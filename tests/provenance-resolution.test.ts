import assert from "node:assert/strict"
import test from "node:test"
import { PROVENANCE, ancestry } from "../src/model/provenance.ts"

test("every displayed provenance state carries the complete DCA resolution address", () => {
  const required = ["root", "input", "operation", "output", "grain", "moment", "evidence", "closure"] as const
  for (const node of PROVENANCE) {
    assert.deepEqual(Object.keys(node.resolution), required)
    for (const field of required) assert.notEqual(node.resolution[field].trim(), "")
  }
})

test("the unresolved external comparison retains its complete parent path", () => {
  const path = ancestry("physical-identity")
  assert.equal(path.at(-1)?.resolution.closure, "UNRESOLVED UNTIL NATIVE EVIDENCE CLOSES")
  assert.deepEqual(path.map((node) => node.id), [
    "nothing", "first-difference", "recurrence-required", "six-face-grid",
    "gf2", "reversible-update", "whole-web", "physical-identity",
  ])
})
