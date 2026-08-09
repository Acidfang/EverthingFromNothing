import type { CubeResolutionKind } from "./cube-resolution.ts"

export type PrismVector = Readonly<{ x: number; y: number; z: number }>

export type TriangularPrismResolutionPoint = Readonly<{
  address: string
  position: PrismVector
  kind: CubeResolutionKind
  perspectiveCount: 1 | 2 | 3
  radius: number
  outwardState: "RESOLVING MEDIUM"
}>

const SQRT_THREE = Math.sqrt(3)
const TOP = 1
const BOTTOM = -1
const triangle = Object.freeze([
  Object.freeze({ x: 1, y: 0 }),
  Object.freeze({ x: -1 / 2, y: SQRT_THREE / 2 }),
  Object.freeze({ x: -1 / 2, y: -SQRT_THREE / 2 }),
])

function point(
  address: string,
  position: PrismVector,
  kind: CubeResolutionKind,
  perspectiveCount: 1 | 2 | 3,
): TriangularPrismResolutionPoint {
  return Object.freeze({
    address,
    position: Object.freeze(position),
    kind,
    perspectiveCount,
    radius: Math.hypot(position.x, position.y, position.z),
    outwardState: "RESOLVING MEDIUM" as const,
  })
}

const faceCentres = [
  point("triangle:+z", { x: 0, y: 0, z: TOP }, "FACE", 1),
  point("triangle:-z", { x: 0, y: 0, z: BOTTOM }, "FACE", 1),
  ...triangle.map((vertex, index) => {
    const next = triangle[(index + 1) % triangle.length]
    return point(
      `rectangle:${index}`,
      { x: (vertex.x + next.x) / 2, y: (vertex.y + next.y) / 2, z: 0 },
      "FACE",
      1,
    )
  }),
]

const edgeCentres = [
  ...triangle.flatMap((vertex, index) => {
    const next = triangle[(index + 1) % triangle.length]
    return [
      point(
        `top-edge:${index}`,
        { x: (vertex.x + next.x) / 2, y: (vertex.y + next.y) / 2, z: TOP },
        "EDGE",
        2,
      ),
      point(
        `bottom-edge:${index}`,
        { x: (vertex.x + next.x) / 2, y: (vertex.y + next.y) / 2, z: BOTTOM },
        "EDGE",
        2,
      ),
    ]
  }),
  ...triangle.map((vertex, index) =>
    point(`vertical-edge:${index}`, { ...vertex, z: 0 }, "EDGE", 2)),
]

const corners = triangle.flatMap((vertex, index) => [
  point(`corner:${index}:+z`, { ...vertex, z: TOP }, "CORNER", 3),
  point(`corner:${index}:-z`, { ...vertex, z: BOTTOM }, "CORNER", 3),
])

export const TRIANGULAR_PRISM_RESOLUTION_POINTS =
  Object.freeze([...faceCentres, ...edgeCentres, ...corners])

export const TRIANGULAR_PRISM_RESOLUTION_COUNTS = Object.freeze({
  FACE: faceCentres.length,
  EDGE: edgeCentres.length,
  CORNER: corners.length,
})

export const TRIANGULAR_PRISM_WHOLE_MOMENT = Object.freeze({
  resolutionPoints: TRIANGULAR_PRISM_RESOLUTION_POINTS.length,
  perspectivePresentations: TRIANGULAR_PRISM_RESOLUTION_POINTS.reduce(
    (total, resolution) => total + resolution.perspectiveCount,
    0,
  ),
  outwardState: "RESOLVING MEDIUM" as const,
})

