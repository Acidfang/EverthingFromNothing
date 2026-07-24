import { add, FACES, key } from "./address.ts"

export type EventAddress = Readonly<{
  grain: number
  act: number
  x: number
  y: number
  z: number
}>

export type Relation =
  | "INWARD"
  | "OUTWARD"
  | "SPATIAL_FACE"
  | "WAS"
  | "NEXT"

export type RelationEdge = Readonly<{
  relation: Relation
  source: string
  target: string
}>

export type RecursiveQuery = Readonly<{
  centre: string
  radius: number
  events: ReadonlySet<string>
  edges: readonly RelationEdge[]
  frontier: ReadonlySet<string>
}>

export function eventKey(event: EventAddress): string {
  return `${event.grain}|${event.act}|${event.x},${event.y},${event.z}`
}

export function eventFromKey(value: string): EventAddress {
  const [grain, act, address] = value.split("|")
  const [x, y, z] = address.split(",").map(Number)
  const values = [Number(grain), Number(act), x, y, z]
  if (values.some((item) => !Number.isSafeInteger(item))) {
    throw new Error(`Invalid event address: ${value}`)
  }
  return { grain: values[0], act: values[1], x, y, z }
}

export function immediateRelations(event: EventAddress): readonly RelationEdge[] {
  const source = eventKey(event)
  const inward = FACES.map((face): RelationEdge => ({
    relation: "INWARD",
    source,
    target: eventKey({
      grain: event.grain - 1,
      act: event.act,
      x: event.x * 2 + face.x,
      y: event.y * 2 + face.y,
      z: event.z * 2 + face.z,
    }),
  }))
  const spatial = FACES.map((face): RelationEdge => {
    const target = add({ x: event.x, y: event.y, z: event.z }, face)
    return {
      relation: "SPATIAL_FACE",
      source,
      target: eventKey({ ...event, ...target }),
    }
  })
  return Object.freeze([
    ...inward,
    {
      relation: "OUTWARD",
      source,
      target: eventKey({
        grain: event.grain + 1,
        act: event.act,
        x: Math.floor(event.x / 2),
        y: Math.floor(event.y / 2),
        z: Math.floor(event.z / 2),
      }),
    },
    ...spatial,
    {
      relation: "WAS",
      source,
      target: eventKey({ ...event, act: event.act - 1 }),
    },
    {
      relation: "NEXT",
      source,
      target: eventKey({ ...event, act: event.act + 1 }),
    },
  ])
}

export function queryField(
  centre: EventAddress,
  radius: number,
): RecursiveQuery {
  if (!Number.isSafeInteger(radius) || radius < 0) {
    throw new Error("Query radius must be a non-negative safe integer")
  }
  const centreKey = eventKey(centre)
  const distance = new Map([[centreKey, 0]])
  const queue = [centreKey]
  const edges: RelationEdge[] = []
  const edgeKeys = new Set<string>()

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const source = queue[cursor]
    const sourceDistance = distance.get(source)!
    if (sourceDistance === radius) continue
    for (const edge of immediateRelations(eventFromKey(source))) {
      const edgeKey = `${edge.relation}:${edge.source}>${edge.target}`
      if (!edgeKeys.has(edgeKey)) {
        edgeKeys.add(edgeKey)
        edges.push(edge)
      }
      if (!distance.has(edge.target)) {
        distance.set(edge.target, sourceDistance + 1)
        queue.push(edge.target)
      }
    }
  }

  return Object.freeze({
    centre: centreKey,
    radius,
    events: new Set(distance.keys()),
    edges: Object.freeze(edges),
    frontier: new Set(
      [...distance]
        .filter(([, value]) => value === radius)
        .map(([event]) => event),
    ),
  })
}

export function isQueryPrefix(
  shallow: RecursiveQuery,
  deep: RecursiveQuery,
): boolean {
  if (shallow.centre !== deep.centre || shallow.radius > deep.radius) return false
  const deepEdges = new Set(
    deep.edges.map((edge) => `${edge.relation}:${edge.source}>${edge.target}`),
  )
  return (
    [...shallow.events].every((event) => deep.events.has(event))
    && shallow.edges.every((edge) =>
      deepEdges.has(`${edge.relation}:${edge.source}>${edge.target}`),
    )
  )
}
