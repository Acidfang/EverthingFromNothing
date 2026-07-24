import assert from "node:assert/strict"
import test from "node:test"

import { buildFrame, parseArguments } from "../src/cli.ts"

test("CLI options build the same inspectable frame without a UI", () => {
  const options = parseArguments([
    "--ticks", "3",
    "--enter-face", "0",
    "--enter-face", "4",
    "--depth", "2",
    "--select-projection", "2,0,0",
    "--compact",
  ])
  const frame = buildFrame(options)
  assert.equal(frame.observer.act, 3)
  assert.equal(frame.observer.relativeGrain, -2)
  assert.deepEqual(frame.observer.relativeWholePath, ["1,0,0", "0,0,1"])
  assert.equal(frame.observer.queryDepth, 2)
  assert.equal(frame.selected?.source, "WHOLE_PROJECTION")
  assert.equal(frame.explanation?.result, "DIFFERENT")
  assert.equal(frame.explanation?.status, "GENERATED")
  assert.ok(frame.explanation?.ancestryStatuses.includes("SELECTED"))
  assert.equal(frame.explanation?.externalComparisonAllowed, false)
  assert.doesNotThrow(() => JSON.parse(JSON.stringify(frame)))
})

test("CLI rejects out-of-range computation requests", () => {
  assert.throws(() => parseArguments(["--ticks", "-1"]), /between 0 and 64/)
  assert.throws(() => parseArguments(["--depth", "5"]), /between 0 and 4/)
  assert.throws(() => parseArguments(["--enter-face", "6"]), /between 0 and 5/)
  assert.throws(() => parseArguments(["--unknown"]), /Unknown argument/)
})
