import type { Address } from "./address.ts"

type Sign = -1 | 1

export type CornerPyramidResolution = Readonly<{
  id: string
  cornerDirection: Address
  unitDirection: Address
  apex: Address
  triangularInterface: readonly [Address, Address, Address]
  baseArea: number
  height: number
  volume: number
  state: "CENTRE-TO-CORNER RESOLUTION SECTOR"
}>

const SIGNS = [-1, 1] as const
const ROOT_THREE = Math.sqrt(3)

/**
 * The six cube-face centres are the vertices of the cube's dual octahedron.
 * Each of the octahedron's eight triangular faces points toward exactly one
 * cube corner. Joining that face to the shared centre produces one tetrahedral
 * (triangular-pyramid) resolution sector.
 */
export const CORNER_PYRAMID_RESOLUTIONS: readonly CornerPyramidResolution[] =
  Object.freeze(SIGNS.flatMap((x: Sign) =>
    SIGNS.flatMap((y: Sign) =>
      SIGNS.map((z: Sign) => Object.freeze({
        id: `${x}:${y}:${z}`,
        cornerDirection: Object.freeze({ x, y, z }),
        unitDirection: Object.freeze({
          x: x / ROOT_THREE,
          y: y / ROOT_THREE,
          z: z / ROOT_THREE,
        }),
        apex: Object.freeze({ x: 0, y: 0, z: 0 }),
        triangularInterface: Object.freeze([
          Object.freeze({ x, y: 0, z: 0 }),
          Object.freeze({ x: 0, y, z: 0 }),
          Object.freeze({ x: 0, y: 0, z }),
        ]) as readonly [Address, Address, Address],
        baseArea: ROOT_THREE / 2,
        height: 1 / ROOT_THREE,
        volume: 1 / 6,
        state: "CENTRE-TO-CORNER RESOLUTION SECTOR" as const,
      })),
    ),
  ))

export const CORNER_PYRAMID_WHOLE = Object.freeze({
  cornerDirections: CORNER_PYRAMID_RESOLUTIONS.length,
  triangularInterfaces: CORNER_PYRAMID_RESOLUTIONS.length,
  sharedFaceCentreVertices: 6,
  sharedEdges: 12,
  volumePerSector: 1 / 6,
  resolvedOctahedronVolume: CORNER_PYRAMID_RESOLUTIONS.reduce(
    (total, sector) => total + sector.volume,
    0,
  ),
  fillsFaceCentreOctahedron: true,
  fillsWholeCube: false,
})
