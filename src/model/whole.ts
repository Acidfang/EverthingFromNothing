import { add, FACES, key, scale, translate } from "./address.ts"
import type { Address } from "./address.ts"
import type { Field } from "./kernel.ts"

export type Whole = Readonly<{
  level: number
  completedAct: number
  support: Field
}>

export type WholeResolution = Readonly<{
  parent: Whole
  child: Whole
  childScale: number
  branches: ReadonlyMap<string, Field>
}>

export function whole(level: number): Whole {
  if (!Number.isSafeInteger(level) || level < 0) {
    throw new Error("Whole level must be a non-negative safe integer")
  }
  let support: ReadonlySet<string> = new Set([key({ x: 0, y: 0, z: 0 })])
  for (let bit = 0; bit < level; bit += 1) {
    const distance = 2 ** bit
    const next = new Set<string>()
    for (const addressKey of support) {
      const [x, y, z] = addressKey.split(",").map(Number)
      const address = { x, y, z }
      for (const face of FACES) {
        next.add(key(add(address, scale(face, distance))))
      }
    }
    support = next
  }
  return Object.freeze({
    level,
    completedAct: 2 ** level - 1,
    support,
  })
}

export function resolveWhole(level: number): WholeResolution {
  if (level < 1) throw new Error("A parent whole requires level >= 1")
  const parent = whole(level)
  const child = whole(level - 1)
  const childScale = 2 ** (level - 1)
  const branches = new Map<string, Field>()
  for (const face of FACES) {
    branches.set(key(face), translate(child.support, scale(face, childScale)))
  }
  return Object.freeze({ parent, child, childScale, branches })
}

export function outwardResidual(field: Whole): Field {
  const counts = new Map<string, number>()
  for (const addressKey of field.support) {
    const [x, y, z] = addressKey.split(",").map(Number)
    for (const face of FACES) {
      const target = key(add({ x, y, z }, face))
      counts.set(target, (counts.get(target) ?? 0) + 1)
    }
  }
  return new Set(
    [...counts]
      .filter(([, count]) => count % 2 === 1)
      .map(([address]) => address),
  )
}

export function enterWhole(
  relation: WholeResolution,
  face: Address,
): Field {
  const branch = relation.branches.get(key(face))
  if (!branch) throw new Error("Selected Face is not a child branch")
  return translate(branch, scale(face, -relation.childScale))
}
