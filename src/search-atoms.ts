import { searchAtomInvariants } from "./model/atom-search.ts"

const requestedMoment = Number(process.argv[2] ?? 64)
const requestedRadius = Number(process.argv[3] ?? 1)
const requestedTransfer = Number(process.argv[4] ?? 1)
const result = searchAtomInvariants(
  requestedMoment,
  requestedRadius,
  requestedTransfer,
)

console.log(JSON.stringify({
  ...result,
  strongest: result.strongest
    ? {
        ...result.strongest,
        occurrences: result.strongest.occurrences.slice(0, 12),
      }
    : null,
  invariants: result.invariants.slice(0, 20).map((invariant) => ({
    ...invariant,
    occurrences: invariant.occurrences.slice(0, 12),
  })),
}, null, 2))
