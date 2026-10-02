import test from 'node:test'
import assert from 'node:assert/strict'
import { deriveEIWorldObject, projectEIWorldObject, EI_WORLD_MAPPING_SCOPE } from '../src/model/ei-world-object.ts'

const entity = Object.freeze({ address: 'retained/root', revision: 3, sourceId: 'supplied-source', value: 'the actual retained text', partCount: 4, root: true })

test('nature objects are finite solid meshes and observer faces are depth sorted', () => {
  for (const partCount of [0, 1, 4, 19, 137]) for (const sourceId of ['source-a', 'source-b', 'source-c']) {
    const object = deriveEIWorldObject({ ...entity, partCount, sourceId })
    assert.ok(object.vertices.length > 20)
    assert.ok(new Set(object.vertices.map(point => point.z)).size > 3)
    assert.ok(object.vertices.every(point => [point.x, point.y, point.z].every(Number.isFinite)))
    assert.ok(object.faces.every(face => face.vertices.length >= 3 && face.vertices.every(index => index >= 0 && index < object.vertices.length)))
    for (const [yaw, pitch] of [[0, 0], [.8, -.4], [2, 1.1]]) {
      const projected = projectEIWorldObject(object, yaw, pitch)
      assert.ok(!/NaN|Infinity/.test(projected.path))
      assert.ok(projected.faces.every((face, index, all) => index === 0 || face.depth >= all[index - 1].depth))
      assert.ok(projected.faces.every(face => /^#[0-9a-f]{6}$/.test(face.fill)))
      assert.ok(projected.bounds.right - projected.bounds.left < 125)
      assert.ok(projected.bounds.bottom - projected.bounds.top < 125)
    }
  }
})

test('branch groups summarize actual parts exactly and leaves invent no parts', () => {
  for (const partCount of [0, 1, 7, 8, 137, 1000000]) {
    const object = deriveEIWorldObject({ ...entity, partCount })
    assert.equal(object.mapping.actualPartCount, partCount)
    assert.equal(object.mapping.clusters.reduce((count, cluster) => count + cluster.count, 0), partCount)
    assert.equal(object.mapping.basis, partCount ? 'actual-retained-parts' : 'retained-value-leaf')
    assert.equal(['branching-tree', 'tree-doorhouse'].includes(object.form), partCount > 0)
    assert.equal(object.faces.some(face => face.role === 'part-cluster'), partCount > 0)
  }
})

test('rotation changes only projection and preserves retained identity and source', () => {
  const object = deriveEIWorldObject(entity), snapshot = JSON.stringify(object)
  const first = projectEIWorldObject(object, 0, 0), turned = projectEIWorldObject(object, .9, .3)
  assert.notEqual(first.path, turned.path)
  assert.deepEqual(first.identity, { address: entity.address, revision: entity.revision, sourceId: entity.sourceId })
  assert.deepEqual(first.identity, turned.identity)
  assert.deepEqual(first.mapping, turned.mapping)
  assert.equal(JSON.stringify(object), snapshot)
  assert.equal(first.scope, EI_WORLD_MAPPING_SCOPE)
  assert.equal(first.mapping.sourceGeometry, false)
  assert.equal(first.mapping.canonicalPosition, null)
  assert.equal(first.mapping.modelAdvanced, false)
})

test('appearance is stable, does not interpret value keywords, and does not mutate input', () => {
  const before = JSON.stringify(entity), first = deriveEIWorldObject(entity)
  assert.deepEqual(first, deriveEIWorldObject(entity))
  assert.deepEqual(first, deriveEIWorldObject({ ...entity, value: 'ocean fire stone forest book spaceship' }))
  projectEIWorldObject(entity, .4, .2)
  assert.equal(JSON.stringify(entity), before)
  assert.equal(first.mapping.valueInterpreted, false)
})

test('invalid actual counts and observer bases cannot produce misleading geometry', () => {
  for (const partCount of [-1, .5, Infinity, NaN]) assert.throws(() => deriveEIWorldObject({ ...entity, partCount }), /part count/)
  assert.throws(() => projectEIWorldObject(entity, Infinity, 0), /observer basis/)
  assert.throws(() => projectEIWorldObject(entity, 0, NaN), /observer basis/)
})
