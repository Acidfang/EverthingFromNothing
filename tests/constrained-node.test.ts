import test from "node:test"
import assert from "node:assert/strict"
import {constrainedNodes,directedTetra} from "../src/model/constrained-node.ts"
import {createLedgerContinuum,resolveTick} from "../src/model/kernel.ts"
test("each node anchor is its actual address and only retained allowed next can orient",()=>{
 const c=createLedgerContinuum(),next=resolveTick(c.state),nodes=constrainedNodes(c.state.is,next.ledger)
 assert.equal(nodes.length,1);assert.deepEqual(nodes[0].anchor,{x:0,y:0,z:0});assert.equal(nodes[0].next.length,6);assert.equal(nodes[0].status,"ALTERNATIVES")
 for(const candidate of nodes[0].next){const entry=next.ledger.entries.find(e=>e.address===candidate.address)!;assert.equal(entry.remainsDifferent,true);assert.ok(entry.arrivals.some(a=>a.source===nodes[0].address))}
 const excluded={...next.ledger,entries:next.ledger.entries.map(e=>({...e,remainsDifferent:false}))};assert.equal(constrainedNodes(c.state.is,excluded)[0].status,"NO ADMISSIBLE NEXT")
})
test("tetra tip aligns admitted displacement, no hash orientation or zero-direction fiction",()=>{
 for(const d of [{x:1,y:0,z:0},{x:0,y:-1,z:0},{x:0,y:0,z:1}]){const t=directedTetra(d)!;assert.equal(t.length,4);assert.deepEqual(t[0],{x:d.x*.38,y:d.y*.38,z:d.z*.38})}
 assert.equal(directedTetra({x:0,y:0,z:0}),null)
})
