import assert from "node:assert/strict"
import test from "node:test"
import { buildGrainPlayback, GRAIN_PLAYBACK_MOMENTS } from "../src/model/grain-playback.ts"

test("grain playback renders every inward grain when skipping is disabled", () => {
  const playback = buildGrainPlayback(0, -3, 0)
  assert.deepEqual(playback.frames.map(({ grain }) => grain), [0, -1, -2, -3])
  assert.deepEqual(playback.frames.map(({ sourceGrain }) => sourceGrain), [null, 0, -1, -2])
  assert.deepEqual(playback.frames.map(({ hiddenGrainsBefore }) => hiddenGrainsBefore), [0, 0, 0, 0])
  assert.equal(playback.causalGrainCount, 4)
  assert.equal(playback.renderedGrainCount, 4)
  assert.equal(playback.hiddenGrainCount, 0)
  assert.ok(playback.frames.every(({ spiral }) => spiral.length === GRAIN_PLAYBACK_MOMENTS + 1))
})

test("grain playback preserves omitted causal grains while skipping rendered frames", () => {
  const playback = buildGrainPlayback(0, -7, 2)
  assert.deepEqual(playback.frames.map(({ grain }) => grain), [0, -3, -6, -7])
  assert.deepEqual(playback.frames.map(({ sourceGrain }) => sourceGrain), [null, -2, -5, -6])
  assert.deepEqual(playback.frames.map(({ hiddenGrainsBefore }) => hiddenGrainsBefore), [0, 2, 2, 0])
  assert.equal(playback.frames.at(-1)?.grain, -7)
  assert.equal(playback.causalGrainCount, 8)
  assert.equal(playback.renderedGrainCount, 4)
  assert.equal(playback.hiddenGrainCount, 4)
})

test("grain playback rejects invalid ranges and skip values", () => {
  assert.throws(() => buildGrainPlayback(0, 0, 0))
  assert.throws(() => buildGrainPlayback(0, -2, -1))
  assert.throws(() => buildGrainPlayback(0, -2, 9))
  assert.throws(() => buildGrainPlayback(0, -2.5, 0))
})
