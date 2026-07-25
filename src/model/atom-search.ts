import { add, fromKey, key, type Address } from "./address.ts"
import {
  firstDifference,
  resolveTick,
  type Field,
  type ResolverState,
} from "./kernel.ts"
import { observeFromSixFaces } from "./observation.ts"
import { analysePotential } from "./potential.ts"

const PERMUTATIONS = [
  [0, 1, 2],
  [0, 2, 1],
  [1, 0, 2],
  [1, 2, 0],
  [2, 0, 1],
  [2, 1, 0],
] as const

const SIGNS = [
  [-1, -1, -1],
  [-1, -1, 1],
  [-1, 1, -1],
  [-1, 1, 1],
  [1, -1, -1],
  [1, -1, 1],
  [1, 1, -1],
  [1, 1, 1],
] as const

export type LocalMotif = Readonly<{
  centre: string
  signature: string
  size: number
  relativeField: Field
}>

export type AtomOccurrence = Readonly<{
  moment: number
  wasCentre: string
  isCentre: string
  willBeCentre: string
  transferFromWas: number
  transferToWillBe: number
}>

export type AtomInvariant = Readonly<{
  signature: string
  resolutionSignature: string
  motifSize: number
  observerSignature: string
  occurrences: readonly AtomOccurrence[]
  firstMoment: number
  lastMoment: number
  uniqueMoments: readonly number[]
  recurrenceStepGcd: number
  closureSpan: 2
  longestConsecutiveRun: number
  exampleField: readonly string[]
}>

export type AtomSearchResult = Readonly<{
  searchedThroughMoment: number
  neighbourhoodRadius: number
  transferRadius: number
  invariantCount: number
  strongest: AtomInvariant | null
  invariants: readonly AtomInvariant[]
}>

function coordinate(address: Address): readonly [number, number, number] {
  return [address.x, address.y, address.z]
}

function transform(
  address: Address,
  permutation: readonly [number, number, number],
  signs: readonly [number, number, number],
): string {
  const values = coordinate(address)
  return `${values[permutation[0]] * signs[0]},${values[permutation[1]] * signs[1]},${values[permutation[2]] * signs[2]}`
}

export function canonicalCubeSignature(relativeField: Field): string {
  let canonical: string | null = null
  for (const permutation of PERMUTATIONS) {
    for (const signs of SIGNS) {
      const transformed = [...relativeField]
        .map((address) => transform(fromKey(address), permutation, signs))
        .sort()
        .join(";")
      if (canonical === null || transformed < canonical) canonical = transformed
    }
  }
  return canonical ?? ""
}

export function localMotifs(field: Field, radius: number): readonly LocalMotif[] {
  if (!Number.isSafeInteger(radius) || radius < 1 || radius > 3) {
    throw new Error("Motif radius must be an integer from 1 through 3")
  }
  return Object.freeze([...field].map((centreKey) => {
    const centre = fromKey(centreKey)
    const relative = new Set<string>()
    for (let x = -radius; x <= radius; x += 1) {
      for (let y = -radius; y <= radius; y += 1) {
        for (let z = -radius; z <= radius; z += 1) {
          const relativeAddress = { x, y, z }
          if (field.has(key(add(centre, relativeAddress)))) {
            relative.add(key(relativeAddress))
          }
        }
      }
    }
    return Object.freeze({
      centre: centreKey,
      signature: canonicalCubeSignature(relative),
      size: relative.size,
      relativeField: relative,
    })
  }))
}

function chebyshevDistance(left: string, right: string): number {
  const a = fromKey(left)
  const b = fromKey(right)
  return Math.max(
    Math.abs(a.x - b.x),
    Math.abs(a.y - b.y),
    Math.abs(a.z - b.z),
  )
}

function nearestMatchingCentre(
  centre: string,
  candidates: readonly LocalMotif[],
  transferRadius: number,
): Readonly<{ centre: string; distance: number }> | null {
  let nearest: Readonly<{ centre: string; distance: number }> | null = null
  for (const candidate of candidates) {
    const distance = chebyshevDistance(centre, candidate.centre)
    if (
      distance <= transferRadius
      && (nearest === null || distance < nearest.distance)
    ) {
      nearest = { centre: candidate.centre, distance }
    }
  }
  return nearest
}

function nearestMotif(
  centre: string,
  candidates: readonly LocalMotif[],
  transferRadius: number,
): Readonly<{ motif: LocalMotif; distance: number }> | null {
  let nearest: Readonly<{ motif: LocalMotif; distance: number }> | null = null
  for (const motif of candidates) {
    const distance = chebyshevDistance(centre, motif.centre)
    if (
      distance <= transferRadius
      && (nearest === null || distance < nearest.distance)
    ) {
      nearest = { motif, distance }
    }
  }
  return nearest
}

function observerSignature(field: Field): string {
  const observation = observeFromSixFaces(field)
  return observation.observers
    .map((observer) => observation.views.get(observer.id)?.length ?? 0)
    .sort((left, right) => left - right)
    .join(":")
}

function motifsBySignature(
  motifs: readonly LocalMotif[],
): ReadonlyMap<string, readonly LocalMotif[]> {
  const grouped = new Map<string, LocalMotif[]>()
  for (const motif of motifs) {
    const values = grouped.get(motif.signature) ?? []
    values.push(motif)
    grouped.set(motif.signature, values)
  }
  return grouped
}

function consecutiveRun(occurrences: readonly AtomOccurrence[]): number {
  let longest = 0
  let current = 0
  let previous = Number.NEGATIVE_INFINITY
  for (const occurrence of occurrences) {
    current = occurrence.moment === previous + 1 ? current + 1 : 1
    previous = occurrence.moment
    longest = Math.max(longest, current)
  }
  return longest
}

function gcd(left: number, right: number): number {
  let a = Math.abs(left)
  let b = Math.abs(right)
  while (b !== 0) [a, b] = [b, a % b]
  return a
}

export function searchAtomInvariants(
  maxMoment: number,
  neighbourhoodRadius = 1,
  transferRadius = 1,
): AtomSearchResult {
  if (!Number.isSafeInteger(maxMoment) || maxMoment < 1 || maxMoment > 512) {
    throw new Error("Search moment must be an integer from 1 through 512")
  }
  const found = new Map<string, {
    motifSize: number
    resolutionSignature: string
    observerSignature: string
    occurrences: AtomOccurrence[]
    exampleField: readonly string[]
  }>()
  let state: ResolverState = firstDifference()
  for (let moment = 0; moment <= maxMoment; moment += 1) {
    const potential = analysePotential(state.was, state.is)
    const wasMotifs = localMotifs(state.was, neighbourhoodRadius)
    const isMotifs = localMotifs(state.is, neighbourhoodRadius)
    const willBeMotifs = localMotifs(potential.willBe, neighbourhoodRadius)
    const willBySignature = motifsBySignature(willBeMotifs)

    for (const motif of wasMotifs) {
      if (motif.size < 2) continue
      const next = nearestMatchingCentre(
        motif.centre,
        willBySignature.get(motif.signature) ?? [],
        transferRadius,
      )
      const resolution = nearestMotif(motif.centre, isMotifs, transferRadius)
      if (!resolution || !next) continue
      const invariantKey = `${motif.signature}|VIA|${resolution.motif.signature}`
      const existing = found.get(invariantKey)
      const occurrence = Object.freeze({
        moment: state.act,
        wasCentre: motif.centre,
        isCentre: resolution.motif.centre,
        willBeCentre: next.centre,
        transferFromWas: resolution.distance,
        transferToWillBe: next.distance,
      })
      if (existing) existing.occurrences.push(occurrence)
      else {
        found.set(invariantKey, {
          motifSize: motif.size,
          resolutionSignature: resolution.motif.signature,
          observerSignature: observerSignature(motif.relativeField),
          occurrences: [occurrence],
          exampleField: Object.freeze([...motif.relativeField].sort()),
        })
      }
    }
    state = resolveTick(state).state
  }
  const invariants = Object.freeze([...found].map(([invariantKey, value]) => {
    const signature = invariantKey.split("|VIA|")[0]
    const occurrences = Object.freeze(
      [...value.occurrences].sort((left, right) => left.moment - right.moment),
    )
    const uniqueMoments = Object.freeze(
      [...new Set(occurrences.map((occurrence) => occurrence.moment))],
    )
    const recurrenceStepGcd = uniqueMoments.slice(1).reduce(
      (result, moment, index) =>
        gcd(result, moment - uniqueMoments[index]),
      0,
    )
    return Object.freeze({
      signature,
      resolutionSignature: value.resolutionSignature,
      motifSize: value.motifSize,
      observerSignature: value.observerSignature,
      occurrences,
      firstMoment: occurrences[0].moment,
      lastMoment: occurrences.at(-1)!.moment,
      uniqueMoments,
      recurrenceStepGcd,
      closureSpan: 2 as const,
      longestConsecutiveRun: consecutiveRun(occurrences),
      exampleField: value.exampleField,
    })
  }).sort(
    (left, right) =>
      right.longestConsecutiveRun - left.longestConsecutiveRun
      || right.occurrences.length - left.occurrences.length
      || left.motifSize - right.motifSize
      || left.firstMoment - right.firstMoment,
  ))
  return Object.freeze({
    searchedThroughMoment: maxMoment,
    neighbourhoodRadius,
    transferRadius,
    invariantCount: invariants.length,
    strongest: invariants[0] ?? null,
    invariants,
  })
}
