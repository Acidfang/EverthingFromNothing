import assert from "node:assert/strict"
import test from "node:test"

import { verifySphericalClosure } from "../src/model/field-closure.ts"
import { deriveNestedGrain } from "../src/model/grain.ts"

test("the current completed spiral is not misidentified as a spherical field", () => {
  const nested = deriveNestedGrain("1,0,0", 0)
  const points = nested.moments.flatMap((moment) =>
    moment.states.flatMap((state) => state.standingWavePath),
  )
  const closure = verifySphericalClosure(points)

  assert.equal(closure.directionalCoverage, 1)
  assert.ok(closure.radialUniformity < 0.1)
  assert.ok(closure.radialVariation > 0.45)
  assert.equal(closure.closed, false)
})

test("a uniform spherical sample passes closure verification", () => {
  const points = Array.from({ length: 6 }, (_, latitude) =>
    Array.from({ length: 12 }, (_, longitude) => {
      const phi = -Math.PI / 2 + (latitude + 0.5) * Math.PI / 6
      const theta = -Math.PI + (longitude + 0.5) * Math.PI * 2 / 12
      return {
        x: Math.cos(phi) * Math.cos(theta),
        y: Math.cos(phi) * Math.sin(theta),
        z: Math.sin(phi),
      }
    }),
  ).flat()

  assert.equal(verifySphericalClosure(points).closed, true)
})
