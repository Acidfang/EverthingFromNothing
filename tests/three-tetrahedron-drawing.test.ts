import test from "node:test"
import assert from "node:assert/strict"
import { SHARED_ZERO, THREE_TETRAHEDRON_DRAWING, THREE_TETRAHEDRON_ORDERS, cycleOrder } from "../src/model/three-tetrahedron-drawing.ts"

test("three tetrahedra occupy one shared ZERO and identical geometry",()=>{
 assert.equal(THREE_TETRAHEDRON_DRAWING.count,3)
 assert.equal(THREE_TETRAHEDRON_DRAWING.coincident,true)
 assert.equal(THREE_TETRAHEDRON_DRAWING.translatedApart,false)
 for(const tetra of THREE_TETRAHEDRON_DRAWING.presentations){
   assert.deepEqual(tetra.centre,SHARED_ZERO)
   assert.deepEqual(tetra.vertices,THREE_TETRAHEDRON_DRAWING.vertices)
 }
})

test("the three presentations are the complete cyclic WAS IS NEXT orders",()=>{
 assert.deepEqual(THREE_TETRAHEDRON_ORDERS,[
   ["WAS","IS","NEXT"],
   ["NEXT","WAS","IS"],
   ["IS","NEXT","WAS"],
 ])
 assert.deepEqual(cycleOrder(THREE_TETRAHEDRON_ORDERS[0]),THREE_TETRAHEDRON_ORDERS[1])
 assert.deepEqual(cycleOrder(THREE_TETRAHEDRON_ORDERS[1]),THREE_TETRAHEDRON_ORDERS[2])
 assert.deepEqual(cycleOrder(THREE_TETRAHEDRON_ORDERS[2]),THREE_TETRAHEDRON_ORDERS[0])
})

test("canonical transition is retained on the drawing",()=>{
 const t=THREE_TETRAHEDRON_DRAWING.transition
 assert.equal(t.nextBecomes,"IS")
 assert.equal(t.isBecomes,"WAS")
 assert.equal(t.wasBecomes,"NEXT")
 assert.equal(t.twist,true)
 assert.equal(t.rotate,true)
 assert.equal(t.turn,true)
})
