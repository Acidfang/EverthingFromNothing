import type { CubeResolutionKind } from "./cube-resolution.ts"

export type ContactClass = Readonly<{
  first: CubeResolutionKind
  second: CubeResolutionKind
  id: string
  state: "POSSIBLE COLLISION"
  resolution: "MAP CONTACT THEN RETAIN SEPARATING MEDIUM"
}>

const FEATURES = ["FACE", "EDGE", "CORNER"] as const

/**
 * Every intrinsic boundary feature of one whole can meet every intrinsic
 * boundary feature of another. Relative placement selects a contact; it does
 * not change either whole's identity.
 */
export const COLLISION_CONTACT_CLASSES: readonly ContactClass[] = Object.freeze(
  FEATURES.flatMap((first) =>
    FEATURES.map((second) => Object.freeze({
      first,
      second,
      id: `${first}:${second}`,
      state: "POSSIBLE COLLISION" as const,
      resolution: "MAP CONTACT THEN RETAIN SEPARATING MEDIUM" as const,
    })),
  ),
)

export const COLLISION_RESOLUTION_RULE = Object.freeze({
  contactClassCount: COLLISION_CONTACT_CLASSES.length,
  orientationChangesIdentity: false,
  relativeOrientationChangesContactMap: true,
  overlapMeansCollisionCandidate: true,
  overlapMeansResolvedCoexistence: false,
  unoccupiedNeighbouringState: "RESOLVING MEDIUM" as const,
  avoidanceState: "CAN BE" as const,
})

