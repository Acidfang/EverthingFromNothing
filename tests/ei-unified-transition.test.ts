import assert from 'node:assert/strict'
import test from 'node:test'
import {
  advanceEI, chooseEI, createEILedger, executeEI, exportEILedger, importEILedger,
  proposeEI, verifyLocalEI, type EICandidate, type EIExecution, type EILedger, type EIPatch,
} from '../src/model/ei-engine.ts'
import {
  EI_UNIFIED_SCOPE_NOTE, EIUnifiedTransitionError, commitEIUnifiedTransition,
  prepareEIUnifiedTransition, readEIUnifiedVerification, reconstructEIUnifiedTransition,
  serializeEIUnifiedTransition, verifyEIUnifiedTransition, type EIUnifiedReadback, type EIUnifiedTransition,
} from '../src/model/ei-unified-transition.ts'
import { prepareEIConversationTurn, readEIConversation } from '../src/model/ei-conversation.ts'
import { saveEISession, restoreEISession } from '../src/model/ei-session.ts'
import { createEIPublicFieldRecords } from '../src/model/ei-public-field.ts'

function initial(): EILedger {
  return createEILedger({ records: [
    { address: 'root', value: 'captured root', source: { id: 'source:root', text: 'captured root' } },
    { address: 'a', value: '0', source: { id: 'source:a', text: '0' }, parents: ['root'], relations: [{ relation: 'R', address: 'b' }, { relation: 'R', address: 'b' }, { relation: 'open', address: 'unbound' }] },
    { address: 'b', value: '1', source: { id: 'source:b', text: '1' }, parents: ['root'], relations: [{ relation: 'returns', address: 'a' }] },
    { address: 'leaf', value: 'retained support', source: { id: 'source:leaf', text: 'retained support' }, parents: ['a', 'b'] },
  ] })
}
function patch(address: string, value: string): EIPatch { return { address, value, source: { id: `return:${address}:${value}`, text: value } } }
function candidate(patches: readonly EIPatch[], changes: Partial<EICandidate> = {}): EICandidate {
  return { id: 'selected', label: 'Explicit local source update', owner: 'engine', source: { id: 'definition', text: 'Apply the supplied local patches' }, conditions: [], patches, ...changes }
}
function stage(ledger: EILedger, patches: readonly EIPatch[] = [patch('a', 'next')], id = 'transition', extra: readonly EICandidate[] = [], user = false): EIExecution {
  const proposal = proposeEI(ledger, { id, producer: 'root', input: { id: `input:${id}`, text: 'Supplied continuation' }, candidates: [candidate(patches, { owner: user ? 'user' : 'engine' }), ...extra] })
  const execution = executeEI(ledger, proposal, user || extra.length ? chooseEI(proposal, 'selected') : undefined)
  assert.equal(execution.status, 'staged')
  return execution as EIExecution
}
/** A unit fixture for DOM-like textContent returns; this is not a browser or raster observation. */
function renderedFixture(execution: EIExecution, projection: EIUnifiedTransition): EIUnifiedReadback {
  const addresses = new Set(projection.gates.map(gate => gate.address))
  return {
    projectionText: serializeEIUnifiedTransition(projection),
    values: execution.stagedLedger.records.filter(record => addresses.has(record.address)).map(record => ({ address: record.address, value: record.is.value })),
  }
}
function admitted(ledger: EILedger, execution: EIExecution) {
  const projection = prepareEIUnifiedTransition(ledger, execution)
  const verification = verifyEIUnifiedTransition(ledger, execution, projection, renderedFixture(execution, projection))
  const result = commitEIUnifiedTransition(ledger, verification)
  assert.equal(result.status, 'committed')
  return { projection, verification, result }
}
function assertProjectionFailure(action: () => unknown, kind: string): EIUnifiedTransitionError {
  let caught: unknown
  try { action() } catch (error) { caught = error }
  assert.ok(caught instanceof EIUnifiedTransitionError)
  assert.ok(caught.report.checks.some(check => check.kind === kind && !check.matches), `${kind} was not identified in ${JSON.stringify(caught.report)}`)
  assert.ok(Object.isFrozen(caught.report))
  return caught
}

test('one issued identity joins affected gates, source ports, all supporting nodes and explicit threads', () => {
  const ledger = initial(), execution = stage(ledger, [patch('a', 'A'), patch('b', 'B')]), projection = prepareEIUnifiedTransition(ledger, execution)
  assert.deepEqual(projection.identity, { transactionId: 'transition', producer: 'root', baseRevision: 0, candidateId: 'selected', receiptId: 'ei-receipt:transition' })
  assert.deepEqual(projection.gates.map(gate => gate.address), ['a', 'b'])
  assert.deepEqual(projection.nodes.filter(node => node.role === 'affected').map(node => node.address), ['a', 'b'])
  assert.deepEqual(projection.nodes.filter(node => node.role === 'support').map(node => node.address), ['root', 'leaf'])
  assert.deepEqual(projection.gates[0].ports.map(port => [port.role, port.value, port.established]), [['WAS', null, false], ['IS', '0', true], ['NEXT', 'A', false]])
  assert.equal(projection.gates[0].ports[1].sourceId, 'source:a')
  assert.equal(projection.gates[0].ports[2].sourceId, 'return:a:A')
  assert.deepEqual(projection.expectedRender, [{ address: 'a', value: 'A' }, { address: 'b', value: 'B' }])
  assert.equal(projection.threads.length, 8)
  assert.equal(new Set(projection.threads.map(thread => thread.id)).size, projection.threads.length)
  const repeated = projection.threads.filter(thread => thread.kind === 'relation' && thread.from === 'a' && thread.to === 'b')
  assert.equal(repeated.length, 2)
  assert.notEqual(repeated[0].id, repeated[1].id)
  assert.ok(projection.gates.every(gate => /^gate:\d+$/.test(gate.id)))
  assert.ok(projection.threads.every(thread => /^(parent|relation):\d+:\d+$/.test(thread.id)))
  assert.equal(projection.admission.selected, true)
  assert.equal(projection.fieldComplete, false)
  assert.ok(Object.isFrozen(projection.gates[0].ports[2]))
  for(const item of projection.grainReferences){
    assert.deepEqual(item.grains,['state','node','pixel','address','coordinate'])
    assert.ok(projection.nodes.some(node=>node.address===item.reference.address))
  }
  for(const node of projection.sourceFractures.field.nodes)assert.equal(node.canonicalEntityAddress,node.address)
  for(const gate of projection.sourceFractures.field.gates){
    assert.equal(gate.identityKind,'DERIVATION_VIEW')
    assert.ok(projection.nodes.some(node=>node.address===gate.canonicalEntityAddress))
  }
  assert.equal(ledger.revision, 0)
})

test('shared parent DAG retains every parent branch and relation cycles without geometry or invented paths', () => {
  const ledger = initial(), projection = prepareEIUnifiedTransition(ledger, stage(ledger))
  assert.deepEqual(projection.parentGraph.addresses, ['root', 'a', 'b', 'leaf'])
  assert.deepEqual(projection.parentGraph.parents, [[], [0], [0], [1, 2]])
  assert.deepEqual(projection.parentGraph.roots, [0])
  assert.ok(projection.threads.some(thread => thread.from === 'b' && thread.to === 'a' && thread.label === 'returns'))
  assert.deepEqual(projection.openBindings.slice(0, 3).map(item => item.kind), ['geometry', 'indexed-infinity', 'directed-gate-port'])
  const missing = projection.threads.find(thread => thread.to === 'unbound')!
  assert.equal(missing.toKnown, false)
  assert.ok(projection.openBindings.some(item => item.kind === 'missing-relation-endpoint' && item.address === 'unbound'))
  assert.ok(!projection.parentGraph.addresses.includes('unbound'), 'unknown endpoint must not become an invented record')
  assert.equal(projection.threads.filter(thread => thread.to === 'unbound').length, 1, 'unknown thread must remain in actual readback')
})

test('WAS retains actual earlier state, IS is current, and NEXT is only the explicitly selected patch', () => {
  const before = initial(), first = admitted(before, stage(before, [patch('a', '1')], 'first')).result.ledger
  const execution = stage(first, [patch('a', '2')], 'second'), projection = prepareEIUnifiedTransition(first, execution)
  assert.deepEqual(projection.gates[0].ports.map(port => [port.role, port.value]), [['WAS', '0'], ['IS', '1'], ['NEXT', '2']])
  assert.deepEqual(projection.gates[0].retainedHistory, [{ value: '0', revision: 0, sourceId: 'source:a' }])
  assert.equal(projection.threads.find(thread => thread.from === 'a' && thread.kind === 'relation')!.sourceId, 'source:a')
  assert.ok(projection.openBindings.some(item => item.kind === 'directed-gate-port'))
  const second = admitted(first, execution).result
  assert.deepEqual(second.ledger.records.find(record => record.address === 'a')!.was.map(state => state.value), ['0', '1'])
  assert.equal(second.ledger.records.find(record => record.address === 'a')!.is.value, '2')
  const later = admitted(second.ledger, stage(second.ledger, [patch('a', '3')], 'third')).result.ledger
  assert.equal(serializeEIUnifiedTransition(reconstructEIUnifiedTransition(later, second.receipt.id)), serializeEIUnifiedTransition(projection))
})

test('created child and same-transaction descendants remain proposed gates with explicit known endpoint links', () => {
  const ledger = initial(), execution = stage(ledger, [
    { ...patch('new-parent', 'parent input'), kind: 'create', parents: ['root', 'a'], relations: [{ relation: 'declared', address: 'b' }] },
    { ...patch('new-child', 'returned input'), kind: 'create', parents: ['new-parent'], relations: [{ relation: 'unbound-label', address: 'missing-child-target' }] },
  ])
  const projection = prepareEIUnifiedTransition(ledger, execution)
  assert.deepEqual(projection.gates.map(gate => gate.operation), ['create', 'create'])
  assert.ok(projection.gates.every(gate => gate.ports[0].value === null && gate.ports[1].value === null && !gate.ports[2].established))
  assert.deepEqual(projection.gates[0].parentIndices.map(index => projection.parentGraph.addresses[index]), ['root', 'a'])
  const childThread = projection.threads.find(thread => thread.from === 'new-child' && thread.to === 'new-parent')!
  assert.equal(childThread.introduced, true); assert.equal(childThread.toKnown, true)
  assert.ok(projection.nodes.filter(node => node.introduced).every(node => node.role === 'affected'))
  const { result } = admitted(ledger, execution)
  assert.deepEqual(result.ledger.records.find(record => record.address === 'new-child')!.parents, ['new-parent'])
  assert.equal(serializeEIUnifiedTransition(reconstructEIUnifiedTransition(result.ledger, result.receipt.id)), serializeEIUnifiedTransition(projection))
})

test('issued identity rejects fabricated execution, copied projection and a different issued execution', () => {
  const ledger = initial(), execution = stage(ledger), projection = prepareEIUnifiedTransition(ledger, execution), readback = renderedFixture(execution, projection)
  assertProjectionFailure(() => prepareEIUnifiedTransition(ledger, { ...execution }), 'issued-execution')
  assertProjectionFailure(() => prepareEIUnifiedTransition({ ...ledger }, execution), 'issued-ledger')
  assertProjectionFailure(() => serializeEIUnifiedTransition({ ...projection }), 'issued-projection')
  assertProjectionFailure(() => verifyEIUnifiedTransition(ledger, execution, { ...projection }, readback), 'issued-projection')
  const distinct = stage(ledger)
  assertProjectionFailure(() => verifyEIUnifiedTransition(ledger, distinct, projection, readback), 'execution-identity')
  assert.throws(() => { (projection.identity as { candidateId: string }).candidateId = 'forged' }, TypeError)
})

test('stale sources are rejected before projection/readback and cannot commit after a successful readback', () => {
  const ledger = initial(), execution = stage(ledger), projection = prepareEIUnifiedTransition(ledger, execution)
  const verification = verifyEIUnifiedTransition(ledger, execution, projection, renderedFixture(execution, projection))
  const changed = admitted(ledger, stage(ledger, [patch('b', 'changed elsewhere')], 'other')).result.ledger
  assertProjectionFailure(() => prepareEIUnifiedTransition(changed, execution), 'live-snapshot')
  assertProjectionFailure(() => verifyEIUnifiedTransition(changed, execution, projection, renderedFixture(execution, projection)), 'live-snapshot')
  const rejected = commitEIUnifiedTransition(changed, verification)
  assert.equal(rejected.status, 'rejected')
  assert.equal(rejected.ledger, changed)
  assert.ok(rejected.receipt.reasons.some(reason => reason.includes('Stale')))
})

test('omitted or tampered gates, ports, threads, source IDs, parent graph, identity or open endpoints fail the same readback barrier', () => {
  const ledger = initial(), execution = stage(ledger, [patch('a', 'A'), patch('b', 'B')]), projection = prepareEIUnifiedTransition(ledger, execution)
  const readback = renderedFixture(execution, projection)
  const changes: [string, (value: any) => void][] = [
    ['gates', value => value.gates.pop()],
    ['gates', value => value.gates[0].ports.pop()],
    ['gates', value => { value.gates[0].ports[1].value = 'not the captured IS' }],
    ['gates', value => { value.gates[0].ports[2].sourceId = 'unrelated source' }],
    ['threads', value => value.threads.pop()],
    ['threads', value => { value.threads = value.threads.filter((thread: any) => thread.to !== 'unbound') }],
    ['threads', value => { value.threads[0].id = value.threads[1].id }],
    ['threads', value => { value.threads[0].label = 'invented crossing' }],
    ['parentGraph', value => { value.parentGraph.parents[3] = [1] }],
    ['parentGraph', value => { value.parentGraph.roots = [3] }],
    ['identity', value => { value.identity.candidateId = 'other candidate' }],
    ['nodes', value => value.nodes.pop()],
    ['expectedRender', value => value.expectedRender.pop()],
    ['openBindings', value => { value.openBindings = [] }],
    ['fieldComplete', value => { value.fieldComplete = true }],
  ]
  for (const [kind, mutate] of changes) {
    const text = JSON.parse(readback.projectionText); mutate(text)
    assertProjectionFailure(() => verifyEIUnifiedTransition(ledger, execution, projection, { ...readback, projectionText: JSON.stringify(text, null, 2) }), kind)
  }
  for (const text of ['', '{', readback.projectionText + '\n']) assertProjectionFailure(() => verifyEIUnifiedTransition(ledger, execution, projection, { ...readback, projectionText: text }), 'canonical-projection-text')
  assert.equal(ledger.revision, 0)
  assert.equal(ledger.receipts.length, 0)
})

test('complete projection text cannot hide missing, changed, duplicate or unexpected actual returned address values', () => {
  const ledger = initial(), execution = stage(ledger, [patch('a', 'A'), patch('b', 'B')]), projection = prepareEIUnifiedTransition(ledger, execution)
  const cases = [
    [{ address: 'a', value: 'A' }],
    [{ address: 'a', value: 'A' }, { address: 'b', value: 'wrong B' }],
    [{ address: 'a', value: 'A' }, { address: 'b', value: 'B' }, { address: 'b', value: 'B' }],
    [{ address: 'a', value: 'A' }, { address: 'b', value: 'B' }, { address: 'root', value: 'unrequested return' }],
  ]
  for (const values of cases) {
    const verification = verifyEIUnifiedTransition(ledger, execution, projection, { projectionText: serializeEIUnifiedTransition(projection), values })
    assert.equal(verification.committable, false)
    const result = commitEIUnifiedTransition(ledger, verification)
    assert.equal(result.status, 'rejected'); assert.equal(result.ledger, ledger)
  }
  assertProjectionFailure(() => commitEIUnifiedTransition(ledger, verifyLocalEI(execution)), 'shared-verification')
  const good = verifyEIUnifiedTransition(ledger, execution, projection, renderedFixture(execution, projection))
  assertProjectionFailure(() => commitEIUnifiedTransition(ledger, { ...good }), 'shared-verification')
})

test('known selected semantics remain admitted while an alternative condition and geometric/indexed meanings stay open', () => {
  const ledger = initial(), unknown = candidate([patch('b', 'unknown branch')], { id: 'unbound-alternative', conditions: [{ address: 'not-captured-condition', equals: '1' }] })
  const execution = stage(ledger, [patch('a', 'explicit known choice')], 'choice', [unknown], true), projection = prepareEIUnifiedTransition(ledger, execution)
  assert.deepEqual(projection.admission.unresolvedCandidateIds, ['unbound-alternative'])
  assert.equal(projection.admission.selectionMode, 'explicit-user')
  assert.ok(projection.openBindings.some(binding => binding.kind === 'candidate-condition' && binding.address === 'not-captured-condition'))
  const { result, verification } = admitted(ledger, execution)
  assert.equal(result.status, 'committed')
  assert.equal(readEIUnifiedVerification(verification)?.checks.every(check => check.matches), true)
  assert.equal(result.receipt.differences.some(difference => difference.status === 'unresolved'), true)
  assert.equal(projection.fieldComplete, false)
})

test('committed receipt reconstruction is deterministic after import and later changes and never trusts a supplied receipt object', () => {
  const ledger = initial(), { projection, verification, result } = admitted(ledger, stage(ledger))
  const first = reconstructEIUnifiedTransition(result.ledger, result.receipt.id)
  assert.equal(serializeEIUnifiedTransition(first), serializeEIUnifiedTransition(projection))
  assert.equal(reconstructEIUnifiedTransition(result.ledger, result.receipt.id), first, 'immutable historical projection may be cached by ledger/receipt')
  const restored = importEILedger(exportEILedger(result.ledger))
  assert.equal(serializeEIUnifiedTransition(reconstructEIUnifiedTransition(restored, result.receipt.id)), serializeEIUnifiedTransition(projection))
  assertProjectionFailure(() => reconstructEIUnifiedTransition(restored, 'not-a-receipt'), 'retained-receipt')
  assertProjectionFailure(() => reconstructEIUnifiedTransition({ ...restored }, result.receipt.id), 'issued-ledger')
  assertProjectionFailure(() => reconstructEIUnifiedTransition(restored, result.receipt as never), 'retained-receipt')
  const replay = commitEIUnifiedTransition(result.ledger, verification)
  assert.equal(replay.status, 'replayed'); assert.equal(replay.ledger, result.ledger)
  assert.ok(!('projectionText' in result.receipt), 'receipt schema must not imply a persisted projection observation')
  assert.match(EI_UNIFIED_SCOPE_NOTE, /does not re-observe a historical frame/)
})

test('legacy local-only receipts reconstruct the same historical proposed records without inventing an observed shared frame', () => {
  const ledger = initial(), execution = stage(ledger), projection = prepareEIUnifiedTransition(ledger, execution)
  const result = advanceEI(ledger, execution.proposal)
  assert.equal(result.status, 'committed'); assert.equal(result.receipt.scope, 'local-staged-records')
  const historical = reconstructEIUnifiedTransition(result.ledger, result.receipt.id)
  assert.equal(serializeEIUnifiedTransition(historical), serializeEIUnifiedTransition(projection))
  assert.equal(readEIUnifiedVerification(verifyLocalEI(execution)), null)
  assert.match(EI_UNIFIED_SCOPE_NOTE, /DOM transition-record text/)
  assert.match(EI_UNIFIED_SCOPE_NOTE, /Receipt reconstruction checks retained replay consistency/)
})

test('captured input shares its gate, open thread, rendered return, commit, recovery and receipt projection without a fabricated reply', async () => {
  const ledger = initial(), turn = await prepareEIConversationTurn({ ledger, root: 'root', input: 'read "a"', id: 'chat-source-query' })
  assert.equal(turn.status, 'proposed'); if (turn.status !== 'proposed') throw Error(turn.reason)
  assert.equal(turn.reply, null); assert.equal(turn.mode, 'capture-only')
  const execution = executeEI(ledger, turn.proposal)
  assert.equal(execution.status, 'staged'); if (execution.status !== 'staged') throw Error('Expected conversation staging')
  const projection = prepareEIUnifiedTransition(ledger, execution)
  assert.deepEqual(projection.gates.map(gate => gate.address), [turn.user.address])
  assert.ok(projection.threads.some(thread => thread.from === turn.user.address && thread.to === 'root' && thread.label === 'conversation-context'))
  assert.ok(projection.threads.some(thread => thread.to === 'unbound' && !thread.toKnown))
  const values = [{ address: turn.user.address, value: 'read "a"' }]
  const missingReply = verifyEIUnifiedTransition(ledger, execution, projection, { values: [], projectionText: serializeEIUnifiedTransition(projection) })
  assert.equal(commitEIUnifiedTransition(ledger, missingReply).status, 'rejected')
  const verified = verifyEIUnifiedTransition(ledger, execution, projection, { values, projectionText: serializeEIUnifiedTransition(projection) })
  const committed = commitEIUnifiedTransition(ledger, verified)
  assert.equal(committed.status, 'committed')
  const restored = restoreEISession(saveEISession('root', committed.ledger, null, []))
  assert.equal(readEIConversation(restored.ledger, 'root').turns.length, 1); assert.equal(readEIConversation(restored.ledger, 'root').turns[0].text, 'read "a"')
  assert.equal(serializeEIUnifiedTransition(reconstructEIUnifiedTransition(restored.ledger, committed.receipt.id)), serializeEIUnifiedTransition(projection))
  assert.equal(projection.fieldComplete, false)
})

test('public 137-record source field and all explicit threads fit the complete projection during real sourced chat', async () => {
  const seeds = createEIPublicFieldRecords(), ledger = createEILedger({ records: [{ address: 'root', value: 'source conversation', source: { id: 'root-source', text: 'source conversation' } }, ...seeds] })
  const turn = await prepareEIConversationTurn({ ledger, root: 'root', input: 'what is NOTHING?', id: 'public-source-query' })
  assert.equal(turn.status, 'proposed'); if (turn.status !== 'proposed') throw Error(turn.reason)
  assert.equal(turn.reply, null)
  const execution = executeEI(ledger, turn.proposal)
  assert.equal(execution.status, 'staged'); if (execution.status !== 'staged') throw Error('Expected conversation staging')
  const projection = prepareEIUnifiedTransition(ledger, execution), raw = serializeEIUnifiedTransition(projection)
  assert.equal(projection.nodes.length, 139)
  assert.equal(projection.gates.length, 1)
  const count = execution.stagedLedger.records.reduce((sum, record) => sum + record.parents.length + record.relations.length, 0)
  assert.equal(projection.threads.length, count)
  assert.ok(new TextEncoder().encode(raw).length < 4 * 1_024 * 1_024)
  const result = commitEIUnifiedTransition(ledger, verifyEIUnifiedTransition(ledger, execution, projection, renderedFixture(execution, projection)))
  assert.equal(result.status, 'committed')
  assert.equal(serializeEIUnifiedTransition(reconstructEIUnifiedTransition(result.ledger, result.receipt.id)), raw)
})
