import { add, compareAddressKeys, FACES, fromKey, key, ORIGIN } from "./address.ts"

export type Field = ReadonlySet<string>

export type ResolverState = Readonly<{
  act: number
  was: Field
  is: Field
}>

export type Arrival = Readonly<{
  source: string
  face: string
}>

export type LedgerEntry = Readonly<{
  address: string
  arrivals: readonly Arrival[]
  arrivalCount: number
  wasDifferent: boolean
  remainsDifferent: boolean
  result: "DIFFERENT" | "SAME"
}>

export type TickLedger = Readonly<{
  fromAct: number
  toAct: number
  entries: readonly LedgerEntry[]
}>

export function firstDifference(): ResolverState {
  return Object.freeze({
    act: 0,
    was: new Set<string>(),
    is: new Set([key(ORIGIN)]),
  })
}

function arrivalsFor(field: Field): Map<string, Arrival[]> {
  const arrivals = new Map<string, Arrival[]>()
  for (const sourceKey of field) {
    const source = fromKey(sourceKey)
    for (const face of FACES) {
      const targetKey = key(add(source, face))
      const targetArrivals = arrivals.get(targetKey) ?? []
      targetArrivals.push({
        source: sourceKey,
        face: key(face),
      })
      arrivals.set(targetKey, targetArrivals)
    }
  }
  return arrivals
}

function symmetricDifference(left: Field, right: Field): Set<string> {
  const result = new Set(left)
  for (const value of right) {
    if (result.has(value)) result.delete(value)
    else result.add(value)
  }
  return result
}

export function resolveTick(
  state: ResolverState,
): Readonly<{ state: ResolverState; ledger: TickLedger }> {
  const snapshotWas = new Set(state.was)
  const snapshotIs = new Set(state.is)
  const arrivals = arrivalsFor(snapshotIs)
  const forcedDifference = new Set(
    [...arrivals]
      .filter(([, values]) => values.length % 2 === 1)
      .map(([address]) => address),
  )
  const nextIs = symmetricDifference(snapshotWas, forcedDifference)
  const allAddresses = new Set([...arrivals.keys(), ...snapshotWas])
  const entries = [...allAddresses]
    .sort(compareAddressKeys)
    .map((address): LedgerEntry => {
      const values = [...(arrivals.get(address) ?? [])].sort(
        (left, right) =>
          compareAddressKeys(left.source, right.source)
          || compareAddressKeys(left.face, right.face),
      )
      const remainsDifferent = nextIs.has(address)
      return Object.freeze({
        address,
        arrivals: Object.freeze(
          values.map((value): Arrival => Object.freeze(value)),
        ),
        arrivalCount: values.length,
        wasDifferent: snapshotWas.has(address),
        remainsDifferent,
        result: remainsDifferent ? "DIFFERENT" : "SAME",
      })
    })

  return Object.freeze({
    state: Object.freeze({
      act: state.act + 1,
      was: snapshotIs,
      is: nextIs,
    }),
    ledger: Object.freeze({
      fromAct: state.act,
      toAct: state.act + 1,
      entries: Object.freeze(entries),
    }),
  })
}

export function reverseTick(state: ResolverState): ResolverState {
  const forcedFromWas = new Set(
    [...arrivalsFor(state.was)]
      .filter(([, values]) => values.length % 2 === 1)
      .map(([address]) => address),
  )
  return Object.freeze({
    act: state.act - 1,
    was: symmetricDifference(state.is, forcedFromWas),
    is: new Set(state.was),
  })
}

export function sameField(left: Field, right: Field): boolean {
  return left.size === right.size && [...left].every((value) => right.has(value))
}
