/**
 * Finite, source-bound EI transactions over local addressed text records.
 * Equality means exact JavaScript text equality (UTF-16 code units), without
 * normalization or interpretation. Verification concerns captured/local/rendered
 * text only: it establishes no natural-language truth or external-world effect.
 * No storage, network, natural-language solver, geometry, or implicit recursion.
 */
export const EI_FORMAT = 'ei-local-ledger/v1' as const
// Expanded immutable state may exceed its normalized storage envelope. Session
// storage retains its separate 1 MiB cap; transaction inputs remain 128 KiB.
export const EI_LIMITS = Object.freeze({ jsonBytes: 4_194_304, inputBytes: 131_072, records: 256, candidates: 32, conditions: 256, patches: 256, receipts: 512, history: 512, textLength: 32_768, idLength: 256 })
export const EI_PIPELINE = Object.freeze(['READ_SOURCE', 'FIND_ADDRESS', 'SEE_DIFFERENCE', 'FILTER_TO_ALLOWED_CONTINUATIONS', 'IF_ONE_CONTINUE', 'IF_NONE_REST_OR_UNRESOLVED', 'IF_MINE_STOP_FOR_USER_SELECTION', 'RECORD_SELECTION', 'CONTINUE'] as const)
export type EISource = Readonly<{ id: string; text: string; realm?: string; locator?: string }>
export type EIRelation = Readonly<{ relation: string; address: string }>
export type EIValueState = Readonly<{ value: string; source: EISource; revision: number }>
export type EIRecord = Readonly<{ address: string; parents: readonly string[]; relations: readonly EIRelation[]; was: readonly EIValueState[]; is: EIValueState; receiptIds: readonly string[] }>
export type EISeedRecord = Readonly<{ address: string; value: string; source: EISource; parents?: readonly string[]; relations?: readonly EIRelation[] }>
export type EICondition = Readonly<{ address: string; equals: string }>
export type EIPatch = Readonly<{ address: string; value: string; source: EISource; kind?: 'update' | 'create'; parents?: readonly string[]; relations?: readonly EIRelation[] }>
export type EICandidate = Readonly<{ id: string; label: string; owner: 'engine' | 'user'; source: EISource; conditions: readonly EICondition[]; patches: readonly EIPatch[] }>
export type EIInput = Readonly<{ id: string; producer: string; input: EISource; candidates: readonly EICandidate[] }>
export type EIDifference = Readonly<{ candidateId: string; address: string; was: string | null; is: string | null; expected: string; status: 'proposed' | 'unresolved' | 'failed' | 'verified'; reason?: string }>
export type EICandidateAssessment = Readonly<{ candidate: EICandidate; allowed: boolean; unresolved: boolean; reasons: readonly string[] }>
export type EIProposal = Readonly<{ input: EIInput; snapshotRevision: number; status: 'ready' | 'open' | 'unresolved' | 'rest' | 'selection-required'; candidates: readonly EICandidateAssessment[]; differences: readonly EIDifference[] }>
export type EISelection = Readonly<{ candidateId: string; mode: 'explicit-user' | 'sole-engine-continuation' }>
export type EIReadbackValue = Readonly<{ address: string; value: string }>
export type EIReadback = Readonly<{ kind: 'rendered-address-values'; values: readonly EIReadbackValue[] }>
export type EICheck = Readonly<{ address: string; expected: string; actual: string | null; matches: boolean; reason?: string }>
export type EIVerificationScope = 'none' | 'local-staged-records' | 'rendered-address-values'
export type EIReceipt = Readonly<{
  id: string; transactionId: string; producer: string; status: 'committed' | 'blocked' | 'rejected';
  snapshotRevision: number; resultRevision: number; selection: EISelection | null;
  scope: EIVerificationScope; reasons: readonly string[]; checks: readonly EICheck[];
  differences: readonly EIDifference[]; source: EISource; candidates: readonly EICandidateAssessment[];
  patches: readonly EIPatch[];
}>
export type EILedger = Readonly<{ format: typeof EI_FORMAT; revision: number; records: readonly EIRecord[]; receipts: readonly EIReceipt[] }>
export type EIResult = Readonly<{ status: 'committed' | 'blocked' | 'rejected' | 'replayed'; ledger: EILedger; receipt: EIReceipt }>
export type EIExecution = Readonly<{ status: 'staged'; proposal: EIProposal; selection: EISelection; expected: readonly EIReadbackValue[]; stagedLedger: EILedger }>
export type EIVerification = Readonly<{ execution: EIExecution; scope: EIVerificationScope; committable: boolean; checks: readonly EICheck[]; reasons: readonly string[] }>

const issuedLedgers = new WeakSet<object>()
const proposals = new WeakMap<object, { snapshot: string; input: string }>()
const selections = new WeakMap<object, EIProposal>()
const executions = new WeakMap<object, { ledger: EILedger; candidate: EICandidate }>()
const verifications = new WeakSet<object>()

function frozen<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(frozen)
    Object.freeze(value)
  }
  return value
}
function fail(message: string): never { throw new Error(`EI: ${message}`) }
function object(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value) || (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) fail(`${label} must be a plain object`)
  return value as Record<string, unknown>
}
function fields(value: Record<string, unknown>, allowed: readonly string[], required: readonly string[], label: string): void {
  for (const key of Object.keys(value)) if (!allowed.includes(key)) fail(`${label}: unexpected field ${key}`)
  for (const key of required) if (!Object.hasOwn(value, key)) fail(`${label}: missing ${key}`)
}
function text(value: unknown, label: string, max: number = EI_LIMITS.textLength, nonempty = false): string {
  if (typeof value !== 'string' || value.length > max || (nonempty && value.trim().length === 0)) fail(`${label} must be ${nonempty ? 'nonempty ' : ''}text of at most ${max} code units`)
  return value as string
}
function id(value: unknown, label: string): string { return text(value, label, EI_LIMITS.idLength, true) }
function integer(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) fail(`${label} must be a nonnegative safe integer`)
  return value as number
}
function array(value: unknown, label: string, max: number): unknown[] {
  if (!Array.isArray(value) || value.length > max) fail(`${label} must be an array of at most ${max} items`)
  return value as unknown[]
}
function unique(items: readonly string[], label: string): void { if (new Set(items).size !== items.length) fail(`${label} contains duplicate addresses or IDs`) }
function byteBound(value: unknown, max: number): void {
  let encoded: string
  try { encoded = JSON.stringify(value) } catch { fail('input must be bounded JSON data') }
  if (typeof encoded !== 'string' || new TextEncoder().encode(encoded).length > max) fail(`JSON exceeds ${max} bytes`)
}
function source(value: unknown): EISource {
  const s = object(value, 'source'); fields(s, ['id', 'text', 'realm', 'locator'], ['id', 'text'], 'source')
  return { id: id(s.id, 'source.id'), text: text(s.text, 'source.text'), ...(s.realm === undefined ? {} : { realm: id(s.realm, 'source.realm') }), ...(s.locator === undefined ? {} : { locator: text(s.locator, 'source.locator') }) }
}
function addresses(value: unknown, label: string): string[] {
  const result = array(value, label, EI_LIMITS.records).map(v => id(v, label)); unique(result, label); return result
}
function relations(value: unknown): EIRelation[] {
  return array(value, 'relations', EI_LIMITS.records).map(v => { const r = object(v, 'relation'); fields(r, ['relation', 'address'], ['relation', 'address'], 'relation'); return { relation: id(r.relation, 'relation.relation'), address: id(r.address, 'relation.address') } })
}
function validateParents(records: readonly Pick<EIRecord, 'address' | 'parents'>[]): void {
  const byAddress = new Map(records.map(r => [r.address, r]))
  unique(records.map(r => r.address), 'records')
  for (const record of records) for (const parent of record.parents) if (!byAddress.has(parent)) fail(`unknown parent ${parent} at ${record.address}`)
  const visited = new Set<string>(), active = new Set<string>()
  function visit(address: string): void {
    if (active.has(address)) fail(`parent cycle at ${address}`)
    if (visited.has(address)) return
    active.add(address)
    for (const parent of byAddress.get(address)!.parents) visit(parent)
    active.delete(address); visited.add(address)
  }
  for (const record of records) visit(record.address)
}
function issueLedger(ledger: EILedger): EILedger { byteBound(ledger, EI_LIMITS.jsonBytes); frozen(ledger); issuedLedgers.add(ledger); return ledger }
function requireLedger(ledger: EILedger): void { if (!issuedLedgers.has(ledger)) fail('use createEILedger or importEILedger to validate this ledger') }
function requireProposal(proposal: EIProposal): { snapshot: string; input: string } { const seal = proposals.get(proposal); if (!seal) fail('proposal was not produced by proposeEI'); return seal }
function requireExecution(execution: EIExecution): { ledger: EILedger; candidate: EICandidate } { const seal = executions.get(execution); if (!seal) fail('execution was not produced by executeEI'); return seal }

export function createEILedger(seed: Readonly<{ records: readonly EISeedRecord[] }>): EILedger {
  byteBound(seed, EI_LIMITS.jsonBytes)
  const root = object(seed, 'seed'); fields(root, ['records'], ['records'], 'seed')
  const records = array(root.records, 'records', EI_LIMITS.records).map(value => {
    const r = object(value, 'record'); fields(r, ['address', 'value', 'source', 'parents', 'relations'], ['address', 'value', 'source'], 'record')
    return { address: id(r.address, 'address'), parents: addresses(r.parents ?? [], 'parents'), relations: relations(r.relations ?? []), was: [], is: { value: text(r.value, 'value'), source: source(r.source), revision: 0 }, receiptIds: [] }
  })
  validateParents(records)
  return issueLedger({ format: EI_FORMAT, revision: 0, records, receipts: [] })
}

export function parseEIInput(raw: string): EIInput {
  if (typeof raw !== 'string' || new TextEncoder().encode(raw).length > EI_LIMITS.inputBytes) fail('input JSON is too large')
  let value: unknown
  try { value = JSON.parse(raw) } catch { fail('invalid input JSON') }
  return validateEIInput(value)
}
export function validateEIInput(value: unknown): EIInput {
  byteBound(value, EI_LIMITS.inputBytes)
  const root = object(value, 'input'); fields(root, ['id', 'producer', 'input', 'candidates'], ['id', 'producer', 'input', 'candidates'], 'input')
  const candidates = array(root.candidates, 'candidates', EI_LIMITS.candidates).map(value => {
    const c = object(value, 'candidate'); fields(c, ['id', 'label', 'owner', 'source', 'conditions', 'patches'], ['id', 'label', 'owner', 'source', 'conditions', 'patches'], 'candidate')
    if (c.owner !== 'engine' && c.owner !== 'user') fail('candidate.owner must be engine or user')
    const conditions = array(c.conditions, 'conditions', EI_LIMITS.conditions).map(value => { const condition = object(value, 'condition'); fields(condition, ['address', 'equals'], ['address', 'equals'], 'condition'); return { address: id(condition.address, 'condition.address'), equals: text(condition.equals, 'condition.equals') } })
    const patches = array(c.patches, 'patches', EI_LIMITS.patches).map(value => {
      const p = object(value, 'patch'); fields(p, ['address', 'value', 'source', 'kind', 'parents', 'relations'], ['address', 'value', 'source'], 'patch')
      if (p.kind !== undefined && p.kind !== 'update' && p.kind !== 'create') fail('patch.kind must be update or create')
      if (p.kind !== 'create' && (p.parents !== undefined || p.relations !== undefined)) fail('parent and relation metadata are only valid on explicit create patches')
      const parents = p.kind === 'create' ? addresses(p.parents, 'create.parents') : undefined
      if (parents && parents.length === 0) fail('a created child must have at least one explicit parent')
      return { address: id(p.address, 'patch.address'), value: text(p.value, 'patch.value'), source: source(p.source), ...(p.kind === undefined ? {} : { kind: p.kind as 'update' | 'create' }), ...(parents === undefined ? {} : { parents }), ...(p.relations === undefined ? {} : { relations: relations(p.relations) }) }
    })
    if (patches.length === 0) fail('a candidate requires at least one explicit patch')
    unique(patches.map(p => p.address), 'candidate patches')
    return { id: id(c.id, 'candidate.id'), label: text(c.label, 'candidate.label'), owner: c.owner as 'engine' | 'user', source: source(c.source), conditions, patches }
  })
  unique(candidates.map(c => c.id), 'candidates')
  return frozen({ id: id(root.id, 'input.id'), producer: id(root.producer, 'producer'), input: source(root.input), candidates })
}

export function findEIAddress(ledger: EILedger, address: string): EIRecord | undefined { requireLedger(ledger); return ledger.records.find(r => r.address === address) }

export function proposeEI(ledger: EILedger, input: EIInput): EIProposal {
  requireLedger(ledger)
  const normalized = validateEIInput(input)
  if (!ledger.records.some(r => r.address === normalized.producer)) fail(`unknown producing address ${normalized.producer}`)
  const byAddress = new Map(ledger.records.map(r => [r.address, r]))
  const differences: EIDifference[] = []
  const candidates = normalized.candidates.map(candidate => {
    let knownFailure = false, unresolved = false
    const reasons: string[] = []
    for (const condition of candidate.conditions) {
      const actual = byAddress.get(condition.address)
      if (!actual) { unresolved = true; reasons.push(`Unbound condition address: ${condition.address}`); differences.push({ candidateId: candidate.id, address: condition.address, was: null, is: null, expected: condition.equals, status: 'unresolved', reason: 'No captured value exists at the condition address' }) }
      else if (actual.is.value !== condition.equals) { knownFailure = true; reasons.push(`Exact text differs at ${condition.address}`); differences.push({ candidateId: candidate.id, address: condition.address, was: actual.is.value, is: actual.is.value, expected: condition.equals, status: 'failed', reason: 'Exact text equality condition did not match' }) }
    }
    const projected = ledger.records.map(r => ({ address: r.address, parents: r.parents }))
    for (const patch of candidate.patches) {
      const actual = byAddress.get(patch.address)
      if (patch.kind === 'create') {
        if (actual) { knownFailure = true; reasons.push(`Create address already exists: ${patch.address}`) }
        else projected.push({ address: patch.address, parents: patch.parents! })
      } else if (!actual) { unresolved = true; reasons.push(`Unbound patch address: ${patch.address}`) }
      differences.push({ candidateId: candidate.id, address: patch.address, was: actual?.is.value ?? null, is: actual?.is.value ?? null, expected: patch.value, status: !actual && patch.kind !== 'create' ? 'unresolved' : 'proposed' })
    }
    try { if (projected.length > EI_LIMITS.records) fail('record limit reached'); validateParents(projected) } catch (error) { knownFailure = true; reasons.push((error as Error).message) }
    // Unknown evidence does not become false; a known failure still excludes the candidate.
    return { candidate, allowed: !knownFailure && !unresolved, unresolved: !knownFailure && unresolved, reasons }
  })
  const allowed = candidates.filter(c => c.allowed), unknown = candidates.some(c => c.unresolved)
  const status: EIProposal['status'] = allowed.length === 0 ? (unknown ? 'unresolved' : 'rest') : allowed.length > 1 || unknown ? 'open' : allowed[0].candidate.owner === 'user' ? 'selection-required' : 'ready'
  const proposal: EIProposal = frozen({ input: normalized, snapshotRevision: ledger.revision, status, candidates, differences })
  proposals.set(proposal, { snapshot: JSON.stringify(ledger), input: JSON.stringify(normalized) })
  return proposal
}

export function chooseEI(proposal: EIProposal, candidateId: string): EISelection {
  requireProposal(proposal)
  if (!proposal.candidates.some(c => c.candidate.id === candidateId && c.allowed)) fail('only a currently admitted candidate can be explicitly selected')
  const selection: EISelection = frozen({ candidateId, mode: 'explicit-user' })
  selections.set(selection, proposal)
  return selection
}

function receiptFor(ledger: EILedger, proposal: EIProposal, status: EIReceipt['status'], selection: EISelection | null, reasons: readonly string[], scope: EIVerificationScope = 'none', checks: readonly EICheck[] = []): EIReceipt {
  const candidate = proposal.candidates.find(c => c.candidate.id === selection?.candidateId)?.candidate
  return frozen({ id: `ei-receipt:${proposal.input.id}`, transactionId: proposal.input.id, producer: proposal.input.producer, status, snapshotRevision: proposal.snapshotRevision, resultRevision: status === 'committed' ? ledger.revision + 1 : ledger.revision, selection, scope, reasons: [...reasons], checks: [...checks], differences: proposal.differences.map(d => {
    const check = d.candidateId === selection?.candidateId ? checks.find(c => c.address === d.address) : undefined
    return check && d.status === 'proposed' ? { ...d, is: check.actual, status: check.matches ? 'verified' as const : 'failed' as const, ...(check.reason ? { reason: check.reason } : {}) } : d
  }), source: proposal.input.input, candidates: proposal.candidates, patches: candidate?.patches ?? [] })
}
function blocked(ledger: EILedger, proposal: EIProposal, reasons: readonly string[], selection: EISelection | null = null): EIResult {
  return frozen({ status: 'blocked', ledger, receipt: receiptFor(ledger, proposal, 'blocked', selection, reasons) })
}
function replay(ledger: EILedger, proposal: EIProposal): EIResult | undefined {
  const receipt = ledger.receipts.find(r => r.transactionId === proposal.input.id)
  if (!receipt) return undefined
  const priorInput = { id: receipt.transactionId, producer: receipt.producer, input: receipt.source, candidates: receipt.candidates.map(c => c.candidate) }
  if (JSON.stringify(priorInput) !== requireProposal(proposal).input) return blocked(ledger, proposal, ['Transaction ID already belongs to a different captured input'])
  return frozen({ status: 'replayed', ledger, receipt })
}

export function executeEI(ledger: EILedger, proposal: EIProposal, explicitSelection?: EISelection): EIExecution | EIResult {
  requireLedger(ledger); const seal = requireProposal(proposal)
  const previous = replay(ledger, proposal); if (previous) return previous
  if (seal.snapshot !== JSON.stringify(ledger)) return blocked(ledger, proposal, ['Stale snapshot: read the current source and propose again'])
  let selection = explicitSelection
  if (selection && (selections.get(selection) !== proposal || selection.mode !== 'explicit-user')) return blocked(ledger, proposal, ['Selection does not belong to this proposal'])
  if (!selection) {
    if (proposal.status !== 'ready') return blocked(ledger, proposal, [proposal.status === 'selection-required' ? 'User-owned continuation requires explicit user selection' : proposal.status === 'open' ? 'Alternatives remain open; explicit user selection is required' : 'No admitted continuation; retain rest or unresolved differences'])
    selection = frozen({ candidateId: proposal.candidates.find(c => c.allowed)!.candidate.id, mode: 'sole-engine-continuation' })
  }
  const candidate = proposal.candidates.find(c => c.candidate.id === selection!.candidateId && c.allowed)?.candidate
  if (!candidate) return blocked(ledger, proposal, ['Selected continuation is not admitted'], selection)
  if (ledger.receipts.length >= EI_LIMITS.receipts || ledger.revision === Number.MAX_SAFE_INTEGER) return blocked(ledger, proposal, ['Ledger capacity reached; state remains unchanged'], selection)
  try {
    const records = [...ledger.records]
    for (const patch of candidate.patches) {
      const at = records.findIndex(r => r.address === patch.address)
      const state = { value: patch.value, source: patch.source, revision: ledger.revision + 1 }
      if (patch.kind === 'create') {
        if (at >= 0) fail(`create collision at ${patch.address}`)
        records.push({ address: patch.address, parents: patch.parents!, relations: patch.relations ?? [], was: [], is: state, receiptIds: [] })
      } else {
        if (at < 0) fail(`unbound patch address ${patch.address}`)
        const prior = records[at]
        if (prior.was.length >= EI_LIMITS.history) fail(`history capacity reached at ${patch.address}`)
        records[at] = { ...prior, was: [...prior.was, prior.is], is: state }
      }
    }
    validateParents(records)
    const stagedLedger = frozen({ ...ledger, revision: ledger.revision + 1, records })
    byteBound(stagedLedger, EI_LIMITS.jsonBytes)
    const execution: EIExecution = frozen({ status: 'staged', proposal, selection, expected: candidate.patches.map(p => ({ address: p.address, value: p.value })), stagedLedger })
    executions.set(execution, { ledger, candidate })
    return execution
  } catch (error) { return blocked(ledger, proposal, [`Atomic staging failed: ${(error as Error).message}`], selection) }
}

function verifyValues(execution: EIExecution, scope: EIVerificationScope, values: readonly EIReadbackValue[]): EIVerification {
  requireExecution(execution)
  const reasons: string[] = []
  const byAddress = new Map<string, string>(), duplicate = new Set<string>()
  // Readback is data, never a caller-provided success flag. Unknown/missing/duplicate
  // addresses and unexpected extra values all fail the finite projection barrier.
  if (!Array.isArray(values) || values.length > EI_LIMITS.patches) reasons.push('Invalid or oversized readback')
  else for (const value of values) {
    if (!value || typeof value.address !== 'string' || typeof value.value !== 'string' || value.value.length > EI_LIMITS.textLength) { reasons.push('Invalid readback address/value'); continue }
    if (byAddress.has(value.address)) duplicate.add(value.address)
    byAddress.set(value.address, value.value)
  }
  const expectedAddresses = new Set(execution.expected.map(v => v.address))
  for (const address of byAddress.keys()) if (!expectedAddresses.has(address)) reasons.push(`Unexpected readback address: ${address}`)
  const checks = execution.expected.map(expected => {
    const actual = byAddress.get(expected.address) ?? null
    const matches = actual !== null && actual === expected.value && !duplicate.has(expected.address)
    return { address: expected.address, expected: expected.value, actual, matches, ...(matches ? {} : { reason: duplicate.has(expected.address) ? 'Duplicate readback address' : actual === null ? 'Missing readback address' : 'Exact text readback differs' }) }
  })
  const verification: EIVerification = frozen({ execution, scope, committable: reasons.length === 0 && checks.every(c => c.matches), checks, reasons })
  verifications.add(verification)
  return verification
}

/** Caller must collect actual rendered address/value text after the frame is presented. */
export function verifyEI(execution: EIExecution, readback: EIReadback): EIVerification {
  requireExecution(execution)
  if (!readback || readback.kind !== 'rendered-address-values') fail('explicit rendered address/value readback is required')
  return verifyValues(execution, 'rendered-address-values', readback.values)
}
/** This narrower check reads staged in-memory records; it makes no rendering claim. */
export function verifyLocalEI(execution: EIExecution): EIVerification {
  requireExecution(execution)
  const expectedAddresses = new Set(execution.expected.map(v => v.address))
  const values = execution.stagedLedger.records.filter(r => expectedAddresses.has(r.address)).map(r => ({ address: r.address, value: r.is.value }))
  return verifyValues(execution, 'local-staged-records', values)
}

export function commitEI(ledger: EILedger, verification: EIVerification): EIResult {
  requireLedger(ledger)
  if (!verifications.has(verification)) fail('verification was not produced by verifyEI or verifyLocalEI')
  const execution = verification.execution; requireExecution(execution)
  const previous = replay(ledger, execution.proposal); if (previous) return previous
  const stale = requireProposal(execution.proposal).snapshot !== JSON.stringify(ledger)
  if (stale || !verification.committable) return frozen({ status: 'rejected', ledger, receipt: receiptFor(ledger, execution.proposal, 'rejected', execution.selection, stale ? ['Stale snapshot at commit; no affected state was committed'] : [...verification.reasons, ...verification.checks.filter(c => !c.matches).map(c => `${c.address}: ${c.reason}`)], verification.scope, verification.checks) })
  const receipt = receiptFor(ledger, execution.proposal, 'committed', execution.selection, [], verification.scope, verification.checks)
  try {
    // Receipt return and every affected state enter the new ledger together.
    const next = issueLedger({ ...execution.stagedLedger, records: execution.stagedLedger.records.map(r => r.address === receipt.producer ? { ...r, receiptIds: [...r.receiptIds, receipt.id] } : r), receipts: [...ledger.receipts, receipt] })
    return frozen({ status: 'committed', ledger: next, receipt })
  } catch (error) { return frozen({ status: 'rejected', ledger, receipt: receiptFor(ledger, execution.proposal, 'rejected', execution.selection, [`Atomic commit failed: ${(error as Error).message}`], verification.scope, verification.checks) }) }
}

/** Convenience path for explicitly local memory verification, with no renderer claim. */
export function advanceEI(ledger: EILedger, proposal: EIProposal, selection?: EISelection): EIResult {
  const execution = executeEI(ledger, proposal, selection)
  return execution.status === 'staged' ? commitEI(ledger, verifyLocalEI(execution)) : execution
}

/** Finite breadth-first relation walk; cycles never cause implicit execution. */
export function walkEIRelations(ledger: EILedger, start: string): readonly string[] {
  requireLedger(ledger)
  const byAddress = new Map(ledger.records.map(r => [r.address, r])), seen = new Set<string>(), queue = [start]
  for (let i = 0; i < queue.length; i++) {
    const address = queue[i]
    if (seen.has(address) || !byAddress.has(address)) continue
    seen.add(address)
    for (const relation of byAddress.get(address)!.relations) if (!seen.has(relation.address) && byAddress.has(relation.address)) queue.push(relation.address)
  }
  return frozen([...seen])
}

/** Lossless JSON of sources, addresses, history, relationships and successful receipts. */
export function exportEILedger(ledger: EILedger): string { requireLedger(ledger); return JSON.stringify(ledger) }

export const EI_IMPORT_NOTE = 'Imported data is user-supplied history. Structural replay verifies local consistency, not source authenticity, a past rendered frame, or external-world truth.'

function sameJSON(left: unknown, right: unknown): boolean {
  if (left === right) return true
  if (left === null || right === null || typeof left !== 'object' || typeof right !== 'object') return false
  if (Array.isArray(left) || Array.isArray(right)) return Array.isArray(left) && Array.isArray(right) && left.length === right.length && left.every((v, i) => sameJSON(v, right[i]))
  const a = left as Record<string, unknown>, b = right as Record<string, unknown>, keys = Object.keys(a)
  return keys.length === Object.keys(b).length && keys.every(key => Object.hasOwn(b, key) && sameJSON(a[key], b[key]))
}
function boundedStructure(value: unknown): void {
  const pending: { value: unknown; depth: number }[] = [{ value, depth: 0 }]
  let nodes = 0
  while (pending.length) {
    const item = pending.pop()!
    if (++nodes > 100_000 || item.depth > 24) fail('JSON structure exceeds bounded depth or item count')
    if (item.value && typeof item.value === 'object') for (const child of Object.values(item.value)) pending.push({ value: child, depth: item.depth + 1 })
  }
}
function parseState(value: unknown, revision: number): EIValueState {
  const s = object(value, 'state'); fields(s, ['value', 'source', 'revision'], ['value', 'source', 'revision'], 'state')
  const at = integer(s.revision, 'state.revision'); if (at > revision) fail('state revision exceeds ledger revision')
  return { value: text(s.value, 'state.value'), source: source(s.source), revision: at }
}

/**
 * Validate and replay every finite committed transaction. This rejects broken
 * chains, changed histories and mismatched receipts. It is NOT authentication:
 * a consistent imported history may have been authored entirely by its supplier.
 */
export function importEILedger(raw: string): EILedger {
  if (typeof raw !== 'string' || new TextEncoder().encode(raw).length > EI_LIMITS.jsonBytes) fail('ledger JSON is too large')
  let parsed: unknown
  try { parsed = JSON.parse(raw) } catch { fail('invalid ledger JSON') }
  boundedStructure(parsed)
  const root = object(parsed, 'ledger'); fields(root, ['format', 'revision', 'records', 'receipts'], ['format', 'revision', 'records', 'receipts'], 'ledger')
  if (root.format !== EI_FORMAT) fail('unsupported ledger format')
  const revision = integer(root.revision, 'ledger.revision')
  const records: EIRecord[] = array(root.records, 'records', EI_LIMITS.records).map(value => {
    const r = object(value, 'record'); fields(r, ['address', 'parents', 'relations', 'was', 'is', 'receiptIds'], ['address', 'parents', 'relations', 'was', 'is', 'receiptIds'], 'record')
    const was = array(r.was, 'record.was', EI_LIMITS.history).map(s => parseState(s, revision)), current = parseState(r.is, revision)
    const chain = [...was, current]
    for (let i = 1; i < chain.length; i++) if (chain[i].revision <= chain[i - 1].revision) fail('record history revisions must increase')
    const receiptIds = array(r.receiptIds, 'receiptIds', EI_LIMITS.receipts).map(v => text(v, 'receipt ID', EI_LIMITS.idLength + 11, true)); unique(receiptIds, 'receiptIds')
    return { address: id(r.address, 'address'), parents: addresses(r.parents, 'parents'), relations: relations(r.relations), was, is: current, receiptIds }
  })
  validateParents(records)
  const receipts = array(root.receipts, 'receipts', EI_LIMITS.receipts)
  if (revision !== receipts.length) fail('ledger revision does not match the complete receipt chain')
  // Reconstruct only the explicitly captured initial records. Later records must
  // appear through an explicit create patch in the historical transaction chain.
  let rebuilt = createEILedger({ records: records.filter(r => (r.was[0] ?? r.is).revision === 0).map(r => ({ address: r.address, value: (r.was[0] ?? r.is).value, source: (r.was[0] ?? r.is).source, parents: r.parents, relations: r.relations })) })
  for (const value of receipts) {
    const r = object(value, 'receipt')
    fields(r, ['id', 'transactionId', 'producer', 'status', 'snapshotRevision', 'resultRevision', 'selection', 'scope', 'reasons', 'checks', 'differences', 'source', 'candidates', 'patches'], ['id', 'transactionId', 'producer', 'status', 'snapshotRevision', 'resultRevision', 'selection', 'scope', 'reasons', 'checks', 'differences', 'source', 'candidates', 'patches'], 'receipt')
    if (r.status !== 'committed' || r.snapshotRevision !== rebuilt.revision || r.resultRevision !== rebuilt.revision + 1) fail('broken committed receipt revision chain')
    const input = validateEIInput({ id: r.transactionId, producer: r.producer, input: r.source, candidates: array(r.candidates, 'receipt.candidates', EI_LIMITS.candidates).map(c => object(c, 'candidate assessment').candidate) })
    const proposal = proposeEI(rebuilt, input), selected = object(r.selection, 'receipt.selection')
    fields(selected, ['candidateId', 'mode'], ['candidateId', 'mode'], 'selection')
    const selection = selected.mode === 'explicit-user' ? chooseEI(proposal, id(selected.candidateId, 'selected candidate')) : undefined
    if (selected.mode !== 'explicit-user' && selected.mode !== 'sole-engine-continuation') fail('invalid historical selection mode')
    const execution = executeEI(rebuilt, proposal, selection)
    if (execution.status !== 'staged') fail('historical transaction cannot be staged')
    let verification: EIVerification
    if (r.scope === 'local-staged-records') verification = verifyLocalEI(execution)
    else if (r.scope === 'rendered-address-values') {
      const values = array(r.checks, 'receipt.checks', EI_LIMITS.patches).map(c => { const check = object(c, 'check'); return { address: id(check.address, 'check.address'), value: text(check.actual, 'check.actual') } })
      verification = verifyEI(execution, { kind: 'rendered-address-values', values })
    } else fail('committed receipt has no valid local verification scope')
    const result = commitEI(rebuilt, verification)
    if (result.status !== 'committed' || !sameJSON(result.receipt, r)) fail('receipt does not match finite source-bound replay')
    rebuilt = result.ledger
  }
  if (!sameJSON(rebuilt.records, records)) fail('records, retained WAS/IS, parents or receipt return do not match replay')
  return rebuilt
}
