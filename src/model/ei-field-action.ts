import {SHARED_TETRAHEDRON_VERTICES} from './three-tetrahedron-drawing.ts'

/** Local UI operation mapping. This is not a user-authored law, a model turn,
 * a completion receipt, or a claim about world position. */
export const EI_FIELD_ACTION_SCOPE='local-operation-implementation' as const
export type EIFieldActionStatus='candidate'|'unavailable'|'pending'|'presented'
export type EIFieldActionSlot=Readonly<{
 id:string; label:string; address?:string; revision?:number; sourceId?:string;
 value?:string; status?:string;
}>
export type EIFieldActionForm=
 | Readonly<{kind:'source-return';source:EIFieldActionSlot;destination:EIFieldActionSlot;returned?:EIFieldActionSlot}>
 | Readonly<{kind:'transition';before:EIFieldActionSlot;proposed?:EIFieldActionSlot;returned?:EIFieldActionSlot}>
 | Readonly<{kind:'navigation';source:EIFieldActionSlot;targets:readonly EIFieldActionSlot[];selectedTargetId?:string}>
export type EIFieldActionInput=Readonly<{
 address:string; revision:number; sourceId?:string; operation:string; label:string;
 disabled?:boolean; pending?:boolean; presented?:boolean; form:EIFieldActionForm;
}>
export type EIFieldActionBinding=Readonly<{address:string;revision:number;sourceId?:string;operation:string}>

// Same observer projection used by the retained gate views, scaled for an action.
// The retained 3D vertices themselves are never moved or rotated.
export const EI_FIELD_ACTION_GEOMETRY=Object.freeze({
 source:'src/model/three-tetrahedron-drawing.ts#SHARED_TETRAHEDRON_VERTICES',
 scope:'observer-action-projection',
 vertices:SHARED_TETRAHEDRON_VERTICES,
 points:Object.freeze(SHARED_TETRAHEDRON_VERTICES.map(point=>Object.freeze({x:14*(point.x+.4*point.z),y:-12*(point.y-.3*point.z)}))),
 edges:Object.freeze(SHARED_TETRAHEDRON_VERTICES.flatMap((_,a)=>SHARED_TETRAHEDRON_VERTICES.slice(a+1).map((_,offset)=>Object.freeze([a,a+offset+1] as const)))),
})
function copySlot(slot:EIFieldActionSlot):EIFieldActionSlot{
 if(!slot.id||!slot.label||(slot.revision!==undefined&&(!Number.isSafeInteger(slot.revision)||slot.revision<0)))throw new Error('Invalid local operation slot')
 return Object.freeze({...slot})
}
function copyForm(form:EIFieldActionForm):EIFieldActionForm{
 if(form.kind==='source-return')return Object.freeze({...form,source:copySlot(form.source),destination:copySlot(form.destination),...(form.returned?{returned:copySlot(form.returned)}:{})})
 if(form.kind==='transition')return Object.freeze({...form,before:copySlot(form.before),...(form.proposed?{proposed:copySlot(form.proposed)}:{}),...(form.returned?{returned:copySlot(form.returned)}:{})})
 const targets=form.targets.map(copySlot)
 if(new Set(targets.map(slot=>slot.id)).size!==targets.length)throw new Error('Duplicate navigation target')
 if(form.selectedTargetId!==undefined&&!targets.some(slot=>slot.id===form.selectedTargetId))throw new Error('Selected navigation target is absent')
 return Object.freeze({...form,source:copySlot(form.source),targets:Object.freeze(targets)})
}
export function bindEIFieldAction(input:EIFieldActionInput){
 if(!input.address||!Number.isSafeInteger(input.revision)||input.revision<0||!input.operation||!input.label)throw new Error('An addressed local operation is required')
 const binding:EIFieldActionBinding=Object.freeze({address:input.address,revision:input.revision,operation:input.operation,...(input.sourceId===undefined?{}:{sourceId:input.sourceId})})
 const status:EIFieldActionStatus=input.pending?'pending':input.disabled?'unavailable':input.presented?'presented':'candidate'
 return Object.freeze({
  format:'ei-field-action/v1' as const,authority:EI_FIELD_ACTION_SCOPE,binding,
  id:JSON.stringify([binding.address,binding.revision,binding.sourceId??null,binding.operation]),
  label:input.label,status,canActivate:!input.disabled&&!input.pending,
  form:copyForm(input.form),geometry:EI_FIELD_ACTION_GEOMETRY,
  modelTransition:'unresolved' as const,
 })
}
export type EIFieldAction=ReturnType<typeof bindEIFieldAction>

/** The supplied callback is the actual operation. Presentation does no work. */
export function activateEIFieldAction<T>(action:EIFieldAction,activate:(binding:EIFieldActionBinding)=>T):Readonly<{activated:false}|{activated:true;value:T}>{
 if(!action.canActivate)return Object.freeze({activated:false})
 return Object.freeze({activated:true,value:activate(action.binding)})
}

export type EIFieldActionDrawingSlot=Readonly<{key:string;role:'source'|'before'|'proposed'|'destination'|'returned'|'target';x:number;y:number;present:boolean;selected:boolean;slot?:EIFieldActionSlot}>
/** Screen layout of declared inputs/outputs, never model-space placement. */
export function drawEIFieldAction(form:EIFieldActionForm){
 const slots:EIFieldActionDrawingSlot[]=[]
 let width=144,height=84
 const add=(key:string,role:EIFieldActionDrawingSlot['role'],x:number,y:number,slot?:EIFieldActionSlot,selected=false,present=!!slot)=>slots.push(Object.freeze({key,role,x,y,present,selected,...(slot?{slot}:{})}))
 if(form.kind==='source-return'){
  add('source','source',30,36,form.source)
  add('destination',form.returned?'returned':'destination',112,36,form.returned??form.destination,false,!!form.returned)
 }else if(form.kind==='transition'){
  width=226
  add('before','before',30,36,form.before)
  add('proposed','proposed',112,36,form.proposed)
  add('returned','returned',194,36,form.returned)
 }else{
  height=Math.max(84,form.targets.length*64+20)
  add('source','source',30,height/2-8,form.source)
  form.targets.forEach((target,index)=>add(`target:${target.id}`,'target',112,32+index*64,target,target.id===form.selectedTargetId))
 }
 const links=(form.kind==='transition'?[[0,1],[1,2]]:slots.slice(1).map((_,index)=>[0,index+1])).map(([from,to])=>Object.freeze({from:slots[from].key,to:slots[to].key,x1:slots[from].x+23,y1:slots[from].y,x2:slots[to].x-23,y2:slots[to].y}))
 return Object.freeze({scope:'observer-action-projection' as const,width,height,slots:Object.freeze(slots),links:Object.freeze(links)})
}

/** Wonderland is an explicitly selected local presentation of addressed slots.
 * These vertices describe the visible well, not canonical model geometry. */
export type EIActionWellPoint=Readonly<{x:number;y:number;z:number}>
export type EIActionWellFace=Readonly<{vertices:readonly number[];material:string}>
export type EIActionWellMesh=Readonly<{vertices:readonly EIActionWellPoint[];faces:readonly EIActionWellFace[]}>
export function projectEIActionWellPoint(point:EIActionWellPoint){return Object.freeze({x:96+(point.x-point.z),y:133-point.y+(point.x+point.z)*.42})}
function wellMesh(vertices:readonly EIActionWellPoint[],faces:readonly (readonly number[])[],materials:readonly string[]):EIActionWellMesh{
 return Object.freeze({vertices:Object.freeze(vertices.map(point=>Object.freeze({...point}))),faces:Object.freeze(faces.map((vertices,index)=>Object.freeze({vertices:Object.freeze([...vertices]),material:materials[index%materials.length]})))})
}
function wellBox(x:number,y:number,z:number,width:number,height:number,depth:number,material:string){
 return wellMesh([[x,y,z],[x+width,y,z],[x+width,y+height,z],[x,y+height,z],[x,y,z+depth],[x+width,y,z+depth],[x+width,y+height,z+depth],[x,y+height,z+depth]].map(([x,y,z])=>({x,y,z})),[[0,1,2,3],[1,5,6,2],[3,2,6,7]],[material,material+'-dark',material+'-light'])
}
function wellRing(outer:number,inner:number,bottom:number,top:number,segments:number,material:string):EIActionWellMesh{
 const vertices:EIActionWellPoint[]=[],faces:number[][]=[],materials:string[]=[]
 for(const radius of [outer,inner])for(const y of [bottom,top])for(let index=0;index<segments;index++){const angle=index/segments*Math.PI*2;vertices.push({x:Math.cos(angle)*radius,y,z:Math.sin(angle)*radius})}
 for(let index=0;index<segments;index++){
  const next=(index+1)%segments
  faces.push([index,next,segments+next,segments+index],[segments+index,segments+next,3*segments+next,3*segments+index],[2*segments+index,3*segments+index,3*segments+next,2*segments+next])
  materials.push(index%2?material:material+'-dark',material+'-light',material+'-dark')
 }
 return wellMesh(vertices,faces,materials)
}
const wellRoof=wellMesh([
 {x:-43,y:88,z:-30},{x:0,y:112,z:-30},{x:43,y:88,z:-30},
 {x:-43,y:88,z:30},{x:0,y:112,z:30},{x:43,y:88,z:30},
],[[0,1,4,3],[1,2,5,4],[0,2,1],[3,4,5]],['roof','roof-dark','roof-light','roof'])
export const EI_ACTION_WELL=Object.freeze({
 authority:EI_FIELD_ACTION_SCOPE,scope:'wonderland-observer-well',projection:projectEIActionWellPoint,
 meshes:Object.freeze([
  wellRing(37,24,0,10,12,'stone'),wellRing(34,24,10,23,12,'stone'),
  wellBox(-33,16,-3,6,73,6,'wood'),wellBox(27,16,-3,6,73,6,'wood'),
  wellBox(-34,62,-4,68,7,8,'wood'),wellBox(33,55,-2,5,18,4,'brass'),
  wellBox(37,53,-1,10,5,5,'brass'),wellRoof,
 ]),
 bucket:wellRing(18,14,0,25,10,'bucket'),
 bucketHandle:wellMesh([{x:-17,y:24,z:0},{x:-14,y:43,z:0},{x:0,y:49,z:0},{x:14,y:43,z:0},{x:17,y:24,z:0}],[[0,1,2,3,4]],['handle']),
})

export type EIFieldActionZero=Readonly<{
 actionId:string;formKey:string;x:number;y:number;
 candidate:Readonly<{kind:'operation'|'slot';id:string}>|null;
 status:'unresolved'|'candidate';
}>
export type EIFieldActionZeroEvent=Readonly<{
 actionId:string;formKey:string;
}> & (Readonly<{type:'move';x:number;y:number}>|Readonly<{type:'select';targetId:string|null}>)
export const eiFieldActionOperationTarget=(action:EIFieldAction)=>`operation:${action.binding.operation}`
export function eiFieldActionZeroTargets(action:EIFieldAction){
 const targets=drawEIFieldAction(action.form).slots.filter(slot=>slot.role!=='source'&&slot.role!=='before'&&slot.slot).map(slot=>Object.freeze({kind:'slot' as const,id:slot.slot!.id}))
 return Object.freeze([Object.freeze({kind:'operation' as const,id:eiFieldActionOperationTarget(action)}),...targets])
}
export function createEIFieldActionZero(action:EIFieldAction):EIFieldActionZero{return Object.freeze({actionId:action.id,formKey:JSON.stringify(action.form),x:0,y:0,candidate:null,status:'unresolved'})}
/** Moving this observer handle only selects a declared local candidate. It never
 * calls the operation, grants a permission, writes a model pose or mints an address. */
export function reduceEIFieldActionZero(action:EIFieldAction,current:EIFieldActionZero,event:EIFieldActionZeroEvent){
 const formKey=JSON.stringify(action.form)
 if(current.actionId!==action.id||current.formKey!==formKey||event.actionId!==action.id||event.formKey!==formKey)return Object.freeze({accepted:false as const,reason:'stale-scope' as const,state:current})
 if(event.type==='move'){
  if(!Number.isFinite(event.x)||!Number.isFinite(event.y))return Object.freeze({accepted:false as const,reason:'invalid-view-position' as const,state:current})
  return Object.freeze({accepted:true as const,state:Object.freeze({...current,x:event.x,y:event.y,candidate:null,status:'unresolved' as const})})
 }
 const candidate=event.targetId===null?undefined:eiFieldActionZeroTargets(action).find(target=>target.id===event.targetId)
 return Object.freeze({accepted:!!candidate,reason:candidate?undefined:'unbound-target' as const,state:Object.freeze({...current,candidate:candidate??null,status:candidate?'candidate' as const:'unresolved' as const})})
}
