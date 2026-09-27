export const INFINITY_ADDRESS_VERSION = "infinity-field-v1" as const

export type InfinityChannel = "FILTER" | "ISOLATE" | "RECONSTRUCT" | "NONE"

export type InfinityFieldAddress = Readonly<{
  version: typeof INFINITY_ADDRESS_VERSION
  grain: number
  act: number
  x: number
  y: number
  z: number
  depth: number
  channel: InfinityChannel
  subject?: string
}>

export function encodeInfinityAddress(address: InfinityFieldAddress): string {
  const params = new URLSearchParams({
    v: address.version,
    g: String(address.grain),
    a: String(address.act),
    x: String(address.x),
    y: String(address.y),
    z: String(address.z),
    d: String(address.depth),
    c: address.channel,
  })
  if (address.subject) params.set("s", address.subject)
  return params.toString()
}

export function decodeInfinityAddress(value: string): InfinityFieldAddress {
  const raw = value.startsWith("?") ? value.slice(1) : value
  const params = new URLSearchParams(raw)
  if (params.get("v") !== INFINITY_ADDRESS_VERSION) {
    throw new Error("Unsupported Infinity field-state address")
  }
  const integer = (name: string) => {
    const value = Number(params.get(name))
    if (!Number.isSafeInteger(value)) throw new Error(`Invalid Infinity address field: ${name}`)
    return value
  }
  const channel = params.get("c") as InfinityChannel
  if (!["FILTER", "ISOLATE", "RECONSTRUCT", "NONE"].includes(channel)) {
    throw new Error("Invalid Infinity routing channel")
  }
  const depth = integer("d")
  if (depth < 0 || depth > 4) throw new Error("Infinity query depth must be 0 through 4")
  const subject = params.get("s") || undefined
  return Object.freeze({
    version: INFINITY_ADDRESS_VERSION,
    grain: integer("g"),
    act: integer("a"),
    x: integer("x"),
    y: integer("y"),
    z: integer("z"),
    depth,
    channel,
    ...(subject ? { subject } : {}),
  })
}

export function infinityAddressFromLocation(location: Pick<Location, "search" | "hash">): InfinityFieldAddress | null {
  const source = location.hash.startsWith("#field=")
    ? decodeURIComponent(location.hash.slice("#field=".length))
    : location.search
  if (!source) return null
  try {
    return decodeInfinityAddress(source)
  } catch {
    return null
  }
}
