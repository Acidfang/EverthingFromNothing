import {
  compareAddressKeys,
  FACES,
  fromKey,
  key,
  scale,
  translate,
} from "./address.ts"
import type { Address } from "./address.ts"
import { outwardResidual, resolveWhole } from "./whole.ts"

export type ProjectionEntry = Readonly<{
  address: string
  normalizedAddress: string
  contributors: readonly string[]
  arrivalCount: number
  result: "DIFFERENT" | "SAME"
}>

export type WholeProjection = Readonly<{
  level: number
  childScale: number
  presentations: number
  entries: readonly ProjectionEntry[]
}>

export function projectWhole(level: number): WholeProjection {
  const relation = resolveWhole(level)
  const childOutward = outwardResidual(relation.child)
  const arrivals = new Map<string, string[]>()

  for (const face of FACES) {
    const faceKey = key(face)
    const centre = scale(face, relation.childScale)
    const presented = translate(childOutward, centre)
    for (const address of presented) {
      const contributors = arrivals.get(address) ?? []
      contributors.push(faceKey)
      arrivals.set(address, contributors)
    }
  }

  const entries = [...arrivals]
    .sort(([left], [right]) => compareAddressKeys(left, right))
    .map(([address, contributors]): ProjectionEntry => {
      const value = fromKey(address)
      const normalized: Address = {
        x: value.x / relation.childScale,
        y: value.y / relation.childScale,
        z: value.z / relation.childScale,
      }
      if (![normalized.x, normalized.y, normalized.z].every(Number.isSafeInteger)) {
        throw new Error("Projection is not exactly representable at containing grain")
      }
      return Object.freeze({
        address,
        normalizedAddress: key(normalized),
        contributors: Object.freeze([...contributors].sort(compareAddressKeys)),
        arrivalCount: contributors.length,
        result: contributors.length % 2 === 1 ? "DIFFERENT" : "SAME",
      })
    })

  return Object.freeze({
    level,
    childScale: relation.childScale,
    presentations: entries.reduce((total, entry) => total + entry.arrivalCount, 0),
    entries: Object.freeze(entries),
  })
}

export function projectionSignature(level: number): string {
  return JSON.stringify(
    projectWhole(level).entries.map((entry) => [
      entry.normalizedAddress,
      entry.arrivalCount,
      entry.contributors,
      entry.result,
    ]),
  )
}
