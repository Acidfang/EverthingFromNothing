import assert from "node:assert/strict"
import test from "node:test"
import {
  GALAXY_OBSERVATION_IDS,
  resolveGalaxyCandidateInward,
  searchGeneratedGalaxyCandidates,
  traceGalaxyCandidateLineage,
} from "../src/model/galaxy-search.ts"

test("galaxy search ranks generated structure without assigning observed identity", () => {
  const result = searchGeneratedGalaxyCandidates(8)
  assert.equal(result.generatedStateCount, 8)
  assert.equal(result.observationalCandidateCount, 0)
  assert.equal(result.precandidates.length, 8)
  assert.ok(result.precandidates.every(
    ({ status }) => status === "STRUCTURAL PRE-CANDIDATE",
  ))
  assert.ok(result.precandidates.every(
    ({ unresolved }) => unresolved.length === GALAXY_OBSERVATION_IDS.length,
  ))
  assert.ok(result.precandidates.some(
    ({ allowances }) => allowances.includes("OUTWARD RESIDUAL"),
  ))
  assert.ok(result.precandidates.some(
    ({ allowances }) => allowances.includes("UNRESOLVED CENTRE"),
  ))
})

test("the matched whole is made into a child grain and resolved again", () => {
  const inward = resolveGalaxyCandidateInward(8, 4)
  assert.equal(inward.steps.length, 4)
  assert.equal(inward.steps[0].parentMeCount, (6n ** 8n).toString())
  assert.equal(
    inward.steps[0].childPresentationCount,
    (6n ** 9n).toString(),
  )
  for (const step of inward.steps) {
    assert.equal(step.initialMatchesCompletedStructure, false)
    assert.equal(step.firstTurningMoment, 2)
    assert.equal(step.completedStructureMoment, 36)
    assert.equal(step.firstNonMatchAfterParentCompletion, 0)
    assert.equal(step.endStateMatchesParentStructure, true)
    assert.equal(step.repeatedComputeCount, 1)
    assert.equal(step.separatelyVisibleAtOriginalResolution, false)
    assert.equal(step.originalViewMatchesThroughAllChildMoments, true)
  }
  assert.equal(inward.steps[0].originalBoundaryRemainder, true)
  assert.ok(inward.steps.slice(1).every(
    ({ originalBoundaryRemainder }) => !originalBoundaryRemainder,
  ))
  assert.equal(inward.localFirstMismatchMoment, 0)
  assert.equal(inward.originalViewFirstMismatchMoment, null)
  assert.equal(
    inward.result,
    "LOCAL STRUCTURE RE-FORMS; ORIGINAL OBSERVER RETAINS THE PARENT MATCH",
  )
})

test("galaxy search validates its finite search bound", () => {
  assert.throws(() => searchGeneratedGalaxyCandidates(0))
  assert.throws(() => searchGeneratedGalaxyCandidates(13))
})

test("the matched structural lineage is followed until its stopping rule", () => {
  const lineage = traceGalaxyCandidateLineage(64)
  assert.equal(lineage.steps.length, 63)
  assert.equal(lineage.firstStructuralMismatch, null)
  assert.equal(
    lineage.termination,
    "NO FINITE MISMATCH UNDER THE DEFINED RECURSION",
  )
  assert.equal(lineage.steps[0].supportCount, "36")
  assert.equal(lineage.steps.at(-1)!.supportCount, (6n ** 64n).toString())
  assert.ok(lineage.steps.every(({ branchCount }) => branchCount === 6))
  assert.ok(lineage.steps.every(
    ({ outwardResidualCount }) => outwardResidualCount === 6,
  ))
  assert.ok(lineage.steps.every(({ originPresent }) => !originPresent))
  assert.equal(lineage.observationalStatus, "UNRESOLVED FROM FIRST COMPARISON")
})
