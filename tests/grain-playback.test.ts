import assert from "node:assert/strict"
import test from "node:test"
import { buildGrainPlayback, GRAIN_PLAYBACK_MOMENTS } from "../src/model/grain-playback.ts"

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
