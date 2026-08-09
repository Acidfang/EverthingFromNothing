import assert from "node:assert/strict"
import test from "node:test"

import {
  CORNER_PYRAMID_RESOLUTIONS,
  CORNER_PYRAMID_WHOLE,
} from "../src/model/corner-pyramid-resolution.ts"

test("the centre resolves one triangular pyramid toward every cube corner", () => {
  assert.equal(CORNER_PYRAMID_RESOLUTIONS.length, 8)
  assert.equal(
    new Set(CORNER_PYRAMID_RESOLUTIONS.map((sector) => sector.id)).size,
    8,
  )

  for (const sector of CORNER_PYRAMID_RESOLUTIONS) {
    assert.equal(sector.triangularInterface.length, 3)
    assert.equal(sector.volume, 1 / 6)
    assert.ok(Math.abs(
      Math.hypot(
        sector.unitDirection.x,
        sector.unitDirection.y,
        sector.unitDirection.z,
      ) - 1,
    ) < 1e-12)
  }
})

test("the eight pyramids exactly fill the face-centre octahedron", () => {
  assert.ok(Math.abs(
    CORNER_PYRAMID_WHOLE.resolvedOctahedronVolume - 4 / 3,
  ) < 1e-12)
  assert.equal(CORNER_PYRAMID_WHOLE.sharedFaceCentreVertices, 6)
  assert.equal(CORNER_PYRAMID_WHOLE.sharedEdges, 12)
  assert.equal(CORNER_PYRAMID_WHOLE.fillsFaceCentreOctahedron, true)
  assert.equal(CORNER_PYRAMID_WHOLE.fillsWholeCube, false)
})
