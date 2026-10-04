import {test} from 'node:test'
import assert from 'node:assert/strict'
import {
  createEILedger, proposeEI, chooseEI, executeEI, verifyEI, verifyLocalEI, commitEI,
  exportEILedger, importEILedger, type EILedger, type EIProposal,
} from '../src/model/ei-engine.ts'
import {proposeGuideStep, proposeGuideSelection, proposeGuideOutcome, readGuideAttempts} from '../src/model/ei-guide-steps.ts'
import {deriveEISeedMirrors} from '../src/model/ei-field-environment.ts'
import {proposeEISeedPlanting, proposeEISeedSowing, proposeEISeedNurture, deriveEISeedSowingTargets, readEISeedPlantings, type EISeedPlantingBinding} from '../src/model/ei-seed-planting.ts'

function staged(ledger: EILedger, proposal: EIProposal) {
  const execution = executeEI(ledger, proposal, chooseEI(proposal, proposal.candidates[0].candidate.id))
  if (execution.status !== 'staged') throw new Error(`Expected staging, received ${execution.status}`)
  return execution
}
// Model tests supply explicit readback data; production must read the rendered DOM.
function commit(ledger: EILedger, proposal: EIProposal) {
  const execution = staged(ledger, proposal)
  const result = commitEI(ledger, verifyEI(execution, {kind: 'rendered-address-values', values: execution.expected}))
  assert.equal(result.status, 'committed')
  return result.ledger
}
function fixture(conditions = [{address: 'water', equals: 'available'}]) {
  let ledger = createEILedger({records: [
    {address: 'goal', value: 'Grow the declared idea', source: {id: 'goal-source', text: 'Grow the declared idea'}},
    {address: 'water', value: 'available', source: {id: 'water-source', text: 'available'}},
    {address: 'other-ground', value: 'Other environment', source: {id: 'other-source', text: 'Other environment'}},
  ]})
  ledger = commit(ledger, proposeGuideStep(ledger, {id: 'declared-step', intentAddress: 'goal', action: 'Try the supplied step', expected: 'A supplied outcome', conditions}))
  const binding: EISeedPlantingBinding = {seedAddress: 'guide/steps/declared-step', seedRevision: 1, seedSourceId: 'declared-step', environmentAddress: 'goal', environmentRevision: 0}
  return {ledger, binding}
}
function update(ledger: EILedger, address: string, value: string, id: string) {
  const source = {id, text: value}
  return commit(ledger, proposeEI(ledger, {id, producer: address, input: source, candidates: [{id: 'update', label: 'Retain changed source', owner: 'user', source, conditions: [], patches: [{address, value, source}]}]}))
}

test('ZERO drop proposes exactly one occurrence and retains canonical seed and ground', () => {
  const {ledger, binding} = fixture(), before = exportEILedger(ledger)
  const proposal = proposeEISeedPlanting(ledger, {...binding, id: 'drop-1'})
  assert.equal(exportEILedger(ledger), before)
  assert.equal(proposal.status, 'selection-required')
  assert.equal(proposal.input.producer, binding.seedAddress)
  assert.equal(proposal.input.candidates.length, 1)
  assert.equal(proposal.input.candidates[0].patches.length, 2)
  const patch = proposal.input.candidates[0].patches[0]
  assert.equal(patch.kind, 'create')
  assert.equal(patch.address, 'field/plantings/drop-1')
  assert.deepEqual(patch.parents, [binding.seedAddress, binding.environmentAddress])
  const detail = JSON.parse(patch.source.locator!)
  assert.equal(detail.seed.address, binding.seedAddress)
  assert.equal(detail.seed.source.id, binding.seedSourceId)
  assert.equal(detail.environment.address, binding.environmentAddress)
  assert.equal(detail.conditions[0].address, 'water')
  assert.equal(detail.conditions[0].source.id, 'water-source')
  assert.equal(detail.conditions[0].value, detail.conditions[0].equals)
  assert.equal(detail.operation, 'drag-zero-to-environment')
  assert.equal(detail.plantingOnly, true)
  assert.equal(detail.completion, 'unresolved')
  assert.equal(detail.realized, false)
  assert.equal(detail.physicalPlacement, null)
  assert.equal(detail.physicalActionExecuted, false)
  assert.equal(executeEI(ledger, proposal).status, 'blocked')
  assert.deepEqual(readEISeedPlantings(ledger), [])
})

test('committed rendered return links the placement receipt back to its original seed', () => {
  const {ledger, binding} = fixture()
  const next = commit(ledger, proposeEISeedPlanting(ledger, {...binding, id: 'drop-1'}))
  const [planting] = readEISeedPlantings(next)
  assert.ok(planting)
  assert.equal(planting.address, 'field/plantings/drop-1')
  assert.equal(planting.receiptId, 'ei-receipt:drop-1')
  assert.equal(planting.contextStatus, 'current')
  assert.equal(planting.current, true)
  assert.ok(Object.isFrozen(planting.conditions[0]))
  const previousSeed = ledger.records.find(record => record.address === binding.seedAddress)!
  const nextSeed = next.records.find(record => record.address === binding.seedAddress)!
  assert.deepEqual(nextSeed.is, previousSeed.is)
  assert.deepEqual(nextSeed.was, previousSeed.was)
  assert.deepEqual(nextSeed.parents, previousSeed.parents)
  assert.ok(nextSeed.receiptIds.includes(planting.receiptId))
  assert.deepEqual(next.records.find(record => record.address === 'goal'), ledger.records.find(record => record.address === 'goal'))
  assert.equal(next.records.length, ledger.records.length + 2)
  assert.deepEqual(readEISeedPlantings(importEILedger(exportEILedger(next))), [planting])
})

test('missing, mismatched, and absent supplied prerequisites never admit planting', () => {
  for (const conditions of [[], [{address: 'missing', equals: 'available'}], [{address: 'water', equals: 'dry'}]]) {
    const {ledger, binding} = fixture(conditions)
    assert.equal(deriveEISeedMirrors(ledger).length, 0)
    assert.throws(() => proposeEISeedPlanting(ledger, {...binding, id: 'drop'}), /no currently matched/)
  }
  const {ledger, binding} = fixture()
  assert.throws(() => proposeEISeedPlanting(ledger, {...binding, seedAddress: 'water', id: 'drop'}), /no currently matched/)
  assert.throws(() => proposeEISeedPlanting(ledger, {...binding, environmentAddress: 'other-ground', id: 'drop'}), /no currently matched/)
})

test('drag binding checks current seed revision, seed source, and addressed environment revision', () => {
  const {ledger, binding} = fixture()
  for (const mismatch of [{seedRevision: 0}, {seedSourceId: 'other-source'}, {environmentRevision: 99}]) {
    assert.throws(() => proposeEISeedPlanting(ledger, {...binding, ...mismatch, id: 'drop'}), /binding is stale/)
  }
  for (const address of [binding.seedAddress, binding.environmentAddress]) {
    const current = ledger.records.find(record => record.address === address)!
    const changed = update(ledger, address, current.is.value, `changed-${address}`)
    assert.throws(() => proposeEISeedPlanting(changed, {...binding, id: 'drop'}), /no currently matched/)
  }
  const dry = update(ledger, 'water', 'dry', 'water-changed')
  assert.throws(() => proposeEISeedPlanting(dry, {...binding, id: 'drop'}), /no currently matched/)
})

test('stale execution and stale commit cannot plant into a changed context', () => {
  const {ledger, binding} = fixture(), proposal = proposeEISeedPlanting(ledger, {...binding, id: 'drop'})
  const execution = staged(ledger, proposal), changed = update(ledger, 'water', 'dry', 'water-changed')
  const rejectedExecution = executeEI(changed, proposal, chooseEI(proposal, proposal.candidates[0].candidate.id))
  assert.equal(rejectedExecution.status, 'blocked')
  const rejectedCommit = commitEI(changed, verifyEI(execution, {kind: 'rendered-address-values', values: execution.expected}))
  assert.equal(rejectedCommit.status, 'rejected')
  assert.equal(rejectedCommit.ledger, changed)
  assert.deepEqual(readEISeedPlantings(changed), [])
})

test('missing, altered, and duplicate rendered returns cannot promote planting', () => {
  const {ledger, binding} = fixture(), proposal = proposeEISeedPlanting(ledger, {...binding, id: 'drop'})
  const execution = staged(ledger, proposal)
  for (const values of [[], [execution.expected[0]], [{...execution.expected[0], value: 'wrong return'}, execution.expected[1]], [...execution.expected, ...execution.expected]]) {
    const result = commitEI(ledger, verifyEI(execution, {kind: 'rendered-address-values', values}))
    assert.equal(result.status, 'rejected')
    assert.equal(result.ledger, ledger)
    assert.deepEqual(readEISeedPlantings(result.ledger), [])
  }
})

test('local-only verification and copied metadata do not substitute for the rendered return', () => {
  const {ledger, binding} = fixture(), proposal = proposeEISeedPlanting(ledger, {...binding, id: 'drop'})
  const local = commitEI(ledger, verifyLocalEI(staged(ledger, proposal)))
  assert.equal(local.status, 'committed')
  assert.deepEqual(readEISeedPlantings(local.ledger), [])
  const patch = proposal.input.candidates[0].patches[0]
  const forged = createEILedger({records: [...ledger.records.map(record => ({address: record.address, value: record.is.value, source: record.is.source, parents: record.parents, relations: record.relations})), {address: patch.address, value: patch.value, source: patch.source, parents: patch.parents, relations: patch.relations}]})
  assert.deepEqual(readEISeedPlantings(forged), [])
  assert.throws(() => readEISeedPlantings({...local.ledger}), /validate this ledger/)
})

test('a real receipt with invented eligibility or completion metadata is not a planting return', () => {
  const {ledger, binding} = fixture(), proposal = proposeEISeedPlanting(ledger, {...binding, id: 'drop'})
  for (const alteration of [{completion: 'complete'}, {conditions: []}, {environment: {address: 'other-ground', revision: 0, value: 'Other environment', source: {id: 'other-source', text: 'Other environment'}}}]) {
    const candidate = proposal.input.candidates[0]
    const source = {...proposal.input.input, locator: JSON.stringify({...JSON.parse(proposal.input.input.locator!), ...alteration})}
    const fake = proposeEI(ledger, {...proposal.input, input: source, candidates: [{...candidate, source, patches: [{...candidate.patches[0], source}]}]})
    const next = commit(ledger, fake)
    assert.deepEqual(readEISeedPlantings(next), [])
  }
})

test('later context changes retain the original planting source without claiming growth or completion', () => {
  const {ledger, binding} = fixture(), planted = commit(ledger, proposeEISeedPlanting(ledger, {...binding, id: 'drop'}))
  for (const address of ['water', binding.seedAddress, binding.environmentAddress]) {
    const changed = update(planted, address, 'Changed after planting', `change-${address}`)
    const [planting] = readEISeedPlantings(changed)
    assert.ok(planting)
    assert.equal(planting.contextStatus, 'changed')
    assert.equal(planting.seed.value, 'Try the supplied step')
    assert.equal(planting.environment.value, 'Grow the declared idea')
    assert.equal(planting.conditions[0].value, 'available')
    assert.equal(planting.completion, 'unresolved')
    assert.equal(planting.realized, false)
  }
})

test('planting starts a linked guide attempt whose later supplied outcome remains an exact-text report', () => {
  const {ledger, binding} = fixture(), proposal = proposeEISeedPlanting(ledger, {...binding, id: 'drop'})
  const normalSelection = proposeGuideSelection(ledger, {id: 'drop', stepAddress: binding.seedAddress})
  const expectedDetail = JSON.parse(normalSelection.input.candidates[0].patches[0].source.locator!)
  const actualDetail = JSON.parse(proposal.input.candidates[0].patches[1].source.locator!)
  const {planting: link, ...selectionDetail} = actualDetail
  assert.deepEqual(selectionDetail, expectedDetail)
  assert.equal(link.address, 'field/plantings/drop')
  const planted = commit(ledger, proposal), [planting] = readEISeedPlantings(planted)
  const [attempt] = readGuideAttempts(planted, binding.environmentAddress)
  assert.ok(attempt)
  assert.equal(planting.attemptAddress, attempt.address)
  assert.equal(attempt.latestOutcome, null)
  assert.equal(attempt.selectionOnly, true)
  assert.equal(attempt.physicalActionExecuted, false)
  const returned = commit(planted, proposeGuideOutcome(planted, {id: 'reported-return', attemptAddress: planting.attemptAddress, actual: 'A supplied outcome'}))
  const [progress] = readGuideAttempts(returned, binding.environmentAddress)
  assert.equal(progress.latestOutcome?.comparison, 'exact-match')
  assert.equal(progress.latestOutcome?.userReported, true)
  assert.equal(progress.latestOutcome?.worldVerified, false)
  assert.equal(readEISeedPlantings(returned)[0].completion, 'unresolved')
  assert.equal(readEISeedPlantings(returned)[0].realized, false)
})

test('a retried transaction returns its receipt once and never duplicates the occurrence', () => {
  const {ledger, binding} = fixture(), proposal = proposeEISeedPlanting(ledger, {...binding, id: 'drop'})
  const next = commit(ledger, proposal), result = executeEI(next, proposal)
  assert.equal(result.status, 'replayed')
  assert.equal(result.ledger, next)
  assert.equal(readEISeedPlantings(next).length, 1)
  const collision = proposeEISeedPlanting(next, {...binding, id: 'drop'})
  assert.equal(collision.status, 'rest')
  assert.equal(executeEI(next, collision).status, 'replayed')
})

test('sowing destinations retain supplied blocked, missing, matched, and empty requirements without inventing eligibility', () => {
  const cases = [
    {conditions: [{address: 'water', equals: 'dry'}], status: 'blocked'},
    {conditions: [{address: 'missing', equals: 'available'}], status: 'unresolved'},
    {conditions: [{address: 'water', equals: 'available'}], status: 'available'},
    {conditions: [], status: 'available'},
  ]
  for (const item of cases) {
    const {ledger, binding} = fixture(item.conditions), [target] = deriveEISeedSowingTargets(ledger)
    assert.ok(target)
    assert.equal(target.address, binding.seedAddress)
    assert.equal(target.environmentAddress, binding.environmentAddress)
    assert.equal(target.status, item.status)
    assert.equal(target.conditions.length, item.conditions.length)
    assert.equal(target.realized, false)
    assert.equal(target.physicalPlacement, null)
    const changed = update(ledger, 'goal', 'Changed intent', 'new-intent')
    assert.deepEqual(deriveEISeedSowingTargets(changed), [])
    assert.throws(() => proposeEISeedSowing(changed, {...binding, id: 'sow'}), /no currently matched/)
  }
})

test('sowing an unmet requirement retains the observed difference and creates no attempted action', () => {
  const {ledger, binding} = fixture([{address: 'water', equals: 'dry'}]), before = exportEILedger(ledger)
  const proposal = proposeEISeedSowing(ledger, {...binding, id: 'sow'})
  assert.equal(exportEILedger(ledger), before)
  assert.equal(proposal.status, 'selection-required')
  assert.equal(proposal.input.candidates[0].id, 'sow-seed')
  assert.equal(proposal.input.candidates[0].patches.length, 1)
  assert.equal(proposal.input.candidates[0].conditions.find(condition => condition.address === 'water')?.equals, 'available')
  const next = commit(ledger, proposal), [planting] = readEISeedPlantings(next)
  assert.ok(planting)
  assert.equal(planting.phase, 'awaiting-environment')
  assert.equal(planting.attemptAddress, null)
  assert.equal(planting.environmentStatus, 'blocked')
  assert.equal(planting.contextStatus, 'current')
  assert.equal(planting.conditions[0].equals, 'dry')
  assert.equal(planting.conditions[0].value, 'available')
  assert.equal(planting.conditions[0].status, 'blocked')
  assert.deepEqual(next.records.find(record => record.address === 'water'), ledger.records.find(record => record.address === 'water'))
  assert.deepEqual(readGuideAttempts(next, 'goal'), [])
  assert.equal(next.records.length, ledger.records.length + 1)
  assert.equal(planting.completion, 'unresolved')
  assert.deepEqual(readEISeedPlantings(importEILedger(exportEILedger(next))), [planting])
})

test('sowing a missing requirement never creates or fills the missing observation', () => {
  const {ledger, binding} = fixture([{address: 'missing', equals: 'available'}])
  const proposal = proposeEISeedSowing(ledger, {...binding, id: 'sow'}), next = commit(ledger, proposal)
  const [planting] = readEISeedPlantings(next)
  assert.equal(proposal.input.candidates[0].conditions.some(condition => condition.address === 'missing'), false)
  assert.equal(next.records.some(record => record.address === 'missing'), false)
  assert.deepEqual(planting.conditions[0], {address: 'missing', revision: null, value: null, source: null, equals: 'available', status: 'unresolved'})
  assert.equal(planting.environmentStatus, 'unresolved')
  assert.equal(planting.contextStatus, 'current')
  assert.equal(planting.attemptAddress, null)
  assert.equal(planting.realized, false)
  assert.deepEqual(readGuideAttempts(next, 'goal'), [])
})

test('a supplied step with no prerequisites can be sown without adding an invented barrier', () => {
  const {ledger, binding} = fixture([])
  assert.equal(deriveEISeedMirrors(ledger).length, 0)
  const next = commit(ledger, proposeEISeedSowing(ledger, {...binding, id: 'sow'})), [planting] = readEISeedPlantings(next)
  assert.equal(planting.phase, 'selected')
  assert.equal(planting.environmentStatus, 'available')
  assert.equal(planting.conditions.length, 0)
  assert.equal(readGuideAttempts(next, 'goal')[0].address, planting.attemptAddress)
  assert.equal(planting.completion, 'unresolved')
})

test('later environment observations can become available but do not auto-select or complete a sown step', () => {
  const {ledger, binding} = fixture([{address: 'water', equals: 'dry'}])
  const planted = commit(ledger, proposeEISeedSowing(ledger, {...binding, id: 'sow'}))
  const observed = update(planted, 'water', 'dry', 'user-observation'), [waiting] = readEISeedPlantings(observed)
  assert.equal(waiting.phase, 'awaiting-environment')
  assert.equal(waiting.environmentStatus, 'available')
  assert.equal(waiting.contextStatus, 'changed')
  assert.equal(waiting.conditions[0].value, 'available')
  assert.equal(waiting.attemptAddress, null)
  assert.deepEqual(readGuideAttempts(observed, 'goal'), [])
  const chosen = commit(observed, proposeGuideSelection(observed, {id: 'explicit-next', stepAddress: binding.seedAddress}))
  assert.equal(readGuideAttempts(chosen, 'goal').length, 1)
  assert.equal(readEISeedPlantings(chosen)[0].completion, 'unresolved')
})

test('sowing rejects stale sources, wrong destinations, unreturned steps, and oversized identities', () => {
  const {ledger, binding} = fixture([{address: 'missing', equals: 'available'}])
  assert.throws(() => proposeEISeedSowing(ledger, {...binding, seedRevision: 999, id: 'sow'}), /binding is stale/)
  assert.throws(() => proposeEISeedSowing(ledger, {...binding, environmentAddress: 'other-ground', id: 'sow'}), /no currently matched/)
  assert.throws(() => proposeEISeedSowing(ledger, {...binding, id: 'x'.repeat(257)}), /at most 256/)
  const uncaptured = createEILedger({records: ledger.records.map(record => ({address: record.address, value: record.is.value, source: record.is.source, parents: record.parents, relations: record.relations}))})
  assert.deepEqual(deriveEISeedSowingTargets(uncaptured), [])
  assert.throws(() => proposeEISeedSowing(uncaptured, {...binding, id: 'sow'}), /no currently matched/)
})

function awaitingSow() {
  const {ledger, binding} = fixture([{address: 'water', equals: 'dry'}])
  const sown = commit(ledger, proposeEISeedSowing(ledger, {...binding, id: 'sow'}))
  return {sown, binding, sowingAddress: 'field/plantings/sow'}
}

test('explicit nurture rebinds matched new observations and returns one attempt to the exact unchanged sow', () => {
  const {sown, sowingAddress} = awaitingSow(), observed = update(sown, 'water', 'dry', 'new-observation')
  const oldSow = observed.records.find(record => record.address === sowingAddress)!, before = exportEILedger(observed)
  const proposal = proposeEISeedNurture(observed, {id: 'nurture', sowingAddress})
  assert.equal(exportEILedger(observed), before)
  assert.equal(proposal.input.producer, sowingAddress)
  assert.equal(proposal.status, 'selection-required')
  assert.equal(proposal.input.candidates[0].patches.length, 1)
  assert.equal(executeEI(observed, proposal).status, 'blocked')
  const patch = proposal.input.candidates[0].patches[0], detail = JSON.parse(proposal.input.input.locator!)
  assert.equal(patch.address, 'guide/attempts/nurture')
  assert.ok(patch.parents!.includes(sowingAddress))
  assert.deepEqual(patch.relations, [{relation: 'seed-placement', address: sowingAddress}])
  assert.equal(detail.sowing.address, sowingAddress)
  assert.equal(detail.conditions[0].source.id, 'new-observation')
  assert.equal(detail.conditions[0].revision, observed.revision)
  assert.equal(detail.conditions[0].equals, detail.conditions[0].value)
  const next = commit(observed, proposal), [planting] = readEISeedPlantings(next)
  assert.equal(planting.address, sowingAddress)
  assert.equal(planting.receiptId, 'ei-receipt:sow')
  assert.equal(planting.continuationReceiptId, 'ei-receipt:nurture')
  assert.equal(planting.phase, 'selected')
  assert.equal(planting.attemptAddress, patch.address)
  assert.equal(planting.conditions[0].value, 'available')
  assert.equal(planting.environmentStatus, 'available')
  assert.equal(planting.completion, 'unresolved')
  assert.equal(planting.realized, false)
  const retained = next.records.find(record => record.address === sowingAddress)!
  assert.deepEqual(retained.is, oldSow.is)
  assert.deepEqual(retained.was, oldSow.was)
  assert.deepEqual(retained.parents, oldSow.parents)
  assert.ok(retained.receiptIds.includes(planting.continuationReceiptId!))
  assert.equal(readGuideAttempts(next, 'goal')[0].address, planting.attemptAddress)
  assert.deepEqual(readEISeedPlantings(importEILedger(exportEILedger(next))), [planting])
  assert.throws(() => proposeEISeedNurture(next, {id: 'second-nurture', sowingAddress}), /already selected/)
  assert.equal(executeEI(next, proposal).status, 'replayed')
})

test('an exact nurtured attempt links later reported mismatch and match outcomes without declaring world completion', () => {
  const {sown, sowingAddress} = awaitingSow(), observed = update(sown, 'water', 'dry', 'new-observation')
  let next = commit(observed, proposeEISeedNurture(observed, {id: 'nurture', sowingAddress}))
  const attemptAddress = readEISeedPlantings(next)[0].attemptAddress!
  next = commit(next, proposeGuideOutcome(next, {id: 'mismatch', attemptAddress, actual: 'Different returned observation'}))
  next = commit(next, proposeGuideOutcome(next, {id: 'match', attemptAddress, actual: 'A supplied outcome'}))
  const [planting] = readEISeedPlantings(next), attempt = readGuideAttempts(next, 'goal').find(item => item.address === planting.attemptAddress)!
  assert.deepEqual(attempt.outcomes.map(outcome => outcome.comparison), ['mismatch', 'exact-match'])
  assert.equal(attempt.latestOutcome!.worldVerified, false)
  assert.equal(planting.completion, 'unresolved')
  assert.equal(planting.physicalActionExecuted, false)
})

test('unmet and missing environment requirements cannot start nurture', () => {
  const {sown, sowingAddress} = awaitingSow()
  assert.throws(() => proposeEISeedNurture(sown, {id: 'nurture', sowingAddress}), /still need matching/)
  const {ledger, binding} = fixture([{address: 'missing', equals: 'available'}])
  const missing = commit(ledger, proposeEISeedSowing(ledger, {...binding, id: 'missing-sow'}))
  assert.throws(() => proposeEISeedNurture(missing, {id: 'nurture', sowingAddress: 'field/plantings/missing-sow'}), /still need matching/)
  assert.throws(() => proposeEISeedNurture(sown, {id: 'nurture', sowingAddress: 'goal'}), /returned sowing occurrence/)
})

test('a formerly missing addressed observation may be supplied before an explicit nurture', () => {
  const {ledger, binding} = fixture([{address: 'missing', equals: 'available'}])
  const sown = commit(ledger, proposeEISeedSowing(ledger, {...binding, id: 'sow'}))
  const source = {id: 'supplied-observation', text: 'available'}
  const observed = commit(sown, proposeEI(sown, {id: 'supply-missing', producer: 'goal', input: source, candidates: [{id: 'supply', label: 'Retain supplied observation', owner: 'user', source, conditions: [], patches: [{kind: 'create', address: 'missing', value: 'available', source, parents: ['goal']}]}]}))
  assert.equal(readEISeedPlantings(observed)[0].attemptAddress, null)
  const next = commit(observed, proposeEISeedNurture(observed, {id: 'nurture', sowingAddress: 'field/plantings/sow'}))
  const [planting] = readEISeedPlantings(next)
  assert.equal(planting.conditions[0].source, null)
  assert.equal(planting.attemptAddress, 'guide/attempts/nurture')
  assert.equal(readGuideAttempts(next, 'goal')[0].conditions[0].source.id, 'supplied-observation')
})

test('nurture rejects changed canonical seed, intent, and sow while allowing prerequisite revisions to change', () => {
  const {sown, sowingAddress, binding} = awaitingSow(), observed = update(sown, 'water', 'dry', 'new-observation')
  for (const address of [binding.seedAddress, binding.environmentAddress, sowingAddress]) {
    const current = observed.records.find(record => record.address === address)!
    const changed = update(observed, address, current.is.value, `changed-${address}`)
    assert.throws(() => proposeEISeedNurture(changed, {id: 'nurture', sowingAddress}), /changed|current returned/)
  }
  const proposal = proposeEISeedNurture(observed, {id: 'nurture', sowingAddress}), execution = staged(observed, proposal)
  const stale = update(observed, 'water', 'wet again', 'newer-observation')
  assert.equal(executeEI(stale, proposal, chooseEI(proposal, proposal.candidates[0].candidate.id)).status, 'blocked')
  assert.equal(commitEI(stale, verifyEI(execution, {kind: 'rendered-address-values', values: execution.expected})).status, 'rejected')
  assert.equal(readEISeedPlantings(stale)[0].continuationReceiptId, null)
})

test('a missing or local-only nurture return cannot link the pending sow to an attempted action', () => {
  const {sown, sowingAddress} = awaitingSow(), observed = update(sown, 'water', 'dry', 'new-observation')
  const proposal = proposeEISeedNurture(observed, {id: 'nurture', sowingAddress}), execution = staged(observed, proposal)
  const rejected = commitEI(observed, verifyEI(execution, {kind: 'rendered-address-values', values: []}))
  assert.equal(rejected.status, 'rejected')
  assert.equal(readEISeedPlantings(rejected.ledger)[0].attemptAddress, null)
  const local = commitEI(observed, verifyLocalEI(execution))
  assert.equal(local.status, 'committed')
  assert.equal(readEISeedPlantings(local.ledger)[0].continuationReceiptId, null)
  assert.equal(readEISeedPlantings(local.ledger)[0].phase, 'awaiting-environment')
})

test('nurture links one exact sowing address and never adopts another sow or an unrelated guide selection', () => {
  const {sown, sowingAddress, binding} = awaitingSow()
  const second = commit(sown, proposeEISeedSowing(sown, {...binding, id: 'second-sow'}))
  const observed = update(second, 'water', 'dry', 'new-observation')
  const independentlySelected = commit(observed, proposeGuideSelection(observed, {id: 'independent', stepAddress: binding.seedAddress}))
  assert.ok(readEISeedPlantings(independentlySelected).every(item => item.attemptAddress === null))
  const next = commit(independentlySelected, proposeEISeedNurture(independentlySelected, {id: 'nurture', sowingAddress}))
  const plantings = readEISeedPlantings(next)
  assert.equal(plantings.find(item => item.address === sowingAddress)!.attemptAddress, 'guide/attempts/nurture')
  assert.equal(plantings.find(item => item.address === 'field/plantings/second-sow')!.attemptAddress, null)
})
