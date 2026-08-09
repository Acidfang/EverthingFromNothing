import assert from "node:assert/strict"
import test from "node:test"

import {
  binocularResolve,
  combineFaceViews,
  observe,
  observeFromSixFaces,
  resolveViewRemainders,
} from "../src/model/observation.ts"

test("each observer keeps only the nearest Difference on each exact ray", () => {
  const field = new Set(["0,0,0", "0,1,0", "1,0,0"])
  const observer = {
    id: "ME" as const,
    position: { x: 0, y: -2, z: 0 },
  }
  assert.deepEqual(
    observe(field, observer).map((sight) => sight.address).sort(),
    ["0,0,0", "1,0,0"],
  )
})

test("binocular resolution preserves agreement, disagreement, and occlusion", () => {
  const field = new Set(["0,0,0", "0,1,0", "-1,0,0", "1,0,0"])
  const result = binocularResolve(field, 2)
  const partitions = [
    ...result.visibleToBoth,
    ...result.onlyMe,
    ...result.onlyOther,
    ...result.hiddenFromBoth,
  ]
  assert.deepEqual(partitions.sort(), [...field].sort())
  assert.ok(result.visibleToBoth.length > 0)
  assert.ok(result.jointlySupported.length >= result.visibleToBoth.length)
  assert.notDeepEqual(result.me.position, result.other.position)
  assert.equal(result.me.position.y, result.other.position.y)
})

test("view remainders exactly reconstruct both views and the complete field", () => {
  const field = new Set([
    "0,0,0",
    "1,0,0",
    "2,0,0",
    "0,1,0",
    "0,-1,0",
  ])
  const meView = observe(field, {
    id: "ME",
    position: { x: -4, y: 0, z: 0 },
  })
  const otherView = observe(field, {
    id: "OTHER",
    position: { x: 0, y: -6, z: 0 },
  })
  const resolution = resolveViewRemainders(field, meView, otherView)

  assert.deepEqual(
    resolution.reconstructedMe,
    meView.map((sight) => sight.address).sort(),
  )
  assert.deepEqual(
    resolution.reconstructedOther,
    otherView.map((sight) => sight.address).sort(),
  )
  assert.deepEqual(resolution.reconstructedWhole, [...field].sort())
  assert.equal(
    resolution.same.length
      + resolution.meRemainder.length
      + resolution.otherRemainder.length
      + resolution.unseenRemainder.length,
    field.size,
  )
})

test("six face observers occupy one radius and partition the whole field", () => {
  const field = new Set(["0,0,0", "1,0,0", "-1,0,0", "0,1,0", "0,0,1"])
  const result = observeFromSixFaces(field)
  assert.equal(result.observers.length, 6)
  for (const observer of result.observers) {
    const { x, y, z } = observer.position
    assert.equal(Math.sqrt(x * x + y * y + z * z), result.radius)
  }
  assert.deepEqual(
    [...result.visibleFromAnyFace, ...result.hiddenFromEveryFace].sort(),
    [...field].sort(),
  )
  assert.equal(result.views.size, 6)
})

test("the two-face stage exposes all 15 pair configurations without averaging", () => {
  const field = new Set(["0,0,0", "1,0,0", "-1,0,0", "0,1,0", "0,0,1"])
  const observation = observeFromSixFaces(field)
  const pairs = observation.observers.flatMap((left, leftIndex) =>
    observation.observers.slice(leftIndex + 1).map((right) =>
      combineFaceViews(field, observation, [left.id, right.id]),
    ),
  )
  assert.equal(pairs.length, 15)
  assert.equal(pairs.filter((pair) => pair.oppositePairCount === 1).length, 3)
  assert.equal(pairs.filter((pair) => pair.oppositePairCount === 0).length, 12)
  for (const pair of pairs) {
    assert.equal(pair.faces.length, 2)
    assert.equal(
      pair.receivedByAny.length + pair.unreceived.length,
      field.size,
    )
    assert.equal(pair.visibilityHistogram.length, 3)
  }
})

test("observer stages carry exact complement symmetry", () => {
  const field = new Set(["0,0,0", "1,0,0", "0,1,0"])
  const observation = observeFromSixFaces(field)
  const pair = combineFaceViews(field, observation, ["-X", "+X"])
  assert.deepEqual(pair.complementFaces, ["-Y", "+Y", "-Z", "+Z"])
  assert.equal(pair.symmetryClass, "2-face/1-opposite")
})
