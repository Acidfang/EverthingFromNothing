import assert from "node:assert/strict"
import test from "node:test"

import { generateLineageLevel, lineageCount } from "../src/model/lineage.ts"

test("binary-scaled six-Face lineages remain unique through depth 6", () => {
  for (let depth = 0; depth <= 6; depth += 1) {
    const level = generateLineageLevel(depth)
    assert.equal(level.count, 6 ** depth)
    assert.equal(level.expectedCount, level.count)
    assert.equal(level.unique, true)
    assert.equal(new Set(level.nodes.map((node) => node.path.join("/"))).size, level.count)
  }
})

test("lineage count remains available without enumerating infinite depth", () => {
  assert.equal(lineageCount(8), 1_679_616)
})
