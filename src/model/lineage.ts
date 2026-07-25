import { FACES, add, key, scale, type Address } from "./address.ts"

export type LineageNode = Readonly<{
  path: readonly string[]
  position: string
}>

export type LineageLevel = Readonly<{
  depth: number
  count: number
  expectedCount: number
  nodes: readonly LineageNode[]
  unique: boolean
}>

export function generateLineageLevel(depth: number): LineageLevel {
  if (!Number.isSafeInteger(depth) || depth < 0 || depth > 7) {
    throw new Error("Lineage depth must be an integer from 0 through 7")
  }
  let nodes: readonly Readonly<{ path: readonly string[]; position: Address }>[] = [
    Object.freeze({ path: Object.freeze([]), position: Object.freeze({ x: 0, y: 0, z: 0 }) }),
  ]
  for (let level = 0; level < depth; level += 1) {
    const distance = 2 ** level
    nodes = Object.freeze(nodes.flatMap((node) =>
      FACES.map((face) => Object.freeze({
        path: Object.freeze([...node.path, key(face)]),
        position: Object.freeze(add(node.position, scale(face, distance))),
      })),
    ))
  }
  const result = Object.freeze(nodes.map((node) => Object.freeze({
    path: node.path,
    position: key(node.position),
  })))
  const positions = new Set(result.map((node) => node.position))
  return Object.freeze({
    depth,
    count: result.length,
    expectedCount: 6 ** depth,
    nodes: result,
    unique: positions.size === result.length,
  })
}

export function lineageCount(depth: number): number {
  if (!Number.isSafeInteger(depth) || depth < 0) {
    throw new Error("Lineage depth must be a non-negative safe integer")
  }
  return 6 ** depth
}
