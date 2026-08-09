import assert from "node:assert/strict"
import test from "node:test"

import { reconstructChildGrain, reconstructFirstAct } from "../src/model/first-act.ts"

test("all resolution phases remain inside one outer First-Act Moment", () => {
  const act = reconstructFirstAct()
  assert.equal(act.outerMoment, 1)
  assert.deepEqual([...new Set(act.phases.map(({ outerMoment }) => outerMoment))], [1])
  assert.deepEqual([...new Set(act.phases.map(({ frame }) => frame))], [
    "FIRST_FRAME", "CLOUD_FRAME", "STRUCTURE_FRAME",
  ])
})

test("the minimum projection is two relational faces at one reference", () => {
  const act = reconstructFirstAct()
  assert.deepEqual(act.presentations.map(({ id }) => id), ["FACE_A", "FACE_B"])
  assert.equal(new Set(act.presentations.map(({ reference }) => reference)).size, 1)
})

test("zoom exposes contained resolution without becoming the causal DID", () => {
  const act = reconstructFirstAct()
  const cloud = act.phases.find(({ did }) => did.startsWith("ZOOM TEMPORAL"))!
  assert.equal(cloud.outerMoment, 1)
  assert.equal(cloud.frame, "CLOUD_FRAME")
  assert.ok(cloud.evidence.includes("no geometry"))
})

test("the wave forms the medium before recursive ripple and structure", () => {
  const act = reconstructFirstAct()
  const closure = act.phases.find(({ introduced }) => introduced.includes("FIRST_WAVE"))!
  const ripple = act.phases.find(({ introduced }) => introduced.includes("RIPPLE"))!
  const structure = act.phases.find(({ frame }) => frame === "STRUCTURE_FRAME")!
  assert.deepEqual(closure.introduced, ["FIRST_WAVE", "LOCAL_MEDIUM"])
  assert.ok(closure.phase < ripple.phase)
  assert.ok(ripple.phase < structure.phase)
})

test("geometry and parity remain optional projections after the mechanism", () => {
  const act = reconstructFirstAct()
  const generated = act.phases.flatMap(({ is }) => is)
  assert.equal(generated.includes("CUBE"), false)
  assert.equal(generated.includes("GF(2)_PARITY"), false)
  assert.deepEqual(act.selectedProjections, ["CUBE", "REPEATING_GRID", "GF(2)_PARITY"])
})

test("a child Grain inherits the complete parent IS before local Difference", () => {
  const parent = reconstructFirstAct().phases.at(-1)!
  const child = reconstructChildGrain(parent, "G-1")
  assert.deepEqual(child.was, parent.is)
  assert.deepEqual(child.is.slice(0, parent.is.length), parent.is)
  assert.equal(child.is.at(-1), "LOCAL_ORIENTATION@G-1")
  assert.equal(child.outerMoment, parent.outerMoment)
})
