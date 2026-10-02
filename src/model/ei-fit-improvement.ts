/** A bounded improvement of the addressed renderer's camera. Source geometry,
 * viewport measurements and returned SVG geometry are supplied by the adapter.
 * This does not change model records, source code, permissions or native state. */
export type EIFitCamera = Readonly<{x:number;y:number;zoom:number}>
export type EIFitViewport = Readonly<{width:number;height:number}>
export type EIFitBounds = Readonly<{left:number;top:number;right:number;bottom:number}>
export type EIFitObject = Readonly<{
  address:string; revision:number; sourceId:string; bounds:EIFitBounds;
}>
export type EIFitEvidence = Readonly<{
  sourceSnapshot:string; viewport:EIFitViewport; view:EIFitCamera;
  objects:readonly EIFitObject[];
}>
export type EIFitProposal = Readonly<{
  kind:'ADDRESSED_FIT_PROPOSAL'; proposalId:string; baseRevision:number;
  before:EIFitEvidence; camera:EIFitCamera; expectedViewBox:string;
  beforeVisible:number; expectedVisible:number;
}>
/** objects must be measured from visible rendered elements, not copied from the
 * proposal. The pure verifier cannot observe a DOM; obtaining real readback is
 * the adapter's responsibility. There is intentionally no "verified" input. */
export type EIFitReadback = Readonly<{
  proposalId:string; sourceSnapshot:string; viewport:EIFitViewport;
  viewBox:string; objects:readonly EIFitObject[]; failure?:string;
}>
export type EIFitSnapshot = Readonly<{
  proposalId:string; sourceSnapshot:string; viewport:EIFitViewport;
  camera:EIFitCamera; objects:readonly EIFitObject[]; fullyVisible:number;
}>
export type EIFitReceipt = Readonly<{
  kind:'ADDRESSED_FIT_READBACK_RECEIPT'; receiptId:string;
  status:'committed'|'failed-return'|'conflict'; reasons:readonly string[];
  proposal:EIFitProposal; currentEvidence:EIFitEvidence|null;
  readback:EIFitReadback|null; actualVisible:number|null;
}>
export type EIFitImprovementState = Readonly<{
  schema:'ei.addressed-fit.v1'; revision:number;
  lastGood:EIFitSnapshot|null; receipts:readonly EIFitReceipt[];
}>
export type EIFitProposalResult = Readonly<{
  status:'proposed'|'no-evidence'|'no-change';
  proposal:EIFitProposal|null; reasons:readonly string[];
}>
export type EIFitCommitResult = Readonly<{
  status:'committed'|'failed-return'|'conflict'|'duplicate';
  state:EIFitImprovementState; receipt:EIFitReceipt;
}>

type ViewBox = Readonly<{x:number;y:number;width:number;height:number}>
type RecordValue = Record<string,unknown>
const TOLERANCE_PIXELS = .01
const record = (value:unknown):value is RecordValue => value!==null&&typeof value==='object'&&!Array.isArray(value)
const finite = (value:unknown):value is number => typeof value==='number'&&Number.isFinite(value)
const text = (value:unknown):value is string => typeof value==='string'&&value.trim().length>0
function freeze<T>(value:T):T {
  if(value!==null&&typeof value==='object') { for(const child of Object.values(value))freeze(child);Object.freeze(value) }
  return value
}
function canonical(value:unknown):string {
  if(value===null||typeof value==='string'||typeof value==='boolean')return JSON.stringify(value)
  if(finite(value))return JSON.stringify(value)
  if(Array.isArray(value))return `[${value.map(canonical).join(',')}]`
  if(record(value))return `{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`
  throw new Error('Fit evidence must contain finite JSON values')
}
function copy<T>(value:T):T { return freeze(JSON.parse(canonical(value)) as T) }
function camera(value:unknown):value is EIFitCamera { return record(value)&&finite(value.x)&&finite(value.y)&&finite(value.zoom)&&value.zoom>0 }
function viewport(value:unknown):value is EIFitViewport { return record(value)&&finite(value.width)&&finite(value.height)&&value.width>0&&value.height>0 }
function bounds(value:unknown):value is EIFitBounds {
  return record(value)&&finite(value.left)&&finite(value.top)&&finite(value.right)&&finite(value.bottom)&&value.right>=value.left&&value.bottom>=value.top&&finite(value.right-value.left)&&finite(value.bottom-value.top)
}
function objects(value:unknown):value is readonly EIFitObject[] {
  if(!Array.isArray(value)||!value.length)return false
  const seen=new Set<string>()
  for(const item of value) {
    if(!record(item)||!text(item.address)||seen.has(item.address)||!text(item.sourceId)||!Number.isSafeInteger(item.revision)||Number(item.revision)<0||!bounds(item.bounds))return false
    seen.add(item.address)
  }
  return true
}
function viewBox(view:EIFitCamera,size:EIFitViewport):ViewBox|null {
  const width=size.width/view.zoom,height=size.height/view.zoom,x=view.x-width/2,y=view.y-height/2
  return [width,height,x,y,x+width,y+height].every(finite)&&width>0&&height>0?{x,y,width,height}:null
}
/** Same centered camera convention as EIFieldArray's SVG. */
export function viewBoxEIFitCamera(view:EIFitCamera,size:EIFitViewport):string {
  if(!camera(view)||!viewport(size))throw new Error('Invalid fit camera or viewport')
  const box=viewBox(view,size)
  if(!box)throw new Error('Unrepresentable fit viewBox')
  return `${box.x} ${box.y} ${box.width} ${box.height}`
}
const SVG_NUMBER='[-+]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:[eE][-+]?\\d+)?'
const SVG_SEPARATOR='(?:[ \\t\\r\\n]+,?[ \\t\\r\\n]*|,[ \\t\\r\\n]*)'
const SVG_VIEWBOX=new RegExp(`^[ \\t\\r\\n]*(${SVG_NUMBER})${SVG_SEPARATOR}(${SVG_NUMBER})${SVG_SEPARATOR}(${SVG_NUMBER})${SVG_SEPARATOR}(${SVG_NUMBER})[ \\t\\r\\n]*$`)
function parseViewBox(value:unknown):ViewBox|null {
  if(typeof value!=='string')return null
  const match=SVG_VIEWBOX.exec(value)
  if(!match)return null
  const parts=match.slice(1).map(Number)
  if(parts.length!==4||!parts.every(finite)||parts[2]<=0||parts[3]<=0||!finite(parts[0]+parts[2])||!finite(parts[1]+parts[3]))return null
  return {x:parts[0],y:parts[1],width:parts[2],height:parts[3]}
}
function normalizeEvidence(value:unknown):EIFitEvidence|null {
  if(!record(value)||!text(value.sourceSnapshot)||!viewport(value.viewport)||!camera(value.view)||!objects(value.objects)||!viewBox(value.view,value.viewport))return null
  return copy({sourceSnapshot:value.sourceSnapshot,viewport:{width:value.viewport.width,height:value.viewport.height},view:{x:value.view.x,y:value.view.y,zoom:value.view.zoom},objects:normalizeObjects(value.objects)})
}
function normalizeObjects(value:readonly EIFitObject[]):readonly EIFitObject[] {
  return value.map(item=>({address:item.address,revision:item.revision,sourceId:item.sourceId,bounds:{left:item.bounds.left,top:item.bounds.top,right:item.bounds.right,bottom:item.bounds.bottom}})).sort((a,b)=>a.address<b.address?-1:a.address>b.address?1:0)
}
function near(a:number,b:number,scale:number):boolean {
  return Math.abs(a-b)*scale<=TOLERANCE_PIXELS
}
function visibleCount(value:readonly EIFitObject[],box:ViewBox,zoom:number):number {
  const tolerance=TOLERANCE_PIXELS/zoom
  return value.filter(({bounds:b})=>b.left>=box.x-tolerance&&b.top>=box.y-tolerance&&b.right<=box.x+box.width+tolerance&&b.bottom<=box.y+box.height+tolerance).length
}
function sameCamera(a:EIFitCamera,b:EIFitCamera,size:EIFitViewport):boolean {
  const first=viewBox(a,size),second=viewBox(b,size)
  return !!first&&!!second&&sameBox(first,second,b.zoom)
}
function sameBox(a:ViewBox,b:ViewBox,zoom:number):boolean {
  return near(a.x,b.x,zoom)&&near(a.y,b.y,zoom)&&near(a.width,b.width,zoom)&&near(a.height,b.height,zoom)
}
function sameSource(a:EIFitEvidence,b:EIFitEvidence):boolean {
  return a.sourceSnapshot===b.sourceSnapshot&&canonical(a.viewport)===canonical(b.viewport)&&canonical(a.objects)===canonical(b.objects)
}
function fingerprint(value:unknown):string {
  let hash=2166136261
  for(const character of canonical(value))hash=Math.imul(hash^character.charCodeAt(0),16777619)
  // An ID is only a correlation label. Full evidence equality is always checked.
  return (hash>>>0).toString(16).padStart(8,'0')
}
export function createEIFitImprovementState():EIFitImprovementState {
  return freeze({schema:'ei.addressed-fit.v1',revision:0,lastGood:null,receipts:[]})
}
export function proposeEIFitImprovement(state:EIFitImprovementState,value:EIFitEvidence|null):EIFitProposalResult {
  const evidence=normalizeEvidence(value)
  const result=(status:EIFitProposalResult['status'],proposal:EIFitProposal|null,reasons:string[]):EIFitProposalResult=>freeze({status,proposal,reasons})
  if(!evidence)return result('no-evidence',null,['missing-or-invalid-source-geometry'])
  const beforeVisible=visibleCount(evidence.objects,viewBox(evidence.view,evidence.viewport)!,evidence.view.zoom)
  if(beforeVisible===evidence.objects.length)return result('no-change',null,['source-objects-already-fit'])
  let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity
  for(const {bounds:b} of evidence.objects){left=Math.min(left,b.left);top=Math.min(top,b.top);right=Math.max(right,b.right);bottom=Math.max(bottom,b.bottom)}
  const spanX=right-left,spanY=bottom-top
  if(!finite(spanX)||!finite(spanY))return result('no-evidence',null,['unrepresentable-source-extent'])
  const zoom=Math.min(spanX>0?evidence.viewport.width/spanX:Infinity,spanY>0?evidence.viewport.height/spanY:Infinity)
  const target={x:left+spanX/2,y:top+spanY/2,zoom:zoom===Infinity?evidence.view.zoom:zoom}
  const targetBox=camera(target)?viewBox(target,evidence.viewport):null
  if(!targetBox)return result('no-evidence',null,['unrepresentable-fit-camera'])
  const expectedVisible=visibleCount(evidence.objects,targetBox,target.zoom)
  if(expectedVisible!==evidence.objects.length||expectedVisible<=beforeVisible)return result('no-change',null,['no-measured-fit-improvement'])
  const proposal:EIFitProposal=copy({kind:'ADDRESSED_FIT_PROPOSAL',proposalId:`fit-${state.revision}-${fingerprint(evidence)}`,baseRevision:state.revision,before:evidence,camera:target,expectedViewBox:viewBoxEIFitCamera(target,evidence.viewport),beforeVisible,expectedVisible})
  return result('proposed',proposal,[])
}

/** Applies only a source-bound camera whose actual renderer return matches.
 * A failure records evidence but leaves lastGood and the committed revision intact. */
export function commitEIFitImprovement(state:EIFitImprovementState,proposal:EIFitProposal,currentValue:EIFitEvidence|null,returned:EIFitReadback|null):EIFitCommitResult {
  const current=normalizeEvidence(currentValue),reasons:string[]=[]
  let readback:EIFitReadback|null=null
  try { readback=returned===null?null:copy(returned) } catch { readback=null }
  const existing=state.receipts.find(receipt=>receipt.status==='committed'&&receipt.proposal.proposalId===proposal.proposalId)
  if(existing&&canonical(existing.proposal)===canonical(proposal))return freeze({status:'duplicate',state,receipt:existing})
  const rebuilt=proposeEIFitImprovement({...state,revision:proposal.baseRevision},proposal.before)
  if(!rebuilt.proposal||canonical(rebuilt.proposal)!==canonical(proposal))reasons.push('proposal-evidence-mismatch')
  if(proposal.baseRevision!==state.revision)reasons.push('committed-view-changed')
  if(!current||!sameSource(current,proposal.before))reasons.push('current-source-or-viewport-changed')
  if(current&&!sameCamera(current.view,proposal.camera,current.viewport))reasons.push('current-camera-changed')
  const conflicted=reasons.length>0
  let actualVisible:number|null=null
  if(!conflicted) {
    const actualBox=parseViewBox(readback?.viewBox),expectedBox=parseViewBox(proposal.expectedViewBox)!
    if(!readback)reasons.push('missing-renderer-return')
    else {
      if(readback.failure)reasons.push('renderer-return-failed')
      if(readback.proposalId!==proposal.proposalId)reasons.push('return-proposal-mismatch')
      if(readback.sourceSnapshot!==proposal.before.sourceSnapshot)reasons.push('return-source-mismatch')
      if(!viewport(readback.viewport)||canonical(readback.viewport)!==canonical(proposal.before.viewport))reasons.push('return-viewport-mismatch')
      if(!actualBox||!sameBox(actualBox,expectedBox,proposal.camera.zoom))reasons.push('return-viewbox-mismatch')
      if(!objects(readback.objects))reasons.push('missing-returned-visible-geometry')
      else {
        const actualObjects=normalizeObjects(readback.objects),expectedObjects=proposal.before.objects
        if(actualObjects.length!==expectedObjects.length||actualObjects.some((item,index)=>{
          const expected=expectedObjects[index]
          return !expected||item.address!==expected.address||item.sourceId!==expected.sourceId||item.revision!==expected.revision||!(['left','top','right','bottom'] as const).every(key=>near(item.bounds[key],expected.bounds[key],proposal.camera.zoom))
        }))reasons.push('return-geometry-mismatch')
        if(actualBox) {
          actualVisible=visibleCount(actualObjects,actualBox,proposal.camera.zoom)
          if(actualVisible!==proposal.expectedVisible||actualVisible<=proposal.beforeVisible)reasons.push('return-not-a-useful-fit')
        }
      }
    }
  }
  const status=conflicted?'conflict':reasons.length?'failed-return':'committed'
  const receipt:EIFitReceipt=copy({kind:'ADDRESSED_FIT_READBACK_RECEIPT',receiptId:`fit-return-${state.receipts.length+1}`,status,reasons,proposal,currentEvidence:current,readback,actualVisible})
  const lastGood:EIFitSnapshot|null=status==='committed'?copy({proposalId:proposal.proposalId,sourceSnapshot:proposal.before.sourceSnapshot,viewport:proposal.before.viewport,camera:proposal.camera,objects:proposal.before.objects,fullyVisible:actualVisible!}):state.lastGood
  const next=freeze({...state,revision:state.revision+(status==='committed'?1:0),lastGood,receipts:[...state.receipts,receipt]})
  return freeze({status,state:next,receipt})
}

/** Replaying every receipt verifies derived fit targets and returned geometry;
 * serialized status flags and last-good claims are never trusted on their own. */
function replay(value:unknown):EIFitImprovementState {
  if(!record(value)||value.schema!=='ei.addressed-fit.v1'||!Array.isArray(value.receipts)||!Number.isSafeInteger(value.revision)||Number(value.revision)<0)throw new Error('invalid-fit-state')
  let state=createEIFitImprovementState()
  for(const item of value.receipts) {
    if(!record(item)||!record(item.proposal)||!Number.isSafeInteger(item.proposal.baseRevision)||Number(item.proposal.baseRevision)<0||!normalizeEvidence(item.proposal.before))throw new Error('invalid-fit-receipt')
    const result=commitEIFitImprovement(state,item.proposal as EIFitProposal,item.currentEvidence as EIFitEvidence|null,item.readback as EIFitReadback|null)
    if(result.status==='duplicate'||canonical(result.receipt)!==canonical(item))throw new Error('invalid-fit-receipt')
    state=result.state
  }
  if(canonical(state)!==canonical(value))throw new Error('invalid-fit-state')
  return state
}
export function serializeEIFitImprovement(state:EIFitImprovementState):string {
  return canonical(replay(state))
}
export function restoreEIFitImprovement(serialized:string,currentValue:EIFitEvidence|null):Readonly<{
  status:'restored'|'stale'|'invalid'; state:EIFitImprovementState;
  applicableCamera:EIFitCamera|null; reasons:readonly string[];
}> {
  let state:EIFitImprovementState
  try { state=replay(JSON.parse(serialized)) } catch { return freeze({status:'invalid',state:createEIFitImprovementState(),applicableCamera:null,reasons:['invalid-durable-fit-evidence']}) }
  const current=normalizeEvidence(currentValue),good=state.lastGood
  if(good) {
    const old={sourceSnapshot:good.sourceSnapshot,viewport:good.viewport,view:good.camera,objects:good.objects}
    if(!current||!sameSource(current,old))return freeze({status:'stale',state,applicableCamera:null,reasons:['current-source-or-viewport-changed']})
    if(visibleCount(current.objects,viewBox(good.camera,current.viewport)!,good.camera.zoom)!==current.objects.length)return freeze({status:'stale',state,applicableCamera:null,reasons:['retained-camera-no-longer-fits']})
  }
  return freeze({status:'restored',state,applicableCamera:good?.camera??null,reasons:[]})
}
