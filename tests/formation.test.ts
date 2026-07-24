import assert from "node:assert/strict"
import test from "node:test"

import { analyseFormation } from "../src/model/formation.ts"
import { firstDifference, resolveTick } from "../src/model/kernel.ts"

test("formation analysis detects connected fields and exact model energies", () => {
  const first = firstDifference()
  const initial = analyseFormation(first.was, first.is)
  assert.equal(initial.fieldCount, 1)
  assert.equal(initial.largestField, 1)
  assert.equal(initial.activeDifferences, 1)
  assert.equal(initial.appearedDifferences, 1)
  assert.equal(initial.retainedDifferences, 0)
  assert.equal(initial.resolvedDifferences, 0)
  assert.equal(initial.boundaryFaces, 6)
  assert.deepEqual(initial.modelEnergy, {
    difference: 1,
    transition: 1,
    boundary: 6,
    physicalUnit: null,
  })

  const second = resolveTick(first).state
  const resolved = analyseFormation(second.was, second.is)
  assert.equal(resolved.fieldCount, 1)
  assert.equal(resolved.largestField, 6)
  assert.equal(resolved.activeDifferences, 6)
  assert.equal(resolved.appearedDifferences, 6)
  assert.equal(resolved.retainedDifferences, 0)
  assert.equal(resolved.resolvedDifferences, 1)
  assert.equal(resolved.boundaryFaces, 36)
  assert.equal(resolved.modelEnergy.transition, 7)
})

test("detected fields partition every active Difference exactly once", () => {
  let state = firstDifference()
  for (let act = 0; act < 10; act += 1) {
    const analysis = analyseFormation(state.was, state.is)
    const addresses = analysis.fields.flatMap((field) => field.addresses)
    assert.equal(addresses.length, state.is.size)
    assert.equal(new Set(addresses).size, state.is.size)
    assert.deepEqual(new Set(addresses), new Set(state.is))
    assert.equal(
      analysis.fields.reduce(
        (total, field) => total + field.boundaryFaces,
        0,
      ),
      analysis.boundaryFaces,
    )
    state = resolveTick(state).state
  }
})
