import assert from "node:assert/strict"
import test from "node:test"

import {
  COLLISION_CONTACT_CLASSES,
  COLLISION_RESOLUTION_RULE,
} from "../src/model/collision-resolution.ts"

test("collision mapping retains every Face, edge, and corner contact pairing", () => {
  assert.equal(COLLISION_CONTACT_CLASSES.length, 9)
  assert.equal(new Set(COLLISION_CONTACT_CLASSES.map((contact) => contact.id)).size, 9)
  assert.ok(COLLISION_CONTACT_CLASSES.some((contact) => contact.id === "FACE:FACE"))
  assert.ok(COLLISION_CONTACT_CLASSES.some((contact) => contact.id === "EDGE:CORNER"))
  assert.ok(COLLISION_CONTACT_CLASSES.some((contact) => contact.id === "CORNER:CORNER"))
})

test("overlap maps a possible collision while separating medium remains CAN BE", () => {
  assert.deepEqual(COLLISION_RESOLUTION_RULE, {
    contactClassCount: 9,
    orientationChangesIdentity: false,
    relativeOrientationChangesContactMap: true,
    overlapMeansCollisionCandidate: true,
    overlapMeansResolvedCoexistence: false,
    unoccupiedNeighbouringState: "RESOLVING MEDIUM",
    avoidanceState: "CAN BE",
  })
})

