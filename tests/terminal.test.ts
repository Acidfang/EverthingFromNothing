import assert from "node:assert/strict"
import test from "node:test"

import { FirstActExplorer } from "../src/model/explorer.ts"
import { executeCommand } from "../src/terminal.ts"

test("terminal workflow explores tick, grain, space, depth, and causal why", () => {
  const explorer = new FirstActExplorer()

  let result = executeCommand(explorer, "tick")
  assert.equal(result.frame.observer.act, 1)
  assert.match(result.output, /Act 1/)

  result = executeCommand(explorer, "enter 0")
  assert.equal(result.frame.observer.act, 1)
  assert.equal(result.frame.observer.relativeGrain, -1)

  result = executeCommand(explorer, "move 4")
  assert.equal(result.frame.observer.act, 1)
  assert.equal(result.frame.observer.spatialAddress, "0,0,1")

  result = executeCommand(explorer, "depth 3")
  assert.equal(result.frame.observer.queryDepth, 3)
  assert.match(result.output, /expandable frontier/)

  result = executeCommand(explorer, "relations")
  assert.equal(result.output.split("\n").length, 19)

  result = executeCommand(explorer, "select 2,0,0")
  assert.equal(result.frame.selected?.address, "2,0,0")
  assert.match(result.output, /status: GENERATED/)
  assert.match(result.output, /external comparison: BLOCKED/)
  assert.match(result.output, /because:/)

  result = executeCommand(explorer, "out")
  assert.equal(result.frame.observer.act, 1)
  assert.equal(result.frame.observer.relativeGrain, 0)
})

test("terminal reports invalid requests without corrupting explorer state", () => {
  const explorer = new FirstActExplorer()
  const before = explorer.frame()
  const result = executeCommand(explorer, "enter 9")
  assert.match(result.output, /^Error:/)
  assert.deepEqual(result.frame, before)
  assert.deepEqual(explorer.frame(), before)
})

test("terminal exposes ledger and complete JSON frame", () => {
  const explorer = new FirstActExplorer()
  assert.match(
    executeCommand(explorer, "ledger").output,
    /No tick ledger/,
  )
  executeCommand(explorer, "tick")
  assert.match(executeCommand(explorer, "ledger").output, /arrivals/)
  const json = executeCommand(explorer, "frame").output
  assert.equal(JSON.parse(json).kernelVersion, "first-act-gf2-v1")
})
