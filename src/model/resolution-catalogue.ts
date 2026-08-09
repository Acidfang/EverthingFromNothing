import {
  CUBE_RESOLUTION_POINTS,
  CUBE_WHOLE_MOMENT,
} from "./cube-resolution.ts"
import {
  TRIANGULAR_PRISM_RESOLUTION_POINTS,
  TRIANGULAR_PRISM_WHOLE_MOMENT,
} from "./triangular-prism-resolution.ts"

export const RESOLVED_GEOMETRIES = Object.freeze([
  Object.freeze({
    id: "CUBE" as const,
    label: "Cube",
    qualifiesFilledVolumeResolution: true,
    points: CUBE_RESOLUTION_POINTS,
    wholeMoment: CUBE_WHOLE_MOMENT,
  }),
  Object.freeze({
    id: "TRIANGULAR_PRISM" as const,
    label: "Equilateral triangular prism",
    qualifiesFilledVolumeResolution: true,
    points: TRIANGULAR_PRISM_RESOLUTION_POINTS,
    wholeMoment: TRIANGULAR_PRISM_WHOLE_MOMENT,
  }),
])

export const FILLED_VOLUME_GEOMETRIES = Object.freeze(
  RESOLVED_GEOMETRIES.filter((geometry) => geometry.qualifiesFilledVolumeResolution),
)

export const COMPLETE_GEOMETRY_RESOLUTION = Object.freeze({
  resolvedGeometryCount: RESOLVED_GEOMETRIES.length,
  resolutionPoints: RESOLVED_GEOMETRIES.reduce(
    (total, geometry) => total + geometry.wholeMoment.resolutionPoints,
    0,
  ),
  perspectivePresentations: RESOLVED_GEOMETRIES.reduce(
    (total, geometry) => total + geometry.wholeMoment.perspectivePresentations,
    0,
  ),
  selectionChangesResolution: false,
  orientationChangesIdentity: false,
  relativeOrientationChangesContactMap: true,
  overlapIsCollisionCandidate: true,
  overlapIsCommittedOccupancy: false,
  nestedCandidatesPreserved: true,
  avoidanceRemainsPossible: true,
  outwardState: "RESOLVING MEDIUM" as const,
  filledVolumeGeometryCount: FILLED_VOLUME_GEOMETRIES.length,
})
