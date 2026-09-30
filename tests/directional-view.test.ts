import test from "node:test"
import assert from "node:assert/strict"
import {MODEL_DIRECTIONS,directionBasis,projectInDirection} from "../src/model/directional-view.ts"
import {createLedgerContinuum,advanceLedgerContinuum} from "../src/model/kernel.ts"
test("retained source points select real projections without inventing a field transition",()=>{
 const field=advanceLedgerContinuum(createLedgerContinuum()),before=[...field.state.is]
 const views=MODEL_DIRECTIONS.map((_,i)=>{assert.deepEqual(projectInDirection({x:0,y:0,z:0},i),{x:0,y:0,depth:0});const basis=directionBasis(i);assert.ok(Math.abs(Math.hypot(basis.right.x,basis.right.y,basis.right.z)-1)<1e-12);return before.map(key=>{const[x,y,z]=key.split(',').map(Number);return projectInDirection({x,y,z},i)})})
 assert.equal(new Set(views.map(v=>JSON.stringify(v))).size,4)
 assert.deepEqual([...field.state.is],before);assert.equal(field.state.act,1)
 assert.throws(()=>directionBasis(4))
})
