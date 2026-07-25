import assert from "node:assert/strict"
import test from "node:test"

import { emptyThoughtState, resolveThought } from "../src/model/thought.ts"

test("a first thought makes a previously absent Difference present", () => {
  const result = resolveThought(emptyThoughtState(), "NOT ME")
  assert.equal(result.wasPresent, false)
  assert.equal(result.isPresent, true)
  assert.equal(result.firstDifference, true)
  assert.equal(result.is.moment, 1)
})

test("thinking the same distinction again records recursion without duplicating it", () => {
  const first = resolveThought(emptyThoughtState(), "NOT ME")
  const second = resolveThought(first.is, "NOT ME")
  assert.equal(second.wasPresent, true)
  assert.equal(second.firstDifference, false)
  assert.equal(second.recurrence, 2)
  assert.equal(second.is.records.length, 1)
})

test("thinking about a prior thought creates a distinct recursively addressable thought", () => {
  const first = resolveThought(emptyThoughtState(), "cube")
  const recursive = resolveThought(first.is, `thought(${first.content})`)
  assert.deepEqual(
    recursive.is.records.map((record) => record.content),
    ["cube", "thought(cube)"],
  )
})
