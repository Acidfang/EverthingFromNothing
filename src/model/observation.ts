import { fromKey, key, type Address } from "./address.ts"

export type Observer = Readonly<{
  id: "ME" | "OTHER"
  position: Address
}>

export type Sight = Readonly<{
  address: string
  direction: string
  distanceSquared: number
}>

export type BinocularResolution = Readonly<{
  me: Observer
  other: Observer
  meView: readonly Sight[]
  otherView: readonly Sight[]
  visibleToBoth: readonly string[]
  jointlySupported: readonly string[]
  onlyMe: readonly string[]
  onlyOther: readonly string[]
  hiddenFromBoth: readonly string[]
}>

export const OBSERVER_FACES = [
  "-X",
  "+X",
  "-Y",
  "+Y",
  "-Z",
  "+Z",
] as const

export type ObserverFace = typeof OBSERVER_FACES[number]

export type FaceObserver = Readonly<{
  id: ObserverFace
  position: Address
}>

export type CubeObservation = Readonly<{
  radius: number
  observers: readonly FaceObserver[]
  views: ReadonlyMap<ObserverFace, readonly Sight[]>
  visibility: ReadonlyMap<string, number>
  visibleFromEveryFace: readonly string[]
  visibleFromAnyFace: readonly string[]
  hiddenFromEveryFace: readonly string[]
}>

export type CombinedObservation = Readonly<{
  faces: readonly ObserverFace[]
  complementFaces: readonly ObserverFace[]
  oppositePairCount: number
  symmetryClass: string
  receivedByAny: readonly string[]
  receivedByEvery: readonly string[]
  observerDependent: readonly string[]
  unreceived: readonly string[]
  visibilityHistogram: readonly number[]
  signature: string
}>

function gcd(left: number, right: number): number {
  let a = Math.abs(left)
  let b = Math.abs(right)
  while (b !== 0) [a, b] = [b, a % b]
  return a
}

function direction(observer: Address, target: Address): string {
  const dx = target.x - observer.x
  const dy = target.y - observer.y
  const dz = target.z - observer.z
  const divisor = gcd(gcd(dx, dy), dz) || 1
  return `${dx / divisor},${dy / divisor},${dz / divisor}`
}

function distanceSquared(observer: Address, target: Address): number {
  const dx = target.x - observer.x
  const dy = target.y - observer.y
  const dz = target.z - observer.z
  return dx * dx + dy * dy + dz * dz
}

export function observe(
  field: ReadonlySet<string>,
  observer: Observer,
): readonly Sight[] {
  const nearestByDirection = new Map<string, Sight>()
  for (const address of field) {
    const target = fromKey(address)
    const ray = direction(observer.position, target)
    const sight = {
      address,
      direction: ray,
      distanceSquared: distanceSquared(observer.position, target),
    }
    const nearest = nearestByDirection.get(ray)
    if (
      nearest === undefined
      || sight.distanceSquared < nearest.distanceSquared
      || (
        sight.distanceSquared === nearest.distanceSquared
        && sight.address < nearest.address
      )
    ) {
      nearestByDirection.set(ray, sight)
    }
  }
  return Object.freeze(
    [...nearestByDirection.values()].sort(
      (left, right) =>
        left.direction.localeCompare(right.direction)
        || left.distanceSquared - right.distanceSquared,
    ),
  )
}

export function binocularResolve(
  field: ReadonlySet<string>,
  separation = 4,
): BinocularResolution {
  if (!Number.isSafeInteger(separation) || separation < 1) {
    throw new Error("Observer separation must be a positive safe integer")
  }
  let extent = 0
  for (const address of field) {
    const { x, y, z } = fromKey(address)
    extent = Math.max(extent, Math.abs(x), Math.abs(y), Math.abs(z))
  }
  const half = Math.ceil(separation / 2)
  const observerY = -(extent + 3)
  const me: Observer = Object.freeze({
    id: "ME",
    position: Object.freeze({ x: -half, y: observerY, z: 0 }),
  })
  const other: Observer = Object.freeze({
    id: "OTHER",
    position: Object.freeze({ x: separation - half, y: observerY, z: 0 }),
  })
  const meView = observe(field, me)
  const otherView = observe(field, other)
  const meVisible = new Set(meView.map((sight) => sight.address))
  const otherVisible = new Set(otherView.map((sight) => sight.address))
  const meDirections = new Set(meView.map((sight) => sight.direction))
  const otherDirections = new Set(otherView.map((sight) => sight.direction))
  const visibleToBoth: string[] = []
  const jointlySupported: string[] = []
  const onlyMe: string[] = []
  const onlyOther: string[] = []
  const hiddenFromBoth: string[] = []

  for (const address of field) {
    const seenByMe = meVisible.has(address)
    const seenByOther = otherVisible.has(address)
    if (seenByMe && seenByOther) visibleToBoth.push(address)
    else if (seenByMe) onlyMe.push(address)
    else if (seenByOther) onlyOther.push(address)
    else hiddenFromBoth.push(address)

    const target = fromKey(address)
    if (
      meDirections.has(direction(me.position, target))
      && otherDirections.has(direction(other.position, target))
    ) {
      jointlySupported.push(key(target))
    }
  }

  return Object.freeze({
    me,
    other,
    meView,
    otherView,
    visibleToBoth: Object.freeze(visibleToBoth.sort()),
    jointlySupported: Object.freeze(jointlySupported.sort()),
    onlyMe: Object.freeze(onlyMe.sort()),
    onlyOther: Object.freeze(onlyOther.sort()),
    hiddenFromBoth: Object.freeze(hiddenFromBoth.sort()),
  })
}

export function observeFromSixFaces(
  field: ReadonlySet<string>,
): CubeObservation {
  let extent = 0
  for (const address of field) {
    const { x, y, z } = fromKey(address)
    extent = Math.max(extent, Math.abs(x), Math.abs(y), Math.abs(z))
  }
  const radius = extent + 3
  const observers: readonly FaceObserver[] = Object.freeze([
    Object.freeze({ id: "-X" as const, position: Object.freeze({ x: -radius, y: 0, z: 0 }) }),
    Object.freeze({ id: "+X" as const, position: Object.freeze({ x: radius, y: 0, z: 0 }) }),
    Object.freeze({ id: "-Y" as const, position: Object.freeze({ x: 0, y: -radius, z: 0 }) }),
    Object.freeze({ id: "+Y" as const, position: Object.freeze({ x: 0, y: radius, z: 0 }) }),
    Object.freeze({ id: "-Z" as const, position: Object.freeze({ x: 0, y: 0, z: -radius }) }),
    Object.freeze({ id: "+Z" as const, position: Object.freeze({ x: 0, y: 0, z: radius }) }),
  ])
  const views = new Map<ObserverFace, readonly Sight[]>()
  const visibility = new Map<string, number>(
    [...field].map((address) => [address, 0]),
  )
  for (const observer of observers) {
    const view = observe(field, {
      id: observer.id === "-X" ? "ME" : "OTHER",
      position: observer.position,
    })
    views.set(observer.id, view)
    for (const sight of view) {
      visibility.set(sight.address, (visibility.get(sight.address) ?? 0) + 1)
    }
  }
  const visibleFromEveryFace: string[] = []
  const visibleFromAnyFace: string[] = []
  const hiddenFromEveryFace: string[] = []
  for (const [address, count] of visibility) {
    if (count === observers.length) visibleFromEveryFace.push(address)
    if (count > 0) visibleFromAnyFace.push(address)
    else hiddenFromEveryFace.push(address)
  }
  return Object.freeze({
    radius,
    observers,
    views,
    visibility,
    visibleFromEveryFace: Object.freeze(visibleFromEveryFace.sort()),
    visibleFromAnyFace: Object.freeze(visibleFromAnyFace.sort()),
    hiddenFromEveryFace: Object.freeze(hiddenFromEveryFace.sort()),
  })
}

export function combineFaceViews(
  field: ReadonlySet<string>,
  observation: CubeObservation,
  faces: readonly ObserverFace[],
): CombinedObservation {
  if (faces.length === 0) throw new Error("At least one observer Face is required")
  if (new Set(faces).size !== faces.length) {
    throw new Error("Observer Faces must be unique")
  }
  const receivedSets = faces.map((face) => {
    const view = observation.views.get(face)
    if (!view) throw new Error(`Unknown observer Face: ${face}`)
    return new Set(view.map((sight) => sight.address))
  })
  const receivedByAny: string[] = []
  const receivedByEvery: string[] = []
  const observerDependent: string[] = []
  const unreceived: string[] = []
  const visibilityHistogram = Array.from(
    { length: faces.length + 1 },
    () => 0,
  )

  for (const address of field) {
    const count = receivedSets.reduce(
      (total, received) => total + Number(received.has(address)),
      0,
    )
    visibilityHistogram[count] += 1
    if (count === 0) unreceived.push(address)
    else receivedByAny.push(address)
    if (count === faces.length) receivedByEvery.push(address)
    else if (count > 0) observerDependent.push(address)
  }
  const sortedHistogram = Object.freeze([...visibilityHistogram])
  const complementFaces = OBSERVER_FACES.filter((face) => !faces.includes(face))
  const oppositePairCount = [
    ["-X", "+X"],
    ["-Y", "+Y"],
    ["-Z", "+Z"],
  ].filter(([negative, positive]) =>
    faces.includes(negative as ObserverFace)
    && faces.includes(positive as ObserverFace),
  ).length
  return Object.freeze({
    faces: Object.freeze([...faces]),
    complementFaces: Object.freeze(complementFaces),
    oppositePairCount,
    symmetryClass: `${faces.length}-face/${oppositePairCount}-opposite`,
    receivedByAny: Object.freeze(receivedByAny.sort()),
    receivedByEvery: Object.freeze(receivedByEvery.sort()),
    observerDependent: Object.freeze(observerDependent.sort()),
    unreceived: Object.freeze(unreceived.sort()),
    visibilityHistogram: sortedHistogram,
    signature: sortedHistogram.join(":"),
  })
}
