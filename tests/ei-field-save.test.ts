import test from 'node:test'
import assert from 'node:assert/strict'
import {advanceEI, createEILedger, exportEILedger, proposeEI, type EILedger} from '../src/model/ei-engine.ts'
import {restoreEISession, saveEISession} from '../src/model/ei-session.ts'
import {createEIThreadDrawPlan} from '../src/model/ei-thread-draw.ts'
import {projectEIFieldArray} from '../src/model/ei-field-array-view.ts'
import {commitEIAnimationFrame, createEIAnimationCycle, exportEIAnimationCycle, proposeNextEIAnimationFrame, rebaseEIAnimationCycle, restoreEIAnimationCycle, verifyEIAnimationReadback, type EIAnimationCycle} from '../src/model/ei-animation-cycle.ts'
import {commitEIFitImprovement, createEIFitImprovementState, proposeEIFitImprovement, restoreEIFitImprovement, serializeEIFitImprovement, type EIFitEvidence} from '../src/model/ei-fit-improvement.ts'
import {createEIIdleState, observeEIIdle} from '../src/model/ei-idle-observation.ts'
import {EI_FIELD_SAVE_LIMITS, packEIFieldSave, unpackEIFieldSave, type EIFieldPresentationSnapshot} from '../src/model/ei-field-save.ts'

const root = 'canonical:source'
const ledger = createEILedger({records: [
  {address: root, value: 'source α\n\u0000', source: {id: 'source:root', text: 'original source α\n\u0000'}},
  {address: 'part', value: 'learn this', source: {id: 'source:part', text: 'retained child'}, parents: [root]},
]})
const session = () => saveEISession(root, ledger, null, [])
function plan(value: EILedger = ledger, observer = root) {
  const field = projectEIFieldArray(value, 'node', undefined, observer)
  return createEIThreadDrawPlan(field.nodes, field.edges, observer)
}
function returned(cycle: EIAnimationCycle) {
  const {frameKey, source, generation, sequence, content} = cycle.NEXT!
  return structuredClone({frameKey, source, generation, sequence, content})
}
function committed(cycle: EIAnimationCycle) {
  const pending = proposeNextEIAnimationFrame(cycle)
  return commitEIAnimationFrame(pending, verifyEIAnimationReadback(pending, returned(pending)))
}
function drawing() {
  return proposeNextEIAnimationFrame(committed(createEIAnimationCycle(plan(), {generation: 'first-live-render'})))
}
function snapshot(cycle = drawing()): EIFieldPresentationSnapshot {
  return {schema: 'ei.field-presentation.v1', canonicalRoot: root, observerZero: root,
    zeroHistory: [root], selectedAddress: 'part', selectedRevision: 0, grain: 'node', view: {x: 120, y: -50, zoom: 2.5},
    orientation: {yaw: .46, pitch: .18}, animation: exportEIAnimationCycle(cycle),
    improvement: serializeEIFitImprovement(createEIFitImprovementState())}
}
const rawEnvelope = (presentation: unknown, source = session()) => JSON.stringify({format: 'ei-field-save/v1', sessionString: source, presentation})

test('plain v1/v2 session recovery and saving without presentation preserve original bytes', () => {
  const legacy = JSON.stringify({format: 'ei-page-session/v1', root, ledger: exportEILedger(ledger), pending: null, attempts: []}, null, 2)
  for (const original of [legacy, session(), `\n ${session()} \n`]) {
    assert.deepEqual(unpackEIFieldSave(original), {sessionString: original, presentation: null})
    assert.equal(packEIFieldSave(original), original)
    assert.equal(packEIFieldSave(original, null), original)
    const combined = unpackEIFieldSave(packEIFieldSave(original, snapshot()))
    assert.equal(combined.sessionString, original)
    assert.equal(exportEILedger(restoreEISession(combined.sessionString).ledger), exportEILedger(ledger))
  }
  assert.equal(unpackEIFieldSave(JSON.stringify({format: 'ei-field-save/v1', sessionString: legacy})).presentation, null)
})

test('combined recovery preserves pending learning, failed attempts, camera, renderer history and exact source', () => {
  const pending = proposeEI(ledger, {id: 'local-proposal/11', producer: root, input: {id: 'user:next', text: 'continue learning'}, candidates: []})
  const attempts = [{transactionId: 'local-proposal/13', producer: root, phase: 'render' as const, message: 'no readback', detail: 'Retain current source', committed: false as const}]
  const source = saveEISession(root, ledger, pending, attempts), presentation = snapshot()
  const saved = packEIFieldSave(source, presentation), restored = unpackEIFieldSave(saved), recovered = restoreEISession(restored.sessionString)
  assert.equal(restored.sessionString, source)
  assert.deepEqual(restored.presentation, presentation)
  assert.equal(recovered.root, root)
  assert.deepEqual(recovered.pending, pending)
  assert.deepEqual(recovered.attempts, attempts)
  assert.equal(recovered.nextSequence, 14)
  assert.equal(exportEILedger(recovered.ledger), exportEILedger(ledger))
  assert.ok(Object.isFrozen(restored) && Object.isFrozen(restored.presentation?.view))
  assert.equal(packEIFieldSave(restored.sessionString, restored.presentation), saved)
})

test('recovery retains historical rendering proof but requires fresh live readback for the next frame', () => {
  const original = drawing(), restored = unpackEIFieldSave(packEIFieldSave(session(), snapshot(original)))
  const resumed = restoreEIAnimationCycle(restored.presentation!.animation, {generation: 'new-live-render'})
  assert.deepEqual(resumed.history, original.history)
  assert.deepEqual(resumed.IS, original.IS)
  assert.equal(resumed.NEXT, null)
  assert.equal(resumed.complete, false)
  const pending = proposeNextEIAnimationFrame(resumed), oldReceipt = verifyEIAnimationReadback(original, returned(original))
  assert.equal(commitEIAnimationFrame(pending, oldReceipt).IS, resumed.IS)
  assert.equal(commitEIAnimationFrame(pending, verifyEIAnimationReadback(pending, returned(pending))).IS?.generation, 'new-live-render')
  const unverified = createEIAnimationCycle(plan(), {generation: 'not-yet-rendered'})
  assert.equal(unpackEIFieldSave(packEIFieldSave(session(), snapshot(unverified))).presentation?.animation, exportEIAnimationCycle(unverified))
})

test('validation generation is deterministic and never conflicts with retained generations', () => {
  const initial = createEIAnimationCycle(plan(), {generation: 'ei-field-save:validation:0'})
  const saved = packEIFieldSave(session(), snapshot(initial))
  assert.equal(packEIFieldSave(session(), snapshot(initial)), saved)
  assert.deepEqual(unpackEIFieldSave(saved).presentation, snapshot(initial))
})

test('root, ZERO, selection, history, grain and invalid view values are rejected before replacement', () => {
  const good = snapshot(), before = JSON.stringify(good), existing = packEIFieldSave(session(), good)
  const invalid = [
    {...good, canonicalRoot: 'part'}, {...good, observerZero: 'part'}, {...good, observerZero: 'absent'},
    {...good, selectedAddress: 'absent'}, {...good, selectedRevision: 999}, {...good, selectedRevision: -1}, {...good, zeroHistory: [root, 'absent']}, {...good, grain: 'world'},
    {...good, view: {...good.view, zoom: 0}}, {...good, view: {...good.view, x: Infinity}},
    {...good, orientation: {...good.orientation, pitch: NaN}}, {...good, schema: 'future'}, {...good, unexpected: true},
  ]
  for (const value of invalid) {
    assert.throws(() => unpackEIFieldSave(rawEnvelope(value)))
    assert.equal(packEIFieldSave(session(), good), existing)
  }
  assert.equal(JSON.stringify(good), before)
})

test('internally valid animation from another source or a forged historical revision is rejected', () => {
  const original = plan()
  for (const nodes of [
    original.nodes.map(node => node.address === root ? {...node, sourceId: 'foreign:source'} : node),
    original.nodes.map(node => node.address === 'part' ? {...node, revision: 999} : node),
  ]) {
    const cycle = createEIAnimationCycle(createEIThreadDrawPlan(nodes, original.edges, root), {generation: 'wrong-source'})
    assert.throws(() => unpackEIFieldSave(rawEnvelope(snapshot(cycle))), /retained IS\/WAS/)
  }
  const wrongEdge = createEIAnimationCycle(createEIThreadDrawPlan(original.nodes, original.edges.map(edge => ({...edge, sourceId: 'foreign:edge'})), root), {generation: 'wrong-edge'})
  assert.throws(() => packEIFieldSave(session(), snapshot(wrongEdge)), /retained IS\/WAS/)
})

test('corrupt renderer cycles and ambiguous envelopes fail closed', () => {
  const good = snapshot(), cycle = drawing(), saved = packEIFieldSave(session(), good)
  for (const animation of ['not-json', '{}', exportEIAnimationCycle({...cycle, cursor: 900}), exportEIAnimationCycle({...cycle, IS: null}), exportEIAnimationCycle({...cycle, history: []})]) {
    assert.throws(() => unpackEIFieldSave(rawEnvelope({...good, animation})))
  }
  assert.throws(() => unpackEIFieldSave(saved.replace('"format":', '"format":"ignored","format":')), /duplicate/)
  assert.throws(() => unpackEIFieldSave(JSON.stringify({...JSON.parse(saved), extra: 1})), /fields/)
  assert.throws(() => unpackEIFieldSave('{"format":"ei-field-save/v2"}'))
})

test('animation edges retain exact occurrence kind and index instead of inventing inverse parent traversal', () => {
  const value = createEILedger({records: [
    {address: 'a', value: 'a', source: {id: 'source:a', text: 'a'}, relations: [{relation: 'parent', address: 'b'}]},
    {address: 'b', value: 'b', source: {id: 'source:b', text: 'b'}},
  ]})
  const field = projectEIFieldArray(value, 'state', undefined, 'b')
  const original = createEIThreadDrawPlan(field.nodes, field.edges, 'b')
  const presentation = (edges = field.edges): EIFieldPresentationSnapshot => ({
    ...snapshot(createEIAnimationCycle(createEIThreadDrawPlan(field.nodes, edges, 'b'), {generation: 'occurrence-check'})),
    canonicalRoot: 'a', observerZero: 'b', zeroHistory: ['a', 'b'], selectedAddress: 'b', selectedRevision: 0,
  })
  const source = saveEISession('a', value, null, [])
  assert.deepEqual(original.unreachableAddresses, ['a'])
  assert.doesNotThrow(() => packEIFieldSave(source, presentation()))
  const reverse = field.edges.map(edge => ({...edge, id: JSON.stringify(['a', 'parent', 0])}))
  assert.deepEqual(createEIThreadDrawPlan(field.nodes, reverse, 'b').unreachableAddresses, [])
  for (const edges of [reverse,
    field.edges.map(edge => ({...edge, id: JSON.stringify(['a', 'relation', 99])})),
    field.edges.map(edge => ({...edge, known: false})),
  ]) assert.throws(() => packEIFieldSave(source, presentation(edges)), /retained incidence occurrence/)
})

test('save envelope byte cap, independent animation cap and expansion guard fail without truncation', () => {
  const good = snapshot()
  assert.throws(() => unpackEIFieldSave(' '.repeat(EI_FIELD_SAVE_LIMITS.storedBytes + 1)), /exceeds/)
  assert.throws(() => packEIFieldSave(session(), {...good, animation: ' '.repeat(EI_FIELD_SAVE_LIMITS.animationBytes + 1)}), /animation snapshot exceeds/)
  const values: unknown[] = ['repeated']
  for (let index = 0; index < 30; index++) values.push({type: 'array', items: [index, index]})
  assert.throws(() => packEIFieldSave(session(), {...good, animation: JSON.stringify({kind: 'EI_ANIMATION_SNAPSHOT', version: 1, root: values.length - 1, values})}), /expanded animation/)
  assert.throws(() => unpackEIFieldSave(JSON.stringify({format: 'ei-field-save/v1', sessionString: session(), presentation: {...good, improvement: 'α'.repeat(EI_FIELD_SAVE_LIMITS.storedBytes / 2)}})), /field save exceeds/)
})

test('idle observations and fit improvements remain source-bound historical evidence', () => {
  const cycle = committed(committed(createEIAnimationCycle(plan(), {generation: 'observed'}))), frame = cycle.IS!
  const readback = {frameKey: frame.frameKey, source: frame.source, generation: frame.generation, sequence: frame.sequence, content: frame.content}
  const idle = observeEIIdle(observeEIIdle(createEIIdleState(), frame, readback, 1000), frame, readback, 2000)
  const evidence: EIFitEvidence = {sourceSnapshot: JSON.stringify([root, ledger.revision, 'node']), viewport: {width: 100, height: 100}, view: {x: 0, y: 0, zoom: 1}, objects: [{address: root, revision: 0, sourceId: 'source:root', bounds: {left: 100, right: 300, top: 0, bottom: 100}}]}
  const initial = createEIFitImprovementState(), proposal = proposeEIFitImprovement(initial, evidence).proposal!
  const fitted = commitEIFitImprovement(initial, proposal, {...evidence, view: proposal.camera}, {proposalId: proposal.proposalId, sourceSnapshot: evidence.sourceSnapshot, viewport: evidence.viewport, viewBox: proposal.expectedViewBox, objects: evidence.objects})
  const improvement = serializeEIFitImprovement(fitted.state), presentation = {...snapshot(cycle), idle, improvement}
  const restored = unpackEIFieldSave(packEIFieldSave(session(), presentation)).presentation!
  assert.deepEqual(restored.idle, idle)
  const fit = restoreEIFitImprovement(restored.improvement, null)
  assert.equal(fit.status, 'stale'); assert.equal(fit.applicableCamera, null)
  assert.deepEqual(fit.state, fitted.state)
  assert.throws(() => unpackEIFieldSave(rawEnvelope({...presentation, idle: {...idle, observations: 20}})), /counts/)
  assert.throws(() => unpackEIFieldSave(rawEnvelope({...presentation, idle: {...idle, IS: {...idle.IS!, entityAddress: 'part'}}})), /historical animation frame/)
  assert.throws(() => unpackEIFieldSave(rawEnvelope({...presentation, improvement: improvement.replace('"revision":1', '"revision":90')})), /fit improvement/)
})

test('continued learning retains old sources, later records, canonical root and previous rendering history', () => {
  const previousDrawing = drawing(), previous = unpackEIFieldSave(packEIFieldSave(session(), snapshot(previousDrawing)))
  const recovered = restoreEISession(previous.sessionString)
  const next = proposeEI(recovered.ledger, {id: 'local-proposal/1', producer: root, input: {id: 'user:learn', text: 'retain this next state'}, candidates: [{id: 'continue', owner: 'engine', label: 'retain new information', source: {id: 'source:next-choice', text: 'specific addition'}, conditions: [], patches: [
    {address: root, value: 'learned α', source: {id: 'source:root:next', text: 'new source observation'}},
    {kind: 'create', address: 'learned:later', value: 'new retained information', source: {id: 'source:later', text: 'literal new evidence'}, parents: [root]},
  ]}]})
  const advanced = advanceEI(recovered.ledger, next)
  assert.equal(advanced.status, 'committed')
  const continuedSession = saveEISession(recovered.root, advanced.ledger, null, [])
  // A still-old view is valid historical evidence while the next view is staged.
  assert.equal(unpackEIFieldSave(packEIFieldSave(continuedSession, previous.presentation)).sessionString, continuedSession)
  const rebased = proposeNextEIAnimationFrame(rebaseEIAnimationCycle(previousDrawing, plan(advanced.ledger), {generation: 'after-learning'}))
  const combined = unpackEIFieldSave(packEIFieldSave(continuedSession, {...snapshot(rebased), selectedAddress: 'learned:later', selectedRevision: 1, zeroHistory: [root, 'learned:later']}))
  const retained = restoreEISession(combined.sessionString)
  assert.equal(retained.root, root)
  assert.equal(exportEILedger(retained.ledger), exportEILedger(advanced.ledger))
  assert.equal(retained.ledger.records.find(record => record.address === root)?.was[0].source.text, ledger.records.find(record => record.address === root)?.is.source.text)
  assert.ok(retained.ledger.records.some(record => record.address === 'learned:later'))
  const replayed = restoreEIAnimationCycle(combined.presentation!.animation, {generation: 'restore-after-learning'})
  assert.deepEqual(replayed.history, previousDrawing.history)
  assert.equal(replayed.source.revision, 1)
  assert.equal(replayed.IS?.source.revision, 0)
  assert.equal(replayed.NEXT, null)
  const historical = unpackEIFieldSave(packEIFieldSave(continuedSession, {...snapshot(rebased), selectedAddress: root, selectedRevision: 0}))
  assert.equal(historical.presentation?.selectedRevision, 0)
  assert.equal(historical.presentation?.selectedAddress, root)
  assert.equal(restoreEISession(historical.sessionString).ledger.records.find(record => record.address === root)?.is.revision, 1)
})

test('fit source mismatches cannot claim a committed fit, while recorded failed evidence is retained', () => {
  const evidence: EIFitEvidence = {sourceSnapshot: 'fit-source', viewport: {width: 100, height: 100}, view: {x: 0, y: 0, zoom: 1}, objects: [{address: root, revision: 0, sourceId: 'source:root', bounds: {left: 100, right: 300, top: 0, bottom: 100}}]}
  const state = createEIFitImprovementState(), proposal = proposeEIFitImprovement(state, evidence).proposal!
  const foreign = {...evidence, objects: evidence.objects.map(item => ({...item, sourceId: 'foreign'}))}
  const conflict = commitEIFitImprovement(state, proposal, {...foreign, view: proposal.camera}, null)
  assert.equal(conflict.status, 'conflict')
  const archived = {...snapshot(), improvement: serializeEIFitImprovement(conflict.state)}
  assert.equal(unpackEIFieldSave(packEIFieldSave(session(), archived)).presentation?.improvement, archived.improvement)
  const foreignProposal = proposeEIFitImprovement(state, foreign).proposal!
  const foreignFit = commitEIFitImprovement(state, foreignProposal, {...foreign, view: foreignProposal.camera}, {proposalId: foreignProposal.proposalId, sourceSnapshot: foreign.sourceSnapshot, viewport: foreign.viewport, viewBox: foreignProposal.expectedViewBox, objects: foreign.objects})
  assert.equal(foreignFit.status, 'committed')
  assert.throws(() => packEIFieldSave(session(), {...snapshot(), improvement: serializeEIFitImprovement(foreignFit.state)}), /retained IS\/WAS/)
})
