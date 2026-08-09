import assert from "node:assert/strict"
import test from "node:test"
import {
  EARTH_OBSERVATIONS,
  resolveEarthCandidates,
} from "../src/model/earth-observation.ts"

test("Earth candidates retain matches, missing facts, and conflicts separately", () => {
  const results = resolveEarthCandidates()
  assert.equal(EARTH_OBSERVATIONS.length, 18)
  assert.equal(results[0].id, "observed-earth-state")
  assert.equal(results[0].status, "OBSERVATIONALLY COMPLETE")
  assert.equal(results[0].matched.length, 18)
  const firstAct = results.find(({ id }) => id === "first-act-recursive-surface")!
  assert.equal(firstAct.status, "CAN BE")
  assert.deepEqual(firstAct.matched, ["CLOSED_SURFACE"])
  assert.equal(firstAct.unresolved.length, 17)
  assert.equal(firstAct.conflicts.length, 0)
  const sphere = results.find(({ id }) => id === "uniform-sphere")!
  assert.equal(sphere.status, "INCOMPATIBLE")
  assert.ok(sphere.conflicts.includes("OBLATE_AXES"))
  assert.ok(sphere.conflicts.includes("LAYERED_INTERIOR"))
  const isolated = results.find(
    ({ id }) => id === "isolated-rotating-oblate-shell",
  )!
  assert.equal(isolated.status, "INCOMPATIBLE")
  assert.deepEqual(isolated.conflicts, [
    "SUN_EARTH_ORBIT",
    "SUN_EARTH_IRRADIANCE",
    "SUN_EARTH_SOLAR_WIND",
  ])
  const galactic = results.find(
    ({ id }) => id === "galaxy-bound-sun-earth-state",
  )!
  assert.equal(galactic.status, "CAN BE")
  assert.equal(galactic.matched.length, 12)
  assert.equal(galactic.unresolved.length, 6)
  assert.equal(galactic.conflicts.length, 0)
})
