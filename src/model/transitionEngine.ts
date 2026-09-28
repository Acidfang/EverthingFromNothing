import { CANONICAL_SEED } from "./canonicalSeed"

export type TemporalRole = (typeof CANONICAL_SEED.temporalRoles)[number]
export type TemporalState = Readonly<{
  was: TemporalRole
  is: TemporalRole
  next: TemporalRole
  step: number
}>

export type TransitionReceipt = Readonly<{
  before: TemporalState
  after: TemporalState
  movement: typeof CANONICAL_SEED.transition.movement
  proceed: true
  twist: true
  turn: true
}>

export const INITIAL_TEMPORAL_STATE: TemporalState = Object.freeze({
  was: "WAS",
  is: "IS",
  next: "NEXT",
  step: 0,
})

export function transition(state: TemporalState): TransitionReceipt {
  const after: TemporalState = Object.freeze({
    was: state.is,
    is: state.next,
    next: state.was,
    step: state.step + 1,
  })
  return Object.freeze({
    before: state,
    after,
    movement: CANONICAL_SEED.transition.movement,
    proceed: true,
    twist: CANONICAL_SEED.transition.twist,
    turn: CANONICAL_SEED.transition.turn,
  })
}

export function verifyTransitionCycle(start: TemporalState = INITIAL_TEMPORAL_STATE): string[] {
  const differences: string[] = []
  const r1 = transition(start)
  const r2 = transition(r1.after)
  const r3 = transition(r2.after)

  if (r1.after.was !== start.is || r1.after.is !== start.next || r1.after.next !== start.was) {
    differences.push("handoff-1")
  }
  if (r3.after.was !== start.was || r3.after.is !== start.is || r3.after.next !== start.next) {
    differences.push("three-step-role-cycle")
  }
  if (r3.after.step !== start.step + 3) differences.push("step-progression")
  for (const receipt of [r1, r2, r3]) {
    if (receipt.movement !== "SEQUENTIAL_FOLLOW_LOCK") differences.push("movement")
    if (!receipt.proceed) differences.push("proceed")
    if (!receipt.twist || !receipt.turn) differences.push("twist-turn")
  }
  return differences
}
