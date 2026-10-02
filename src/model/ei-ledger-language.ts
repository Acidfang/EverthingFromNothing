/** Lossless, bounded front end for retained ledger clauses.
 * Recognition is deliberately narrower than retention. Opaque clauses are data;
 * neither compilation nor a symbolic consequence grants execution authority.
 */
import {
  AUTHORED_COMPARE_CLAUSE, AUTHORED_IDENTITY_CLAUSE, createAuthoredComparisonEvaluator,
  isComparisonTerm, parseDirectComparisonPremise, createComparisonSourceStringReader,
  readRetainedComparisonClause,
  type ClauseRef, type ComparisonSource, type ComparisonSourceBinding,
  type ComparisonProgramScope, type ComparisonResult,
} from './source-bound-comparison.ts'

export type EILedgerToken = Readonly<{
  kind: 'identifier' | 'operator' | 'whitespace' | 'opaque';
  /** A token span is not, by itself, an executable clause or premise. */
  source: ClauseRef;
}>
export type EILedgerClause = Readonly<{
  id: string; source: ClauseRef; tokens: readonly EILedgerToken[];
  syntax: Readonly<
    | { kind: 'comparison-rule'; mode: 'identity-or-difference' | 'identity-only' }
    | { kind: 'direct-comparison'; operator: '≡' | '≠'; left: ClauseRef; right: ClauseRef }
    | { kind: 'opaque'; reason: 'unsupported-clause' }
  >;
}>
export type EILedgerDocument = Readonly<{
  /** Undefined selects raw source text; a pointer selects a decoded JSON string. */
  pointer?: string; text: string; tokens: readonly EILedgerToken[];
  clauseIds: readonly string[];
}>
export type EILedgerAst = Readonly<{
  format: 'ei-ledger-ast/v1'; source: ComparisonSource;
  documents: readonly EILedgerDocument[]; clauses: readonly EILedgerClause[];
}>
export type EILedgerLimits = Readonly<{
  maxSources: number; maxSourceUtf16: number; maxSelectedUtf16: number;
  maxClauses: number; maxTokens: number; maxEvaluations: number; maxWork: number;
}>
/** Callers may lower these bounds, never lift them silently. */
export const EI_LEDGER_LIMITS: EILedgerLimits = Object.freeze({
  maxSources: 128, maxSourceUtf16: 2_000_000, maxSelectedUtf16: 250_000,
  maxClauses: 10_000, maxTokens: 100_000, maxEvaluations: 4096, maxWork: 250_000,
})
export type EILedgerQuery = Readonly<{ rule: ClauseRef; left: string; right: string }>
export type EILedgerEvaluation = Readonly<{
  id: string; ruleId: string; result: ComparisonResult;
  dependencies: Readonly<{
    /** Includes whole consulted sources: additions can resolve a missing premise
     * or invalidate a formerly unopposed witness without editing an old proof. */
    sources: readonly ComparisonSourceBinding[];
    clauses: readonly ClauseRef[];
    witnessSet: Readonly<{ kind: 'ordered-direct-premises'; left: string; right: string }>;
  }>;
}>
export type EILedgerCompilation = Readonly<{
  format: 'ei-ledger-compilation/v1'; executionAuthority: false;
  asts: readonly EILedgerAst[]; programScope?: ComparisonProgramScope;
  evaluations: readonly EILedgerEvaluation[];
  opaqueClauses: readonly EILedgerClause[];
  dependencies: readonly Readonly<{ source: ComparisonSourceBinding; evaluationIds: readonly string[] }>[];
}>

function fail(message: string): never { throw new Error(`EI ledger language: ${message}`) }
const parsedAsts = new WeakSet<object>()
function freeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze); Object.freeze(value)
  }
  return value
}
function limitsOf(input: Partial<EILedgerLimits> = {}): EILedgerLimits {
  const limits = { ...EI_LEDGER_LIMITS, ...input }
  for (const key of Object.keys(EI_LEDGER_LIMITS) as (keyof EILedgerLimits)[]) {
    if (!Number.isSafeInteger(limits[key]) || limits[key] < 1 || limits[key] > EI_LEDGER_LIMITS[key]) fail(`invalid ${key} bound`)
  }
  return limits
}
const sourceKey = (s: Pick<ComparisonSource, 'recordAddress' | 'sourceId'>) => JSON.stringify([s.recordAddress, s.sourceId])
const binding = (s: ComparisonSource): ComparisonSourceBinding => ({ recordAddress: s.recordAddress, sourceId: s.sourceId, revision: s.revision, frameId: s.frameId })
export const eiLedgerClauseId = (r: ClauseRef): string => JSON.stringify([r.recordAddress, r.sourceId, r.revision, r.pointer ?? null, r.start, r.end, r.exact])
function span(source: ComparisonSource, text: string, start: number, end: number, pointer?: string): ClauseRef {
  return { recordAddress: source.recordAddress, sourceId: source.sourceId, revision: source.revision,
    ...(pointer === undefined ? {} : { pointer }), start, end, exact: text.slice(start, end) }
}
function sameBinding(a: ComparisonSourceBinding, b: ComparisonSourceBinding): boolean {
  return sourceKey(a) === sourceKey(b) && a.revision === b.revision && a.frameId === b.frameId
}
function provenanceSnapshot(input: ComparisonSource['provenance']): ComparisonSource['provenance'] {
  if (input === undefined) return undefined
  if (!input || typeof input !== 'object' || (Object.getPrototypeOf(input) !== Object.prototype && Object.getPrototypeOf(input) !== null)) fail('invalid source provenance')
  const snapshot: { realm?: string; locator?: string } = {}
  for (const key of Reflect.ownKeys(input)) {
    const descriptor = Object.getOwnPropertyDescriptor(input, key)!
    if ((key !== 'realm' && key !== 'locator') || !('value' in descriptor)
      || (descriptor.value !== undefined && (typeof descriptor.value !== 'string' || descriptor.value.length > 4096))) fail('invalid source provenance')
    snapshot[key] = descriptor.value
  }
  return snapshot
}
function sourceSnapshot(source: ComparisonSource, limits: EILedgerLimits): ComparisonSource {
  assertPlainData(source, limits)
  if (!source.recordAddress || !source.sourceId || !source.frameId || !Number.isSafeInteger(source.revision) || source.revision < 0 || typeof source.text !== 'string') fail('invalid retained source')
  for (const name of [source.recordAddress, source.sourceId, source.frameId]) if (typeof name !== 'string' || name.length > 4096) fail('invalid source identity')
  if (source.text.length > limits.maxSourceUtf16) fail('source UTF-16 bound exceeded')
  const provenance = provenanceSnapshot(source.provenance)
  return { ...binding(source), text: source.text, ...(provenance ? { provenance } : {}) }
}
const operatorCharacters = new Set([...';≡≠→⇒⋈∀?:,()⟦⟧⊥=|¬∈∅+−<>⊂⊃∩∧↛@{}[]\\'])
function lex(source: ComparisonSource, text: string, pointer: string | undefined, limits: EILedgerLimits): EILedgerToken[] {
  const tokens: EILedgerToken[] = []
  let i = 0
  while (i < text.length) {
    if (tokens.length >= limits.maxTokens) fail('token bound exceeded')
    const start = i, char = String.fromCodePoint(text.codePointAt(i)!)
    let kind: EILedgerToken['kind']
    if (/\s/u.test(char)) {
      kind = 'whitespace'; i += char.length
      while (i < text.length && /\s/u.test(text[i])) i++
    } else if (/[\p{L}\p{N}_∞]/u.test(char)) {
      kind = 'identifier'; i += char.length
      while (i < text.length) {
        const next = String.fromCodePoint(text.codePointAt(i)!)
        if (!/[\p{L}\p{N}_∞]/u.test(next)) break
        i += next.length
      }
    } else { kind = operatorCharacters.has(char) ? 'operator' : 'opaque'; i += char.length }
    tokens.push({ kind, source: span(source, text, start, i, pointer) })
  }
  return tokens
}
function syntaxOf(ref: ClauseRef): EILedgerClause['syntax'] {
  if (ref.exact === AUTHORED_COMPARE_CLAUSE) return { kind: 'comparison-rule', mode: 'identity-or-difference' }
  if (ref.exact === AUTHORED_IDENTITY_CLAUSE) return { kind: 'comparison-rule', mode: 'identity-only' }
  const premise = parseDirectComparisonPremise(ref.exact, ref)
  if (!premise) return { kind: 'opaque', reason: 'unsupported-clause' }
  const split = ref.start + premise.left.length
  return { kind: 'direct-comparison', operator: premise.relation,
    left: { ...ref, end: split, exact: premise.left },
    right: { ...ref, start: split + 1, exact: premise.right } }
}

/** Pointers must be supplied by the record adapter. JSON shape, common ledger
 * membership and string resemblance never establish a program scope. */
export function parseEILedgerSource(source: ComparisonSource, options: {
  pointers?: readonly (string | undefined)[]; limits?: Partial<EILedgerLimits>;
} = {}): EILedgerAst {
  const limits = limitsOf(options.limits), retained = sourceSnapshot(source, limits)
  const pointers = options.pointers ?? [undefined]
  if (pointers.length > limits.maxClauses) fail('excessive source selections')
  const selectedPointers = new Set<string | undefined>()
  let selectorUtf16 = 0
  for (const pointer of pointers) {
    if (pointer !== undefined && (typeof pointer !== 'string' || pointer.length > 4096)) fail('invalid or excessive JSON pointer')
    selectorUtf16 += pointer?.length ?? 0
    if (selectorUtf16 > limits.maxSelectedUtf16) fail('selected UTF-16 bound exceeded')
    if (selectedPointers.has(pointer)) fail('duplicate source selection')
    selectedPointers.add(pointer)
  }
  const documents: EILedgerDocument[] = [], clauses: EILedgerClause[] = []
  const readString = createComparisonSourceStringReader(retained.text)
  // Selector text shares the selection budget, including empty-string targets.
  let selectedUtf16 = selectorUtf16, tokenCount = 0
  for (const pointer of pointers) {
    const text = readString(pointer)
    selectedUtf16 += text.length
    if (selectedUtf16 > limits.maxSelectedUtf16) fail('selected UTF-16 bound exceeded')
    const tokens = lex(retained, text, pointer, limits), clauseIds: string[] = []
    tokenCount += tokens.length
    if (tokenCount > limits.maxTokens) fail('token bound exceeded')
    let start = 0, tokenIndex = 0
    for (const piece of text.split(';')) {
      const leading = piece.length - piece.trimStart().length, trailing = piece.length - piece.trimEnd().length
      if (piece.trim()) {
        if (clauses.length >= limits.maxClauses) fail('clause bound exceeded')
        const ref = span(retained, text, start + leading, start + piece.length - trailing, pointer)
        while (tokenIndex < tokens.length && tokens[tokenIndex].source.end <= ref.start) tokenIndex++
        const clauseTokens: EILedgerToken[] = []
        while (tokenIndex < tokens.length && tokens[tokenIndex].source.start < ref.end) clauseTokens.push(tokens[tokenIndex++])
        const id = eiLedgerClauseId(ref)
        clauses.push({ id, source: ref, tokens: clauseTokens, syntax: syntaxOf(ref) }); clauseIds.push(id)
      }
      start += piece.length + 1
    }
    documents.push({ ...(pointer === undefined ? {} : { pointer }), text, tokens, clauseIds })
  }
  const ast = freeze({ format: 'ei-ledger-ast/v1' as const, source: retained, documents, clauses })
  parsedAsts.add(ast)
  return ast
}

/** Reconstitute the selected string from every token, including punctuation,
 * unsupported syntax, whitespace and UTF-16 surrogate pairs. */
export function renderEILedgerDocument(document: EILedgerDocument): string {
  return document.tokens.map(token => token.source.exact).join('')
}

/** Validate deserialized ASTs before compilation. Re-lexing authenticates the
 * retained node structure; evaluation below selects and consumes AST nodes. */
function assertPlainData(input: unknown, limits: EILedgerLimits): void {
  const queue: { value: unknown; depth: number }[] = [{ value: input, depth: 0 }], seen = new Set<object>()
  let visits = 0
  while (queue.length) {
    const { value, depth } = queue.pop()!
    if (++visits > limits.maxTokens * 40 + limits.maxClauses * 40 + 100) fail('AST data bound exceeded')
    if (depth > 20) fail('AST nesting bound exceeded')
    if (value === null || ['undefined', 'string', 'number', 'boolean'].includes(typeof value)) continue
    if (typeof value !== 'object') fail('AST must contain plain data')
    if (seen.has(value)) continue
    seen.add(value)
    const prototype = Object.getPrototypeOf(value)
    if (prototype !== (Array.isArray(value) ? Array.prototype : Object.prototype) && prototype !== null) fail('AST must contain plain data')
    const keys = Reflect.ownKeys(value)
    if (keys.length > limits.maxTokens + limits.maxClauses + 20) fail('AST data bound exceeded')
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key)!
      if (typeof key !== 'string' || !('value' in descriptor)) fail('AST must contain plain data')
      queue.push({ value: descriptor.value, depth: depth + 1 })
    }
  }
}
function equalData(expected: unknown, actual: unknown): boolean {
  if (expected === null || typeof expected !== 'object') return Object.is(expected, actual)
  if (actual === null || typeof actual !== 'object' || Array.isArray(expected) !== Array.isArray(actual)) return false
  const keys = Reflect.ownKeys(expected)
  return keys.length === Reflect.ownKeys(actual).length && keys.every(key => {
    const wanted = Object.getOwnPropertyDescriptor(expected, key)!, given = Object.getOwnPropertyDescriptor(actual, key)
    return !!given && 'value' in given && equalData(wanted.value, given.value)
  })
}
function validateAst(ast: EILedgerAst, limits: EILedgerLimits): EILedgerAst {
  if (!parsedAsts.has(ast)) assertPlainData(ast, limits)
  if (ast.format !== 'ei-ledger-ast/v1' || ast.clauses.length > limits.maxClauses || ast.documents.length > limits.maxClauses) fail('invalid AST or clause bound exceeded')
  sourceSnapshot(ast.source, limits)
  let tokenCount = 0, selectedUtf16 = 0
  for (const document of ast.documents) { tokenCount += document.tokens.length; selectedUtf16 += document.text.length + (document.pointer?.length ?? 0) }
  if (tokenCount > limits.maxTokens || selectedUtf16 > limits.maxSelectedUtf16) fail('AST resource bound exceeded')
  if (parsedAsts.has(ast)) return ast
  const expected = parseEILedgerSource(ast.source, { pointers: ast.documents.map(d => d.pointer), limits })
  // Compare the bounded canonical tree; a forged node kind cannot turn a
  // substring of a conditional into a premise.
  if (!equalData(expected, ast)) fail('AST differs from retained source spans or syntax')
  return expected
}

/** Compile only direct retained witnesses and the two verified rule forms.
 * Without an explicit programScope each rule consults its own source only.
 * With no queries supplied, instantiate only ordered pairs actually witnessed.
 */
export function compileEILedgerProgram(inputAsts: readonly EILedgerAst[], options: {
  programScope?: ComparisonProgramScope; queries?: readonly EILedgerQuery[];
  limits?: Partial<EILedgerLimits>;
} = {}): EILedgerCompilation {
  const limits = limitsOf(options.limits)
  if (inputAsts.length > limits.maxSources) fail('source bound exceeded')
  const asts: EILedgerAst[] = []
  let clauseCount = 0, tokenCount = 0, selectedUtf16 = 0, work = 0
  const spend = (amount = 1) => { work += amount; if (work > limits.maxWork) fail('compiler work bound exceeded') }
  const seen = new Set<string>()
  for (const input of inputAsts) {
    const ast = validateAst(input, limits)
    const key = sourceKey(ast.source)
    if (seen.has(key)) fail('ambiguous source snapshot'); seen.add(key)
    clauseCount += ast.clauses.length
    for (const doc of ast.documents) { tokenCount += doc.tokens.length; selectedUtf16 += doc.text.length + (doc.pointer?.length ?? 0) }
    if (clauseCount > limits.maxClauses || tokenCount > limits.maxTokens || selectedUtf16 > limits.maxSelectedUtf16) fail('aggregate compiler resource bound exceeded')
    asts.push(ast)
  }
  const sources = asts.map(ast => ast.source), clauses = asts.flatMap(ast => ast.clauses)
  const evaluate = createAuthoredComparisonEvaluator(sources)
  if (options.programScope) assertPlainData(options.programScope, limits)
  const scope = options.programScope ? { id: options.programScope.id, sources: options.programScope.sources.map(member => ({ ...member })) } : undefined
  if (scope) {
    if (!scope.id || !scope.sources.length || scope.sources.length > limits.maxSources) fail('invalid program scope')
    const members = new Set<string>()
    for (const member of scope.sources) {
      const key = sourceKey(member)
      if (members.has(key)) fail('ambiguous program source binding'); members.add(key)
      if (sources.filter(source => sameBinding(source, member)).length !== 1) fail('stale or missing program source binding')
    }
  }
  const rules = clauses.filter(clause => clause.syntax.kind === 'comparison-rule')
  const ruleMap = new Map(rules.map(rule => [rule.id, rule]))
  const available = (rule: EILedgerClause) => {
    const own = sources.find(source => sourceKey(source) === sourceKey(rule.source))!
    if (!scope) return [own]
    if (!scope.sources.some(member => sameBinding(member, own))) fail('rule is outside explicit program scope')
    return sources.filter(source => scope.sources.some(member => sameBinding(source, member)))
  }
  const evaluationQueries: EILedgerQuery[] = []
  if (options.queries) {
    if (options.queries.length > limits.maxEvaluations) fail('evaluation bound exceeded')
    evaluationQueries.push(...options.queries)
  } else {
    for (const rule of rules) {
      if (scope && !scope.sources.some(member => sourceKey(member) === sourceKey(rule.source))) continue
      const allowed = new Set(available(rule).map(sourceKey)), pairs = new Set<string>()
      for (const clause of clauses) {
        spend()
        if (!allowed.has(sourceKey(clause.source)) || clause.syntax.kind !== 'direct-comparison') continue
        const left = clause.syntax.left.exact, right = clause.syntax.right.exact, key = JSON.stringify([left, right])
        if (pairs.has(key)) continue
        pairs.add(key)
        if (evaluationQueries.length >= limits.maxEvaluations) fail('evaluation bound exceeded')
        evaluationQueries.push({ rule: rule.source, left, right })
      }
    }
  }
  const evaluations: EILedgerEvaluation[] = [], evaluated = new Set<string>()
  for (const query of evaluationQueries) {
    const rule = ruleMap.get(eiLedgerClauseId(query.rule))
    if (!rule) fail('query rule is missing, stale or unsupported')
    if (!isComparisonTerm(query.left) || !isComparisonTerm(query.right)) fail('query operands are unsupported')
    const consulted = available(rule), allowed = new Set(consulted.map(sourceKey))
    const witnesses: EILedgerClause[] = []
    for (const clause of clauses) {
      spend()
      if (allowed.has(sourceKey(clause.source)) && clause.syntax.kind === 'direct-comparison'
        && clause.syntax.left.exact === query.left && clause.syntax.right.exact === query.right) witnesses.push(clause)
    }
    const id = JSON.stringify([rule.id, scope?.id ?? null, consulted.map(binding), query.left, query.right])
    if (evaluated.has(id)) fail('duplicate evaluation query'); evaluated.add(id)
    const own = sources.find(source => sourceKey(source) === sourceKey(rule.source))!
    const result = evaluate(rule.source, witnesses.map(node => node.source),
      { frameId: own.frameId, left: query.left, right: query.right }, scope)
    evaluations.push({ id, ruleId: rule.id, result, dependencies: {
      sources: consulted.map(binding), clauses: [rule.source, ...witnesses.map(node => node.source)].map(ref => ({ ...ref })),
      witnessSet: { kind: 'ordered-direct-premises', left: query.left, right: query.right },
    } })
  }
  return freeze({ format: 'ei-ledger-compilation/v1', executionAuthority: false,
    asts, ...(scope ? { programScope: { id: scope.id, sources: scope.sources.map(member => ({ ...member })) } } : {}),
    evaluations, opaqueClauses: asts.flatMap(ast => ast.clauses.filter(clause => clause.syntax.kind === 'opaque')),
    dependencies: sources.map(source => ({ source: binding(source), evaluationIds: evaluations.filter(evaluation =>
      evaluation.dependencies.sources.some(member => sameBinding(source, member))).map(evaluation => evaluation.id) })),
  })
}

/** Report which immutable evaluations need fresh compilation against new source
 * snapshots. A fresh parse plus explicit new bindings produces new proofs. */
export function inspectEILedgerDependencies(compiled: EILedgerCompilation, currentSources: readonly ComparisonSource[]) {
  const changes = compiled.asts.flatMap(ast => {
    const expected = ast.source, matches = currentSources.filter(source => sourceKey(source) === sourceKey(expected))
    let sameProvenance = true
    if (matches.length === 1) {
      try {
        const provenance = provenanceSnapshot(matches[0].provenance)
        sameProvenance = provenance?.realm === expected.provenance?.realm && provenance?.locator === expected.provenance?.locator
      } catch { sameProvenance = false }
    }
    const reason = matches.length === 0 ? 'missing-source' : matches.length > 1 ? 'ambiguous-source'
      : matches[0].revision !== expected.revision ? 'changed-revision'
      : matches[0].frameId !== expected.frameId ? 'changed-frame'
      : matches[0].text !== expected.text ? 'changed-source-text'
      : !sameProvenance ? 'changed-provenance' : null
    if (!reason) return []
    const dependency = compiled.dependencies.find(entry => sameBinding(entry.source, expected))!
    return [{ source: binding(expected), reason, evaluationIds: dependency.evaluationIds }]
  })
  return freeze({ status: changes.length ? 'stale' as const : 'current' as const, changes,
    affectedEvaluationIds: [...new Set(changes.flatMap(change => change.evaluationIds))] })
}

/** Explicit clause validation is available to adapters retaining external refs. */
export function readEILedgerClause(ast: EILedgerAst, ref: ClauseRef): EILedgerClause {
  const validated = validateAst(ast, EI_LEDGER_LIMITS)
  readRetainedComparisonClause([validated.source], ref)
  const clause = validated.clauses.find(node => node.id === eiLedgerClauseId(ref))
  if (!clause) return fail('source clause was not selected into this AST')
  return clause
}
