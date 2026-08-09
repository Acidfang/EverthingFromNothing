import assert from "node:assert/strict"
import test from "node:test"

import {
  COMPLETE_GEOMETRY_RESOLUTION,
  FILLED_VOLUME_GEOMETRIES,
  RESOLVED_GEOMETRIES,
} from "../src/model/resolution-catalogue.ts"

test("every available geometry remains resolved when the observation filter changes", () => {
  assert.deepEqual(
    RESOLVED_GEOMETRIES.map((geometry) => geometry.id),
    ["CUBE", "TRIANGULAR_PRISM"],
  )
  assert.deepEqual(COMPLETE_GEOMETRY_RESOLUTION, {
    resolvedGeometryCount: 2,
    resolutionPoints: 46,
    perspectivePresentations: 95,
    selectionChangesResolution: false,
    orientationChangesIdentity: false,
    relativeOrientationChangesContactMap: true,
    overlapIsCollisionCandidate: true,
    overlapIsCommittedOccupancy: false,
    nestedCandidatesPreserved: true,
    avoidanceRemainsPossible: true,
    outwardState: "RESOLVING MEDIUM",
    filledVolumeGeometryCount: 2,
  })
  assert.deepEqual(
    FILLED_VOLUME_GEOMETRIES.map((geometry) => geometry.id),
    ["CUBE", "TRIANGULAR_PRISM"],
  )
})
