export type Address = Readonly<{
  x: number
  y: number
  z: number
}>

export const ORIGIN: Address = Object.freeze({ x: 0, y: 0, z: 0 })

export const FACES: readonly Address[] = Object.freeze([
  Object.freeze({ x: 1, y: 0, z: 0 }),
  Object.freeze({ x: -1, y: 0, z: 0 }),
  Object.freeze({ x: 0, y: 1, z: 0 }),
  Object.freeze({ x: 0, y: -1, z: 0 }),
  Object.freeze({ x: 0, y: 0, z: 1 }),
  Object.freeze({ x: 0, y: 0, z: -1 }),
])

export function add(left: Address, right: Address): Address {
  return {
    x: left.x + right.x,
    y: left.y + right.y,
    z: left.z + right.z,
  }
}

export function scale(address: Address, factor: number): Address {
  return {
    x: address.x * factor,
    y: address.y * factor,
    z: address.z * factor,
  }
}

export function key(address: Address): string {
  return `${address.x},${address.y},${address.z}`
}

export function fromKey(value: string): Address {
  const coordinates = value.split(",").map(Number)
  if (
    coordinates.length !== 3
    || coordinates.some((coordinate) => !Number.isSafeInteger(coordinate))
  ) {
    throw new Error(`Invalid address: ${value}`)
  }
  return { x: coordinates[0], y: coordinates[1], z: coordinates[2] }
}

export function compareAddressKeys(left: string, right: string): number {
  const a = fromKey(left)
  const b = fromKey(right)
  return a.x - b.x || a.y - b.y || a.z - b.z
}

export function translate(
  addresses: ReadonlySet<string>,
  offset: Address,
): ReadonlySet<string> {
  return new Set(
    [...addresses].map((address) => key(add(fromKey(address), offset))),
  )
}
