import { add, compareAddressKeys, FACES, fromKey, key, type Address } from "./address.ts"
import type { Field } from "./kernel.ts"

export type PotentialPresentation = Readonly<{
  source: string
  target: string
  face: string
}>

export type PotentialCell = Readonly<{
  address: string
  arrivalCount: number
  opposingPairs: number
  netFace: Address
  wasDifferent: boolean
  isDifferent: boolean
  willBeDifferent: boolean
}>

export type PotentialResolution = Readonly<{
  presentations: readonly PotentialPresentation[]
  cells: readonly PotentialCell[]
  willBe: Field
  presentationCount: number
  addressedPotential: number
  convergenceExcess: number
  opposingPairs: number
  directionalRemainder: number
  willBeDifferences: number
}>

const OPPOSITES = [
  ["1,0,0", "-1,0,0"],
  ["0,1,0", "0,-1,0"],
  ["0,0,1", "0,0,-1"],
] as const

export function analysePotential(
  was: Field,
  is: Field,
): PotentialResolution {
  const presentations: PotentialPresentation[] = []
  const byTarget = new Map<string, PotentialPresentation[]>()
  for (const sourceKey of is) {
    const source = fromKey(sourceKey)
    for (const face of FACES) {
      const target = key(add(source, face))
      const presentation = Object.freeze({
        source: sourceKey,
        target,
        face: key(face),
      })
      presentations.push(presentation)
      const arrivals = byTarget.get(target) ?? []
      arrivals.push(presentation)
      byTarget.set(target, arrivals)
    }
  }
  const addresses = new Set([...byTarget.keys(), ...was])
  const willBe = new Set<string>()
  const cells = [...addresses].sort(compareAddressKeys).map((address) => {
    const arrivals = byTarget.get(address) ?? []
    const faceCounts = new Map<string, number>()
    let netX = 0
    let netY = 0
    let netZ = 0
    for (const arrival of arrivals) {
      const face = fromKey(arrival.face)
      faceCounts.set(arrival.face, (faceCounts.get(arrival.face) ?? 0) + 1)
      netX += face.x
      netY += face.y
      netZ += face.z
    }
    const opposingPairs = OPPOSITES.reduce(
      (total, [positive, negative]) =>
        total + Math.min(faceCounts.get(positive) ?? 0, faceCounts.get(negative) ?? 0),
      0,
    )
    const forcedDifference = arrivals.length % 2 === 1
    const willBeDifferent = was.has(address) !== forcedDifference
    if (willBeDifferent) willBe.add(address)
    return Object.freeze({
      address,
      arrivalCount: arrivals.length,
      opposingPairs,
      netFace: Object.freeze({ x: netX, y: netY, z: netZ }),
      wasDifferent: was.has(address),
      isDifferent: is.has(address),
      willBeDifferent,
    })
  })
  return Object.freeze({
    presentations: Object.freeze(presentations),
    cells: Object.freeze(cells),
    willBe,
    presentationCount: presentations.length,
    addressedPotential: cells.length,
    convergenceExcess: cells.reduce(
      (total, cell) => total + Math.max(0, cell.arrivalCount - 1),
      0,
    ),
    opposingPairs: cells.reduce((total, cell) => total + cell.opposingPairs, 0),
    directionalRemainder: cells.reduce(
      (total, cell) =>
        total
        + Math.abs(cell.netFace.x)
        + Math.abs(cell.netFace.y)
        + Math.abs(cell.netFace.z),
      0,
    ),
    willBeDifferences: willBe.size,
  })
}
