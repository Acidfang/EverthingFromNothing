import test from 'node:test'
import assert from 'node:assert/strict'
import {createEIThreadDrawPlan} from '../src/model/ei-thread-draw.ts'
import {projectEIThreadDrawFrame} from '../src/model/ei-thread-draw-frame.ts'
const nodes=['root','child','leaf','elsewhere'].map(address=>({address,revision:0,sourceId:`source:${address}`}))
const edge=(id:string,from:string,to:string)=>({id,from,to,label:'thread',sourceId:`source:${id}`,sourceRevision:0,known:true})
const plan=createEIThreadDrawPlan(nodes,[edge('a','root','child'),edge('b','child','leaf'),edge('c','leaf','root')],'root')
test('source appears before each real incoming thread completes and before its child',()=>{
 const start=projectEIThreadDrawFrame(plan,0);assert.deepEqual(start.nodes.filter(n=>n.visible).map(n=>n.address),['root']);assert.equal(start.edges.filter(e=>e.visible).length,0)
 const partial=projectEIThreadDrawFrame(plan,1.5);assert.equal(partial.edges.find(e=>e.id==='a')!.fraction,.5);assert.equal(partial.nodes.find(n=>n.address==='child')!.visible,false)
 const next=projectEIThreadDrawFrame(plan,2);assert.equal(next.edges.find(e=>e.id==='a')!.fraction,1);assert.equal(next.nodes.find(n=>n.address==='child')!.visible,true);assert.equal(next.edges.find(e=>e.id==='b')!.fraction,0)
})
test('complete drawing retains every cycle edge and marks disconnected overview without inventing a path',()=>{
 const frame=projectEIThreadDrawFrame(plan,plan.lastStage+1);assert.equal(frame.complete,true);assert.equal(frame.modelAdvanced,false);assert.ok(frame.edges.every(e=>e.fraction===1));assert.equal(frame.nodes.find(n=>n.address==='elsewhere')!.unreached,true)
})
test('replay retains already drawn trace and never mutates inputs or invents state revisions',()=>{
 const before=JSON.stringify(plan),frame=projectEIThreadDrawFrame(plan,0,{nodes:new Set(['child']),edges:new Set(['a'])});assert.equal(frame.nodes.find(n=>n.address==='child')!.visible,true);assert.equal(frame.edges.find(e=>e.id==='a')!.retained,true);assert.equal(JSON.stringify(plan),before);assert.ok(frame.nodes.every(n=>n.revision===0))
 assert.throws(()=>projectEIThreadDrawFrame(plan,NaN));assert.throws(()=>projectEIThreadDrawFrame(plan,-1))
})
