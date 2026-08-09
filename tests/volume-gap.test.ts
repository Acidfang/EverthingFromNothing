import assert from "node:assert/strict"
import test from "node:test"

import {
  CUBE_PRISM_GAP,
  NORMALIZED_CUBE_VOLUME,
  NORMALIZED_TRIANGULAR_PRISM_VOLUME,
  CUBE_RECURSIVE_VOLUME_RATIO,
  PRISM_RECURSIVE_VOLUME_RATIO,
  SIMULTANEOUS_RECURSIVE_VOLUME,
  cumulativeRecursiveGap,
  recursiveGapAtGrain,
} from "../src/model/volume-gap.ts"

test("cube and prism resolve together through all recursive grains", () => {
  assert.equal(NORMALIZED_CUBE_VOLUME, 8)
  assert.equal(NORMALIZED_TRIANGULAR_PRISM_VOLUME, 3 * Math.sqrt(3) / 2)
  assert.equal(CUBE_PRISM_GAP, 8 - 3 * Math.sqrt(3) / 2)
  assert.equal(CUBE_RECURSIVE_VOLUME_RATIO, 3 / 4)
  assert.equal(PRISM_RECURSIVE_VOLUME_RATIO, 5 / 8)
  assert.equal(recursiveGapAtGrain(0), CUBE_PRISM_GAP)
  assert.equal(
    recursiveGapAtGrain(1),
    8 * 3 / 4 - (3 * Math.sqrt(3) / 2) * 5 / 8,
  )
  assert.ok(
    Math.abs(
      SIMULTANEOUS_RECURSIVE_VOLUME.infiniteRecursiveGapContribution
      - (32 - 4 * Math.sqrt(3)),
    ) < 1e-12,
  )
  assert.equal(SIMULTANEOUS_RECURSIVE_VOLUME.resolution, "SIMULTANEOUS AT EVERY GRAIN")
  assert.ok(
    Math.abs(cumulativeRecursiveGap(30) - (32 - 4 * Math.sqrt(3))) < 0.01,
  )
})

test("invalid recursive volume depths are rejected", () => {
  assert.throws(() => recursiveGapAtGrain(-1))
  assert.throws(() => cumulativeRecursiveGap(1.5))
})
