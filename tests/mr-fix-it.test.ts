import assert from "node:assert/strict"
import test from "node:test"
import { deriveFixProjection, fixAddress, MR_FIX_IT_FLOW } from "../src/model/mr-fix-it.ts"

const intake = {
  intent: "Repair the leaking tap",
  skill: "Basic hand tools",
  risk: "Water isolation",
  worries: "Damaging the fitting",
  ability: "Turn off the water and photograph the valve",
  equipment: "Adjustable spanner",
  cost: "$40 parts allowance",
  help: "Replace the cartridge",
}

test("public and array views derive from one addressed intake", () => {
  const projection = deriveFixProjection(intake)
  assert.equal(projection.address, fixAddress(intake))
  assert.equal(projection.address, "PUBLIC/MR-FIX-IT/repair-the-leaking-tap")
  assert.equal(projection.guidancePrice, "FREE")
  assert.equal(projection.statedBudget, "$40 parts allowance")
  assert.equal(projection.requestedWorkPrice, "UNRESOLVED — NO QUOTE PRODUCED")
  assert.equal(projection.intake, projection.intake)
})

test("the retained intake path includes every established decision boundary", () => {
  assert.deepEqual(MR_FIX_IT_FLOW, [
    "INTENT", "SKILL", "RISK", "WORRIES", "ABILITY", "EQUIPMENT",
    "COST", "CAN_DO", "SELECTED_HELP",
  ])
})

test("guidance stays free until requested work is selected and priced", () => {
  const projection = deriveFixProjection({ ...intake, cost: "", help: "" })
  assert.equal(projection.guidancePrice, "FREE")
  assert.equal(projection.statedBudget, "NOT PROVIDED")
  assert.equal(projection.requestedWorkPrice, "UNRESOLVED — NO QUOTE PRODUCED")
  assert.equal(projection.selectedHelp, "No paid work selected. Guidance remains free.")
})

