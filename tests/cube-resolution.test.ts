import assert from "node:assert/strict"
import test from "node:test"

import {
  CUBE_RESOLUTION_COUNTS,
  CUBE_RESOLUTION_POINTS,
  CUBE_RESOLUTION_RADII,
  CUBE_WHOLE_MOMENT,
} from "../src/model/cube-resolution.ts"

test("the complete cube Act retains every Face, edge, and corner resolution", () => {
  assert.equal(CUBE_RESOLUTION_POINTS.length, 26)
  assert.deepEqual(CUBE_RESOLUTION_COUNTS, {
    FACE: 6,
    EDGE: 12,
    CORNER: 8,
  })
  assert.equal(
    new Set(CUBE_RESOLUTION_POINTS.map((point) => point.address)).size,
    26,
  )
})

test("Face, edge, and corner layers resolve at sqrt(1), sqrt(2), sqrt(3)", () => {
  for (const point of CUBE_RESOLUTION_POINTS) {
    assert.equal(point.radius, CUBE_RESOLUTION_RADII[point.kind])
    assert.equal(
      point.perspectiveCount,
      [point.position.x, point.position.y, point.position.z]
        .filter((coordinate) => coordinate !== 0).length,
    )
    assert.equal(point.adjacentRegions, 2 ** point.perspectiveCount)
    assert.equal(point.outwardResolvingRegions, point.adjacentRegions - 1)
    assert.equal(point.outwardState, "RESOLVING MEDIUM")
  }
})

test("all resolution perspectives act on the previous whole moment", () => {
  assert.deepEqual(CUBE_WHOLE_MOMENT, {
    resolutionPoints: 26,
    perspectivePresentations: 54,
    outwardMediumPresentations: 98,
    outwardState: "RESOLVING MEDIUM",
  })
})
