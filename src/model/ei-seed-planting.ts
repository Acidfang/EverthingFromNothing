import {findEIAddress, proposeEI, validateEIInput, type EIInput, type EILedger, type EIRecord, type EIReceipt, type EISource} from './ei-engine.ts'
import {readGuideSteps} from './ei-guide-steps.ts'

export const EI_SEED_PLANTING_SCOPE = 'source-linked-local-seed-placement' as const
const REALM = 'user-selected-seed-placement'
const CANDIDATE = 'plant-seed'
const SOW_CANDIDATE = 'sow-seed'
const NURTURE_CANDIDATE = 'nurture-seed'

/** Captured when an eligible seed's ZERO is dragged into its declared ground.
 * Screen coordinates are deliberately absent: ground is an addressed context. */
export type EISeedPlantingBinding = Readonly<{
  seedAddress: string; seedRevision: number; seedSourceId: string;
  environmentAddress: string; environmentRevision: number;
}>
type SourceState = Readonly<{address: string; revision: number; value: string; source: EISource}>
type RequirementState = Readonly<{
  address: string; equals: string; revision: number | null; value: string | null; source: EISource | null;
  status: 'matched' | 'blocked' | 'unresolved';
}>
type PlantingDetail = Readonly<{
  format: 'ei-seed-planting/v1'; operation: 'drag-zero-to-environment';
  scope: typeof EI_SEED_PLANTING_SCOPE;
  seed: SourceState; environment: SourceState;
  phase: 'selected' | 'awaiting-environment'; attemptAddress: string | null;
  conditions: readonly RequirementState[];
  plantingOnly: true; realized: false; physicalPlacement: null; physicalActionExecuted: false;
  completion: 'unresolved';
}>
export type EISeedPlanting = Readonly<PlantingDetail & {
  address: string; revision: number; source: EISource; receiptId: string;
  continuationReceiptId: string | null;
  current: boolean; contextStatus: 'current' | 'changed' | 'missing';
  environmentStatus: 'available' | 'blocked' | 'unresolved' | 'changed';
}>

const find = (ledger: EILedger, address: string) => ledger.records.find(record => record.address === address)
const original = (record: EIRecord) => record.was[0] ?? record.is
const state = (record: EIRecord): SourceState => ({address: record.address, ...record.is})
const same = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right)
function freeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze)
    Object.freeze(value)
  }
  return value
}
function fail(message: string): never { throw new Error(`Seed planting: ${message}`) }

function guideAttemptSource(ledger: EILedger, id: string, step: ReturnType<typeof readGuideSteps>[number], seed: EIRecord, planting: unknown): EISource {
  return {id, text: step.action, realm: 'user-selected-guide-step', locator: JSON.stringify({
    intent: step.intent, step: state(seed), action: step.action, expected: step.expected,
    conditions: step.conditions.map(condition => ({...condition, revision: find(ledger, condition.address)!.is.revision, source: find(ledger, condition.address)!.is.source})),
    selectionOnly: true, physicalActionExecuted: false, planting,
  })}
}
function requirementStates(ledger: EILedger, requirements: readonly Readonly<{address: string; expected: string; status: RequirementState['status']}>[]): RequirementState[] {
  return requirements.map(condition => {
    const actual = find(ledger, condition.address)
    return {...(actual ? state(actual) : {address: condition.address, revision: null, value: null, source: null}), equals: condition.expected, status: condition.status}
  })
}

/** An intended sowing destination is the step's supplied intent environment.
 * A target's requirements may still be missing or blocked. This does not make
 * them matched, invent conditions, or claim physical ground is suitable. */
export function deriveEISeedSowingTargets(ledger: EILedger) {
  const contexts = new Set(ledger.records.flatMap(record => {
    const source = original(record).source
    if (source.realm !== 'user-declared-guide-step') return []
    try { const address = JSON.parse(source.locator ?? '').intent?.address; return typeof address === 'string' ? [address] : [] } catch { return [] }
  }))
  return freeze([...contexts].flatMap(environment => readGuideSteps(ledger, environment).filter(step =>
    step.current && step.currentIntent && step.currentIntent.revision === step.intent.revision &&
    step.currentIntent.value === step.intent.value && same(step.currentIntent.source, step.intent.source)
  ).map(step => ({
    viewId: `seed-mirror:${step.address}:${step.revision}:${environment}`,
    address: step.address, revision: step.revision, sourceId: step.source.id,
    environmentAddress: environment, environmentRevision: step.currentIntent!.revision,
    status: step.status,
    conditions: step.conditions.map(condition => ({address: condition.address, expected: condition.equals, observed: condition.actual, status: condition.actual === null ? 'unresolved' as const : condition.actual === condition.equals ? 'matched' as const : 'blocked' as const})),
    scope: 'supplied-user-declared-environment' as const, physicalPlacement: null, realized: false as const,
  }))))
}

function plantingInput(ledger: EILedger, input: EISeedPlantingBinding & {id: string}, allowSowing = false): EIInput {
  const mirror = deriveEISeedSowingTargets(ledger).find(item => item.address === input.seedAddress && item.environmentAddress === input.environmentAddress)
  if (!mirror || (!allowSowing && (mirror.status !== 'available' || !mirror.conditions.length))) fail('the seed has no currently matched, supplied prerequisites in this environment')
  if (mirror.revision !== input.seedRevision || mirror.sourceId !== input.seedSourceId || mirror.environmentRevision !== input.environmentRevision) fail('the dragged seed or ground binding is stale')
  const seed = find(ledger, mirror.address)!, environment = find(ledger, mirror.environmentAddress)!
  const step = readGuideSteps(ledger, environment.address).find(item => item.address === seed.address)!
  const conditions = requirementStates(ledger, mirror.conditions)
  const admitted = mirror.status === 'available'
  const placementAddress = `field/plantings/${input.id}`, attemptAddress = admitted ? `guide/attempts/${input.id}` : null
  const detail: PlantingDetail = {
    format: 'ei-seed-planting/v1', operation: 'drag-zero-to-environment', scope: EI_SEED_PLANTING_SCOPE,
    seed: state(seed), environment: state(environment), phase: admitted ? 'selected' : 'awaiting-environment', attemptAddress, conditions,
    plantingOnly: true, realized: false, physicalPlacement: null, physicalActionExecuted: false, completion: 'unresolved',
  }
  const source: EISource = {id: input.id, text: seed.is.value, realm: REALM, locator: JSON.stringify(detail)}
  // Preserve the existing guide-selection contract so supplied outcomes can be
  // recorded with proposeGuideOutcome. Both records belong to one atomic return.
  const attemptSource = admitted ? guideAttemptSource(ledger, input.id, step, seed, {address: placementAddress, operation: detail.operation, scope: detail.scope}) : null
  return validateEIInput({
    id: input.id, producer: seed.address, input: source,
    candidates: [{
      id: admitted ? CANDIDATE : SOW_CANDIDATE,
      label: admitted ? 'Plant the selected seed in its declared environment' : 'Sow the selected seed and retain its environment requirements', owner: 'user', source,
      conditions: [
        {address: seed.address, equals: seed.is.value},
        {address: environment.address, equals: environment.is.value},
        // These guard actual captured observations. Awaiting requirements remain
        // explicitly unmet in provenance; they are never written as true values.
        ...conditions.flatMap(condition => condition.value === null ? [] : [{address: condition.address, equals: condition.value}]),
      ],
      patches: [{
        kind: 'create', address: placementAddress, value: seed.is.value, source,
        parents: [seed.address, environment.address],
        relations: [{relation: 'planted-from', address: seed.address}, {relation: 'planted-in', address: environment.address}, ...(attemptAddress ? [{relation: 'selected-attempt', address: attemptAddress}] : [])],
      }, ...(attemptAddress && attemptSource ? [{
        kind: 'create', address: attemptAddress, value: step.action, source: attemptSource,
        parents: [seed.address, environment.address], relations: [{relation: 'seed-placement', address: placementAddress}],
      }] : [])],
    }],
  })
}

/** A proposal only. Call for an explicit ZERO drop onto the bound environment,
 * then use chooseEI/executeEI and the actual rendered-readback commit path.
 * Ordinary ZERO clicks remain observer navigation. No source state is rewritten,
 * physical action performed, growth inferred, or completion asserted here. */
export function proposeEISeedPlanting(ledger: EILedger, input: EISeedPlantingBinding & {id: string}) {
  // Require a real engine-issued ledger before deriving any eligibility.
  findEIAddress(ledger, input.seedAddress)
  return proposeEI(ledger, plantingInput(ledger, input))
}

/** An explicit sowing drop can start with an unfinished environment. The exact
 * supplied requirements are retained as observed/missing, and no guide attempt
 * is selected until all supplied requirements match. Empty requirements add no
 * invented barrier. Later observations and step selection remain explicit. */
export function proposeEISeedSowing(ledger: EILedger, input: EISeedPlantingBinding & {id: string}) {
  findEIAddress(ledger, input.seedAddress)
  return proposeEI(ledger, plantingInput(ledger, input, true))
}

function nurtureInput(ledger: EILedger, input: {id: string; sowingAddress: string}): EIInput {
  const sowing = find(ledger, input.sowingAddress)
  if (!sowing || original(sowing) !== sowing.is || sowing.is.source.realm !== REALM) fail('the original sowing source is missing or changed')
  const detail = JSON.parse(sowing.is.source.locator ?? '') as PlantingDetail
  if (detail.phase !== 'awaiting-environment' || detail.attemptAddress !== null) fail('this sowing already selected a guide attempt')
  const target = deriveEISeedSowingTargets(ledger).find(item => item.address === detail.seed.address && item.environmentAddress === detail.environment.address)
  const seed = find(ledger, detail.seed.address), environment = find(ledger, detail.environment.address)
  if (!target || !seed || !environment || !same(state(seed), detail.seed) || !same(state(environment), detail.environment)) fail('the canonical seed or supplied environment changed after sowing')
  if (target.status !== 'available') fail('the supplied environment requirements still need matching observations')
  const step = readGuideSteps(ledger, environment.address).find(item => item.address === seed.address)!
  const conditions = requirementStates(ledger, target.conditions), attemptAddress = `guide/attempts/${input.id}`
  const source: EISource = {id: input.id, text: step.action, realm: 'user-selected-seed-nurture', locator: JSON.stringify({
    format: 'ei-seed-nurture/v1', operation: 'nurture-sown-seed', scope: EI_SEED_PLANTING_SCOPE,
    sowing: state(sowing), seed: state(seed), environment: state(environment), conditions, attemptAddress,
    selectionOnly: true, physicalActionExecuted: false, realized: false, completion: 'unresolved',
  })}
  const attemptSource = guideAttemptSource(ledger, input.id, step, seed, {
    address: sowing.address, revision: sowing.is.revision, sourceId: sowing.is.source.id,
    operation: 'nurture-sown-seed', scope: EI_SEED_PLANTING_SCOPE,
  })
  return validateEIInput({id: input.id, producer: sowing.address, input: source, candidates: [{
    id: NURTURE_CANDIDATE, label: 'Nurture the sown seed with its matched environment', owner: 'user', source,
    conditions: [{address: sowing.address, equals: sowing.is.value}, {address: seed.address, equals: seed.is.value}, {address: environment.address, equals: environment.is.value}, ...conditions.map(condition => ({address: condition.address, equals: condition.equals}))],
    patches: [{kind: 'create', address: attemptAddress, value: step.action, source: attemptSource,
      parents: [seed.address, environment.address, sowing.address], relations: [{relation: 'seed-placement', address: sowing.address}],
    }],
  }]})
}

/** Explicitly continue one retained awaiting-environment sow. Matching later
 * observations alone never select it. The new guide attempt names this exact
 * sow as parent/relation, and its receipt returns to the sow without rewriting it. */
export function proposeEISeedNurture(ledger: EILedger, input: {id: string; sowingAddress: string}) {
  const sowing = readEISeedPlantings(ledger).find(item => item.address === input.sowingAddress)
  if (!sowing || !sowing.current) fail('a current returned sowing occurrence is required')
  if (sowing.phase !== 'awaiting-environment' || sowing.attemptAddress !== null) fail('this sowing already selected a guide attempt')
  return proposeEI(ledger, nurtureInput(ledger, input))
}

/** Read-only historical projection for checking the exact eligibility that was
 * available before a retained placement. It is never passed to engine execution. */
function before(ledger: EILedger, revision: number): EILedger {
  const receipts = ledger.receipts.filter(receipt => receipt.resultRevision <= revision)
  const receiptIds = new Set(receipts.map(receipt => receipt.id))
  const records = ledger.records.flatMap(record => {
    const states = [...record.was, record.is].filter(item => item.revision <= revision)
    return states.length ? [{...record, was: states.slice(0, -1), is: states[states.length - 1], receiptIds: record.receiptIds.filter(id => receiptIds.has(id))}] : []
  })
  return {...ledger, revision, records, receipts}
}

function exactReturnedInput(ledger: EILedger, receipt: EIReceipt, expected: EIInput): boolean {
  const patches = expected.candidates[0].patches
  if (!same({id: receipt.transactionId, producer: receipt.producer, input: receipt.source, candidates: receipt.candidates.map(item => item.candidate)}, expected) || !same(receipt.patches, patches) || receipt.checks.length !== patches.length) return false
  return patches.every(patch => {
    const target = find(ledger, patch.address), captured = target && original(target)
    return !!target && !!captured && captured.revision === receipt.resultRevision && captured.value === patch.value && same(captured.source, patch.source) && same(target.parents, patch.parents) && same(target.relations, patch.relations) && receipt.checks.some(check => check.address === patch.address && check.matches && check.expected === patch.value && check.actual === patch.value)
  })
}

function returnedNurture(ledger: EILedger, sowing: EIRecord) {
  for (const receipt of ledger.receipts) {
    if (receipt.producer !== sowing.address || receipt.status !== 'committed' || receipt.scope !== 'rendered-address-values' || receipt.selection?.mode !== 'explicit-user' || receipt.selection.candidateId !== NURTURE_CANDIDATE || !sowing.receiptIds.includes(receipt.id)) continue
    try {
      const expected = nurtureInput(before(ledger, receipt.snapshotRevision), {id: receipt.transactionId, sowingAddress: sowing.address})
      if (exactReturnedInput(ledger, receipt, expected)) return {receiptId: receipt.id, attemptAddress: expected.candidates[0].patches[0].address}
    } catch { /* A stale or fabricated continuation is not a returned link. */ }
  }
  return null
}

/** Only an exact, committed rendered return counts as a planted occurrence.
 * Canonical seed and environment snapshots remain readable if either later
 * changes; changed context never silently becomes a new eligibility claim. */
export function readEISeedPlantings(ledger: EILedger): readonly EISeedPlanting[] {
  findEIAddress(ledger, 'field/plantings')
  return freeze(ledger.records.flatMap(record => {
    const retained = original(record)
    if (retained.source.realm !== REALM) return []
    try {
      const detail = JSON.parse(retained.source.locator ?? '') as PlantingDetail
      const receipt = ledger.receipts.find(item => item.transactionId === retained.source.id)
      if (!receipt || receipt.status !== 'committed' || receipt.scope !== 'rendered-address-values' || receipt.resultRevision !== retained.revision || receipt.selection?.mode !== 'explicit-user' || ![CANDIDATE, SOW_CANDIDATE].includes(receipt.selection.candidateId)) return []
      const seed = find(ledger, detail.seed.address)
      if (!seed || receipt.producer !== seed.address || !seed.receiptIds.includes(receipt.id)) return []
      const expected = plantingInput(before(ledger, receipt.snapshotRevision), {
        id: receipt.transactionId,
        seedAddress: detail.seed.address, seedRevision: detail.seed.revision, seedSourceId: detail.seed.source.id,
        environmentAddress: detail.environment.address, environmentRevision: detail.environment.revision,
      }, true)
      if (record.address !== expected.candidates[0].patches[0].address || !exactReturnedInput(ledger, receipt, expected)) return []
      const context = [detail.seed, detail.environment, ...detail.conditions]
      const contextStatus = context.some(item => item.source !== null && !find(ledger, item.address)) ? 'missing' as const : context.some(item => {
        const current = find(ledger, item.address)
        if (item.source === null) return !!current
        return current!.is.revision !== item.revision || current!.is.value !== item.value || !same(current!.is.source, item.source)
      }) ? 'changed' as const : 'current' as const
      const target = deriveEISeedSowingTargets(ledger).find(item => item.address === detail.seed.address && item.environmentAddress === detail.environment.address && item.revision === detail.seed.revision && item.environmentRevision === detail.environment.revision)
      const environmentStatus = target?.status ?? 'changed'
      const continuation = detail.phase === 'awaiting-environment' ? returnedNurture(ledger, record) : null
      return [{...detail, ...(continuation ? {phase: 'selected' as const, attemptAddress: continuation.attemptAddress} : {}), address: record.address, revision: retained.revision, source: retained.source, receiptId: receipt.id, continuationReceiptId: continuation?.receiptId ?? null, current: retained === record.is, contextStatus, environmentStatus}]
    } catch { return [] }
  }))
}
