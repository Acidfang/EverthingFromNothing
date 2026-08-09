import assert from "node:assert/strict"
import test from "node:test"

import { reconstructFirstAct, relationChildren } from "../src/model/first-act.ts"

test("Joe's selected thought Act is the sole model Root", () => {
  const model = reconstructFirstAct()
  const roots = model.relations.filter(({ parents }) => parents.length === 0)
  assert.deepEqual(roots.map(({ id, status }) => [id, status]), [["root-thought", "SELECTED"]])
})

test("the exact First Act ledger retains WAS DID IS CAN BE", () => {
  const { ledger } = reconstructFirstAct()
  assert.match(ledger.was, /not present/)
  assert.match(ledger.did, /one oriented rotation/)
  assert.match(ledger.is, /Difference and its first bias/)
  assert.match(ledger.canBe, /Every Resolution/)
})

test("pre-temporal entailment does not execute recursion or ordered time", () => {
  const model = reconstructFirstAct()
  const recursion = model.relations.find(({ id }) => id === "recursion-available")!
  const time = model.relations.find(({ id }) => id === model.temporalBoundaryId)!
  assert.equal(recursion.layer, "PRE_TEMPORAL")
  assert.match(recursion.statement, /available/)
  assert.match(recursion.how, /do not claim repeated temporal execution/)
  assert.equal(time.layer, "TEMPORAL")
})

test("foundational physical closure ends at recursively retained medium SPACE", () => {
  const model = reconstructFirstAct()
  const space = model.relations.find(({ id }) => id === model.foundationalClosureId)!
  assert.equal(space.label, "RECURSIVELY RETAINED MEDIUM · SPACE")
  assert.deepEqual(space.parents, ["medium"])
  assert.deepEqual(relationChildren("closure").map(({ id }) => id), ["wave"])
})

test("frames and two faces are explanatory projections, not mechanism events", () => {
  const model = reconstructFirstAct()
  for (const id of ["two-face-demo", "frame-views"]) {
    assert.equal(model.relations.find((item) => item.id === id)?.layer, "EXPLANATORY_PROJECTION")
  }
})

test("cube algebra is optional and physical identity remains unresolved", () => {
  const model = reconstructFirstAct()
  const cube = model.relations.find(({ id }) => id === "cube")!
  const labels = model.relations.find(({ id }) => id === "physical-labels")!
  assert.equal(cube.layer, "OPTIONAL_PROJECTION")
  assert.equal(cube.status, "SELECTED")
  assert.equal(labels.layer, "LATER_LABEL")
  assert.equal(labels.status, "UNRESOLVED")
})
