import test from 'node:test'
import assert from 'node:assert/strict'
import {createEIIdleState,observeEIIdle} from '../src/model/ei-idle-observation.ts'
import {createEIThreadDrawPlan} from '../src/model/ei-thread-draw.ts'
import {createEIAnimationCycle,proposeNextEIAnimationFrame} from '../src/model/ei-animation-cycle.ts'
const plan=createEIThreadDrawPlan([{address:'a',revision:2,sourceId:'s'}],[],'a'),frame=proposeNextEIAnimationFrame(createEIAnimationCycle(plan,{generation:'g'}),()=>'<actual/>').NEXT!
const readback={frameKey:frame.frameKey,source:frame.source,generation:frame.generation,sequence:frame.sequence,content:frame.content}
test('idle records genuine no-change observations as bounded WAS/IS/NEXT without advancing model state',()=>{
 let state=createEIIdleState();for(let i=0;i<100;i++)state=observeEIIdle(state,frame,readback,1000+i)
 assert.equal(state.unchanged,100);assert.equal(state.differences,0);assert.equal(state.WAS!.observedAt,1098);assert.equal(state.IS!.observedAt,1099);assert.equal(state.IS!.revision,2);assert.equal(state.NEXT!.frameKey,frame.frameKey)
})
test('actual mismatch remains difference, unavailable and stale observations never invent a new IS',()=>{
 const before=observeEIIdle(createEIIdleState(),frame,readback,1),different=observeEIIdle(before,frame,{...readback,content:'changed actual'},2);assert.equal(different.status,'difference');assert.equal(different.differences,1)
 assert.equal(observeEIIdle(before,frame,null,3).IS,before.IS);assert.equal(observeEIIdle(before,frame,{...readback,generation:'other'},4).status,'stale');assert.throws(()=>observeEIIdle(before,frame,readback,NaN))
})
