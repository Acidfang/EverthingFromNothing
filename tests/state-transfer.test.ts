import assert from "node:assert/strict"
import test from "node:test"
import {
  buildStateTransferEngine,
  resolveRecursiveSweep,
  resolveReceiverView,
} from "../src/model/state-transfer.ts"

test("state transfer engine references repeated WAS IS WILL-BE behaviour", () => {
  const engine = buildStateTransferEngine()
  assert.equal(engine.moments.length, 36)
  assert.equal(engine.uniqueTemporalBehaviours, 4)
  assert.equal(engine.referencedComputes, 32)
  assert.equal(engine.intervals.reduce(
    (total, interval) => total + interval.momentCount,
    0,
  ), 36)
  assert.equal(engine.emergentGeometry, "OPEN PATH")
  assert.equal(
    engine.nextShapeAllowance,
    "INDEPENDENT RECURSIVE AXIS → SWEPT SURFACE",
  )
})

test("all resolved phase moments sweep the open path into a closed surface", () => {
  const engine = buildStateTransferEngine()
  const sweep = resolveRecursiveSweep(engine)
  assert.equal(sweep.phaseCount, 36)
  assert.equal(sweep.pathSampleCount, 37)
  assert.equal(sweep.startRadius, 0)
  assert.ok(sweep.endRadius < 1e-12)
  assert.ok(sweep.phaseClosureError < 1e-12)
  assert.equal(sweep.boundaryClosed, true)
  assert.equal(sweep.topology, "CLOSED SPHERE-TOPOLOGY SURFACE")
  assert.equal(sweep.uniqueSurfacePointCount, 1262)
})

test("receiver resolution retains moments it cannot distinguish", () => {
  const engine = buildStateTransferEngine()
  const fine = resolveReceiverView(engine, {
    spatialStep: 0.001,
    temporalStep: 1,
  })
  const coarse = resolveReceiverView(engine, {
    spatialStep: 0.2,
    temporalStep: 4,
  })
  assert.equal(
    fine.capturedMoments.length + fine.unresolvedMoments.length,
    engine.moments.length,
  )
  assert.equal(
    coarse.capturedMoments.length + coarse.unresolvedMoments.length,
    engine.moments.length,
  )
  assert.ok(coarse.capturedMoments.length < fine.capturedMoments.length)
  assert.ok(coarse.unresolvedMoments.length > fine.unresolvedMoments.length)
})
