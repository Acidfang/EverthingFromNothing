import assert from "node:assert/strict"
import test from "node:test"

import { deriveFirstActParticle } from "../src/model/particle.ts"

test("one First Act produces the complete six-Face model particle", () => {
  const particle = deriveFirstActParticle()
  assert.equal(particle.firstDifference.size, 1)
  assert.equal(particle.facePresentations, 6)
  assert.equal(particle.particleField.size, 6)
  assert.equal(particle.observerViews.size, 6)
  assert.equal(particle.observerSignature, "5:5:5:5:5:5")
  assert.equal(particle.mergedCount, 6)
  assert.equal(particle.mergeRecoversParticle, true)
  assert.equal(particle.causalTraces.length, 6)
  assert.deepEqual(
    particle.causalTraces.map((trace) => trace.from),
    Array(6).fill("0,0,0"),
  )
  assert.deepEqual(
    particle.causalTraces.map((trace) => trace.to),
    particle.particleAddresses,
  )
  for (const trace of particle.causalTraces) {
    assert.deepEqual(trace.subcauses, [
      "DIRECTION ALLOWED",
      "FACE PRESENTED",
      "ADDRESS RESOLVED",
    ])
  }
})

test("no single Face observer contains the complete particle", () => {
  const particle = deriveFirstActParticle()
  for (const view of particle.observerViews.values()) {
    assert.equal(view.length, 5)
    assert.notDeepEqual(view, particle.particleAddresses)
  }
})
