import assert from "node:assert/strict"
import test from "node:test"

import { buildWholeScene } from "../src/model/scene.ts"

test("the scene graph is the exact renderable 36-to-19 projection", () => {
  const scene = buildWholeScene(5, "2,0,0")
  const children = scene.points.filter((point) => point.kind === "CHILD_WHOLE")
  const relations = scene.points.filter(
    (point) => point.kind === "RESOLVED_RELATION",
  )
  assert.equal(children.length, 6)
  assert.equal(relations.length, 19)
  assert.equal(scene.edges.length, 36)
  assert.deepEqual(scene.bounds.minimum, [-2, -2, -2])
  assert.deepEqual(scene.bounds.maximum, [2, 2, 2])
  assert.equal(relations.filter((point) => point.selected).length, 1)
  assert.equal(
    relations.find((point) => point.selected)?.result,
    "DIFFERENT",
  )
  assert.match(scene.accessibilitySummary, /13 resolve to Same/)
  assert.match(scene.accessibilitySummary, /6 remain Different/)
})

test("every visible scene primitive carries provenance qualification", () => {
  const scene = buildWholeScene(3)
  for (const point of scene.points) {
    assert.equal(point.provenance, "GENERATED")
    assert.equal(point.dependsOnSelectedFormalization, true)
  }
  for (const edge of scene.edges) {
    assert.equal(edge.provenance, "GENERATED")
    assert.equal(edge.dependsOnSelectedFormalization, true)
  }
})

test("scene geometry is normalized and invariant across completed grains", () => {
  const expected = buildWholeScene(1)
  for (let level = 2; level <= 8; level += 1) {
    const scene = buildWholeScene(level)
    assert.deepEqual(scene.points, expected.points)
    assert.deepEqual(scene.edges, expected.edges)
    assert.deepEqual(scene.bounds, expected.bounds)
  }
})
