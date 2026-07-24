import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import { FirstActExplorer } from "../src/model/explorer.ts"

test("one serializable frame keeps chronology, grain, query, and projection together", () => {
  const explorer = new FirstActExplorer()
  const initial = explorer.frame()
  assert.equal(initial.observer.act, 0)
  assert.equal(initial.observer.relativeGrain, 0)
  assert.deepEqual(initial.chronology.was, [])
  assert.deepEqual(initial.chronology.is, ["0,0,0"])
  assert.equal(initial.chronology.next, null)
  assert.equal(initial.wholeProjection.presentations, 36)
  assert.equal(initial.wholeProjection.addressedRelations, 19)
  assert.equal(initial.wholeProjection.resolvedSame, 13)
  assert.equal(initial.wholeProjection.outwardDifference, 6)
  assert.equal(initial.recursiveQuery.frontierIsExpandable, true)
  const serialized = JSON.stringify(initial)
  const restored = JSON.parse(serialized)
  assert.equal(
    restored.recursiveQuery.query.events.length,
    initial.recursiveQuery.eventCount,
  )
  assert.equal(
    restored.recursiveQuery.query.frontier.length,
    initial.recursiveQuery.frontierCount,
  )
})

test("shared Act remains fixed while navigating grain and space", () => {
  const explorer = new FirstActExplorer()
  explorer.resolveOneTick()
  const before = explorer.frame()
  const inward = explorer.enterWhole(2)
  assert.equal(inward.observer.act, before.observer.act)
  assert.equal(inward.observer.relativeGrain, -1)
  assert.equal(inward.observer.relativeWholePath.length, 1)

  const moved = explorer.moveSpatially(0)
  assert.equal(moved.observer.act, before.observer.act)
  assert.equal(moved.observer.relativeGrain, -1)
  assert.equal(moved.observer.spatialAddress, "1,0,0")

  const outward = explorer.returnOutward()
  assert.equal(outward.observer.act, before.observer.act)
  assert.equal(outward.observer.relativeGrain, 0)
  assert.equal(outward.observer.relativeWholePath.length, 0)
})

test("WAS and NEXT navigation reuse verified history", () => {
  const explorer = new FirstActExplorer()
  const one = explorer.resolveOneTick()
  const two = explorer.resolveOneTick()
  assert.equal(two.observer.act, 2)
  const was = explorer.returnToWas()
  assert.equal(was.observer.act, 1)
  assert.deepEqual(was.chronology.is, one.chronology.is)
  assert.deepEqual(was.chronology.next, two.chronology.is)
  const next = explorer.resolveOneTick()
  assert.equal(next.observer.act, 2)
  assert.deepEqual(next.chronology.is, two.chronology.is)
})

test("every selectable generated relation explains why it exists with provenance", () => {
  const explorer = new FirstActExplorer()
  const tick = explorer.resolveOneTick()
  assert.ok(tick.currentLedger)
  for (const entry of tick.currentLedger.entries) {
    const selected = explorer.selectTickRelation(entry.address)
    assert.equal(selected.explanation?.result, entry.result)
    assert.ok(selected.explanation?.because.length)
    assert.equal(selected.explanation?.status, "GENERATED")
    assert.ok(selected.explanation?.ancestryStatuses.includes("SELECTED"))
    assert.equal(selected.explanation?.externalComparisonAllowed, false)
    assert.ok(selected.explanation?.provenanceIds.includes("gf2"))
  }

  const projection = explorer.frame().wholeProjection
  for (const entry of projection.entries) {
    const selected = explorer.selectProjectionRelation(entry.normalizedAddress)
    assert.equal(selected.explanation?.result, entry.result)
    assert.ok(selected.explanation?.because.length)
    assert.equal(selected.explanation?.status, "GENERATED")
    assert.ok(selected.explanation?.ancestryStatuses.includes("SELECTED"))
    assert.equal(selected.explanation?.externalComparisonAllowed, false)
    assert.ok(selected.explanation?.provenanceIds.includes("whole-web"))
  }
})

test("deeper interactive query keeps the observer and Act fixed", () => {
  const explorer = new FirstActExplorer()
  explorer.resolveOneTick()
  const shallow = explorer.setQueryDepth(1)
  const deep = explorer.setQueryDepth(3)
  assert.equal(deep.observer.act, shallow.observer.act)
  assert.equal(deep.observer.relativeGrain, shallow.observer.relativeGrain)
  assert.ok(deep.recursiveQuery.eventCount > shallow.recursiveQuery.eventCount)
  assert.ok(deep.recursiveQuery.relationCount > shallow.recursiveQuery.relationCount)
  assert.equal(deep.recursiveQuery.frontierIsExpandable, true)
})

test("the public frame schema parses and declares the provenance qualification fields", async () => {
  const schema = JSON.parse(
    await readFile(
      new URL("../schema/explorer-frame.schema.json", import.meta.url),
      "utf8",
    ),
  )
  assert.equal(schema.properties.kernelVersion.const, "first-act-gf2-v1")
  assert.equal(schema.$defs.explanation.properties.status.const, "GENERATED")
  assert.ok(
    schema.$defs.explanation.required.includes("ancestryStatuses"),
  )
  assert.ok(
    schema.$defs.explanation.required.includes("externalComparisonAllowed"),
  )
})
