/** Grain changes are projections of one addressed entity and retained/proposed
 * state. They do not establish a numeric position or add an engine operation. */
import {
  EI_LIMITS, executeEI, exportEILedger, verifyLocalEI,
  type EIExecution, type EILedger, type EISource, type EIValueState,
} from './ei-engine.ts'
import { evaluateEIQuery, verifyEIQueryAnswer, type EIQuery, type EIQueryAnswer, type EIQueryVerification } from './ei-relation-reasoner.ts'

export const EI_GRAINS = Object.freeze(['state', 'node', 'pixel', 'address', 'coordinate'] as const)
export type EIGrain = typeof EI_GRAINS[number]
export type EIGrainEntity = Readonly<{ address: string }>
/** Context metadata is serializable. Exact snapshot authority is held by the
 * issued registry, not by the revision number or this object's printed fields. */
export type EIGrainContext = Readonly<{
  ledgerRevision: number;
  execution: Readonly<{ transactionId: string; candidateId: string }> | null;
}>
export type EIGrainState = Readonly<{
  entity: EIGrainEntity; context: EIGrainContext; revision: number;
  value: string; source: EISource;
  phase: 'retained' | 'proposed'; role: 'WAS' | 'IS' | 'NEXT';
}>
export type EIGrainHandle = Readonly<{
  grain: EIGrain; entity: EIGrainEntity; state: EIGrainState;
  observedMapping: null;
}>
export type EIGrainRegistry = Readonly<{
  context: EIGrainContext; entities: readonly EIGrainEntity[]; states: readonly EIGrainState[];
}>
/** A view/source reference, never a replacement for an issued handle. Enclosing
 * transition/receipt verification must bind its complete source snapshot. */
export type EIGrainReference = Readonly<{
  context: EIGrainContext; address: string; revision: number;
  sourceId: string; sourceRealm: string | null;
  phase: EIGrainState['phase']; role: EIGrainState['role'];
}>
export type EIGrainIdentityErrorCode = 'unissued-ledger' | 'unissued-execution' | 'execution-snapshot-mismatch' | 'unissued-registry' | 'unknown-address' | 'unknown-revision' | 'unknown-grain' | 'unissued-handle' | 'stale-snapshot' | 'state-mismatch' | 'historical-operation-target' | 'proposed-operation-target'
export class EIGrainIdentityError extends Error {
  readonly code: EIGrainIdentityErrorCode
  constructor(code: EIGrainIdentityErrorCode) { super(`EI grain identity: ${code}`); this.name = 'EIGrainIdentityError'; this.code = code }
}

type RegistrySeal = {
  snapshot: string; ledger: EILedger; execution?: EIExecution;
  byAddress: Map<string, EIGrainState[]>;
  valueStates: Map<EIGrainState, EIValueState>;
  handles: Map<EIGrainState, Map<EIGrain, EIGrainHandle>>;
}
const registries = new WeakMap<object, RegistrySeal>()
const handles = new WeakMap<object, { registry: EIGrainRegistry; state: EIGrainState }>()
const cached = new WeakMap<EILedger, { retained?: EIGrainRegistry; executions: WeakMap<EIExecution, EIGrainRegistry> }>()

function fail(code: EIGrainIdentityErrorCode): never { throw new EIGrainIdentityError(code) }
function freeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.values(value).forEach(freeze); Object.freeze(value) }
  return value
}
function snapshot(ledger: EILedger): string {
  try { return exportEILedger(ledger) } catch { return fail('unissued-ledger') }
}
function same(a: unknown, b: unknown): boolean { return JSON.stringify(a) === JSON.stringify(b) }
function requireRegistry(registry: EIGrainRegistry): RegistrySeal {
  const seal = registries.get(registry)
  return seal ?? fail('unissued-registry')
}
function validateExecution(previous: EILedger, execution: EIExecution): void {
  try { if (!verifyLocalEI(execution).committable) fail('unissued-execution') }
  catch { fail('unissued-execution') }
  // Pure re-admission uses the engine's private proposal/selection snapshot seals.
  // It commits no state and does not turn a user-owned candidate into a choice.
  const current = executeEI(previous, execution.proposal, execution.selection.mode === 'explicit-user' ? execution.selection : undefined)
  if (current.status !== 'staged' || !same(current.stagedLedger, execution.stagedLedger) || !same(current.expected, execution.expected)) fail('execution-snapshot-mismatch')
}

/** Retained and optional proposed states share their one canonical entity at an
 * address. Factory validation and all later grain switches leave the ledger as is. */
export function createEIGrainRegistry(previous: EILedger, execution?: EIExecution): EIGrainRegistry {
  const raw = snapshot(previous), priorCache = cached.get(previous)
  const known = execution ? priorCache?.executions.get(execution) : priorCache?.retained
  if (known) return known
  if (execution) validateExecution(previous, execution)
  const context: EIGrainContext = freeze({ ledgerRevision: previous.revision, execution: execution ? { transactionId: execution.proposal.input.id, candidateId: execution.selection.candidateId } : null })
  const entities: EIGrainEntity[] = [], states: EIGrainState[] = []
  const byAddress = new Map<string, EIGrainState[]>(), valueStates = new Map<EIGrainState, EIValueState>()
  const retained = new Map(previous.records.map(record => [record.address, record]))
  for (const record of (execution?.stagedLedger ?? previous).records) {
    const entity: EIGrainEntity = freeze({ address: record.address }), atAddress: EIGrainState[] = []
    entities.push(entity); byAddress.set(entity.address, atAddress)
    const old = retained.get(record.address)
    // Keep the pre-transition IS role even if the staged record moves that same
    // value into its WAS list. Proposed NEXT is separately and explicitly marked.
    for (const value of old ? [...old.was, old.is] : []) {
      const state: EIGrainState = freeze({ entity, context, revision: value.revision, value: value.value, source: value.source, phase: 'retained', role: value === old!.is ? 'IS' : 'WAS' })
      states.push(state); atAddress.push(state); valueStates.set(state, value)
    }
    if (!old || record.is.revision !== old.is.revision) {
      if (!execution) fail('state-mismatch')
      const value = record.is
      const state: EIGrainState = freeze({ entity, context, revision: value.revision, value: value.value, source: value.source, phase: 'proposed', role: 'NEXT' })
      states.push(state); atAddress.push(state); valueStates.set(state, value)
    }
  }
  const registry: EIGrainRegistry = freeze({ context, entities, states })
  registries.set(registry, { snapshot: raw, ledger: previous, ...(execution ? { execution } : {}), byAddress, valueStates, handles: new Map() })
  const cache = priorCache ?? { executions: new WeakMap<EIExecution, EIGrainRegistry>() }
  if (execution) cache.executions.set(execution, registry)
  else cache.retained = registry
  cached.set(previous, cache)
  return registry
}

/** Revision defaults to the latest state in this registry, including proposed
 * NEXT when supplied. The five labels neither select nor execute a continuation. */
export function projectEIGrain(registry: EIGrainRegistry, address: string, grain: EIGrain, revision?: number): EIGrainHandle {
  const seal = requireRegistry(registry)
  if (!EI_GRAINS.includes(grain)) fail('unknown-grain')
  const atAddress = seal.byAddress.get(address)
  if (!atAddress) fail('unknown-address')
  const state = revision === undefined ? atAddress.at(-1)! : atAddress.find(state => state.revision === revision)
  if (!state) fail('unknown-revision')
  const byGrain = seal.handles.get(state) ?? new Map<EIGrain, EIGrainHandle>(), known = byGrain.get(grain)
  if (known) return known
  const handle: EIGrainHandle = freeze({ grain, entity: state.entity, state, observedMapping: null })
  byGrain.set(grain, handle); seal.handles.set(state, byGrain); handles.set(handle, { registry, state })
  return handle
}

function requireHandle(handle: EIGrainHandle): { registry: EIGrainRegistry; state: EIGrainState; seal: RegistrySeal } {
  const issued = handles.get(handle)
  if (!issued) fail('unissued-handle')
  return { ...issued, seal: requireRegistry(issued.registry) }
}

/** Inspect the same retained or proposed source state through any grain. A
 * proposed state remains NEXT; reading its value never admits it as returned IS. */
export function readEIGrain(previous: EILedger, handle: EIGrainHandle): EIGrainState {
  const { state, seal } = requireHandle(handle)
  if (snapshot(previous) !== seal.snapshot) fail('stale-snapshot')
  const records = state.phase === 'proposed' ? seal.execution!.stagedLedger.records : previous.records
  const record = records.find(record => record.address === state.entity.address)
  const value = record && [...record.was, record.is].find(value => value.revision === state.revision)
  if (!value || !same(value, seal.valueStates.get(state))) fail('state-mismatch')
  return state
}

/** This only resolves the existing current address for an explicitly supplied
 * operation. It grants no selection, mutation, commit or external authority. */
export function resolveEIGrainTarget(previous: EILedger, handle: EIGrainHandle): string {
  const state = readEIGrain(previous, handle)
  if (state.phase === 'proposed') fail('proposed-operation-target')
  if (state.role !== 'IS') fail('historical-operation-target')
  return state.entity.address
}

export function referenceEIGrain(handle: EIGrainHandle): EIGrainReference {
  const { state } = requireHandle(handle)
  return freeze({ context: state.context, address: state.entity.address, revision: state.revision, sourceId: state.source.id, sourceRealm: state.source.realm ?? null, phase: state.phase, role: state.role })
}

export type EIGrainPredicate = Readonly<{ kind: 'exact-text-equality'; equals: string }>
export type EIGrainFilter = Readonly<{
  status: EIQueryAnswer['status']; addresses: readonly string[];
  query: EIQuery; answer: EIQueryAnswer; verification: EIQueryVerification;
}>
export type EIGrainFilterUnbound = Readonly<{
  status: 'unbound'; addresses: readonly string[]; query: null; answer: null; verification: null;
  code: 'predicate-unbound' | 'predicate-invalid' | 'empty-address-set' | 'address-limit' | 'invalid-address' | 'evaluation-unavailable';
}>
export type EIGrainFilterResult = EIGrainFilter | EIGrainFilterUnbound

/** Filters an explicit address set through the existing exact-text evaluator.
 * Grain labels, numeric locations, synonyms and source text never supply a
 * predicate. Canonical text ordering makes set/representation changes commute. */
export async function filterEIGrainAddresses(previous: EILedger, targets: readonly (EIGrainHandle | string)[], predicate: EIGrainPredicate | unknown): Promise<EIGrainFilterResult> {
  snapshot(previous)
  const addresses = [...new Set(targets.map(target => typeof target === 'string' ? target : resolveEIGrainTarget(previous, target)))].sort()
  const unbound = (code: EIGrainFilterUnbound['code']): EIGrainFilterUnbound => freeze({ status: 'unbound', addresses, query: null, answer: null, verification: null, code })
  if (!predicate || typeof predicate !== 'object' || Array.isArray(predicate) || Object.getPrototypeOf(predicate) !== Object.prototype) return unbound('predicate-unbound')
  const p = predicate as Record<string, unknown>
  if (p.kind !== 'exact-text-equality') return unbound('predicate-unbound')
  if (Object.keys(p).length !== 2 || !Object.hasOwn(p, 'equals') || typeof p.equals !== 'string' || p.equals.length > EI_LIMITS.textLength) return unbound('predicate-invalid')
  if (!addresses.length) return unbound('empty-address-set')
  if (addresses.length > EI_LIMITS.records) return unbound('address-limit')
  if (addresses.some(address => !address.trim() || address.length > EI_LIMITS.idLength)) return unbound('invalid-address')
  const query: EIQuery = freeze({ kind: 'filter', addresses, equals: p.equals })
  try {
    const answer = await evaluateEIQuery(previous, query), verification = await verifyEIQueryAnswer(previous, query, answer)
    return freeze({ status: verification.status === 'failed' ? 'unresolved' : answer.status, addresses, query: answer.query, answer, verification })
  } catch { return unbound('evaluation-unavailable') }
}
