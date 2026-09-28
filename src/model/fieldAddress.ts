export type FieldChannel = "NONE" | "FILTER" | "ISOLATE" | "RECONSTRUCT"

export type UniversalAddress = Readonly<{
  root: "FAMILY/NOTODUS/ZERO"
  grain: number
  act: number
  x: number
  y: number
  z: number
  depth: number
  channel: FieldChannel
  subject?: string
}>

export type AddressReceipt = Readonly<{
  requested: UniversalAddress
  canonical: string
  parent: string | null
  filter: FieldChannel
  status: "ADDRESSED"
}>

export const ZERO: UniversalAddress = Object.freeze({
  root: "FAMILY/NOTODUS/ZERO",
  grain: 0,
  act: 0,
  x: 0,
  y: 0,
  z: 0,
  depth: 0,
  channel: "NONE",
})

function integer(value: number, name: string): number {
  if (!Number.isSafeInteger(value)) throw new Error(`${name} must be a safe integer`)
  return value
}

export function canonicalAddress(input: UniversalAddress): string {
  const grain = integer(input.grain, "grain")
  const act = integer(input.act, "act")
  const x = integer(input.x, "x")
  const y = integer(input.y, "y")
  const z = integer(input.z, "z")
  const depth = integer(input.depth, "depth")
  if (depth < 0) throw new Error("depth must be zero or greater")
  const subject = input.subject ? `/SUBJECT/${encodeURIComponent(input.subject)}` : ""
  return `${input.root}/G${grain}/A${act}/X${x}/Y${y}/Z${z}/D${depth}/${input.channel}${subject}`
}

export function address(input: UniversalAddress): AddressReceipt {
  const canonical = canonicalAddress(input)
  const parent = input.depth === 0 ? null : canonicalAddress({ ...input, depth: input.depth - 1 })
  return Object.freeze({ requested: Object.freeze({ ...input }), canonical, parent, filter: input.channel, status: "ADDRESSED" })
}

export function fracture(input: UniversalAddress): readonly AddressReceipt[] {
  const depth = integer(input.depth, "depth") + 1
  return Object.freeze([
    address({ ...input, depth, x: input.x + 1 }),
    address({ ...input, depth, x: input.x - 1 }),
    address({ ...input, depth, y: input.y + 1 }),
    address({ ...input, depth, y: input.y - 1 }),
    address({ ...input, depth, z: input.z + 1 }),
    address({ ...input, depth, z: input.z - 1 }),
  ])
}

export function filterAddress(input: UniversalAddress, channel: FieldChannel): AddressReceipt {
  return address({ ...input, channel })
}
