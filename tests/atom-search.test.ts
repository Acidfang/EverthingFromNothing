import assert from "node:assert/strict"
import test from "node:test"

import {
  canonicalCubeSignature,
  searchAtomInvariants,
} from "../src/model/atom-search.ts"

test("cube canonicalization removes rotations and reflections but preserves structure", () => {
  const first = new Set(["0,0,0", "1,0,0", "0,1,0"])
  const rotated = new Set(["0,0,0", "0,1,0", "0,0,-1"])
  const different = new Set(["0,0,0", "1,0,0", "-1,0,0"])
  assert.equal(canonicalCubeSignature(first), canonicalCubeSignature(rotated))
  assert.notEqual(canonicalCubeSignature(first), canonicalCubeSignature(different))
})

test("atom search finds the first five-to-one-to-five closure at moment four", () => {
  const result = searchAtomInvariants(16, 1, 1)
  assert.equal(result.invariantCount, 1)
  assert.equal(result.strongest?.motifSize, 5)
  assert.equal(result.strongest?.resolutionSignature, "0,0,0")
  assert.equal(result.strongest?.observerSignature, "5:5:5:5:5:5")
  assert.equal(result.strongest?.firstMoment, 4)
  assert.equal(result.strongest?.closureSpan, 2)
  assert.equal(result.strongest?.recurrenceStepGcd, 2)
  for (const invariant of result.invariants) {
    assert.ok(invariant.motifSize >= 2)
    assert.ok(invariant.occurrences.length > 0)
    assert.ok(invariant.longestConsecutiveRun > 0)
    for (const occurrence of invariant.occurrences) {
      assert.ok(occurrence.transferFromWas <= 1)
      assert.ok(occurrence.transferToWillBe <= 1)
    }
  }
})
