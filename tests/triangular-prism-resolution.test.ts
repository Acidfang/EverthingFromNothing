import assert from "node:assert/strict"
import test from "node:test"

import {
  TRIANGULAR_PRISM_RESOLUTION_COUNTS,
  TRIANGULAR_PRISM_RESOLUTION_POINTS,
  TRIANGULAR_PRISM_WHOLE_MOMENT,
} from "../src/model/triangular-prism-resolution.ts"

test("the equilateral triangular prism retains all Face, edge, and corner points", () => {
  assert.equal(TRIANGULAR_PRISM_RESOLUTION_POINTS.length, 20)
  assert.deepEqual(TRIANGULAR_PRISM_RESOLUTION_COUNTS, {
    FACE: 5,
    EDGE: 9,
    CORNER: 6,
  })
  assert.equal(
    new Set(TRIANGULAR_PRISM_RESOLUTION_POINTS.map((point) => point.address)).size,
    20,
  )
})

test("the prism whole moment combines 41 perspective presentations", () => {
  assert.deepEqual(TRIANGULAR_PRISM_WHOLE_MOMENT, {
    resolutionPoints: 20,
    perspectivePresentations: 41,
    outwardState: "RESOLVING MEDIUM",
  })
  assert.ok(
    new Set(TRIANGULAR_PRISM_RESOLUTION_POINTS.map((point) => point.radius)).size > 3,
  )
})

