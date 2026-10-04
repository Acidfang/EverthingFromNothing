/** Bounded interpreter for an explicitly retained authored comparison clause.
 * The term grammar, source locators and result schema are engineering bindings.
 * No natural-language meaning, implicit equality, symmetry or transitivity.
 */
export const AUTHORED_COMPARE_CLAUSE = '∀a,b:a≡b?a⋈b:Δab→L'
export const AUTHORED_IDENTITY_CLAUSE = '≡→⋈'
export type ComparisonSource = Readonly<{
  recordAddress: string; sourceId: string; revision: number; frameId: string; text: string;
  provenance?: Readonly<{ realm?: string; locator?: string }>;
}>
/** A caller-supplied binding, never inferred from ledger membership or spelling. */
export type ComparisonSourceBinding = Readonly<Pick<ComparisonSource, 'recordAddress' | 'sourceId' | 'revision' | 'frameId'>>
export type ComparisonProgramScope = Readonly<{ id: string; sources: readonly ComparisonSourceBinding[] }>
export type ClauseRef = Readonly<{
  recordAddress: string; sourceId: string; revision: number;
  /** RFC 6901 pointer into source.text JSON; omitted means source.text itself. */
  pointer?: string;
  /** UTF-16 offsets in the selected string, not semantic binary addresses. */
  start: number; end: number; exact: string;
}>
export type ComparisonQuery = Readonly<{ frameId: string; left: string; right: string }>
export type DirectPremise = Readonly<{ relation: '≡' | '≠'; left: string; right: string; source: ClauseRef }>
export type ComparisonProof = Readonly<{
  rule: ClauseRef; premise: DirectPremise; substitution: Readonly<{ a: string; b: string }>;
  conclusion: Readonly<
    | { kind: 'relation'; operator: '⋈'; left: string; right: string }
    | { kind: 'transition'; from: Readonly<{ operator: 'Δ'; left: string; right: string }>; to: 'L' }
  >;
}>
export type ComparisonResult = Readonly<{
  format: 'source-bound-comparison/v1'; query: ComparisonQuery;
  status: 'known-identity' | 'known-difference' | 'unresolved'; conflict: boolean;
  identityWitnesses: readonly DirectPremise[]; differenceWitnesses: readonly DirectPremise[];
  /** On conflict no consequence is admitted; both witness sets are retained. */
  proofs: readonly ComparisonProof[];
  unused: readonly Readonly<{ source: ClauseRef; reason: 'different-frame' | 'outside-program-scope' | 'unsupported-clause' | 'different-operands' }>[];
  scope: 'direct-retained-symbolic-premises';
  programScope?: ComparisonProgramScope;
}>
function fail(message: string): never { throw new Error(`Source comparison: ${message}`) }
function copyRef(r: ClauseRef): ClauseRef { return { ...r } }
function freeze<T>(x: T): T {
  if (x && typeof x === 'object' && !Object.isFrozen(x)) { Object.values(x).forEach(freeze); Object.freeze(x) }
  return x
}
/** Small syntax adapter: Unicode identifiers, unary application and ⟦term⟧.
 * Excludes conditionals, chains, infix composition, prose and guessed meanings.
 */
export function isComparisonTerm(term: string): boolean {
  if (!term || typeof term !== 'string' || term.length > 4096) return false
  const atom = /^[\p{L}\p{N}_∞]+/u
  let i = 0, expectTerm = true
  const closes: string[] = []
  while (i < term.length) {
    if (expectTerm) {
      if (term[i] === '⟦') { if (closes.length >= 64) return false; closes.push('⟧'); i++; continue }
      const match = atom.exec(term.slice(i))
      if (match) i += match[0].length
      else if (term[i] === '?' || term[i] === '⊥') i++
      else return false
      if (term[i] === '(') { if (closes.length >= 64) return false; closes.push(')'); i++; continue }
      expectTerm = false
    } else {
      if (!closes.length || term[i] !== closes.pop()) return false
      i++
    }
  }
  return !expectTerm && closes.length === 0
}
/** Decode a retained JSON source at most once across all selected pointers. */
export function createComparisonSourceStringReader(text: string): (pointer?: string) => string {
 let decoded: unknown, parsed = false
 return (pointer?: string) => {
  if (pointer === undefined) return text
  if (typeof pointer !== 'string' || pointer.length > 4096) return fail('invalid or excessive JSON pointer')
  if (!parsed) {
    try { decoded = JSON.parse(text); parsed = true } catch { return fail('pointer source is not JSON') }
  }
  let value = decoded
  if (pointer !== '') {
    if (!pointer.startsWith('/')) return fail('invalid JSON pointer')
    for (const encoded of pointer.slice(1).split('/')) {
      if (/~(?:[^01]|$)/.test(encoded)) return fail('invalid pointer escape')
      const key = encoded.replace(/~1/g, '/').replace(/~0/g, '~')
      if (!value || typeof value !== 'object' || !Object.hasOwn(value, key)) return fail('missing pointer target')
      if (Array.isArray(value) && !/^(0|[1-9][0-9]*)$/.test(key)) return fail('invalid array pointer')
      value = (value as Record<string, unknown>)[key]
    }
  }
  if (typeof value !== 'string') return fail('pointer target is not a source string')
  return value
 }
}
export function readComparisonSourceString(text: string, pointer: string | undefined): string {
  return createComparisonSourceStringReader(text)(pointer)
}
function createClauseReader(sources: readonly ComparisonSource[]) {
 const readers = new Map(sources.map(source => [source, createComparisonSourceStringReader(source.text)]))
 return (ref: ClauseRef): { text: string; frameId: string } => {
  const records = sources.filter(s => s.recordAddress === ref.recordAddress && s.sourceId === ref.sourceId && s.revision === ref.revision)
  if (records.length !== 1) return fail('missing or ambiguous source revision')
  const source = records[0]
  const selected = readers.get(source)!(ref.pointer)
  if (!Number.isSafeInteger(ref.start) || !Number.isSafeInteger(ref.end) || ref.start < 0 || ref.end <= ref.start || ref.end > selected.length) return fail('invalid source span')
  const exact = selected.slice(ref.start, ref.end)
  if (exact !== ref.exact) return fail('source span differs from retained clause')
  // A substring in the antecedent of another rule is not a standalone premise.
  const before = selected.slice(0, ref.start).trimEnd(), after = selected.slice(ref.end).trimStart()
  if ((before && !before.endsWith(';')) || (after && !after.startsWith(';'))) return fail('span is not a complete semicolon-delimited clause')
  return { text: exact, frameId: source.frameId }
 }
}
export function readRetainedComparisonClause(sources: readonly ComparisonSource[], ref: ClauseRef): { text: string; frameId: string } {
  return createClauseReader(sources)(ref)
}
export function parseDirectComparisonPremise(text: string, source: ClauseRef): DirectPremise | null {
  const operators = [...text.matchAll(/[≡≠]/g)]
  if (operators.length !== 1) return null
  const op = operators[0], left = text.slice(0, op.index), right = text.slice(op.index! + 1)
  if (!isComparisonTerm(left) || !isComparisonTerm(right)) return null
  return { relation: op[0] as '≡' | '≠', left, right, source: copyRef(source) }
}
/** Shared retained-source readers for a bounded batch. The snapshot prevents
 * later caller mutation from altering already selected source revisions. */
export function createAuthoredComparisonEvaluator(inputSources: readonly ComparisonSource[]) {
 const sources = inputSources.map(source => ({ ...source, ...(source.provenance ? { provenance: { ...source.provenance } } : {}) }))
 const readClause = createClauseReader(sources)
 return (rule: ClauseRef,
  premiseRefs: readonly ClauseRef[], query: ComparisonQuery, programScope?: ComparisonProgramScope,
 ): ComparisonResult => {
  if (!query.frameId || !isComparisonTerm(query.left) || !isComparisonTerm(query.right)) return fail('query needs an explicit frame and supported exact terms')
  const readRule = readClause(rule)
  if (readRule.text !== AUTHORED_COMPARE_CLAUSE && readRule.text !== AUTHORED_IDENTITY_CLAUSE) return fail('unsupported comparison rule')
  if (readRule.frameId !== query.frameId) return fail('rule belongs to a different frame')
  const inScope = (ref: ClauseRef, frameId: string) => programScope?.sources.some(s => s.recordAddress === ref.recordAddress && s.sourceId === ref.sourceId && s.revision === ref.revision && s.frameId === frameId)
  if (programScope) {
    if (!programScope.id || !programScope.sources.length || programScope.sources.length > 128) return fail('invalid explicit program scope')
    const keys = new Set<string>()
    for (const binding of programScope.sources) {
      const key = JSON.stringify([binding.recordAddress, binding.sourceId])
      if (keys.has(key)) return fail('ambiguous program source binding')
      keys.add(key)
      if (sources.filter(s => s.recordAddress === binding.recordAddress && s.sourceId === binding.sourceId && s.revision === binding.revision && s.frameId === binding.frameId).length !== 1) return fail('stale or ambiguous program source binding')
    }
    if (!inScope(rule, readRule.frameId)) return fail('rule is outside explicit program scope')
  }
  const identityWitnesses: DirectPremise[] = [], differenceWitnesses: DirectPremise[] = []
  const unused: ComparisonResult['unused'][number][] = []
  for (const ref of premiseRefs) {
    const retained = readClause(ref)
    if (programScope ? !inScope(ref, retained.frameId) : ref.recordAddress !== rule.recordAddress || ref.sourceId !== rule.sourceId || ref.revision !== rule.revision) {
      unused.push({ source: copyRef(ref), reason: retained.frameId !== query.frameId && !programScope ? 'different-frame' : 'outside-program-scope' }); continue
    }
    if (!programScope && retained.frameId !== query.frameId) { unused.push({ source: copyRef(ref), reason: 'different-frame' }); continue }
    const premise = parseDirectComparisonPremise(retained.text, ref)
    if (!premise) { unused.push({ source: copyRef(ref), reason: 'unsupported-clause' }); continue }
    if (premise.left !== query.left || premise.right !== query.right) { unused.push({ source: copyRef(ref), reason: 'different-operands' }); continue }
    ;(premise.relation === '≡' ? identityWitnesses : differenceWitnesses).push(premise)
  }
  const conflict = identityWitnesses.length > 0 && differenceWitnesses.length > 0
  const status = conflict ? 'unresolved' : identityWitnesses.length ? 'known-identity' : differenceWitnesses.length ? 'known-difference' : 'unresolved'
  const proofWitnesses = readRule.text === AUTHORED_IDENTITY_CLAUSE ? identityWitnesses : [...identityWitnesses, ...differenceWitnesses]
  const proofs: ComparisonProof[] = conflict ? [] : proofWitnesses.map(premise => ({
    rule: copyRef(rule), premise, substitution: { a: query.left, b: query.right },
    conclusion: premise.relation === '≡'
      ? { kind: 'relation', operator: '⋈', left: query.left, right: query.right }
      : { kind: 'transition', from: { operator: 'Δ', left: query.left, right: query.right }, to: 'L' },
  }))
  return freeze({ format: 'source-bound-comparison/v1', query: { ...query }, status, conflict,
    identityWitnesses, differenceWitnesses, proofs, unused, scope: 'direct-retained-symbolic-premises',
    ...(programScope ? { programScope: { id: programScope.id, sources: programScope.sources.map(s => ({ ...s })) } } : {}) })
 }
}
export function evaluateAuthoredComparison(
  sources: readonly ComparisonSource[], rule: ClauseRef,
  premiseRefs: readonly ClauseRef[], query: ComparisonQuery, programScope?: ComparisonProgramScope,
): ComparisonResult {
  return createAuthoredComparisonEvaluator(sources)(rule, premiseRefs, query, programScope)
}
