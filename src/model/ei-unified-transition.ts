import {createEIGrainRegistry,projectEIGrain,referenceEIGrain,EI_GRAINS,type EIGrainReference} from './ei-grain-identity.ts'
import {deriveEISourceFractures} from './ei-source-fractures.ts'
/** One derived identity for an EI act, its gate records, explicit threads and local return. */
import {
  EI_LIMITS, chooseEI, commitEI, executeEI, exportEILedger, importEILedger,
  proposeEI, verifyEI, verifyLocalEI,
  type EIDifference, type EIExecution, type EILedger, type EIReadbackValue,
  type EIResult, type EIValueState, type EIVerification,
} from './ei-engine.ts'

export const EI_UNIFIED_SCOPE_NOTE = 'Verification covers DOM transition-record text and displayed addressed value returns. It does not verify raster geometry, indexed infinity meanings, directed gate-port functions, or external-world truth. Receipt reconstruction checks retained replay consistency; it does not re-observe a historical frame.'
export type EIUnifiedIdentity = Readonly<{ transactionId: string; producer: string; baseRevision: number; candidateId: string; receiptId: string }>
export type EIUnifiedPort = Readonly<{ role: 'WAS' | 'IS' | 'NEXT'; value: string | null; revision: number | null; sourceId: string | null; established: boolean }>
export type EIUnifiedHistory = Readonly<{ value: string; revision: number; sourceId: string }>
export type EIUnifiedGate = Readonly<{
  id: string; address: string; operation: 'create' | 'update';
  ports: readonly [EIUnifiedPort, EIUnifiedPort, EIUnifiedPort];
  retainedHistory: readonly EIUnifiedHistory[]; parentIndices: readonly number[];
}>
export type EIUnifiedThread = Readonly<{
  id: string; kind: 'parent' | 'relation'; from: string; to: string; label: string;
  sourceAddress: string; sourceId: string; fromKnown: boolean; toKnown: boolean; introduced: boolean;
}>
export type EIUnifiedNode = Readonly<{
  address: string; role: 'affected' | 'support'; introduced: boolean;
  sourceId: string; sourceRealm: string | null; stateRevision: number;
}>
export type EIUnifiedOpenBinding = Readonly<{
  kind: 'geometry' | 'indexed-infinity' | 'directed-gate-port' | 'missing-relation-endpoint' | 'candidate-condition';
  address?: string; detail: string;
}>
export type EIUnifiedTransition = Readonly<{
  format: 'ei-unified-transition/v1'; identity: EIUnifiedIdentity;
  sourceFractures:ReturnType<typeof deriveEISourceFractures>;
  grainReferences:readonly Readonly<{reference:EIGrainReference;grains:typeof EI_GRAINS}>[];
  scope: 'local-addressed-transition-records'; fieldComplete: false;
  admission: Readonly<{ selected: true; selectionMode: 'explicit-user' | 'sole-engine-continuation'; inputSourceId: string; candidateSourceId: string; allowedCandidateIds: readonly string[]; unresolvedCandidateIds: readonly string[] }>;
  gates: readonly EIUnifiedGate[]; nodes: readonly EIUnifiedNode[]; threads: readonly EIUnifiedThread[];
  parentGraph: Readonly<{ addresses: readonly string[]; parents: readonly (readonly number[])[]; roots: readonly number[] }>;
  differences: readonly EIDifference[]; expectedRender: readonly EIReadbackValue[];
  openBindings: readonly EIUnifiedOpenBinding[];
}>
export type EIUnifiedReadback = Readonly<{ values: readonly EIReadbackValue[]; projectionText: string }>
export type EIUnifiedCheck = Readonly<{ kind: string; subject: string; matches: boolean; reason?: string }>
export type EIUnifiedReport = Readonly<{ phase: 'prepare' | 'verify' | 'commit' | 'reconstruct'; identity: EIUnifiedIdentity | null; checks: readonly EIUnifiedCheck[]; scope: 'local-addressed-transition-records' }>
export class EIUnifiedTransitionError extends Error {
  readonly report: EIUnifiedReport
  constructor(report: EIUnifiedReport) {
    super(`EI unified transition: ${report.checks.filter(check => !check.matches).map(check => check.reason ?? check.subject).join('; ')}`)
    this.name = 'EIUnifiedTransitionError'
    this.report = freeze(report)
  }
}

type ProjectionSeal = { execution: EIExecution; snapshot: string; canonical: string }
const projections = new WeakMap<object, ProjectionSeal>()
const unifiedVerifications = new WeakMap<object, { projection: EIUnifiedTransition; report: EIUnifiedReport }>()
const reconstructed = new WeakMap<object, Map<string, EIUnifiedTransition>>()

function freeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.values(value).forEach(freeze); Object.freeze(value) }
  return value
}
function reject(phase: EIUnifiedReport['phase'], identity: EIUnifiedIdentity | null, kind: string, reason: string): never {
  throw new EIUnifiedTransitionError({ phase, identity, checks: [{ kind, subject: kind, matches: false, reason }], scope: 'local-addressed-transition-records' })
}
function snapshot(ledger: EILedger, phase: EIUnifiedReport['phase']): string {
  try { return exportEILedger(ledger) } catch { return reject(phase, null, 'issued-ledger', 'A validated committed engine ledger is required') }
}
function identityOf(execution: EIExecution): EIUnifiedIdentity {
  return { transactionId: execution.proposal.input.id, producer: execution.proposal.input.producer, baseRevision: execution.proposal.snapshotRevision, candidateId: execution.selection.candidateId, receiptId: `ei-receipt:${execution.proposal.input.id}` }
}
function port(role: EIUnifiedPort['role'], value: EIValueState | undefined, proposed = false): EIUnifiedPort {
  return { role, value: value?.value ?? null, revision: value?.revision ?? null, sourceId: value?.source.id ?? null, established: !!value && !proposed }
}
function requireProjection(projection: EIUnifiedTransition, phase: EIUnifiedReport['phase']): ProjectionSeal {
  const seal = projections.get(projection)
  if (!seal) return reject(phase, null, 'issued-projection', 'Projection was not derived by prepareEIUnifiedTransition')
  return seal
}

/** Pure preparation; gates are affected records, while nodes/threads retain the supporting field. */
export function prepareEIUnifiedTransition(previous: EILedger, execution: EIExecution): EIUnifiedTransition {
  const before = snapshot(previous, 'prepare')
  try { if (!verifyLocalEI(execution).committable) reject('prepare', null, 'issued-execution', 'Issued local execution did not preserve its expected staged values') }
  catch (error) { if (error instanceof EIUnifiedTransitionError) throw error; reject('prepare', null, 'issued-execution', 'An actual issued engine execution is required') }
  const identity = identityOf(execution)
  // Re-admission is pure and checks the engine's private proposal snapshot seal.
  const current = executeEI(previous, execution.proposal, execution.selection.mode === 'explicit-user' ? execution.selection : undefined)
  if (current.status !== 'staged') reject('prepare', identity, 'live-snapshot', `Execution is not staged against this live source snapshot: ${current.status}`)
  if (JSON.stringify(current.stagedLedger) !== JSON.stringify(execution.stagedLedger) || JSON.stringify(current.expected) !== JSON.stringify(execution.expected)) reject('prepare', identity, 'execution-state', 'Execution and staged field disagree')
  const candidate = execution.proposal.candidates.find(item => item.candidate.id === execution.selection.candidateId && item.allowed)!.candidate
  const oldRecords = new Map(previous.records.map(record => [record.address, record]))
  const staged = execution.stagedLedger.records, addresses = staged.map(record => record.address)
  const indices = new Map(addresses.map((address, index) => [address, index])), affected = new Set(candidate.patches.map(patch => patch.address))
  const parents = staged.map(record => record.parents.map(parent => {
    const index = indices.get(parent)
    if (index === undefined) reject('prepare', identity, 'parent-address', `Explicit parent ${parent} is absent from the staged field`)
    return index
  }))
  const gates: EIUnifiedGate[] = candidate.patches.map((patch, index) => {
    const beforeRecord = oldRecords.get(patch.address), afterRecord = staged[indices.get(patch.address)!]
    return {
      id: `gate:${index}`, address: patch.address, operation: patch.kind === 'create' ? 'create' : 'update',
      ports: [port('WAS', beforeRecord?.was.at(-1)), port('IS', beforeRecord?.is), port('NEXT', afterRecord.is, true)],
      retainedHistory: beforeRecord?.was.map(value => ({ value: value.value, revision: value.revision, sourceId: value.source.id })) ?? [],
      parentIndices: parents[indices.get(patch.address)!],
    }
  })
  const nodes: EIUnifiedNode[] = staged.map(record => ({ address: record.address, role: affected.has(record.address) ? 'affected' : 'support', introduced: !oldRecords.has(record.address), sourceId: record.is.source.id, sourceRealm: record.is.source.realm ?? null, stateRevision: record.is.revision }))
  const threads: EIUnifiedThread[] = []
  const openBindings: EIUnifiedOpenBinding[] = [
    { kind: 'geometry', detail: 'No geometry, raster completion, screen overlap or intersection meaning is inferred from these records.' },
    { kind: 'indexed-infinity', detail: 'Indexed infinity symbols have no bound clock, depth, angle or progression meaning in this transition.' },
    { kind: 'directed-gate-port', detail: 'WAS/IS/NEXT identify retained and proposed local states. Directed tetra-port functions remain unbound.' },
  ]
  staged.forEach((record, recordIndex) => {
    const source = record.was[0]?.source ?? record.is.source, introduced = !oldRecords.has(record.address)
    record.parents.forEach((parent, parentIndex) => threads.push({ id: `parent:${recordIndex}:${parentIndex}`, kind: 'parent', from: record.address, to: parent, label: 'declared-parent', sourceAddress: record.address, sourceId: source.id, fromKnown: true, toKnown: indices.has(parent), introduced }))
    record.relations.forEach((relation, relationIndex) => {
      const known = indices.has(relation.address)
      threads.push({ id: `relation:${recordIndex}:${relationIndex}`, kind: 'relation', from: record.address, to: relation.address, label: relation.relation, sourceAddress: record.address, sourceId: source.id, fromKnown: true, toKnown: known, introduced })
      if (!known) openBindings.push({ kind: 'missing-relation-endpoint', address: relation.address, detail: `Explicit relation ${record.address} → ${relation.relation} → ${relation.address} has no captured target record; the thread is retained.` })
    })
  })
  for (const difference of execution.proposal.differences) if (difference.status === 'unresolved') openBindings.push({ kind: 'candidate-condition', address: difference.address, detail: `${difference.candidateId}: ${difference.reason ?? 'Addressed difference remains unresolved'}` })
  const registry=createEIGrainRegistry(previous,execution)
  const grainReferences=registry.states.map(state=>({reference:referenceEIGrain(projectEIGrain(registry,state.entity.address,'state',state.revision)),grains:EI_GRAINS}))
  const projection: EIUnifiedTransition = freeze({
    format: 'ei-unified-transition/v1', identity, sourceFractures:deriveEISourceFractures(previous,execution), grainReferences, scope: 'local-addressed-transition-records', fieldComplete: false,
    admission: { selected: true, selectionMode: execution.selection.mode, inputSourceId: execution.proposal.input.input.id, candidateSourceId: candidate.source.id, allowedCandidateIds: execution.proposal.candidates.filter(item => item.allowed).map(item => item.candidate.id), unresolvedCandidateIds: execution.proposal.candidates.filter(item => item.unresolved).map(item => item.candidate.id) },
    gates, nodes, threads, parentGraph: { addresses, parents, roots: parents.flatMap((items, index) => items.length ? [] : [index]) },
    differences: execution.proposal.differences, expectedRender: execution.expected, openBindings,
  })
  const canonical = JSON.stringify(projection, null, 2)
  if (new TextEncoder().encode(canonical).length > EI_LIMITS.jsonBytes) reject('prepare', identity, 'projection-bound', 'Complete transition records exceed the 4 MiB render bound; no threads or gates were omitted')
  projections.set(projection, { execution, snapshot: before, canonical })
  return projection
}

/** The UI retains this complete canonical text in inspectable details and reads its DOM textContent back. */
export function serializeEIUnifiedTransition(projection: EIUnifiedTransition): string { return requireProjection(projection, 'verify').canonical }

function projectionChecks(projection: EIUnifiedTransition, actualText: unknown, expectedText: string): EIUnifiedCheck[] {
  const checks: EIUnifiedCheck[] = [{ kind: 'canonical-projection-text', subject: 'whole rendered transition record', matches: typeof actualText === 'string' && actualText === expectedText, reason: 'Rendered transition records differ or are incomplete' }]
  let actual: Record<string, unknown> | null = null
  if (typeof actualText === 'string' && new TextEncoder().encode(actualText).length <= EI_LIMITS.jsonBytes) {
    try { const parsed: unknown = JSON.parse(actualText); if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) actual = parsed as Record<string, unknown> } catch { /* Exact readback still fails; malformed text is never executed. */ }
  }
  for (const key of ['format', 'identity', 'sourceFractures', 'grainReferences', 'scope', 'fieldComplete', 'admission', 'gates', 'nodes', 'threads', 'parentGraph', 'differences', 'expectedRender', 'openBindings'] as const) {
    let matches = false
    try { matches = actual !== null && JSON.stringify(actual[key]) === JSON.stringify(projection[key]) } catch { /* Excessively nested malformed readback is rejected, not traversed further. */ }
    checks.push({ kind: key, subject: `rendered ${key}`, matches, ...(matches ? {} : { reason: `Rendered ${key} are missing or differ from the issued transition` }) })
  }
  return checks
}

/** Projection text and actual addressed values are separate observed returns; neither is copied from expectations here. */
export function verifyEIUnifiedTransition(previous: EILedger, execution: EIExecution, projection: EIUnifiedTransition, readback: EIUnifiedReadback): EIVerification {
  const seal = requireProjection(projection, 'verify')
  if (seal.execution !== execution) reject('verify', projection.identity, 'execution-identity', 'Projection belongs to a different issued execution')
  if (snapshot(previous, 'verify') !== seal.snapshot) reject('verify', projection.identity, 'live-snapshot', 'Source snapshot is stale; reconstruct the transition from current records')
  const checks = projectionChecks(projection, readback?.projectionText, seal.canonical)
  const report: EIUnifiedReport = freeze({ phase: 'verify', identity: projection.identity, checks, scope: 'local-addressed-transition-records' })
  if (checks.some(check => !check.matches)) throw new EIUnifiedTransitionError(report)
  const verification = verifyEI(execution, { kind: 'rendered-address-values', values: readback?.values })
  unifiedVerifications.set(verification, { projection, report })
  return verification
}

/** Optional wrapper ensures this caller cannot skip the shared projection barrier. Engine stale/atomic checks remain in force. */
export function commitEIUnifiedTransition(previous: EILedger, verification: EIVerification): EIResult {
  const checked = unifiedVerifications.get(verification)
  if (!checked) reject('commit', null, 'shared-verification', 'Commit requires verification of the shared rendered transition and addressed values')
  const seal = requireProjection(checked.projection, 'commit')
  if (seal.execution !== verification.execution) reject('commit', checked.projection.identity, 'execution-identity', 'Verification belongs to a different execution')
  return commitEI(previous, verification)
}
export function readEIUnifiedVerification(verification: EIVerification): EIUnifiedReport | null { return unifiedVerifications.get(verification)?.report ?? null }

function ledgerAt(ledger: EILedger, revision: number): EILedger {
  const receipts = ledger.receipts.filter(receipt => receipt.resultRevision <= revision), ids = new Set(receipts.map(receipt => receipt.id))
  const records = ledger.records.flatMap(record => {
    const states = [...record.was, record.is].filter(state => state.revision <= revision)
    return states.length ? [{ ...record, was: states.slice(0, -1), is: states.at(-1)!, receiptIds: record.receiptIds.filter(id => ids.has(id)) }] : []
  })
  return importEILedger(JSON.stringify({ ...ledger, revision, receipts, records }))
}

/** Rebuild the original proposed projection from the actual retained receipt and replay, including later histories. */
export function reconstructEIUnifiedTransition(ledger: EILedger, receiptId: string): EIUnifiedTransition {
  const raw = snapshot(ledger, 'reconstruct'), cached = reconstructed.get(ledger)?.get(receiptId)
  if (cached) return cached
  try {
    const validated = importEILedger(raw), receipt = validated.receipts.find(item => item.id === receiptId)
    if (!receipt || receipt.status !== 'committed') reject('reconstruct', null, 'retained-receipt', 'No committed receipt exists at the supplied ID')
    const previous = ledgerAt(validated, receipt.snapshotRevision), after = ledgerAt(validated, receipt.resultRevision)
    const proposal = proposeEI(previous, { id: receipt.transactionId, producer: receipt.producer, input: receipt.source, candidates: receipt.candidates.map(item => item.candidate) })
    const selection = receipt.selection?.mode === 'explicit-user' ? chooseEI(proposal, receipt.selection.candidateId) : undefined
    const execution = executeEI(previous, proposal, selection)
    if (execution.status !== 'staged') reject('reconstruct', null, 'receipt-execution', 'The receipt cannot be reconstructed as an admitted local execution')
    const verification = receipt.scope === 'rendered-address-values' ? verifyEI(execution, { kind: 'rendered-address-values', values: receipt.checks.map(check => ({ address: check.address, value: check.actual! })) }) : verifyLocalEI(execution)
    const replayed = commitEI(previous, verification)
    if (replayed.status !== 'committed' || JSON.stringify(replayed.receipt) !== JSON.stringify(receipt) || exportEILedger(replayed.ledger) !== exportEILedger(after)) reject('reconstruct', null, 'receipt-replay', 'Receipt, source histories or returned state do not match actual local replay')
    const projection = prepareEIUnifiedTransition(previous, execution)
    const cache = reconstructed.get(ledger) ?? new Map<string, EIUnifiedTransition>(); cache.set(receiptId, projection); reconstructed.set(ledger, cache)
    return projection
  } catch (error) {
    if (error instanceof EIUnifiedTransitionError) throw error
    reject('reconstruct', null, 'receipt-replay', `Retained receipt reconstruction failed: ${error instanceof Error ? error.message : 'invalid retained state'}`)
  }
}
