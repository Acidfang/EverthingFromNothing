import assert from "node:assert/strict"
import test from "node:test"

import { firstDifference, resolveTick, sameField } from "../src/model/kernel.ts"
import { analysePotential } from "../src/model/potential.ts"

test("potential flow resolves to exactly the kernel's next IS", () => {
  let state = firstDifference()
  for (let moment = 0; moment < 12; moment += 1) {
    const potential = analysePotential(state.was, state.is)
    const resolved = resolveTick(state)
    assert.ok(sameField(potential.willBe, resolved.state.is))
    assert.equal(potential.presentationCount, state.is.size * 6)
    state = resolved.state
  }
})

test("potential analysis preserves convergence, opposition, and directional remainder", () => {
  let state = firstDifference()
  for (let moment = 0; moment < 3; moment += 1) {
    state = resolveTick(state).state
  }
  const potential = analysePotential(state.was, state.is)
  assert.ok(potential.convergenceExcess > 0)
  assert.ok(potential.opposingPairs > 0)
  assert.ok(potential.directionalRemainder >= 0)
  assert.equal(potential.willBeDifferences, potential.willBe.size)
})
