import assert from "node:assert/strict"
import test from "node:test"

import {
  PARTICLE_MOMENTS_PER_ACT,
  calculateParticleForceMoments,
  calculateParticleTransformPath,
  deriveFirstActParticle,
  sampleParticleHelix,
} from "../src/model/particle.ts"

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

test("the drawn helix and force calculation share the same 36 moments", () => {
  const samples = sampleParticleHelix("1,0,0")
  const forces = calculateParticleForceMoments("1,0,0")
  assert.equal(samples.length, PARTICLE_MOMENTS_PER_ACT + 1)
  assert.equal(forces.length, PARTICLE_MOMENTS_PER_ACT - 1)
  assert.deepEqual(samples[0], { x: 0, y: 0, z: 0 })
  assert.ok(Math.abs(samples.at(-1)!.x - 1) < 1e-12)
  assert.ok(Math.abs(samples.at(-1)!.y) < 1e-12)
  assert.ok(Math.abs(samples.at(-1)!.z) < 1e-12)
  for (const force of forces) {
    assert.ok(Number.isFinite(force.resultantForce))
    assert.ok(Math.abs(force.outwardTransfer - 1 / PARTICLE_MOMENTS_PER_ACT) < 1e-12)
    assert.ok(Math.abs(force.axialForce) < 1e-12)
    assert.ok(Math.abs(force.sixFaceResultant - force.resultantForce * 6) < 1e-12)
  }
})

test("all six Faces generate equal force magnitudes at every moment", () => {
  const particle = deriveFirstActParticle()
  const signatures = particle.causalTraces.map((trace) =>
    calculateParticleForceMoments(trace.to).map((force) =>
      force.resultantForce.toFixed(12),
    ),
  )
  for (const signature of signatures.slice(1)) {
    assert.deepEqual(signature, signatures[0])
  }
})

test("the full transform path preserves every WAS to IS handoff", () => {
  const path = calculateParticleTransformPath("1,0,0")
  assert.equal(path.length, PARTICLE_MOMENTS_PER_ACT)
  assert.equal(path[0].parentId, null)
  assert.equal(path.at(-1)!.nextId, null)
  assert.deepEqual(
    path.map((step) => step.phase),
    [
      ...Array(12).fill("DIRECTION ALLOWED"),
      ...Array(12).fill("FACE PRESENTED"),
      ...Array(12).fill("ADDRESS RESOLVED"),
    ],
  )
  for (let index = 1; index < path.length; index += 1) {
    assert.equal(path[index].parentId, path[index - 1].id)
    assert.equal(path[index - 1].nextId, path[index].id)
    assert.deepEqual(path[index].was, path[index - 1].is)
  }
})

test("the particle retains all 216 six-Face transforms", () => {
  const particle = deriveFirstActParticle()
  assert.equal(particle.transformPaths.size, 6)
  assert.equal(particle.transformStepCount, 6 * PARTICLE_MOMENTS_PER_ACT)
  for (const path of particle.transformPaths.values()) {
    assert.equal(path.length, PARTICLE_MOMENTS_PER_ACT)
  }
})
