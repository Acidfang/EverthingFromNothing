import test from 'node:test'
import assert from 'node:assert/strict'
import {createEIThreadDrawPlan, type EIThreadDrawEdgeInput} from '../src/model/ei-thread-draw.ts'
import {createEILedger, exportEILedger} from '../src/model/ei-engine.ts'
import {projectEIFieldArray} from '../src/model/ei-field-array-view.ts'
import {createEIPublicFieldRecords} from '../src/model/ei-public-field.ts'

const nodes = (...addresses: string[]) => addresses.map(address => ({address, revision: 3, sourceId: `source:${address}`}))
const edge = (id: string, from: string, to: string, label = 'contains', known = true): EIThreadDrawEdgeInput =>
  ({id, from, to, label, known, sourceId: `source:${id}`, sourceRevision: 2})

test('centre-out stages follow retained incoming threads before revealing deeper nodes', () => {
  const plan = createEIThreadDrawPlan(nodes('root', 'a', 'b', 'leaf'), [edge('ra', 'root', 'a'), edge('rb', 'root', 'b'), edge('al', 'a', 'leaf'), edge('ab', 'a', 'b')], 'root')
  assert.deepEqual(plan.nodes.map(node => [node.address, node.distance, node.stage]), [['a', 1, 2], ['b', 1, 2], ['leaf', 2, 4], ['root', 0, 0]])
  assert.deepEqual(plan.waves.map(wave => [wave.stage, wave.kind]), [[0, 'nodes'], [1, 'threads'], [2, 'nodes'], [3, 'threads'], [4, 'nodes']])
  for (const node of plan.nodes) if (node.via) {
    const incoming = plan.edges.find(thread => thread.id === node.via!.edgeId)!
    assert.equal(incoming.stage! + 1, node.stage)
    assert.equal(incoming.drawTo, node.address)
    assert.ok(plan.nodes.find(from => from.address === incoming.drawFrom)!.stage! < incoming.stage!)
  }
  assert.equal(plan.edges.find(thread => thread.id === 'ab')!.stage, 3)
  assert.equal(plan.maxDistance, 2); assert.equal(plan.lastStage, 4)
})

test('cycles, self-loops and parallel occurrences remain finite without duplicating canonical nodes', () => {
  const input = [edge('first', 'a', 'b'), edge('parallel', 'a', 'b'), edge('back', 'b', 'a'), edge('self', 'b', 'b')]
  const plan = createEIThreadDrawPlan(nodes('a', 'b'), input, 'a')
  assert.equal(plan.nodes.length, 2); assert.equal(plan.edges.length, 4); assert.equal(plan.lastStage, 3)
  assert.equal(plan.nodes.find(node => node.address === 'b')!.via!.edgeId, 'first')
  assert.deepEqual(plan.edges.map(thread => [thread.id, thread.stage]), [['back', 3], ['first', 1], ['parallel', 1], ['self', 3]])
  for (const retained of input) {
    const thread = plan.edges.find(candidate => candidate.id === retained.id)!
    for (const key of ['from', 'to', 'label', 'sourceId', 'sourceRevision', 'known'] as const) assert.equal(thread[key], retained[key])
  }
})

test('named relations never gain a reverse traversal or an invented component root', () => {
  const plan = createEIThreadDrawPlan(nodes('source', 'incoming', 'island', 'island-child'), [edge('toward-source', 'incoming', 'source'), edge('island-thread', 'island', 'island-child')], 'source')
  assert.deepEqual(plan.unreachableAddresses, ['incoming', 'island', 'island-child'])
  assert.deepEqual(plan.waves, [{stage: 0, distance: 0, kind: 'nodes', nodeAddresses: ['source'], edgeIds: []}])
  assert.ok(plan.edges.every(thread => thread.status === 'unreachable' && thread.stage === null))
})

test('only explicit parent occurrences permit parent-to-child observer traversal', () => {
  const parentId = JSON.stringify(['child', 'parent', 0])
  const namedId = JSON.stringify(['named', 'relation', 0])
  const plan = createEIThreadDrawPlan(nodes('root', 'child', 'named'), [edge(parentId, 'child', 'root', 'parent'), edge(namedId, 'named', 'root', 'parent')], 'root')
  const parent = plan.edges.find(thread => thread.id === parentId)!
  assert.equal(parent.from, 'child'); assert.equal(parent.to, 'root')
  assert.equal(parent.drawFrom, 'root'); assert.equal(parent.drawTo, 'child')
  assert.equal(parent.traversal, 'parent-to-child'); assert.equal(parent.stage, 1)
  assert.equal(plan.nodes.find(node => node.address === 'child')!.via!.traversal, 'parent-to-child')
  assert.deepEqual(plan.unreachableAddresses, ['named'])
  assert.equal(plan.edges.find(thread => thread.id === namedId)!.traversal, 'forward')
})

test('unknown endpoints stay explicit without synthetic nodes, distances or threads', () => {
  const plan = createEIThreadDrawPlan(nodes('source', 'island'), [edge('unknown', 'source', 'missing', 'refers', false), edge('missing-from', 'absent', 'source')], 'source')
  assert.deepEqual(plan.unknownEndpoints, ['absent', 'missing'])
  assert.deepEqual(plan.unreachableAddresses, ['island'])
  assert.equal(plan.nodes.length, 2); assert.equal(plan.edges.length, 2)
  assert.ok(plan.edges.every(thread => thread.status === 'unknown-endpoint' && thread.distance === null && thread.stage === null))
})

test('a child SOURCE follows its actual parent then reaches a sibling through explicit parent incidence', () => {
  const childParent = JSON.stringify(['child', 'parent', 0]), siblingParent = JSON.stringify(['sibling', 'parent', 0])
  const inputEdges = [edge(childParent, 'child', 'parent', 'parent'), edge(siblingParent, 'sibling', 'parent', 'parent')]
  const plan = createEIThreadDrawPlan(nodes('child', 'parent', 'sibling'), inputEdges, 'child')
  assert.deepEqual(plan.nodes.map(node => [node.address, node.distance]), [['child', 0], ['parent', 1], ['sibling', 2]])
  assert.equal(plan.edges.length, 2)
  const forward = plan.edges.find(thread => thread.id === childParent)!, inverse = plan.edges.find(thread => thread.id === siblingParent)!
  assert.equal(forward.traversal, 'forward'); assert.equal(forward.stage, 1)
  assert.equal(inverse.traversal, 'parent-to-child'); assert.equal(inverse.stage, 3)
  assert.equal(inverse.from, 'sibling'); assert.equal(inverse.to, 'parent')
  assert.equal(inverse.drawFrom, 'parent'); assert.equal(inverse.drawTo, 'sibling')
})

test('changing selected SOURCE derives new distances from the same retained incidence', () => {
  const inputNodes = nodes('a', 'b', 'c'), inputEdges = [edge('ab', 'a', 'b'), edge('bc', 'b', 'c')]
  const before = JSON.stringify({inputNodes, inputEdges})
  const a = createEIThreadDrawPlan(inputNodes, inputEdges, 'a'), b = createEIThreadDrawPlan(inputNodes, inputEdges, 'b')
  assert.deepEqual(a.nodes.map(node => node.distance), [0, 1, 2])
  assert.deepEqual(b.nodes.map(node => node.distance), [null, 0, 1])
  assert.equal(b.nodes.find(node => node.address === 'b')!.via, null)
  assert.equal(JSON.stringify({inputNodes, inputEdges}), before)
  assert.throws(() => createEIThreadDrawPlan(inputNodes, inputEdges, 'missing'), /SOURCE address is not retained/)
  assert.throws(() => createEIThreadDrawPlan([], [], 'missing'), /SOURCE address is not retained/)
})

test('reordering input arrays produces the identical plan and stable incoming provenance', () => {
  const inputNodes = nodes('root', 'a', 'b', 'leaf', 'island')
  const inputEdges = [edge('zb', 'root', 'b'), edge('za', 'root', 'a'), edge('bl', 'b', 'leaf'), edge('al', 'a', 'leaf'), edge('unknown', 'island', 'missing', 'refers', false)]
  const plan = createEIThreadDrawPlan(inputNodes, inputEdges, 'root')
  assert.deepEqual(createEIThreadDrawPlan([...inputNodes].reverse(), [...inputEdges].reverse(), 'root'), plan)
  assert.deepEqual(createEIThreadDrawPlan([...inputNodes.slice(2), ...inputNodes.slice(0, 2)], [...inputEdges.slice(1), inputEdges[0]], 'root'), plan)
})

test('actual field projection retains node and thread provenance without committing state or reading geometry', () => {
  const ledger = createEILedger({records: [{address: 'root', value: 'r', source: {id: 'root-source', text: 'r'}}, {address: 'child', value: 'c', parents: ['root'], source: {id: 'child-source', text: 'c'}}]})
  const before = exportEILedger(ledger), field = projectEIFieldArray(ledger, 'state', undefined, 'root')
  const plan = createEIThreadDrawPlan(field.nodes, field.edges, 'root')
  assert.equal(plan.nodes.find(node => node.address === 'child')!.distance, 1)
  assert.equal(plan.edges[0].sourceId, field.edges[0].sourceId)
  assert.equal(plan.edges[0].sourceRevision, field.edges[0].sourceRevision)
  const moved = field.nodes.map(node => ({...node, x: NaN, y: Infinity, depth: 500, component: 42}))
  assert.deepEqual(createEIThreadDrawPlan(moved, field.edges, 'root'), plan)
  assert.equal(exportEILedger(ledger), before)
})

test('ambiguous duplicated identities are rejected instead of merging or dropping retained occurrences', () => {
  assert.throws(() => createEIThreadDrawPlan(nodes('root', 'root'), [], 'root'), /one canonical node/)
  assert.throws(() => createEIThreadDrawPlan(nodes('root'), [edge('same', 'root', 'root'), edge('same', 'root', 'root')], 'root'), /unique retained edge/)
})

test('public inventory draws every retained occurrence from the selected inventory SOURCE without adding incidence', () => {
  const field = projectEIFieldArray(createEILedger({records: createEIPublicFieldRecords()}), 'state')
  const plan = createEIThreadDrawPlan(field.nodes, field.edges, 'model/inventory-root')
  assert.equal(plan.nodes.length, 137); assert.equal(plan.edges.length, 598)
  assert.deepEqual(plan.unreachableAddresses, []); assert.deepEqual(plan.unknownEndpoints, [])
  assert.equal(plan.maxDistance, 2); assert.equal(plan.lastStage, 5)
  const byAddress = new Map(plan.nodes.map(node => [node.address, node]))
  const byId = new Map(plan.edges.map(thread => [thread.id, thread]))
  for (const node of plan.nodes) if (node.via) {
    const thread = byId.get(node.via.edgeId)!
    assert.equal(thread.drawTo, node.address)
    assert.equal(thread.stage! + 1, node.stage)
  }
  for (const thread of plan.edges) {
    assert.equal(thread.status, 'reachable')
    assert.ok(byAddress.get(thread.drawFrom)!.stage! < thread.stage!)
    if (thread.label !== 'parent') {
      assert.equal(thread.traversal, 'forward')
      assert.equal(thread.drawFrom, thread.from); assert.equal(thread.drawTo, thread.to)
    }
  }
  assert.deepEqual(createEIThreadDrawPlan([...field.nodes].reverse(), [...field.edges].reverse(), 'model/inventory-root'), plan)
})
