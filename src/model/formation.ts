import { add, compareAddressKeys, FACES, fromKey, key } from "./address.ts"
import type { Field } from "./kernel.ts"

const FIELD_RELATIONS = Object.freeze(
  [...new Map(
    FACES.flatMap((left) =>
      FACES.map((right) => ({
        x: left.x - right.x,
        y: left.y - right.y,
        z: left.z - right.z,
      })),
    )
      .filter(({ x, y, z }) => x !== 0 || y !== 0 || z !== 0)
      .map((offset) => [key(offset), offset]),
  ).values()],
)

export type DetectedField = Readonly<{
  id: string
  addresses: readonly string[]
  activeDifferences: number
  boundaryFaces: number
}>

export type FormationAnalysis = Readonly<{
  fields: readonly DetectedField[]
  fieldCount: number
  largestField: number
  activeDifferences: number
  appearedDifferences: number
  retainedDifferences: number
  resolvedDifferences: number
  boundaryFaces: number
  modelEnergy: Readonly<{
    difference: number
    transition: number
    boundary: number
    physicalUnit: null
  }>
}>

function boundaryFaces(field: Field, addresses: readonly string[]): number {
  let count = 0
  for (const address of addresses) {
    const point = fromKey(address)
    for (const face of FACES) {
      if (!field.has(key(add(point, face)))) count += 1
    }
  }
  return count
}

function connectedFields(field: Field): readonly DetectedField[] {
  const unvisited = new Set(field)
  const components: DetectedField[] = []

  while (unvisited.size > 0) {
    const seed = [...unvisited].sort(compareAddressKeys)[0]
    const queue = [seed]
    const addresses: string[] = []
    unvisited.delete(seed)

    for (let index = 0; index < queue.length; index += 1) {
      const address = queue[index]
      addresses.push(address)
      const point = fromKey(address)
      for (const relation of FIELD_RELATIONS) {
        const neighbour = key(add(point, relation))
        if (!unvisited.has(neighbour)) continue
        unvisited.delete(neighbour)
        queue.push(neighbour)
      }
    }

    addresses.sort(compareAddressKeys)
    components.push(Object.freeze({
      id: addresses[0],
      addresses: Object.freeze(addresses),
      activeDifferences: addresses.length,
      boundaryFaces: boundaryFaces(field, addresses),
    }))
  }

  components.sort(
    (left, right) =>
      right.activeDifferences - left.activeDifferences
      || compareAddressKeys(left.id, right.id),
  )
  return Object.freeze(components)
}

export function analyseFormation(was: Field, is: Field): FormationAnalysis {
  const fields = connectedFields(is)
  let appearedDifferences = 0
  let retainedDifferences = 0
  let resolvedDifferences = 0

  for (const address of is) {
    if (was.has(address)) retainedDifferences += 1
    else appearedDifferences += 1
  }
  for (const address of was) {
    if (!is.has(address)) resolvedDifferences += 1
  }

  const totalBoundaryFaces = fields.reduce(
    (total, field) => total + field.boundaryFaces,
    0,
  )
  const transition = appearedDifferences + resolvedDifferences

  return Object.freeze({
    fields,
    fieldCount: fields.length,
    largestField: fields[0]?.activeDifferences ?? 0,
    activeDifferences: is.size,
    appearedDifferences,
    retainedDifferences,
    resolvedDifferences,
    boundaryFaces: totalBoundaryFaces,
    modelEnergy: Object.freeze({
      difference: is.size,
      transition,
      boundary: totalBoundaryFaces,
      physicalUnit: null,
    }),
  })
}
