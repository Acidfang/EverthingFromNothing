import assert from "node:assert/strict"
import test from "node:test"

import {
  CHILD_GRAIN_SCALE,
  deriveNestedGrain,
} from "../src/model/grain.ts"

test("a resolved ME becomes the next child-grain origin", () => {
  const nested = deriveNestedGrain("1,0,0", 0)
  assert.equal(nested.parentGrain, 0)
  assert.equal(nested.childGrain, -1)
  assert.equal(nested.childScale, CHILD_GRAIN_SCALE)
  assert.deepEqual(nested.spiralStartsAt, { grain: -1, moment: 1 })
  assert.equal(nested.moments.length, 36)
  assert.equal(nested.moments[0].states.length, 6)
})

test("the child state remains embedded around its parent ME", () => {
  const nested = deriveNestedGrain("1,0,0")
  const final = nested.finalParentPositions
  assert.equal(final.length, 6)
  assert.deepEqual(
    final.map(({ x, y, z }) => [
      ...[x, y, z].map((value) => {
        const rounded = Number(value.toFixed(12))
        return Object.is(rounded, -0) ? 0 : rounded
      }),
    ]).sort(),
    [
      [0.5, 0, 0],
      [1, -0.5, 0],
      [1, 0, -0.5],
      [1, 0, 0.5],
      [1, 0.5, 0],
      [1.5, 0, 0],
    ].sort(),
  )
})

test("every nested moment exposes all six outward transfers", () => {
  const nested = deriveNestedGrain("0,1,0")
  for (const moment of nested.moments) {
    assert.equal(moment.states.length, 6)
    assert.ok(moment.totalEmittedMagnitude > 0)
    assert.ok(moment.totalCreatedForce >= 0)
    assert.ok(moment.states.every((state) =>
      Number.isFinite(state.emittedMagnitude)
      && Number.isFinite(state.createdForce),
    ))
    assert.ok(moment.states.every((state) =>
      state.axisOffset.symbol === "ε = 0…01",
    ))
  }
})

test("the child spiral rides the parent spiral while preserving standing nodes", () => {
  const nested = deriveNestedGrain("1,0,0")
  assert.notDeepEqual(
    nested.moments[0].carrierPosition,
    nested.moments[17].carrierPosition,
  )
  assert.ok(nested.moments[8].totalStandingAmplitude < 1e-12)
  for (const moment of nested.moments) {
    for (const state of moment.states) {
      assert.equal(state.standingWavePath.length, 37)
    }
  }
  const firstNode = nested.moments[0].states[0].standingWavePath[9]
  const laterNode = nested.moments[17].states[0].standingWavePath[9]
  const firstRelative = {
    x: firstNode.x - nested.moments[0].carrierPosition.x,
    y: firstNode.y - nested.moments[0].carrierPosition.y,
    z: firstNode.z - nested.moments[0].carrierPosition.z,
  }
  const laterRelative = {
    x: laterNode.x - nested.moments[17].carrierPosition.x,
    y: laterNode.y - nested.moments[17].carrierPosition.y,
    z: laterNode.z - nested.moments[17].carrierPosition.z,
  }
  for (const coordinate of ["x", "y", "z"] as const) {
    assert.ok(Math.abs(firstRelative[coordinate] - laterRelative[coordinate]) < 1e-12)
  }
})
