import assert from "node:assert/strict"
import test from "node:test"
import {
  canVerify,
  normalizeCompletionState,
  type CompletionState,
  type FractureReceipt,
} from "../src/model/completion-fracture.ts"

type AddressedField = Readonly<{
  address: string
  state: CompletionState
  evidence: readonly string[]
}>

function filterIsolateAddressOneToTwo(fieldOne: AddressedField, fieldTwo: AddressedField): FractureReceipt {
  switch (fieldOne.state) {
    case "VERIFIED":
      return Object.freeze({
        address: fieldOne.address,
        sourceAddress: fieldTwo.address,
        owner: "ADDRESSED_FIELD",
        state: normalizeCompletionState(fieldTwo.state, fieldTwo.evidence),
        evidence: fieldTwo.evidence,
        blockers: [],
        unfinished: [],
      })
    case "RETAINED":
    case "QUEUED":
    case "EXECUTED":
    case "BLOCKED":
    case "UNRESOLVED":
      return Object.freeze({
        address: fieldOne.address,
        sourceAddress: fieldTwo.address,
        owner: "ADDRESSED_FIELD",
        state: fieldOne.state,
        evidence: fieldOne.evidence,
        blockers: ["FIELD_ONE_NOT_VERIFIED"],
        unfinished: ["FILTER_ISOLATE_FIELD_ONE"],
      })
  }
}

test("FILTER ISOLATE one verified address can address two and return its evidence", () => {
  const fieldOne = Object.freeze({
    address: "FIELD_1",
    state: "VERIFIED" as const,
    evidence: ["FIELD_1_RECEIPT"],
  })
  const fieldTwo = Object.freeze({
    address: "FIELD_2",
    state: "VERIFIED" as const,
    evidence: ["FIELD_2_RECEIPT"],
  })

  const receipt = filterIsolateAddressOneToTwo(fieldOne, fieldTwo)

  assert.equal(receipt.address, "FIELD_1")
  assert.equal(receipt.sourceAddress, "FIELD_2")
  assert.equal(receipt.state, "VERIFIED")
  assert.deepEqual(receipt.evidence, ["FIELD_2_RECEIPT"])
  assert.equal(canVerify(receipt), true)
})

test("one cannot promote two to VERIFIED when two has no returned evidence", () => {
  const receipt = filterIsolateAddressOneToTwo(
    Object.freeze({ address: "FIELD_1", state: "VERIFIED" as const, evidence: ["FIELD_1_RECEIPT"] }),
    Object.freeze({ address: "FIELD_2", state: "VERIFIED" as const, evidence: [] }),
  )

  assert.equal(receipt.state, "EXECUTED")
  assert.equal(canVerify(receipt), false)
})

test("one cannot address two as verified before one is verified", () => {
  const receipt = filterIsolateAddressOneToTwo(
    Object.freeze({ address: "FIELD_1", state: "EXECUTED" as const, evidence: ["FIELD_1_EXECUTION"] }),
    Object.freeze({ address: "FIELD_2", state: "VERIFIED" as const, evidence: ["FIELD_2_RECEIPT"] }),
  )

  assert.equal(receipt.state, "EXECUTED")
  assert.deepEqual(receipt.blockers, ["FIELD_ONE_NOT_VERIFIED"])
  assert.equal(canVerify(receipt), false)
})
