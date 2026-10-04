import test from 'node:test'
import assert from 'node:assert/strict'
import { createEIModelerObjectDraw, EI_RETAINED_MODELER_OBJECT, bindEIWorldObjectToModeler } from '../src/model/ei-modeler-object.ts'
import { SHARED_TETRAHEDRON_VERTICES, SHARED_ZERO } from '../src/model/three-tetrahedron-drawing.ts'
import { EI_FIELD_ACTION_GEOMETRY } from '../src/model/ei-field-action.ts'
import { projectInDirection } from '../src/model/directional-view.ts'
import { deriveEIWorldObject, projectEIWorldObject } from '../src/model/ei-world-object.ts'
import { createEIPublicFieldRecords } from '../src/model/ei-public-field.ts'
import { createEILedger } from '../src/model/ei-engine.ts'
import { deriveEIFieldObject } from '../src/model/ei-field-object.ts'

test('retained source centre, four vertices and six existing binary edges retain their identities', () => {
  const object = EI_RETAINED_MODELER_OBJECT, before = JSON.stringify(object)
  assert.deepEqual(object.centre.point, SHARED_ZERO)
  assert.deepEqual(object.vertices.map(vertex => vertex.point), SHARED_TETRAHEDRON_VERTICES)
  assert.deepEqual(object.edges.map(edge => [object.vertices.findIndex(vertex => vertex.id === edge.from), object.vertices.findIndex(vertex => vertex.id === edge.to)]), EI_FIELD_ACTION_GEOMETRY.edges)
  const draw = createEIModelerObjectDraw(object, { width: 41, height: 37, yaw: 0, pitch: 0, direction: 2 })
  for (let i = 0; i < object.vertices.length; i++) {
    const expected = projectInDirection(object.vertices[i].point, 2), actual = draw.projection.vertices[i]
    assert.equal(actual.id, object.vertices[i].id)
    assert.equal(actual.sourceId, object.vertices[i].sourceId)
    assert.equal(actual.x, 20 + expected.x * draw.projection.scale)
    assert.equal(actual.y, 18 - expected.y * draw.projection.scale)
    assert.equal(actual.depth, expected.depth)
  }
  assert.equal(JSON.stringify(object), before)
})

test('addressed assignments construct every target pixel exactly once in source-centre-out order', () => {
  const draw = createEIModelerObjectDraw(EI_RETAINED_MODELER_OBJECT, { width: 45, height: 39 })
  assert.equal(draw.returnBuffer(), null)
  assert.equal(draw.mayPresentAsComplete(true), false)
  const partial = draw.assign(97)
  assert.equal(partial.assigned, 97)
  assert.equal(partial.assignedTargets, 97)
  assert.equal(partial.modelAdvanced, false)
  assert.equal(draw.returnBuffer(), null)
  draw.assign(45 * 39)
  assert.equal(draw.mayPresentAsComplete(true), false)
  const output = draw.returnBuffer()!
  assert.ok(output)
  assert.equal(output.rgba.length, 45 * 39 * 4)
  assert.ok(output.assignmentCounts.every(count => count === 1))
  assert.equal(new Set(output.targetOrder).size, 45 * 39)
  let lastDistance = -1
  for (const target of output.targetOrder) {
    const distance = (target % 45 - 22) ** 2 + (Math.floor(target / 45) - 19) ** 2
    assert.ok(distance >= lastDistance)
    lastDistance = distance
    assert.equal(output.rgba[target * 4 + 3], 255)
  }
  assert.equal(output.targetOrder[0], 19 * 45 + 22)
  assert.equal(output.primitiveAtPixel[output.targetOrder[0]], 0)
  assert.equal(output.receipt.complete, true)
  assert.equal(output.receipt.returned, true)
  assert.equal(draw.mayPresentAsComplete(false), false)
  assert.equal(draw.mayPresentAsComplete(true), true)
  assert.equal(output.modelAdvanced, false)
  draw.assign(100)
  assert.equal(draw.receipt().assignedTargets, 45 * 39)
})

test('pixel construction is batch-independent and returned buffers cannot mutate internal output', () => {
  const options = { width: 32, height: 28 }
  const single = createEIModelerObjectDraw(EI_RETAINED_MODELER_OBJECT, options)
  const chunked = createEIModelerObjectDraw(EI_RETAINED_MODELER_OBJECT, options)
  single.assign(896)
  while (!chunked.receipt().complete) chunked.assign(11)
  const a = single.returnBuffer()!, b = chunked.returnBuffer()!
  assert.deepEqual(a.rgba, b.rgba)
  assert.equal(a.checksum, b.checksum)
  assert.ok(new Set(a.primitiveAtPixel).size > 5)
  a.rgba.fill(0)
  assert.deepEqual(single.returnBuffer()!.rgba, b.rgba)
})

test('unknown endpoints fail before a drawable job exists; cancellation cannot complete', () => {
  assert.throws(() => createEIModelerObjectDraw({ ...EI_RETAINED_MODELER_OBJECT, edges: [{ id: 'unknown-edge', sourceId: 'retained', from: EI_RETAINED_MODELER_OBJECT.vertices[0].id, to: 'absent' }] }, { width: 10, height: 10 }), /Unknown retained edge endpoint/)
  const draw = createEIModelerObjectDraw(EI_RETAINED_MODELER_OBJECT, { width: 10, height: 10 })
  draw.assign(7)
  draw.cancel()
  draw.assign(100)
  assert.equal(draw.receipt().assignedTargets, 7)
  assert.equal(draw.returnBuffer(), null)
  assert.equal(draw.mayPresentAsComplete(true), false)
})

test('observer changes pixels while source geometry remains unchanged', () => {
  const before = JSON.stringify(EI_RETAINED_MODELER_OBJECT)
  const a = createEIModelerObjectDraw(EI_RETAINED_MODELER_OBJECT, { width: 51, height: 49, direction: 0 })
  const b = createEIModelerObjectDraw(EI_RETAINED_MODELER_OBJECT, { width: 51, height: 49, direction: 1 })
  a.assign(2499); b.assign(2499)
  const first = a.returnBuffer()!, second = b.returnBuffer()!
  assert.notDeepEqual(first.rgba, second.rgba)
  assert.deepEqual(first.retained, second.retained)
  assert.equal(JSON.stringify(EI_RETAINED_MODELER_OBJECT), before)
  assert.equal(first.geometryDerived, false)
  assert.ok(first.unresolved.includes('source-law-for-new-object-shapes'))
})

test('actual public object mesh keeps authored blueprint provenance and every face and boundary identity', () => {
  const records = createEIPublicFieldRecords(), record = records.find(record => record.address === 'model/group-1')!
  const parts = deriveEIFieldObject(createEILedger({ records }), record.address, 'state').partAddresses
  const world = deriveEIWorldObject({ address: record.address, revision: 0, sourceId: record.source.id, value: record.value, partCount: parts.length, root: false })
  const before = JSON.stringify(world), input = bindEIWorldObjectToModeler(world)
  assert.equal(parts.length, 17)
  assert.equal(input.provenance?.geometryScope, 'authored-presentation-geometry')
  assert.deepEqual(input.provenance?.binding, world.identity)
  assert.deepEqual(input.vertices.map(vertex => vertex.point), world.vertices)
  assert.equal(input.faces!.length, world.faces.length)
  const boundaries = input.edges.flatMap(edge => edge.boundaryFaces!)
  for (const face of input.faces!) assert.equal(boundaries.filter(id => id === face.id).length, face.vertices.length)
  const options = { width: 68, height: 64, showVertexMarkers: false, showCentreMarker: false, strokeWidth: .5 }
  const a = createEIModelerObjectDraw(input, options), b = createEIModelerObjectDraw(input, options)
  a.assign(68 * 64)
  while (!b.receipt().complete) b.assign(101)
  const first = a.returnBuffer()!, second = b.returnBuffer()!
  assert.deepEqual(first.rgba, second.rgba)
  assert.equal(first.checksum, second.checksum)
  assert.deepEqual(first.retained.faces, input.faces)
  assert.deepEqual(first.retained.edges, input.edges)
  assert.ok(first.assignmentCounts.every(count => count === 1))
  assert.ok(first.primitiveAtPixel.some(index => index >= 0 && first.primitives[index].kind === 'face'))
  assert.equal(first.geometryScope, 'authored-presentation-geometry')
  assert.equal(first.geometryDerived, false)
  assert.equal(first.modelAdvanced, false)
  assert.equal(JSON.stringify(world), before)
})

test('unknown face vertices and unknown edge-face references fail before drawing', () => {
  assert.throws(() => createEIModelerObjectDraw({ ...EI_RETAINED_MODELER_OBJECT,
    faces: [{ id: 'face', sourceId: 'supplied', vertices: ['absent', 'absent', 'absent'], fill: '#aabbcc' }],
  }, { width: 10, height: 10 }), /Unknown retained face vertex/)
  assert.throws(() => createEIModelerObjectDraw({ ...EI_RETAINED_MODELER_OBJECT,
    edges: [{ ...EI_RETAINED_MODELER_OBJECT.edges[0], boundaryFaces: ['absent'] }],
  }, { width: 10, height: 10 }), /Unknown retained edge boundary face/)
})

test('transparent texture targets are all assigned and returned placement matches observer projection', () => {
  const world = deriveEIWorldObject({ address: 'source/item', revision: 2, sourceId: 'retained', value: 'exact value', partCount: 3, root: false })
  const projection = projectEIWorldObject(world, .46, .18)
  const draw = createEIModelerObjectDraw(bindEIWorldObjectToModeler(world), {
    width: 96, height: 92, yaw: .46, pitch: .18, transparentBackground: true,
    showCentreMarker: false, showVertexMarkers: false, strokeWidth: .5,
  })
  draw.assign(96 * 92)
  const result = draw.returnBuffer()!
  assert.ok(result.assignmentCounts.every(count => count === 1))
  assert.equal(result.rgba[3], 0)
  assert.equal(result.primitiveAtPixel[0], -1)
  assert.ok(result.rgba.some((channel, index) => index % 4 === 3 && channel === 255))
  assert.equal(result.pixelsPerUnit, draw.projection.pixelsPerUnit)
  assert.deepEqual(result.pixelOrigin, draw.projection.pixelOrigin)
  for (let index = 0; index < world.vertices.length; index++) {
    const actual = draw.projection.vertices[index], expected = projection.vertices[index]
    assert.ok(Math.abs((actual.x - result.pixelOrigin.x) / result.pixelsPerUnit - expected.x) < 1e-10)
    assert.ok(Math.abs((actual.y - result.pixelOrigin.y) / result.pixelsPerUnit - expected.y) < 1e-10)
  }
})
