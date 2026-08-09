import assert from "node:assert/strict"
import test from "node:test"
import {
  buildGrainPlayback,
  GRAIN_PLAYBACK_MOMENTS,
  planCrossGrainResolution,
} from "../src/model/grain-playback.ts"

test("grain playback renders every change that occupies an available pixel", () => {
  const playback = buildGrainPlayback(0, -3, 8)
  assert.deepEqual(playback.frames.map(({ grain }) => grain), [0, -1, -2, -3])
  assert.deepEqual(playback.frames.map(({ sourceGrain }) => sourceGrain), [null, 0, -1, -2])
  assert.deepEqual(playback.frames.map(({ hiddenGrainsBefore }) => hiddenGrainsBefore), [0, 0, 0, 0])
  assert.equal(playback.causalGrainCount, 4)
  assert.equal(playback.renderedGrainCount, 4)
  assert.equal(playback.hiddenGrainCount, 0)
  assert.ok(playback.frames.every(({ spiral }) => spiral.length === GRAIN_PLAYBACK_MOMENTS + 1))
})

test("grain playback accumulates sub-pixel changes before rendering another frame", () => {
  const playback = buildGrainPlayback(0, -7, 8)
  assert.deepEqual(playback.frames.map(({ grain }) => grain), [0, -1, -2, -3])
  assert.deepEqual(playback.frames.map(({ sourceGrain }) => sourceGrain), [null, 0, -1, -2])
  assert.deepEqual(playback.frames.map(({ hiddenGrainsBefore }) => hiddenGrainsBefore), [0, 0, 0, 0])
  assert.ok(playback.frames.slice(1).every(({ projectedChangePixels }) => projectedChangePixels >= 1))
  assert.equal(playback.causalGrainCount, 8)
  assert.equal(playback.renderedGrainCount, 4)
  assert.equal(playback.hiddenGrainCount, 4)
})

test("grain playback rejects invalid ranges and pixel spans", () => {
  assert.throws(() => buildGrainPlayback(0, 0, 0))
  assert.throws(() => buildGrainPlayback(0, -2, -1))
  assert.throws(() => buildGrainPlayback(0, -2, Number.NaN))
  assert.throws(() => buildGrainPlayback(0, -2.5, 0))
})

test("matching transform paths become references while grain-local values remain local", () => {
  const playback = buildGrainPlayback(0, -3, 8)
  const plan = planCrossGrainResolution(playback)
  assert.equal(plan.uniquePatternCount, 1)
  assert.equal(plan.referencedPatternCount, 3)
  assert.equal(plan.needs[0].mode, "RESOLVE HERE")
  assert.equal(plan.needs[0].referenceGrain, null)
  assert.ok(plan.needs.slice(1).every((need) =>
    need.mode === "REFERENCE OTHER GRAIN"
    && need.referenceGrain === 0
  ))
  assert.deepEqual(plan.needs[2].localValuesRetained, [
    "grain",
    "scale",
    "orientation",
    "size",
    "causal route",
  ])
  assert.equal(
    plan.needs[0].shapeSignature,
    plan.needs[2].shapeSignature,
  )
  assert.equal(
    plan.needs[0].orientationSignature,
    plan.needs[2].orientationSignature,
  )
  assert.equal(plan.needs[0].size, plan.needs[2].size)
  assert.equal(plan.evaluatedPointCount, GRAIN_PLAYBACK_MOMENTS + 1)
  assert.equal(
    plan.savedPointEvaluations,
    plan.expandedPointCount - plan.evaluatedPointCount,
  )
})
