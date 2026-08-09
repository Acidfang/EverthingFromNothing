import assert from "node:assert/strict"
import test from "node:test"

import { FACES } from "../src/model/address.ts"
import {
  firstDifference,
  resolveTick,
  reverseTick,
  sameField,
} from "../src/model/kernel.ts"
import { projectWhole, projectionSignature } from "../src/model/projection.ts"
import {
  mayClaimExternalIdentity,
  PROVENANCE,
} from "../src/model/provenance.ts"
import {
  immediateRelations,
  isQueryPrefix,
  queryField,
} from "../src/model/query.ts"
import { enterWhole, resolveWhole } from "../src/model/whole.ts"

test("the First Difference is the only nonempty seed", () => {
  const initial = firstDifference()
  assert.equal(initial.act, 0)
  assert.equal(initial.was.size, 0)
  assert.deepEqual([...initial.is], ["0,0,0"])
})

test("one tick resolves a frozen WAS/IS snapshot and reverses exactly", () => {
  let state = firstDifference()
  for (let step = 0; step < 12; step += 1) {
    const prior = state
    const resolved = resolveTick(prior)
    assert.equal(resolved.ledger.fromAct, prior.act)
    assert.equal(resolved.ledger.toAct, prior.act + 1)
    const recovered = reverseTick(resolved.state)
    assert.equal(recovered.act, prior.act)
    assert.ok(sameField(recovered.was, prior.was))
    assert.ok(sameField(recovered.is, prior.is))
    state = resolved.state
  }
})

test("resolution is independent of field insertion order", () => {
  let state = firstDifference()
  for (let step = 0; step < 10; step += 1) {
    state = resolveTick(state).state
  }
  const reordered = {
    act: state.act,
    was: new Set([...state.was].reverse()),
    is: new Set([...state.is].reverse()),
  }
  const first = resolveTick(state)
  const second = resolveTick(reordered)
  assert.ok(sameField(first.state.was, second.state.was))
  assert.ok(sameField(first.state.is, second.state.is))
  assert.deepEqual(first.ledger.entries, second.ledger.entries)
})

test("entering a child rebases its complete whole without cropping", () => {
  const relation = resolveWhole(6)
  for (const face of FACES) {
    const view = enterWhole(relation, face)
    assert.ok(sameField(view, relation.child.support))
  }
})

test("the containing-grain projection is exactly 36 to 19 to 13 Same plus 6 Difference", () => {
  const projection = projectWhole(6)
  assert.equal(projection.presentations, 36)
  assert.equal(projection.entries.length, 19)
  assert.equal(
    projection.entries.filter((entry) => entry.result === "SAME").length,
    13,
  )
  assert.equal(
    projection.entries.filter((entry) => entry.result === "DIFFERENT").length,
    6,
  )
  const multiplicities = Map.groupBy(
    projection.entries,
    (entry) => entry.arrivalCount,
  )
  assert.equal(multiplicities.get(1)?.length, 6)
  assert.equal(multiplicities.get(2)?.length, 12)
  assert.equal(multiplicities.get(6)?.length, 1)
})

test("normalized whole projection is grain invariant through level 8", () => {
  const expected = projectionSignature(1)
  for (let level = 2; level <= 8; level += 1) {
    assert.equal(projectionSignature(level), expected)
  }
})

test("recursive field queries preserve every prior finite prefix", () => {
  const centre = { grain: 0, act: 7, x: 0, y: 0, z: 0 }
  const queries = [0, 1, 2, 3].map((radius) => queryField(centre, radius))
  for (let index = 1; index < queries.length; index += 1) {
    assert.ok(isQueryPrefix(queries[index - 1], queries[index]))
    assert.ok(queries[index].frontier.size > 0)
  }
  const relations = immediateRelations(centre)
  assert.equal(relations.filter((edge) => edge.relation === "INWARD").length, 6)
  assert.equal(relations.filter((edge) => edge.relation === "OUTWARD").length, 1)
  assert.equal(
    relations.filter((edge) => edge.relation === "SPATIAL_FACE").length,
    6,
  )
  assert.equal(relations.filter((edge) => edge.relation === "WAS").length, 1)
  assert.equal(relations.filter((edge) => edge.relation === "NEXT").length, 1)
})

test("provenance blocks unresolved physical identity claims", () => {
  assert.equal(PROVENANCE.length, 11)
  assert.equal(mayClaimExternalIdentity("recurrence-required"), true)
  assert.equal(mayClaimExternalIdentity("whole-web"), false)
  assert.equal(mayClaimExternalIdentity("physical-identity"), false)
})
