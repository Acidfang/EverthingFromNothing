import {useRef,useState,type ButtonHTMLAttributes,type MouseEvent} from 'react'
import {activateEIFieldAction,bindEIFieldAction,drawEIFieldAction,EI_ACTION_WELL,projectEIActionWellPoint,type EIActionWellMesh,type EIFieldActionBinding,type EIFieldActionForm,type EIFieldActionDrawingSlot,createEIFieldActionZero,reduceEIFieldActionZero,eiFieldActionZeroTargets,eiFieldActionOperationTarget} from './model/ei-field-action'

export type EIFieldActionProps=Omit<ButtonHTMLAttributes<HTMLButtonElement>,'children'|'onClick'|'disabled'|'aria-label'|'form'> & {
 address:string;revision:number;sourceId?:string;operation:string;label:string;form:EIFieldActionForm;
 hint?:string;disabled?:boolean;pending?:boolean;presented?:boolean;
 onClick?:(event:MouseEvent<HTMLButtonElement>)=>unknown;
 onActivate?:(binding:EIFieldActionBinding)=>unknown;
}
const wellColors:Record<string,string>={stone:'#99d4c8','stone-dark':'#507e89','stone-light':'#c4eee1',wood:'#bb7595','wood-dark':'#7b4473','wood-light':'#edb0bb',roof:'#d17dee','roof-dark':'#8157c8','roof-light':'#ecc4ff',brass:'#ffd47d','brass-dark':'#b97f4c','brass-light':'#fff0a6',bucket:'#eaba65','bucket-dark':'#b37846','bucket-light':'#fff0aa',handle:'#ffd9a5'}
function WellMesh({mesh,bucket=false}:{mesh:EIActionWellMesh;bucket?:boolean}){
 const points=mesh.vertices.map(point=>bucket?{x:38+(point.x-point.z)*.8,y:61-point.y*.9+(point.x+point.z)*.28}:projectEIActionWellPoint(point))
 const faces=[...mesh.faces].sort((a,b)=>a.vertices.reduce((sum,index)=>sum+mesh.vertices[index].x+mesh.vertices[index].z,0)/a.vertices.length-b.vertices.reduce((sum,index)=>sum+mesh.vertices[index].x+mesh.vertices[index].z,0)/b.vertices.length)
 return <g>{faces.map((face,index)=>face.material==='handle'?<polyline key={index} points={face.vertices.map(vertex=>`${points[vertex].x},${points[vertex].y}`).join(' ')} fill="none" stroke={wellColors.handle} strokeWidth="2.5"/>:<polygon key={index} points={face.vertices.map(vertex=>`${points[vertex].x},${points[vertex].y}`).join(' ')} fill={wellColors[face.material]??'#b378a2'} stroke="#263443" strokeWidth=".8" strokeLinejoin="round"/>)}</g>
}
/** Each visible well part has its own native control. Only the well runs
 * the operation; material buckets inspect exactly the supplied input/output data. */
export function EIFieldAction({address,revision,sourceId,operation,label,form,hint,disabled=false,pending=false,presented=false,onClick,onActivate,type='button',className='',...buttonProps}:EIFieldActionProps){
 const active=useRef(false),[pendingId,setPendingId]=useState<string|null>(null),[inspected,setInspected]=useState<string|null>(null)
 const identity=JSON.stringify([address,revision,sourceId??null,operation])
 const action=bindEIFieldAction({address,revision,sourceId,operation,label,form,disabled:disabled||(pendingId!==null&&pendingId!==identity)||(!onClick&&!onActivate&&type!=='submit'),pending:pending||pendingId===identity,presented})
 const [retainedZero,setZero]=useState(()=>createEIFieldActionZero(action))
 const zero=retainedZero.actionId===action.id&&retainedZero.formKey===JSON.stringify(action.form)?retainedZero:createEIFieldActionZero(action)
 const zeroDrag=useRef<{pointer:number;startX:number;startY:number;x:number;y:number;actionId:string;formKey:string}|null>(null)
 const selectZero=(targetId:string|null)=>setZero(reduceEIFieldActionZero(action,zero,{type:'select',targetId,actionId:zero.actionId,formKey:zero.formKey}).state)
 const drawing=drawEIFieldAction(action.form),{points,edges}=action.geometry
 const inputs=drawing.slots.filter(slot=>slot.role==='source'||slot.role==='before'||slot.role==='proposed'),outputs=drawing.slots.filter(slot=>!inputs.includes(slot))
 const inspectedSlot=drawing.slots.find(slot=>slot.key===inspected)
 const activate=(event:MouseEvent<HTMLButtonElement>)=>{
  if(active.current||!action.canActivate){event.preventDefault();return}
  if(!onClick&&!onActivate)return // Native submit still reaches its form.
  active.current=true
  try{
   const result=activateEIFieldAction(action,binding=>onActivate?onActivate(binding):onClick?.(event))
   if(result.activated&&result.value&&typeof (result.value as PromiseLike<unknown>).then==='function'){
    setPendingId(identity)
    Promise.resolve(result.value).finally(()=>{active.current=false;setPendingId(current=>current===identity?null:current)})
   }else active.current=false
  }catch(reason){active.current=false;throw reason}
 }
 const material=(node:EIFieldActionDrawingSlot)=><button key={node.key} type="button" className={`ei-field-action-inspect ${node.present?'is-present':'is-open'}${node.selected?' is-selected':''}`} onClick={()=>setInspected(inspected===node.key?null:node.key)} aria-label={`Inspect ${node.slot?.label??node.role} for ${label}`} aria-expanded={inspected===node.key} data-zero-target={node.slot?.id} data-slot-id={node.slot?.id} data-slot-role={node.role} data-slot-address={node.slot?.address} data-slot-revision={node.slot?.revision} data-slot-source={node.slot?.sourceId} data-slot-status={node.slot?.status} data-slot-value={node.slot?.value}>
  <svg width="76" height="88" viewBox="0 0 76 88" className="ei-field-action-material" aria-hidden="true" focusable="false">
   <ellipse cx="38" cy="70" rx="29" ry="8" fill="#0c2439" opacity=".45"/>
   <WellMesh mesh={EI_ACTION_WELL.bucketHandle} bucket/>
   <WellMesh mesh={EI_ACTION_WELL.bucket} bucket/>
   {node.present?<g transform="translate(37 39) scale(.7)">{edges.map(([from,to])=><line key={`${from}:${to}`} x1={points[from].x} y1={points[from].y} x2={points[to].x} y2={points[to].y} stroke="#dffff5" strokeWidth="2"/>)}{points.map((point,index)=><circle key={index} cx={point.x} cy={point.y} r={node.selected?3:2} fill="#edfff3"/>)}</g>:<ellipse cx="38" cy="37" rx="11" ry="4" fill="#302d47"/>}
   <text x="38" y="84" textAnchor="middle" fill="currentColor" textLength={(node.slot?.label??node.role).length>12?72:undefined} lengthAdjust="spacingAndGlyphs">{node.slot?.label??node.role}</text>
  </svg>
 </button>
 return <span className={`ei-field-action ${className}`.trim()} data-field-address={address} data-field-revision={revision} data-field-source={sourceId} data-field-operation={operation} data-action-id={action.id} data-action-state={action.status} data-action-form={form.kind} data-operation-mapping={action.authority}>
  <button type="button" className="ei-field-action-zero" aria-label={`Move ZERO for ${label}; arrow keys move, Enter selects the operation, Home resets`} aria-description="Observer handle only. Moving selects a candidate; activate the well explicitly to perform the operation." style={{transform:`translate(${zero.x}px, ${zero.y}px)`}} data-zero-state={zero.status} data-zero-candidate={zero.candidate?.id} onPointerDown={event=>{event.preventDefault();event.currentTarget.focus();event.currentTarget.setPointerCapture(event.pointerId);zeroDrag.current={pointer:event.pointerId,startX:event.clientX,startY:event.clientY,x:zero.x,y:zero.y,actionId:zero.actionId,formKey:zero.formKey}}} onPointerMove={event=>{const drag=zeroDrag.current;if(!drag||drag.pointer!==event.pointerId)return;const changed=reduceEIFieldActionZero(action,zero,{type:'move',x:drag.x+event.clientX-drag.startX,y:drag.y+event.clientY-drag.startY,actionId:drag.actionId,formKey:drag.formKey});if(changed.accepted)setZero(changed.state)}} onPointerUp={event=>{const drag=zeroDrag.current;if(!drag||drag.pointer!==event.pointerId)return;zeroDrag.current=null;const wrapper=event.currentTarget.closest('.ei-field-action');const target=event.currentTarget.ownerDocument.elementsFromPoint(event.clientX,event.clientY).map(element=>element.closest<HTMLElement>('[data-zero-target]')).find(element=>element&&wrapper?.contains(element));setZero(reduceEIFieldActionZero(action,zero,{type:'select',targetId:target?.dataset.zeroTarget??null,actionId:drag.actionId,formKey:drag.formKey}).state)}} onPointerCancel={()=>{zeroDrag.current=null;selectZero(null)}} onKeyDown={event=>{const offsets:Record<string,readonly[number,number]>={ArrowLeft:[-8,0],ArrowRight:[8,0],ArrowUp:[0,-8],ArrowDown:[0,8]};if(event.key in offsets){event.preventDefault();const [x,y]=offsets[event.key];setZero(reduceEIFieldActionZero(action,zero,{type:'move',x:zero.x+x,y:zero.y+y,actionId:zero.actionId,formKey:zero.formKey}).state)}else if(event.key==='Enter'||event.key===' '){event.preventDefault();const targets=eiFieldActionZeroTargets(action);const index=targets.findIndex(target=>target.id===zero.candidate?.id);selectZero(targets[(index+1)%targets.length].id)}else if(event.key==='Home'||event.key==='Escape'){event.preventDefault();setZero(createEIFieldActionZero(action))}}}>0</button>
  <span className="ei-field-action-zero-status" role="status">{zero.candidate?`NEXT candidate: ${zero.candidate.id}. Activate the well to run the operation.`:'Move ZERO to a declared operation or output; unbound space stays unresolved.'}</span>
  <span className="ei-field-action-inputs">{inputs.map(material)}</span>
  <button {...buttonProps} type={type} className="ei-field-action-trigger" data-zero-target={eiFieldActionOperationTarget(action)} disabled={!action.canActivate} aria-label={label} aria-busy={action.status==='pending'} aria-description={`Local operation ${operation} at ${address}, revision ${revision}. ${action.status}. Select buckets to inspect actual inputs and outputs. Model transition unresolved.`} title={buttonProps.title??`${label} · ${action.status}`} onClick={activate}>
   <svg className="ei-field-action-form" width="168" height="164" viewBox="0 0 192 180" aria-hidden="true" focusable="false" data-geometry-source={action.geometry.source} data-housing-scope={EI_ACTION_WELL.scope}>
    <ellipse cx="96" cy="147" rx="57" ry="18" fill="#092137" opacity=".45"/>
    {EI_ACTION_WELL.meshes.map((mesh,index)=><WellMesh key={index} mesh={mesh}/>)}
    <path d="M96 67v42" fill="none" stroke="#fff0b8" strokeWidth="2"/>
    <circle cx="96" cy="107" r="4" className="ei-field-action-indicator" fill="currentColor"/>
    <text x="96" y="176" textAnchor="middle" fill="currentColor" textLength={(hint??label).length>22?174:undefined} lengthAdjust="spacingAndGlyphs">{hint??label}</text>
   </svg>
   <span className="ei-field-action-hint">{label}</span>
  </button>
  <span className="ei-field-action-outputs">{outputs.map(material)}</span>
  {inspectedSlot&&<span className="ei-field-action-inspection" role="status"><strong>{inspectedSlot.slot?.label??inspectedSlot.role}</strong><span>{inspectedSlot.present?JSON.stringify(inspectedSlot.slot,null,2):`No ${inspectedSlot.role==='proposed'?'proposed state':'returned result'} supplied for this operation.`}</span><button type="button" onClick={()=>setInspected(null)} aria-label={`Close ${label} inspection`}>Close</button></span>}
 </span>
}
