/** Bounded interpreter for an explicitly retained authored comparison clause.
 * The term grammar, source locators and result schema are engineering bindings.
 * No natural-language meaning, implicit equality, symmetry or transitivity.
 */
export const AUTHORED_COMPARE_CLAUSE = '∀a,b:a≡b?a⋈b:Δab→L'
export type ComparisonSource = Readonly<{
  recordAddress: string; sourceId: string; revision: number; frameId: string; text: string;
}>
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
  unused: readonly Readonly<{ source: ClauseRef; reason: 'different-frame' | 'unsupported-clause' | 'different-operands' }>[];
  scope: 'direct-retained-symbolic-premises';
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
  if (!term || typeof term !== 'string') return false
  const atom = /^[\p{L}\p{N}_∞]+/u
  let i = 0, expectTerm = true
  const closes: string[] = []
  while (i < term.length) {
    if (expectTerm) {
      if (term[i] === '⟦') { closes.push('⟧'); i++; continue }
      const match = atom.exec(term.slice(i)); if (!match) return false
      i += match[0].length
      if (term[i] === '(') { closes.push(')'); i++; continue }
      expectTerm = false
    } else {
      if (!closes.length || term[i] !== closes.pop()) return false
      i++
    }
  }
  return !expectTerm && closes.length === 0
}
function pointerString(text: string, pointer: string | undefined): string {
  if (pointer === undefined) return text
  let value: unknown
  try { value = JSON.parse(text) } catch { return fail('pointer source is not JSON') }
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
export function readRetainedComparisonClause(sources: readonly ComparisonSource[], ref: ClauseRef): { text: string; frameId: string } {
  const records = sources.filter(s => s.recordAddress === ref.recordAddress && s.sourceId === ref.sourceId && s.revision === ref.revision)
  if (records.length !== 1) return fail('missing or ambiguous source revision')
  const source = records[0]
  const selected = pointerString(source.text, ref.pointer)
  if (!Number.isSafeInteger(ref.start) || !Number.isSafeInteger(ref.end) || ref.start < 0 || ref.end <= ref.start || ref.end > selected.length) return fail('invalid source span')
  const exact = selected.slice(ref.start, ref.end)
  if (exact !== ref.exact) return fail('source span differs from retained clause')
  // A substring in the antecedent of another rule is not a standalone premise.
  const before = selected.slice(0, ref.start).trimEnd(), after = selected.slice(ref.end).trimStart()
  if ((before && !before.endsWith(';')) || (after && !after.startsWith(';'))) return fail('span is not a complete semicolon-delimited clause')
  return { text: exact, frameId: source.frameId }
}
export function parseDirectComparisonPremise(text: string, source: ClauseRef): DirectPremise | null {
  const operators = [...text.matchAll(/[≡≠]/g)]
  if (operators.length !== 1) return null
  const op = operators[0], left = text.slice(0, op.index), right = text.slice(op.index! + 1)
  if (!isComparisonTerm(left) || !isComparisonTerm(right)) return null
  return { relation: op[0] as '≡' | '≠', left, right, source: copyRef(source) }
}
export function evaluateAuthoredComparison(
  sources: readonly ComparisonSource[], rule: ClauseRef,
  premiseRefs: readonly ClauseRef[], query: ComparisonQuery,
): ComparisonResult {
  if (!query.frameId || !isComparisonTerm(query.left) || !isComparisonTerm(query.right)) return fail('query needs an explicit frame and supported exact terms')
  const readRule = readRetainedComparisonClause(sources, rule)
  if (readRule.text !== AUTHORED_COMPARE_CLAUSE) return fail('unsupported comparison rule')
  if (readRule.frameId !== query.frameId) return fail('rule belongs to a different frame')
  const identityWitnesses: DirectPremise[] = [], differenceWitnesses: DirectPremise[] = []
  const unused: { source: ClauseRef; reason: 'different-frame' | 'unsupported-clause' | 'different-operands' }[] = []
  for (const ref of premiseRefs) {
    const retained = readRetainedComparisonClause(sources, ref)
    if (retained.frameId !== query.frameId) { unused.push({ source: copyRef(ref), reason: 'different-frame' }); continue }
    const premise = parseDirectComparisonPremise(retained.text, ref)
    if (!premise) { unused.push({ source: copyRef(ref), reason: 'unsupported-clause' }); continue }
    if (premise.left !== query.left || premise.right !== query.right) { unused.push({ source: copyRef(ref), reason: 'different-operands' }); continue }
    ;(premise.relation === '≡' ? identityWitnesses : differenceWitnesses).push(premise)
  }
  const conflict = identityWitnesses.length > 0 && differenceWitnesses.length > 0
  const status = conflict ? 'unresolved' : identityWitnesses.length ? 'known-identity' : differenceWitnesses.length ? 'known-difference' : 'unresolved'
  const proofs: ComparisonProof[] = conflict ? [] : [...identityWitnesses, ...differenceWitnesses].map(premise => ({
    rule: copyRef(rule), premise, substitution: { a: query.left, b: query.right },
    conclusion: premise.relation === '≡'
      ? { kind: 'relation', operator: '⋈', left: query.left, right: query.right }
      : { kind: 'transition', from: { operator: 'Δ', left: query.left, right: query.right }, to: 'L' },
  }))
  return freeze({ format: 'source-bound-comparison/v1', query: { ...query }, status, conflict,
    identityWitnesses, differenceWitnesses, proofs, unused, scope: 'direct-retained-symbolic-premises' })
}
