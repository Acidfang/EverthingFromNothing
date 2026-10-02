import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createEIFitImprovementState,proposeEIFitImprovement,commitEIFitImprovement,
  serializeEIFitImprovement,restoreEIFitImprovement,viewBoxEIFitCamera,
  type EIFitEvidence,type EIFitProposal,type EIFitReadback,
} from '../src/model/ei-fit-improvement.ts'

const evidence:EIFitEvidence={
  sourceSnapshot:'address/root@revision/7:actual-source-snapshot',
  viewport:{width:400,height:200},view:{x:0,y:0,zoom:2},
  objects:[
    {address:'root',revision:7,sourceId:'source/root',bounds:{left:-20,right:20,top:-20,bottom:20}},
    {address:'child',revision:2,sourceId:'source/child',bounds:{left:280,right:320,top:80,bottom:120}},
  ],
}
function proposal(value:EIFitEvidence=evidence,state=createEIFitImprovementState()):EIFitProposal {
  const result=proposeEIFitImprovement(state,value)
  assert.equal(result.status,'proposed')
  return result.proposal!
}
function applied(next:EIFitProposal):EIFitEvidence {return {...next.before,view:next.camera}}
/** Stand-in for a separate renderer measurement in pure model tests. */
function returned(next:EIFitProposal):EIFitReadback {
  return {proposalId:next.proposalId,sourceSnapshot:next.before.sourceSnapshot,viewport:{...next.before.viewport},viewBox:next.expectedViewBox,objects:next.before.objects.map(object=>({...object,bounds:{...object.bounds}}))}
}

test('source bounds and actual viewport produce a useful fit, accepted only after matching geometry return',()=>{
  const state=createEIFitImprovementState(),next=proposal()
  assert.equal(next.beforeVisible,1)
  assert.equal(next.expectedVisible,2)
  assert.deepEqual(next.camera,{x:150,y:50,zoom:400/340})
  assert.equal(next.expectedViewBox,viewBoxEIFitCamera(next.camera,evidence.viewport))
  assert.equal(state.lastGood,null)
  const result=commitEIFitImprovement(state,next,applied(next),returned(next))
  assert.equal(result.status,'committed')
  assert.equal(result.state.revision,1)
  assert.equal(result.state.lastGood?.fullyVisible,2)
  assert.equal(result.receipt.actualVisible,2)
  assert.deepEqual(result.state.lastGood?.camera,next.camera)
  assert.equal(state.receipts.length,0)
  assert.ok(Object.isFrozen(result.state.lastGood))
})

test('no invented source, empty geometry, invalid bounds, zero viewport or camera can produce a proposal',()=>{
  const state=createEIFitImprovementState()
  for(const value of [null,{...evidence,sourceSnapshot:''},{...evidence,objects:[]},{...evidence,viewport:{width:0,height:200}},{...evidence,view:{x:0,y:0,zoom:0}},{...evidence,view:{x:0,y:0,zoom:Infinity}},{...evidence,objects:[{...evidence.objects[0],bounds:{left:20,right:0,top:0,bottom:20}}]},{...evidence,objects:[evidence.objects[0],evidence.objects[0]]}]) {
    const result=proposeEIFitImprovement(state,value)
    assert.equal(result.status,'no-evidence')
    assert.equal(result.proposal,null)
  }
})

test('already fitting source objects do not trigger zoom, recentering, scores or a receipt',()=>{
  const state=createEIFitImprovementState(),fitted={...evidence,view:{x:100,y:40,zoom:.1}}
  assert.deepEqual(proposeEIFitImprovement(state,fitted),{status:'no-change',proposal:null,reasons:['source-objects-already-fit']})
  assert.equal(state.receipts.length,0)
})

test('actual source geometry, including objects larger than the viewport and degenerate points, determines fit',()=>{
  const large=proposal({...evidence,objects:[{...evidence.objects[0],bounds:{left:-1000,right:1000,top:-500,bottom:500}}]})
  assert.deepEqual(large.camera,{x:0,y:0,zoom:.2})
  assert.equal(large.beforeVisible,0)
  const point=proposal({...evidence,objects:[{...evidence.objects[0],bounds:{left:1000,right:1000,top:500,bottom:500}}]})
  assert.deepEqual(point.camera,{x:1000,y:500,zoom:2})
  const portrait=proposal({...evidence,viewport:{width:80,height:400}})
  assert.equal(portrait.camera.zoom,80/340)
})

test('missing, failed, moved, missing-object and stale source returns never become last-good',()=>{
  const next=proposal(),good=returned(next)
  const wrong:readonly (EIFitReadback|null)[]=[null,{...good,failure:'getBBox failed'},{...good,viewBox:'0 0 400 200'},{...good,viewBox:'not an SVG box'},{...good,sourceSnapshot:'old-source'},{...good,proposalId:'other-proposal'},{...good,viewport:{width:401,height:200}},{...good,objects:good.objects.slice(0,1)},{...good,objects:good.objects.map((object,index)=>index?object:{...object,bounds:{...object.bounds,left:object.bounds.left+1}})},{...good,objects:good.objects.map(object=>({...object,revision:99}))}]
  for(const actual of wrong) {
    const result=commitEIFitImprovement(createEIFitImprovementState(),next,applied(next),actual)
    assert.equal(result.status,'failed-return')
    assert.equal(result.state.lastGood,null)
    assert.equal(result.state.revision,0)
    assert.equal(result.state.receipts.length,1)
    assert.ok(result.receipt.reasons.length)
  }
})

test('failed readback can retry the same proposal, and an accepted duplicate cannot commit twice',()=>{
  const next=proposal(),failed=commitEIFitImprovement(createEIFitImprovementState(),next,applied(next),null)
  const accepted=commitEIFitImprovement(failed.state,next,applied(next),returned(next))
  assert.equal(accepted.status,'committed')
  assert.equal(accepted.state.receipts.length,2)
  const duplicate=commitEIFitImprovement(accepted.state,next,applied(next),returned(next))
  assert.equal(duplicate.status,'duplicate')
  assert.equal(duplicate.state,accepted.state)
  assert.equal(duplicate.state.revision,1)
  assert.equal(duplicate.receipt,accepted.receipt)
})

test('source, viewport, camera and concurrent committed-view conflicts preserve the last-good snapshot',()=>{
  const first=proposal(),accepted=commitEIFitImprovement(createEIFitImprovementState(),first,applied(first),returned(first))
  const next=proposal({...evidence,view:{x:4000,y:0,zoom:3}},accepted.state)
  const values=[{...applied(next),sourceSnapshot:'root@revision/8'},{...applied(next),viewport:{width:800,height:200}},{...applied(next),view:{x:0,y:0,zoom:10}},{...applied(next),objects:next.before.objects.map(object=>({...object,sourceId:'changed-source'}))}]
  for(const value of values) {
    const result=commitEIFitImprovement(accepted.state,next,value,returned(next))
    assert.equal(result.status,'conflict')
    assert.equal(result.state.lastGood,accepted.state.lastGood)
    assert.equal(result.state.revision,1)
  }
  const competing=proposal({...evidence,view:{x:5000,y:0,zoom:3}},accepted.state)
  const advanced=commitEIFitImprovement(accepted.state,next,applied(next),returned(next))
  const conflict=commitEIFitImprovement(advanced.state,competing,applied(competing),returned(competing))
  assert.equal(conflict.status,'conflict')
  assert.ok(conflict.receipt.reasons.includes('committed-view-changed'))
  assert.equal(conflict.state.lastGood,advanced.state.lastGood)
  const failed=commitEIFitImprovement(accepted.state,next,applied(next),null)
  assert.equal(failed.status,'failed-return')
  assert.equal(failed.state.lastGood,accepted.state.lastGood)
})

test('forged proposals, scores and targets are recomputed against actual source evidence',()=>{
  const next=proposal()
  for(const forged of [{...next,camera:{...next.camera,zoom:100}},{...next,expectedVisible:999},{...next,beforeVisible:0},{...next,expectedViewBox:'0 0 1 1'}]) {
    const result=commitEIFitImprovement(createEIFitImprovementState(),forged,applied(forged),returned(forged))
    assert.equal(result.status,'conflict')
    assert.ok(result.receipt.reasons.includes('proposal-evidence-mismatch'))
    assert.equal(result.state.lastGood,null)
  }
})

test('reordered objects and subpixel SVG serialization drift preserve geometric verification',()=>{
  const next=proposal(),actual=returned(next)
  const result=commitEIFitImprovement(createEIFitImprovementState(),next,{...applied(next),objects:[...next.before.objects].reverse()},{...actual,objects:[...actual.objects].reverse().map(object=>({...object,bounds:{...object.bounds,left:object.bounds.left+.00001}}))})
  assert.equal(result.status,'committed')
})

test('fit readback rejects non-SVG numeric syntax and empty viewBox components',()=>{
  const next=proposal(),actual=returned(next),current=applied(next)
  assert.equal(next.expectedViewBox,'-20 -35 340 170')
  for(const viewBox of ['-20 -35 0x154 170','-20 -35 0b101010100 170','-20 -35 0o524 170','-20,, -35 340 170','-20 -35 340 170,']) {
    const result=commitEIFitImprovement(createEIFitImprovementState(),next,current,{...actual,viewBox})
    assert.equal(result.status,'failed-return')
    assert.ok(result.receipt.reasons.includes('return-viewbox-mismatch'))
    assert.equal(result.state.lastGood,null)
  }
  const valid=commitEIFitImprovement(createEIFitImprovementState(),next,current,{...actual,viewBox:' -.2e2, -3.5e1, 3.4e2, 1.7e2 '})
  assert.equal(valid.status,'committed')
})

test('durable receipts replay the verifier and re-evaluate current source and viewport',()=>{
  const next=proposal(),failed=commitEIFitImprovement(createEIFitImprovementState(),next,applied(next),null)
  const committed=commitEIFitImprovement(failed.state,next,applied(next),returned(next)),raw=serializeEIFitImprovement(committed.state)
  const restored=restoreEIFitImprovement(raw,applied(next))
  assert.equal(restored.status,'restored')
  assert.deepEqual(restored.state,committed.state)
  assert.deepEqual(restored.applicableCamera,next.camera)
  assert.equal(serializeEIFitImprovement(restored.state),raw)
  for(const current of [null,{...applied(next),sourceSnapshot:'changed-source'},{...applied(next),viewport:{width:800,height:200}},{...applied(next),objects:next.before.objects.map(object=>({...object,revision:object.revision+1}))}]) {
    const stale=restoreEIFitImprovement(raw,current)
    assert.equal(stale.status,'stale')
    assert.equal(stale.applicableCamera,null)
    assert.deepEqual(stale.state.lastGood,committed.state.lastGood)
  }
})

test('corrupt durable status, receipts, counters, source and last-good camera are rejected',()=>{
  const next=proposal(),committed=commitEIFitImprovement(createEIFitImprovementState(),next,applied(next),returned(next))
  const raw=serializeEIFitImprovement(committed.state)
  const corruptions=[
    (v:any)=>{v.revision=99},
    (v:any)=>{v.lastGood.camera.zoom=99},
    (v:any)=>{v.receipts[0].status='failed-return'},
    (v:any)=>{v.receipts[0].readback=null},
    (v:any)=>{v.receipts[0].readback.objects[0].bounds.left+=20},
    (v:any)=>{v.receipts[0].proposal.before.sourceSnapshot='fake'},
    (v:any)=>{v.receipts[0].proposal.camera.zoom=100},
    (v:any)=>{v.receipts=[]},
    (v:any)=>{v.receipts.push(v.receipts[0])},
  ]
  for(const corrupt of corruptions) {
    const data=JSON.parse(raw);corrupt(data)
    const result=restoreEIFitImprovement(JSON.stringify(data),applied(next))
    assert.equal(result.status,'invalid')
    assert.equal(result.state.lastGood,null)
    assert.equal(result.applicableCamera,null)
  }
  for(const invalid of ['not-json','null','{}','[]'])assert.equal(restoreEIFitImprovement(invalid,evidence).status,'invalid')
  const empty=restoreEIFitImprovement(serializeEIFitImprovement(createEIFitImprovementState()),null)
  assert.equal(empty.status,'restored')
  assert.equal(empty.applicableCamera,null)
})
