/** Finite derivations over captured EI records. Operator names have no implied semantics. */
import { EI_LIMITS, exportEILedger, type EILedger, type EIRecord, type EISource, type EIValueState } from './ei-engine.ts'

export const EI_QUERY_GRAMMAR = Object.freeze([
  'read "address" [is|was]',
  'compare "left address" with "right address"',
  'from "address" follow "relation" [then "relation" ...] [where value is "exact text"]',
  'filter "address" [, "address" ...] where value is "exact text"',
  'trace "address"',
  'context "address"',
])
export const EI_REASONER_LIMITS = Object.freeze({ relations: 32, paths: 128, incidentRelations: 256, rootPaths: 64, proofSteps: 2048, ancestrySteps: 2048, outputLength: 8192 })
export type EIQuery = Readonly<
  | { kind: 'read'; address: string; state?: 'is' | 'was' }
  | { kind: 'compare'; left: string; right: string }
  | { kind: 'follow'; address: string; relations: readonly string[]; where?: Readonly<{ equals: string }> }
  | { kind: 'filter'; addresses: readonly string[]; equals: string }
  | { kind: 'trace'; address: string }
  | { kind: 'context'; address: string }
>
export type EIQueryParseResult = Readonly<{ status: 'parsed'; query: EIQuery } | { status: 'unresolved'; reason: string; grammar: readonly string[] }>
export type EIQueryEdge = Readonly<{ from: string; relation: string; to: string; relationIndex: number }>
export type EIQueryPath = Readonly<{ start: string; edges: readonly EIQueryEdge[] }>
export type EIQueryGap = Readonly<{ kind: 'no-captured-edge'; address: string; relation: string; path: EIQueryPath }>
export type EIQueryContext = Readonly<{
  address: string; kind: 'retained-incident-relations';
  incident: readonly Readonly<{ role: 'incoming' | 'outgoing' | 'self'; edge: EIQueryEdge; sourcePremise: string | null; targetPremise: string | null; sourceRealm: string | null; targetRealm: string | null }>[];
  parentLinks: readonly Readonly<{ role: 'parent' | 'child'; child: string; parent: string; childPremise: string | null; parentPremise: string | null }>[];
}>
export type EIQueryUnknown = Readonly<{ kind: 'missing-address' | 'missing-relation' | 'missing-history' | 'missing-receipt' | 'broken-receipt-return' | 'limit'; address: string; reason: string; path?: EIQueryPath }>
export type EIQueryReceiptPath = Readonly<{
  receiptId: string; transactionId: string; producer: string; resultRevision: number;
  scope: string; inputSource: EISource; patchSource: EISource; returnedToProducer: boolean;
}>
export type EIQueryPremise = Readonly<{
  id: string; address: string; state: 'is' | 'was'; revision: number; value: string; source: EISource;
  sourceStateFingerprint: string; sourceBinding: 'captured-seed' | 'committed-local-receipt' | 'unresolved';
  parents: readonly string[]; relations: EIRecord['relations']; rootPaths: readonly (readonly string[])[];
  valueReceiptPaths: readonly EIQueryReceiptPath[]; returnedReceiptIds: readonly string[];
}>
export type EIQueryProofStep = Readonly<
  | { op: 'FIND_ADDRESS'; address: string; found: boolean }
  | { op: 'READ_SOURCE'; premise: string; sourceId: string; revision: number }
  | { op: 'FOLLOW_RELATION'; edge: EIQueryEdge }
  | { op: 'CONTEXT_RELATION'; role: 'incoming' | 'outgoing' | 'self'; edge: EIQueryEdge }
  | { op: 'CONTEXT_PARENT'; child: string; parent: string }
  | { op: 'FILTER'; premise: string; expected: string; actual: string; matches: boolean }
  | { op: 'SEE_DIFFERENCE'; leftPremise: string; rightPremise: string; equal: boolean }
>
export type EIQueryMatch = Readonly<{ address: string; value: string; revision: number; state: 'is' | 'was'; premise: string; path: EIQueryPath }>
export type EIQueryComparison = Readonly<{ left: string; right: string; leftValue: string | null; rightValue: string | null; result: 'equal' | 'different' | 'unknown' }>
export type EIQueryOrigin = Readonly<{ ledgerRevision: number; sourceStateFingerprint: string; queryFingerprint: string }>
export type EIQueryAnswer = Readonly<{
  format: 'ei-query-answer/v1'; query: EIQuery; origin: EIQueryOrigin; scope: 'captured-local-records';
  status: 'resolved' | 'open' | 'unresolved' | 'empty'; matches: readonly EIQueryMatch[];
  comparison: EIQueryComparison | null; context: EIQueryContext | null; premises: readonly EIQueryPremise[];
  proof: readonly EIQueryProofStep[]; gaps: readonly EIQueryGap[]; unknowns: readonly EIQueryUnknown[]; sourceRefs: readonly string[];
}>
export type EIQueryCheck = Readonly<{ kind: string; subject: string; matches: boolean; expected: unknown; actual: unknown }>
export type EIQueryVerification = Readonly<{
  format: 'ei-query-verification/v1'; scope: 'retained-local-relation-consistency';
  status: 'passed' | 'failed' | 'unresolved'; origin: EIQueryOrigin; checks: readonly EIQueryCheck[]; note: string;
}>

function freeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.values(value).forEach(freeze); Object.freeze(value) }
  return value
}
function fail(message: string): never { throw new Error(`EI query: ${message}`) }
function plain(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) fail('expected a plain query object')
  return value as Record<string, unknown>
}
function fields(value: Record<string, unknown>, allowed: string[]): void { for (const key of Object.keys(value)) if (!allowed.includes(key)) fail(`unexpected query field ${key}`) }
function text(value: unknown, identifier = true): string {
  if (typeof value !== 'string' || value.length > (identifier ? EI_LIMITS.idLength : EI_LIMITS.textLength) || (identifier && !value.trim())) fail('invalid or excessive quoted text')
  return value as string
}
function validateQuery(value: unknown): EIQuery {
  const q = plain(value)
  if (q.kind === 'read') {
    fields(q, ['kind', 'address', 'state'])
    if (q.state !== undefined && q.state !== 'is' && q.state !== 'was') fail('state must be is or was')
    return freeze({ kind: 'read', address: text(q.address), state: q.state ?? 'is' }) as EIQuery
  }
  if (q.kind === 'trace' || q.kind === 'context') { fields(q, ['kind', 'address']); return freeze({ kind: q.kind, address: text(q.address) }) }
  if (q.kind === 'compare') { fields(q, ['kind', 'left', 'right']); return freeze({ kind: 'compare', left: text(q.left), right: text(q.right) }) }
  if (q.kind === 'follow') {
    fields(q, ['kind', 'address', 'relations', 'where'])
    if (!Array.isArray(q.relations) || !q.relations.length || q.relations.length > EI_REASONER_LIMITS.relations) fail('relation sequence must contain 1–32 exact labels')
    let where: { equals: string } | undefined
    if (q.where !== undefined) { const w = plain(q.where); fields(w, ['equals']); where = { equals: text(w.equals, false) } }
    return freeze({ kind: 'follow', address: text(q.address), relations: q.relations.map(r => text(r)), ...(where ? { where } : {}) })
  }
  if (q.kind === 'filter') {
    fields(q, ['kind', 'addresses', 'equals'])
    if (!Array.isArray(q.addresses) || !q.addresses.length || q.addresses.length > EI_LIMITS.records) fail('filter requires 1–256 supplied addresses')
    return freeze({ kind: 'filter', addresses: q.addresses.map(a => text(a)), equals: text(q.equals, false) })
  }
  return fail('no declared operation matches this query')
}

/** Only this declared grammar is parsed. Quotes use JSON string escaping; keywords are lowercase. */
export function parseEIQuery(raw: string): EIQueryParseResult {
  try {
    if (typeof raw !== 'string' || new TextEncoder().encode(raw).length > EI_LIMITS.inputBytes) fail('query text is excessive')
    const tokens: { kind: 'quoted' | 'word' | 'comma'; value: string }[] = []
    let rest = raw.trim()
    while (rest) {
      if (tokens.length >= 1024) fail('query has too many tokens')
      const quoted = /^"(?:[^"\\\u0000-\u001f]|\\(?:["\\/bfnrt]|u[0-9a-fA-F]{4}))*"/.exec(rest)
      const word = /^[a-z]+/.exec(rest)
      if (quoted) { tokens.push({ kind: 'quoted', value: JSON.parse(quoted[0]) }); rest = rest.slice(quoted[0].length).trimStart() }
      else if (word) { tokens.push({ kind: 'word', value: word[0] }); rest = rest.slice(word[0].length).trimStart() }
      else if (rest[0] === ',') { tokens.push({ kind: 'comma', value: ',' }); rest = rest.slice(1).trimStart() }
      else fail('input is outside the declared quoted query grammar')
    }
    let position = 0
    const is = (word: string): boolean => tokens[position]?.kind === 'word' && tokens[position].value === word
    const take = (word: string): void => { if (!is(word)) fail(`expected ${word}`); position++ }
    const quote = (): string => { const token = tokens[position++]; if (token?.kind !== 'quoted') fail('an exact JSON-quoted identifier or value is required'); return token.value }
    const where = (): { equals: string } => { take('where'); take('value'); take('is'); return { equals: quote() } }
    let query: EIQuery
    if (is('read')) { take('read'); const address = quote(); let state: 'is' | 'was' = 'is'; if (is('was')) { take('was'); state = 'was' } else if (is('is')) take('is'); query = { kind: 'read', address, state } }
    else if (is('trace')) { take('trace'); query = { kind: 'trace', address: quote() } }
    else if (is('context')) { take('context'); query = { kind: 'context', address: quote() } }
    else if (is('compare')) { take('compare'); const left = quote(); take('with'); query = { kind: 'compare', left, right: quote() } }
    else if (is('from')) {
      take('from'); const address = quote(); take('follow'); const relations = [quote()]
      while (is('then')) { take('then'); relations.push(quote()) }
      query = { kind: 'follow', address, relations, ...(is('where') ? { where: where() } : {}) }
    } else if (is('filter')) {
      take('filter'); const addresses = [quote()]
      while (tokens[position]?.kind === 'comma') { position++; addresses.push(quote()) }
      query = { kind: 'filter', addresses, equals: where().equals }
    } else return fail('no declared operation matches this text; its meaning remains open')
    if (position !== tokens.length) fail('unexpected trailing text; no partial query was executed')
    return freeze({ status: 'parsed', query: validateQuery(query) })
  } catch (error) { return freeze({ status: 'unresolved', reason: error instanceof Error ? error.message : 'Unresolved query', grammar: EI_QUERY_GRAMMAR }) }
}

async function fingerprint(value: unknown): Promise<string> {
  const encoded = new TextEncoder().encode(typeof value === 'string' ? value : JSON.stringify(value))
  const digest = await globalThis.crypto.subtle.digest('SHA-256', encoded)
  return `sha256:${Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')}`
}
function equal(a: unknown, b: unknown): boolean { try { return JSON.stringify(a) === JSON.stringify(b) } catch { return false } }

/** Read-only interpretation. Relations are followed only in the supplied order and direction. */
export async function evaluateEIQuery(ledger: EILedger, input: EIQuery): Promise<EIQueryAnswer> {
  const snapshot = exportEILedger(ledger), query = validateQuery(input)
  const byAddress = new Map(ledger.records.map(record => [record.address, record]))
  const proof: EIQueryProofStep[] = [], unknowns: EIQueryUnknown[] = [], matches: EIQueryMatch[] = [], gaps: EIQueryGap[] = []
  const premises: Omit<EIQueryPremise, 'sourceStateFingerprint'>[] = []
  const premiseByState = new Map<EIValueState, Omit<EIQueryPremise, 'sourceStateFingerprint'>>()
  const rootsByAddress = new Map<string, string[][]>()
  let comparison: EIQueryComparison | null = null, context: EIQueryContext | null = null, limited = false, matchesLimited = false, ancestry = 0
  function unknown(kind: EIQueryUnknown['kind'], address: string, reason: string, path?: EIQueryPath): void {
    unknowns.push({ kind, address, reason, ...(path ? { path } : {}) })
  }
  function step(item: EIQueryProofStep): boolean {
    if (proof.length >= EI_REASONER_LIMITS.proofSteps) { if (!limited) unknown('limit', '', 'Proof-step bound reached; omitted branches remain open'); limited = true; return false }
    proof.push(item); return true
  }
  function find(address: string, path?: EIQueryPath): EIRecord | undefined {
    const record = byAddress.get(address)
    if (!step({ op: 'FIND_ADDRESS', address, found: !!record })) return undefined
    if (!record) unknown('missing-address', address, 'No captured record exists at this exact address', path)
    return record
  }
  function rootPaths(address: string): string[][] {
    const known = rootsByAddress.get(address); if (known) return known
    const paths: string[][] = [], pending = [[address]]
    while (pending.length) {
      if (++ancestry > EI_REASONER_LIMITS.ancestrySteps || paths.length >= EI_REASONER_LIMITS.rootPaths) { unknown('limit', address, 'Parent-path bound reached; remaining ancestry is open'); break }
      const path = pending.pop()!, record = byAddress.get(path.at(-1)!)
      if (!record) { unknown('missing-address', path.at(-1)!, 'An explicit parent has no captured record'); continue }
      if (!record.parents.length) { paths.push([...path].reverse()); continue }
      for (let i = record.parents.length - 1; i >= 0; i--) {
        const parent = record.parents[i]
        if (path.includes(parent)) { unknown('limit', parent, 'Cyclic parent path cannot establish a root'); continue }
        if (pending.length >= EI_REASONER_LIMITS.ancestrySteps) { unknown('limit', address, 'Pending parent-path bound reached; omitted ancestry remains open'); break }
        pending.push([...path, parent])
      }
    }
    rootsByAddress.set(address, paths); return paths
  }
  function premise(record: EIRecord, value: EIValueState, state: 'is' | 'was'): Omit<EIQueryPremise, 'sourceStateFingerprint'> {
    const cached = premiseByState.get(value); if (cached) return cached
    const valueReceiptPaths: EIQueryReceiptPath[] = []
    for (const receipt of ledger.receipts) {
      if (receipt.status !== 'committed' || receipt.resultRevision !== value.revision) continue
      for (const patch of receipt.patches) if (patch.address === record.address && patch.value === value.value && equal(patch.source, value.source)) {
        const returnedToProducer = !!byAddress.get(receipt.producer)?.receiptIds.includes(receipt.id)
        valueReceiptPaths.push({ receiptId: receipt.id, transactionId: receipt.transactionId, producer: receipt.producer, resultRevision: receipt.resultRevision, scope: receipt.scope, inputSource: receipt.source, patchSource: patch.source, returnedToProducer })
        if (!returnedToProducer) unknown('broken-receipt-return', record.address, `Receipt ${receipt.id} is not retained by its producing address`)
      }
    }
    const sourceBinding = value.revision === 0 ? 'captured-seed' : valueReceiptPaths.length && valueReceiptPaths.every(path => path.returnedToProducer) ? 'committed-local-receipt' : 'unresolved'
    if (sourceBinding === 'unresolved') unknown('missing-receipt', record.address, 'This value has no complete source-to-patch-to-producer receipt path')
    const item = { id: `premise:${premises.length + 1}`, address: record.address, state, revision: value.revision, value: value.value, source: value.source, sourceBinding, parents: record.parents, relations: record.relations, rootPaths: rootPaths(record.address), valueReceiptPaths, returnedReceiptIds: record.receiptIds } as Omit<EIQueryPremise, 'sourceStateFingerprint'>
    premiseByState.set(value, item); premises.push(item)
    step({ op: 'READ_SOURCE', premise: item.id, sourceId: item.source.id, revision: item.revision })
    return item
  }
  function match(record: EIRecord, path: EIQueryPath, value = record.is, state: 'is' | 'was' = 'is', equals?: string): void {
    if (matches.length >= EI_REASONER_LIMITS.paths) { if (!matchesLimited) unknown('limit', record.address, 'Result bound reached; remaining matching values stay open'); matchesLimited = true; return }
    const p = premise(record, value, state)
    if (equals !== undefined) {
      if (!step({ op: 'FILTER', premise: p.id, expected: equals, actual: p.value, matches: p.value === equals })) return
      if (p.value !== equals) return
    }
    matches.push({ address: record.address, value: value.value, revision: value.revision, state, premise: p.id, path })
  }

  if (query.kind === 'context') {
    const record = find(query.address)
    if (record) match(record, { start: record.address, edges: [] })
    const incident: EIQueryContext['incident'][number][] = [], parentLinks: EIQueryContext['parentLinks'][number][] = []
    function endpoint(address: string): Omit<EIQueryPremise, 'sourceStateFingerprint'> | null {
      const found = find(address)
      return found ? premise(found, found.is, 'is') : null
    }
    relations: for (const source of ledger.records) for (let relationIndex = 0; relationIndex < source.relations.length; relationIndex++) {
      const relation = source.relations[relationIndex]
      if (source.address !== query.address && relation.address !== query.address) continue
      if (incident.length >= EI_REASONER_LIMITS.incidentRelations) { unknown('limit', query.address, 'Incident-relation bound reached; the remaining context stays open'); break relations }
      const edge = { from: source.address, relation: relation.relation, to: relation.address, relationIndex }
      const role = edge.from === query.address && edge.to === query.address ? 'self' : edge.from === query.address ? 'outgoing' : 'incoming'
      if (!step({ op: 'CONTEXT_RELATION', role, edge })) break relations
      const from = endpoint(edge.from), to = endpoint(edge.to)
      incident.push({ role, edge, sourcePremise: from?.id ?? null, targetPremise: to?.id ?? null, sourceRealm: from?.source.realm ?? null, targetRealm: to?.source.realm ?? null })
    }
    parents: for (const child of ledger.records) for (const parent of child.parents) {
      if (child.address !== query.address && parent !== query.address) continue
      if (parentLinks.length >= EI_REASONER_LIMITS.incidentRelations) { unknown('limit', query.address, 'Explicit parent-link bound reached; the remaining context stays open'); break parents }
      if (!step({ op: 'CONTEXT_PARENT', child: child.address, parent })) break parents
      const c = endpoint(child.address), p = endpoint(parent)
      parentLinks.push({ role: child.address === query.address ? 'parent' : 'child', child: child.address, parent, childPremise: c?.id ?? null, parentPremise: p?.id ?? null })
    }
    context = { address: query.address, kind: 'retained-incident-relations', incident, parentLinks }
  } else if (query.kind === 'read' || query.kind === 'trace') {
    const record = find(query.address), path = { start: query.address, edges: [] }
    if (record && query.kind === 'read' && query.state === 'was') {
      if (!record.was.length) unknown('missing-history', record.address, 'No earlier value is retained at this address')
      for (const value of record.was) match(record, path, value, 'was')
    } else if (record) match(record, path)
  } else if (query.kind === 'compare') {
    const left = find(query.left), right = find(query.right)
    if (left) match(left, { start: left.address, edges: [] })
    if (right) match(right, { start: right.address, edges: [] })
    comparison = { left: query.left, right: query.right, leftValue: left?.is.value ?? null, rightValue: right?.is.value ?? null, result: !left || !right ? 'unknown' : left.is.value === right.is.value ? 'equal' : 'different' }
    if (left && right) step({ op: 'SEE_DIFFERENCE', leftPremise: premise(left, left.is, 'is').id, rightPremise: premise(right, right.is, 'is').id, equal: left.is.value === right.is.value })
  } else if (query.kind === 'filter') {
    for (const address of query.addresses) { const record = find(address); if (record) match(record, { start: address, edges: [] }, record.is, 'is', query.equals) }
  } else {
    const first = find(query.address)
    let frontier: { record: EIRecord; path: EIQueryPath }[] = first ? [{ record: first, path: { start: first.address, edges: [] } }] : []
    if (first) premise(first, first.is, 'is')
    for (const relation of query.relations) {
      const next: typeof frontier = []
      branches: for (const current of frontier) {
        const edges = current.record.relations.flatMap((item, relationIndex) => item.relation === relation ? [{ from: current.record.address, relation, to: item.address, relationIndex }] : [])
        if (!edges.length) gaps.push({ kind: 'no-captured-edge', address: current.record.address, relation, path: current.path })
        for (const edge of edges) {
          if (next.length >= EI_REASONER_LIMITS.paths) { unknown('limit', current.record.address, 'Relation-path bound reached; remaining choices are open', current.path); break branches }
          if (!step({ op: 'FOLLOW_RELATION', edge })) break branches
          const path = { start: current.path.start, edges: [...current.path.edges, edge] }, target = find(edge.to, path)
          if (target) { premise(target, target.is, 'is'); next.push({ record: target, path }) }
        }
      }
      frontier = next
      if (limited) { frontier = []; break }
    }
    for (const { record, path } of frontier) match(record, path, record.is, 'is', query.where?.equals)
  }

  const origin = { ledgerRevision: ledger.revision, sourceStateFingerprint: await fingerprint(snapshot), queryFingerprint: await fingerprint(query) }
  const sourcedPremises = await Promise.all(premises.map(async p => ({ ...p, sourceStateFingerprint: await fingerprint({ address: p.address, state: p.state, revision: p.revision, value: p.value, source: p.source, parents: p.parents, relations: p.relations }) })))
  const status = unknowns.length ? (matches.length ? 'open' : 'unresolved') : (query.kind === 'follow' || query.kind === 'filter') && matches.length > 1 ? 'open' : matches.length || comparison ? 'resolved' : 'empty'
  return freeze({ format: 'ei-query-answer/v1', query, origin, scope: 'captured-local-records', status, matches, comparison, context, premises: sourcedPremises, proof, gaps, unknowns, sourceRefs: [...new Set(premises.map(p => p.address))] })
}

/** Recompute once from retained inputs. A passed check proves internal consistency only. */
export async function verifyEIQueryAnswer(ledger: EILedger, query: EIQuery, answer: unknown): Promise<EIQueryVerification> {
  const expected = await evaluateEIQuery(ledger, query)
  const actual = answer && typeof answer === 'object' && !Array.isArray(answer) ? answer as Record<string, unknown> : {}
  const checks: EIQueryCheck[] = []
  const check = (kind: string, subject: string, wanted: unknown, got: unknown): void => { checks.push({ kind, subject, matches: equal(wanted, got), expected: wanted ?? null, actual: got ?? null }) }
  const origin = actual.origin && typeof actual.origin === 'object' ? actual.origin as Record<string, unknown> : {}
  check('origin-revision', 'ledger revision', expected.origin.ledgerRevision, origin.ledgerRevision)
  check('origin-source-state', 'retained source snapshot SHA-256', expected.origin.sourceStateFingerprint, origin.sourceStateFingerprint)
  check('origin-query', 'normalized query SHA-256', expected.origin.queryFingerprint, origin.queryFingerprint)
  check('query', 'declared query', expected.query, actual.query)
  const actualPremises = Array.isArray(actual.premises) ? actual.premises : []
  check('premise-count', 'addressed premises', expected.premises.length, actualPremises.length)
  for (let i = 0; i < expected.premises.length; i++) {
    const p = expected.premises[i], supplied = actualPremises[i] && typeof actualPremises[i] === 'object' ? actualPremises[i] as Record<string, unknown> : {}
    check('source-revision', p.address, { revision: p.revision, sourceStateFingerprint: p.sourceStateFingerprint, source: p.source }, { revision: supplied.revision, sourceStateFingerprint: supplied.sourceStateFingerprint, source: supplied.source })
    check('parent-paths', p.address, p.rootPaths, supplied.rootPaths)
    check('receipt-paths', p.address, { valueReceiptPaths: p.valueReceiptPaths, returnedReceiptIds: p.returnedReceiptIds }, { valueReceiptPaths: supplied.valueReceiptPaths, returnedReceiptIds: supplied.returnedReceiptIds })
    check('premise', p.id, p, supplied)
  }
  const actualProof = Array.isArray(actual.proof) ? actual.proof : []
  check('proof-count', 'proof steps', expected.proof.length, actualProof.length)
  expected.proof.forEach((step, index) => check(step.op === 'FOLLOW_RELATION' || step.op === 'CONTEXT_RELATION' ? 'edge' : 'proof-step', `step ${index + 1}`, step, actualProof[index]))
  check('source-refs', 'existing addressed source references', expected.sourceRefs, actual.sourceRefs)
  check('incident-context', 'all captured incident relations and explicit parent links', expected.context, actual.context)
  check('result', 'expected and returned derivation', { status: expected.status, matches: expected.matches, comparison: expected.comparison, gaps: expected.gaps, unknowns: expected.unknowns }, { status: actual.status, matches: actual.matches, comparison: actual.comparison, gaps: actual.gaps, unknowns: actual.unknowns })
  check('answer-shape', 'complete bounded answer', expected, actual)
  const status = checks.some(c => !c.matches) ? 'failed' : expected.unknowns.length ? 'unresolved' : 'passed'
  // Keep mismatch evidence reviewable without repeatedly embedding full source
  // text or earlier conversation proofs in a later conversation receipt.
  async function compact(value: unknown): Promise<unknown> {
    let encoded: string | undefined
    try { encoded = JSON.stringify(value) } catch { return { invalid: 'non-JSON evidence' } }
    return encoded && encoded.length > 512 ? { fingerprint: await fingerprint(encoded), jsonCodeUnits: encoded.length } : value
  }
  const compactChecks = await Promise.all(checks.map(async c => ({ ...c, expected: await compact(c.expected), actual: await compact(c.actual) })))
  return freeze({ format: 'ei-query-verification/v1', scope: 'retained-local-relation-consistency', status, origin: expected.origin, checks: compactChecks, note: 'Checks concern internal derivation from retained local records only. Captured source authenticity, operator meaning, and external-world truth are not established.' })
}

export function formatEIQueryAnswer(answer: EIQueryAnswer): string {
  const lines = [`Local relation result: ${answer.status}`]
  if (answer.context) {
    lines.push('Relation-context reconstruction from retained edges; free-language meaning remains open.')
    for (const relation of answer.context.incident) lines.push(`${relation.role}: ${JSON.stringify(relation.edge.from)} → ${JSON.stringify(relation.edge.relation)} → ${JSON.stringify(relation.edge.to)}`)
    for (const link of answer.context.parentLinks) lines.push(`Explicit parent: ${JSON.stringify(link.child)} → ${JSON.stringify(link.parent)}`)
  }
  if (answer.comparison) lines.push(`Exact text Difference: ${answer.comparison.result}`)
  for (const match of answer.matches) {
    lines.push(`${JSON.stringify(match.address)} ${match.state.toUpperCase()} at revision ${match.revision}: ${JSON.stringify(match.value)}`)
    if (match.path.edges.length) lines.push(`Path: ${JSON.stringify(match.path.start)}${match.path.edges.map(e => ` → ${JSON.stringify(e.relation)} → ${JSON.stringify(e.to)}`).join('')}`)
  }
  if (answer.status === 'empty') lines.push('No result follows from the supplied query in the captured local graph.')
  for (const gap of answer.gaps) lines.push(`No captured outgoing edge ${JSON.stringify(gap.relation)} at ${JSON.stringify(gap.address)}. This local graph gap does not establish absence outside the captured graph.`)
  for (const unknown of answer.unknowns) lines.push(`Open at ${JSON.stringify(unknown.address)}: ${unknown.reason}`)
  for (const premise of answer.premises) {
    lines.push(`Source at ${JSON.stringify(premise.address)}: ${JSON.stringify(premise.source.id)} (${premise.sourceBinding})`)
    if (answer.query.kind === 'trace' || answer.query.kind === 'context') {
      for (const path of premise.rootPaths) lines.push(`Parent path: ${path.map(a => JSON.stringify(a)).join(' → ')}`)
      for (const path of premise.valueReceiptPaths) lines.push(`Receipt: ${JSON.stringify(path.receiptId)} from ${JSON.stringify(path.producer)}, revision ${path.resultRevision}, ${path.scope}`)
    }
  }
  lines.push('Scope: captured local records and explicit edges; no inferred operator meaning or external-world truth.')
  const output = lines.join('\n')
  if (output.length > EI_REASONER_LIMITS.outputLength) fail(`complete answer exceeds the ${EI_REASONER_LIMITS.outputLength}-character display bound; narrow the query before displaying a result`)
  return output
}
export function formatEIQueryVerification(receipt: EIQueryVerification): string {
  const failed = receipt.checks.filter(check => !check.matches)
  return `Self-check: ${receipt.status}; scope: ${receipt.scope}. ${failed.length ? failed.slice(0, 8).map(check => `${check.kind} mismatch at ${check.subject}`).join('; ') : `${receipt.checks.length} checks matched the retained derivation${receipt.status === 'unresolved' ? '; unknown branches remain unverified' : ''}`}. Internal consistency only.`
}
