import assert from "node:assert/strict"
import test from "node:test"

import { reconstructChildGrain, reconstructFirstAct } from "../src/model/first-act.ts"

test("the carrier-independent Root begins with no represented Difference", () => {
  const act = reconstructFirstAct()
  assert.deepEqual(act.moments[0].is, [])
  assert.deepEqual(act.moments[0].canBe, ["FIRST DIFFERENCE"])
})

test("the First Difference creates exactly two presentations at one reference", () => {
  const act = reconstructFirstAct()
  assert.deepEqual(act.presentations.map(({ id }) => id), ["THIS", "IS_NOT_THIS"])
  assert.equal(new Set(act.presentations.map(({ reference }) => reference)).size, 1)
})

test("geometry and parity are not imported into the generating ledger", () => {
  const act = reconstructFirstAct()
  const generated = act.moments.flatMap(({ is }) => is)
  assert.equal(generated.includes("CUBE"), false)
  assert.equal(generated.includes("GF(2)_PARITY"), false)
  assert.deepEqual(act.selectedProjections, ["BINARY", "CUBE", "SIX_FACE_GRID", "GF(2)_PARITY"])
})

test("orientation closure admits wave and medium as one moment", () => {
  const closure = reconstructFirstAct().moments[3]
  assert.ok(closure.is.includes("FIRST_WAVE"))
  assert.ok(closure.is.includes("LOCAL_MEDIUM"))
  assert.equal(closure.did, "RESOLVE THE ALLOWANCE BETWEEN PRESENTATIONS")
})

test("a child Grain inherits the complete parent IS before local Difference", () => {
  const parent = reconstructFirstAct().moments[4]
  const child = reconstructChildGrain(parent, "G-1")
  assert.deepEqual(child.was, parent.is)
  assert.deepEqual(child.is.slice(0, parent.is.length), parent.is)
  assert.equal(child.is.at(-1), "LOCAL_ORIENTATION@G-1")
})
