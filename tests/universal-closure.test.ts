import assert from "node:assert/strict"
import test from "node:test"

import { firstDifference, resolveTick, reverseTick, sameField } from "../src/model/kernel.ts"
import { COMPLETE_MEDIUM_ANALYSIS } from "../src/model/medium-resolution.ts"
import { projectWhole } from "../src/model/projection.ts"
import {
  buildStateTransferEngine,
  resolveRecursiveSweep,
} from "../src/model/state-transfer.ts"
import { traceGalaxyCandidateLineage } from "../src/model/galaxy-search.ts"

test("demonstrations six and seven share one traced structural closure", () => {
  const first = firstDifference()
  const advanced = resolveTick(first).state
  const returned = reverseTick(advanced)
  const projection = projectWhole(2)
  const sweep = resolveRecursiveSweep(buildStateTransferEngine())
  const lineage = traceGalaxyCandidateLineage(8)

  const trace = Object.freeze({
    distributedMediumPresentations:
      COMPLETE_MEDIUM_ANALYSIS.totalMediumPresentations,
    exactReturn:
      returned.act === first.act
      && sameField(returned.was, first.was)
      && sameField(returned.is, first.is),
    transientSameClosures:
      projection.entries.filter(({ result }) => result === "SAME").length,
    residualDifferences:
      projection.entries.filter(({ result }) => result === "DIFFERENT").length,
    maximumArrivalCount: Math.max(
      ...projection.entries.map(({ arrivalCount }) => arrivalCount),
    ),
    recursiveSurfaceClosed: sweep.boundaryClosed,
    recursiveSurfacePoints: sweep.uniqueSurfacePointCount,
    disjointContinuationCount:
      new Set(lineage.steps.map(({ branchCount }) => branchCount)),
    residualCounts:
      new Set(lineage.steps.map(({ outwardResidualCount }) =>
        outwardResidualCount)),
    occupiedOrigins:
      lineage.steps.filter(({ originPresent }) => originPresent).length,
    firstStructuralMismatch: lineage.firstStructuralMismatch,
  })

  assert.equal(trace.distributedMediumPresentations, 172)
  assert.equal(trace.exactReturn, true)
  assert.equal(trace.transientSameClosures, 13)
  assert.equal(trace.residualDifferences, 6)
  assert.equal(trace.maximumArrivalCount, 6)
  assert.equal(trace.recursiveSurfaceClosed, true)
  assert.equal(trace.recursiveSurfacePoints, 1262)
  assert.deepEqual([...trace.disjointContinuationCount], [6])
  assert.deepEqual([...trace.residualCounts], [6])
  assert.equal(trace.occupiedOrigins, 0)
  assert.equal(trace.firstStructuralMismatch, null)
})
