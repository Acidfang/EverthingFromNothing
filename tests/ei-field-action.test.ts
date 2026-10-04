import test from 'node:test'
import assert from 'node:assert/strict'
import {bindEIFieldAction,activateEIFieldAction,drawEIFieldAction,EI_FIELD_ACTION_GEOMETRY,EI_ACTION_WELL,projectEIActionWellPoint,createEIFieldActionZero,reduceEIFieldActionZero,eiFieldActionOperationTarget,type EIFieldActionInput,type EIFieldActionForm} from '../src/model/ei-field-action.ts'
import {SHARED_TETRAHEDRON_VERTICES} from '../src/model/three-tetrahedron-drawing.ts'

const form:EIFieldActionForm={kind:'source-return',source:{id:'source:retained',label:'Source',address:'field/source',revision:4,sourceId:'capture:4',value:'exact source'},destination:{id:'phone:metadata',label:'Metadata'}}
const input:EIFieldActionInput={address:'field/source',revision:4,sourceId:'capture:4',operation:'phone.capabilities.read',label:'Read capabilities',form}

test('each operation keeps its immutable exact address, revision, source and explicit local mapping',()=>{
 const action=bindEIFieldAction(input)
 assert.deepEqual(action.binding,{address:'field/source',revision:4,sourceId:'capture:4',operation:'phone.capabilities.read'})
 assert.equal(action.authority,'local-operation-implementation')
 assert.equal(action.modelTransition,'unresolved')
 assert.equal(action.status,'candidate')
 assert.equal(Object.isFrozen(action.binding),true)
 assert.equal(Object.isFrozen(action.form),true)
 assert.equal(action.form.kind==='source-return'&&action.form.source.value,'exact source')
 let captured:unknown
 assert.equal(activateEIFieldAction(action,binding=>{captured=binding;return 'actual callback result'}).activated,true)
 assert.equal(captured,action.binding)
})

test('same source can have distinct actions, and same operation cannot collapse source or revision identities',()=>{
 const base=bindEIFieldAction(input)
 const changed=[{operation:'phone.overlay.interact'},{address:'field/another'},{revision:5},{sourceId:'capture:other'}].map(change=>bindEIFieldAction({...input,...change}))
 assert.equal(new Set([base,...changed].map(action=>action.id)).size,5)
 const calls:string[]=[]
 activateEIFieldAction(base,binding=>calls.push(binding.operation))
 activateEIFieldAction(changed[0],binding=>calls.push(binding.operation))
 assert.deepEqual(calls,['phone.capabilities.read','phone.overlay.interact'])
})

test('disabled and pending actions cannot activate; presentation is not a completion receipt',()=>{
 let calls=0
 for(const availability of [{disabled:true},{pending:true},{disabled:true,pending:true}]){
  const action=bindEIFieldAction({...input,...availability})
  assert.equal(action.canActivate,false)
  assert.deepEqual(activateEIFieldAction(action,()=>calls++),{activated:false})
 }
 assert.equal(calls,0)
 assert.equal(bindEIFieldAction({...input,disabled:true}).status,'unavailable')
 assert.equal(bindEIFieldAction({...input,pending:true}).status,'pending')
 const presented=bindEIFieldAction({...input,presented:true})
 assert.equal(presented.status,'presented')
 assert.equal(presented.canActivate,true)
 assert.equal('receipt' in presented,false)
})

test('retained material is the shared 3D tetrahedron with every one of its six derived edges',()=>{
 assert.equal(EI_FIELD_ACTION_GEOMETRY.vertices,SHARED_TETRAHEDRON_VERTICES)
 assert.deepEqual(EI_FIELD_ACTION_GEOMETRY.edges,[[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]])
 assert.equal(new Set(EI_FIELD_ACTION_GEOMETRY.edges.map(edge=>edge.join(':'))).size,6)
 SHARED_TETRAHEDRON_VERTICES.forEach((point,index)=>assert.deepEqual(EI_FIELD_ACTION_GEOMETRY.points[index],{x:14*(point.x+.4*point.z),y:-12*(point.y-.3*point.z)}))
})

test('output bucket stays empty until actual returned data is supplied and preserves queued rather than applied',()=>{
 const empty=drawEIFieldAction(form)
 assert.deepEqual(empty.slots.map(slot=>[slot.role,slot.present]),[['source',true],['destination',false]])
 assert.equal(empty.slots[1].slot?.id,'phone:metadata')
 const returned={id:'request:42',label:'Queued',address:'field/source',revision:4,status:'queued',value:'{"mode":"off","permissionGranted":false}'}
 const actual=bindEIFieldAction({...input,form:{...form,returned}})
 const drawn=drawEIFieldAction(actual.form)
 assert.equal(drawn.slots[1].present,true)
 assert.equal(drawn.slots[1].slot?.status,'queued')
 assert.equal(drawn.slots[1].slot?.value,returned.value)
 assert.equal(actual.status,'candidate')
 assert.equal(actual.modelTransition,'unresolved')
})

test('transition and navigation forms derive their actual input/output topology rather than operation words',()=>{
 const before={id:'before',label:'Before',value:'WAS'},proposed={id:'proposed',label:'Proposed',value:'NEXT'}
 const transition=drawEIFieldAction({kind:'transition',before,proposed})
 assert.deepEqual(transition.slots.map(slot=>[slot.role,slot.present]),[['before',true],['proposed',true],['returned',false]])
 assert.equal(transition.links.length,2)
 const targets=[{id:'field/a',label:'A',address:'field/a',revision:1},{id:'field/b',label:'B',address:'field/b',revision:3}]
 const navigation=drawEIFieldAction({kind:'navigation',source:before,targets,selectedTargetId:'field/b'})
 assert.deepEqual(navigation.slots.slice(1).map(slot=>slot.slot),targets)
 assert.equal(navigation.slots[2].selected,true)
 assert.equal(navigation.slots[1].selected,false)
 assert.equal(navigation.links.length,2)
 assert.throws(()=>bindEIFieldAction({...input,form:{kind:'navigation',source:before,targets,selectedTargetId:'minted/address'}}),/absent/)
})

test('whimsical well is local 3D presentation and does not replace retained material',()=>{
 assert.equal(EI_ACTION_WELL.authority,'local-operation-implementation')
 assert.equal(EI_ACTION_WELL.scope,'wonderland-observer-well')
 assert.equal(EI_ACTION_WELL.meshes.length,8)
 for(const mesh of [...EI_ACTION_WELL.meshes,EI_ACTION_WELL.bucket,EI_ACTION_WELL.bucketHandle]){
  assert.ok(mesh.vertices.length>=5)
  assert.ok(mesh.faces.length>=1)
  for(const face of mesh.faces)for(const vertex of face.vertices)assert.ok(mesh.vertices[vertex])
  for(const point of mesh.vertices){const projected=projectEIActionWellPoint(point);assert.ok(Number.isFinite(projected.x)&&Number.isFinite(projected.y))}
 }
 assert.equal(EI_FIELD_ACTION_GEOMETRY.vertices,SHARED_TETRAHEDRON_VERTICES)
})

test('ZERO movement selects only supplied candidates and never invokes the operation',()=>{
 const action=bindEIFieldAction(input),zero=createEIFieldActionZero(action),before=JSON.stringify(action)
 const moved=reduceEIFieldActionZero(action,zero,{...zero,type:'move',x:40,y:12})
 assert.equal(moved.accepted,true)
 assert.equal(moved.state.status,'unresolved')
 const selected=reduceEIFieldActionZero(action,moved.state,{...zero,type:'select',targetId:eiFieldActionOperationTarget(action)})
 assert.equal(selected.accepted,true)
 assert.deepEqual(selected.state.candidate,{kind:'operation',id:'operation:phone.capabilities.read'})
 const slot=reduceEIFieldActionZero(action,selected.state,{...zero,type:'select',targetId:'phone:metadata'})
 assert.deepEqual(slot.state.candidate,{kind:'slot',id:'phone:metadata'})
 assert.equal(JSON.stringify(action),before)
 assert.equal('activate' in slot.state,false)
})

test('blank or undeclared ZERO targets stay unresolved and cannot mint an address',()=>{
 const action=bindEIFieldAction(input),zero=createEIFieldActionZero(action)
 for(const targetId of [null,'field/new','operation:phone.overlay.interact']){
  const result=reduceEIFieldActionZero(action,zero,{...zero,type:'select',targetId})
  assert.equal(result.accepted,false)
  assert.equal(result.state.status,'unresolved')
  assert.equal(result.state.candidate,null)
 }
 assert.equal(reduceEIFieldActionZero(action,zero,{...zero,type:'move',x:Infinity,y:0}).accepted,false)
})

test('ZERO rejects stale canonical scope and stale actual source/return content',()=>{
 const action=bindEIFieldAction(input),zero=createEIFieldActionZero(action)
 const changed=[bindEIFieldAction({...input,revision:5}),bindEIFieldAction({...input,sourceId:'capture:5'}),bindEIFieldAction({...input,form:{...form,returned:{id:'new-return',label:'Returned',value:'new actual response'}}})]
 for(const current of changed){
  const result=reduceEIFieldActionZero(current,zero,{...zero,type:'select',targetId:eiFieldActionOperationTarget(current)})
  assert.equal(result.accepted,false)
  assert.equal(result.reason,'stale-scope')
  assert.equal(result.state,zero)
 }
 assert.throws(()=>bindEIFieldAction({...input,address:''}),/addressed/)
 assert.throws(()=>bindEIFieldAction({...input,revision:-1}),/addressed/)
})
