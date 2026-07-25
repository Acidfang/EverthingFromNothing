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
