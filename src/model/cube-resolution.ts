import { key, type Address } from "./address.ts"

export type CubeResolutionKind = "FACE" | "EDGE" | "CORNER"

export type CubeResolutionPoint = Readonly<{
  address: string
  position: Address
  kind: CubeResolutionKind
  perspectiveCount: 1 | 2 | 3
  adjacentRegions: 2 | 4 | 8
  outwardResolvingRegions: 1 | 3 | 7
  outwardState: "RESOLVING MEDIUM"
  radius: number
}>

const VALUES = [-1, 0, 1] as const

function classify(contributingAxes: number): CubeResolutionKind {
  if (contributingAxes === 1) return "FACE"
  if (contributingAxes === 2) return "EDGE"
  return "CORNER"
}

/**
 * Every non-central point of the normalized cube boundary.  Faces, edges, and
 * corners are all retained as resolutions of the complete Act.
 */
export const CUBE_RESOLUTION_POINTS: readonly CubeResolutionPoint[] =
  Object.freeze(VALUES.flatMap((x) =>
    VALUES.flatMap((y) =>
      VALUES.flatMap((z) => {
        const perspectiveCount = Number(x !== 0) + Number(y !== 0) + Number(z !== 0)
        if (perspectiveCount === 0) return []
        const position = Object.freeze({ x, y, z })
        const adjacentRegions = 2 ** perspectiveCount as 2 | 4 | 8
        return [Object.freeze({
          address: key(position),
          position,
          kind: classify(perspectiveCount),
          perspectiveCount: perspectiveCount as 1 | 2 | 3,
          adjacentRegions,
          outwardResolvingRegions: (adjacentRegions - 1) as 1 | 3 | 7,
          outwardState: "RESOLVING MEDIUM" as const,
          radius: Math.sqrt(perspectiveCount),
        })]
      }),
    ),
  ))

export const CUBE_RESOLUTION_COUNTS: Readonly<Record<CubeResolutionKind, number>> =
  Object.freeze({
    FACE: CUBE_RESOLUTION_POINTS.filter((point) => point.kind === "FACE").length,
    EDGE: CUBE_RESOLUTION_POINTS.filter((point) => point.kind === "EDGE").length,
    CORNER: CUBE_RESOLUTION_POINTS.filter((point) => point.kind === "CORNER").length,
  })

export const CUBE_RESOLUTION_RADII = Object.freeze({
  FACE: 1,
  EDGE: Math.sqrt(2),
  CORNER: Math.sqrt(3),
})

export const CUBE_WHOLE_MOMENT = Object.freeze({
  resolutionPoints: CUBE_RESOLUTION_POINTS.length,
  perspectivePresentations: CUBE_RESOLUTION_POINTS.reduce(
    (total, point) => total + point.perspectiveCount,
    0,
  ),
  outwardMediumPresentations: CUBE_RESOLUTION_POINTS.reduce(
    (total, point) => total + point.outwardResolvingRegions,
    0,
  ),
  outwardState: "RESOLVING MEDIUM" as const,
})
