import assert from "node:assert/strict"
import test from "node:test"

import {
  COMPLETE_MEDIUM_ANALYSIS,
  SHAPE_MEDIUM_ANALYSIS,
} from "../src/model/medium-resolution.ts"

test("medium grows as one, three, and seven outward regions per resolution", () => {
  for (const shape of SHAPE_MEDIUM_ANALYSIS) {
    assert.deepEqual(
      shape.moments.map((moment) => moment.mediumPresentationsPerPoint),
      [1, 3, 7],
    )
    assert.equal(shape.maximumMediumMoment.kind, "CORNER")
  }
})

test("cube and prism medium totals are calculated exactly", () => {
  const cube = SHAPE_MEDIUM_ANALYSIS.find((shape) => shape.shape === "CUBE")!
  const prism = SHAPE_MEDIUM_ANALYSIS.find(
    (shape) => shape.shape === "TRIANGULAR_PRISM",
  )!
  assert.deepEqual(cube.moments.map((moment) => moment.mediumPresentations), [6, 36, 56])
  assert.deepEqual(prism.moments.map((moment) => moment.mediumPresentations), [5, 27, 42])
  assert.equal(cube.totalMediumPresentations, 98)
  assert.equal(prism.totalMediumPresentations, 74)
  assert.equal(COMPLETE_MEDIUM_ANALYSIS.totalMediumPresentations, 172)
  assert.equal(COMPLETE_MEDIUM_ANALYSIS.maximumShape.shape, "CUBE")
  assert.deepEqual(
    COMPLETE_MEDIUM_ANALYSIS.moments.map((moment) => moment.mediumPresentations),
    [11, 63, 98],
  )
})

