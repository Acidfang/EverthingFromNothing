import {checkEIData} from './ei-binary-machine.ts'
import {EI_CORE_WASM_BASE64,EI_CORE_WASM_SHA256} from './ei-core-binary.ts'
/** One immutable source frame and one occurrence shape at every child root.
 * Adjacency is supplied by the adapter; no semantic relation is guessed here. */
export const EI_MECHANISM_LIMITS=Object.freeze({records:64,links:128,jobs:64,parallelism:2,sourceBytes:1_048_576,returnBytes:1_048_576,steps:128,budget:32})
export type EIMechanismLink=Readonly<{address:string;relation:'adjacent'|'related';sourceId:string;revision:number}>
export type EIMechanismRecord=Readonly<{address:string;value:string;sourceId:string;revision:number;links:readonly EIMechanismLink[]}>
export type EIMechanismFrame=Readonly<{format:'ei-mechanism-frame/v1';userRoot:string;sourceAddress:string;sourceRevision:number;sourceId:string;records:readonly EIMechanismRecord[];digest:string}>
export type EIMechanismJob=Readonly<{address:string;parentAddress:string|null;depth:number}>
export type EIMechanismOccurrence=Readonly<{sequence:number;parentSequence:number;userRoot:string;rootAddress:string;address:string;targetAddress:string|null;sourceId:string;revision:number;kind:'record'|'edge';relation:'adjacent'|'related'|null;hadBefore:boolean;valueDifferent:boolean;before:string|null;after:string|null}>
export type EIMechanismReturn=Readonly<{format:'ei-mechanism-return/v1';userRoot:string;frameDigest:string;job:EIMechanismJob;kernelSha256:string;status:string;occurrences:readonly EIMechanismOccurrence[];executionAuthority:false}>
export type EIMechanismResult=Readonly<{format:'ei-mechanism-result/v1';frame:EIMechanismFrame;returns:readonly EIMechanismReturn[];failures:readonly Readonly<{job:EIMechanismJob;error:string}>[];unresolved:readonly string[];complete:boolean;transport:Readonly<{mode:'serial'|'workers';maximumInFlight:number}>;executionAuthority:false}>
export type EIMechanismRunner=(frame:EIMechanismFrame,job:EIMechanismJob)=>Promise<EIMechanismReturn>
const seal=new WeakSet<object>(),results=new WeakSet<object>(),encoder=new TextEncoder()
const freeze=<T>(v:T):T=>{if(v&&typeof v==='object'&&!Object.isFrozen(v)){Object.values(v).forEach(freeze);Object.freeze(v)}return v}
function fail(s:string):never{throw Error(`EI mechanism: ${s}`)}
const fields=(v:unknown,names:string)=>{if(!v||typeof v!=='object'||Object.keys(v).sort().join(',')!==names)fail('unknown or missing scripted field')}
const text=(v:unknown,max=4096)=>typeof v==='string'&&v.length>0&&v.length<=max
const revision=(v:unknown)=>Number.isInteger(v)&&(v as number)>=0&&(v as number)<=0xffffffff
export const eiMechanismDigest=async(raw:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(raw))),n=>n.toString(16).padStart(2,'0')).join('')
export async function createEIMechanismFrame(input:Omit<EIMechanismFrame,'format'|'digest'>):Promise<EIMechanismFrame>{
 checkEIData(input);fields(input,'records,sourceAddress,sourceId,sourceRevision,userRoot')
 if(!text(input.userRoot)||!text(input.sourceAddress)||!text(input.sourceId)||!revision(input.sourceRevision)||!Array.isArray(input.records)||!input.records.length||input.records.length>EI_MECHANISM_LIMITS.records)fail('invalid or excessive pinned frame')
 const addresses=new Set<string>();let edges=0
 for(const r of input.records){fields(r,'address,links,revision,sourceId,value');if(!text(r.address)||addresses.has(r.address)||typeof r.value!=='string'||r.value.length>32768||!text(r.sourceId)||!revision(r.revision)||!Array.isArray(r.links))fail('invalid source record');addresses.add(r.address);for(const e of r.links){fields(e,'address,relation,revision,sourceId');if(!text(e.address)||!['adjacent','related'].includes(e.relation)||!text(e.sourceId)||!revision(e.revision))fail('invalid declared link');if(++edges>EI_MECHANISM_LIMITS.links)fail('link capacity')}}
 if(!addresses.has(input.sourceAddress))fail('source root is absent')
 const data={format:'ei-mechanism-frame/v1' as const,userRoot:input.userRoot,sourceAddress:input.sourceAddress,sourceRevision:input.sourceRevision,sourceId:input.sourceId,records:input.records.map(r=>({...r,links:r.links.map((e:EIMechanismLink)=>({...e}))}))},raw=JSON.stringify(data)
 if(encoder.encode(raw).length>EI_MECHANISM_LIMITS.sourceBytes)fail('source frame byte capacity')
 const frame=freeze({...data,digest:await eiMechanismDigest(raw)});seal.add(frame);return frame
}
export async function restoreEIMechanismFrame(raw:EIMechanismFrame){checkEIData(raw);fields(raw,'digest,format,records,sourceAddress,sourceId,sourceRevision,userRoot');const {format,digest,...input}=raw;const frame=await createEIMechanismFrame(input);if(JSON.stringify(frame)!==JSON.stringify(raw))fail('frame differs from exact pinned source');return frame}
export function deriveEIMechanismJobs(frame:EIMechanismFrame){
 if(!seal.has(frame))fail('unvalidated frame')
 const records=new Map(frame.records.map(r=>[r.address,r])),seen=new Set<string>(),jobs:EIMechanismJob[]=[],unresolved:string[]=[]
 const visit=(address:string,parentAddress:string|null,depth:number)=>{if(seen.has(address))return;seen.add(address);if(!records.has(address)){unresolved.push(address);return}if(jobs.length>=EI_MECHANISM_LIMITS.jobs){unresolved.push(address);return}jobs.push(freeze({address,parentAddress,depth}));for(const edge of records.get(address)!.links)visit(edge.address,address,depth+1)}
 visit(frame.sourceAddress,null,0)
 for(const r of frame.records)if(!seen.has(r.address))unresolved.push(r.address)
 return freeze({jobs,unresolved})
}
type Core={memory:WebAssembly.Memory;ei_bridge_reset:()=>number;ei_bridge_record:(a:number,v:number,s:number,r:number)=>number;ei_bridge_link:(a:number,b:number,s:number,r:number,k:number)=>number;ei_bridge_init:(o:number,r:number)=>number;ei_bridge_step:(budget:number)=>number;ei_bridge_receipts:()=>number;ei_bridge_field:(i:number,f:number)=>number}
let modulePromise:Promise<WebAssembly.Module>|null=null
async function module(){return modulePromise??=(async()=>{const bytes=Uint8Array.from(atob(EI_CORE_WASM_BASE64),c=>c.charCodeAt(0)),digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');if(digest!==EI_CORE_WASM_SHA256)fail('compiled core bytes changed');const m=await WebAssembly.compile(bytes);if(WebAssembly.Module.imports(m).length)fail('unexpected core host imports');return m})()}
const statuses=['progress','complete','waiting','node-capacity','edge-capacity','occurrence-capacity','invalid-input','provider-error','cursor-overflow','revision-overflow']
export async function executeEIMechanismJob(frame:EIMechanismFrame,job:EIMechanismJob):Promise<EIMechanismReturn>{
 if(!seal.has(frame))fail('unvalidated frame');checkEIData(job);const declared=deriveEIMechanismJobs(frame).jobs.find(j=>j.address===job.address);if(!declared||JSON.stringify(declared)!==JSON.stringify(job))fail('job is not an addressed child of this frame')
 const e=(await WebAssembly.instantiate(await module())).exports as unknown as Core
 if(e.memory.buffer.byteLength!==65536)fail('unexpected core memory profile');e.ei_bridge_reset()
 const entries:{kind:string;value:string}[]=[],ids=new Map<string,number>(),intern=(kind:string,value:string)=>{const key=JSON.stringify([kind,value]);let n=ids.get(key);if(n===undefined){n=entries.push({kind,value});ids.set(key,n)}return n},lookup=(id:number,kind:string)=>{if(!id||id>entries.length||entries[id-1].kind!==kind)fail('unbound or wrong-kind core return');return entries[id-1].value}
 for(const r of frame.records)if(!e.ei_bridge_record(intern('address',r.address),intern('value',r.value),intern('source',r.sourceId),r.revision))fail('core input capacity')
 for(const r of frame.records)for(const link of r.links)if(!e.ei_bridge_link(intern('address',r.address),intern('address',link.address),intern('source',link.sourceId),link.revision,link.relation==='adjacent'?1:2))fail('core link capacity')
 const initialized=e.ei_bridge_init(intern('address',frame.userRoot),intern('address',job.address));if(initialized!==0)fail('core initialization rejected')
 let status=0,steps=0;while(status===0&&steps++<EI_MECHANISM_LIMITS.steps)status=e.ei_bridge_step(EI_MECHANISM_LIMITS.budget)
 const occurrences:EIMechanismOccurrence[]=[]
 for(let i=0;i<e.ei_bridge_receipts();i++){const f=(n:number)=>e.ei_bridge_field(i,n)>>>0,kind=f(7)===1?'record':'edge';occurrences.push(freeze({sequence:f(0),parentSequence:f(1),userRoot:frame.userRoot,rootAddress:lookup(f(2),'address'),address:lookup(f(5),'address'),targetAddress:kind==='edge'?lookup(f(6),'address'):null,sourceId:lookup(f(3),'source'),revision:f(4),kind,relation:kind==='edge'?(f(8)===1?'adjacent':'related'):null,hadBefore:!!f(9),valueDifferent:!!f(10),before:f(9)?lookup(f(11),'value'):null,after:kind==='record'?lookup(f(12),'value'):null}))}
 const returned=freeze({format:'ei-mechanism-return/v1' as const,userRoot:frame.userRoot,frameDigest:frame.digest,job:{...job},kernelSha256:EI_CORE_WASM_SHA256,status:status===0?'budget':statuses[status]??'invalid-status',occurrences,executionAuthority:false as const});if(encoder.encode(JSON.stringify(returned)).length>EI_MECHANISM_LIMITS.returnBytes)fail('child return byte capacity');validateEIMechanismReturn(frame,job,returned);return returned
}
/** Admission verifies source binding and every occurrence independently of
 * worker completion order. It cannot grant an external action permission. */
export function validateEIMechanismReturn(frame:EIMechanismFrame,job:EIMechanismJob,r:EIMechanismReturn){
 checkEIData(r);fields(r,'executionAuthority,format,frameDigest,job,kernelSha256,occurrences,status,userRoot');if(!seal.has(frame)||r.format!=='ei-mechanism-return/v1'||r.userRoot!==frame.userRoot||r.frameDigest!==frame.digest||r.kernelSha256!==EI_CORE_WASM_SHA256||JSON.stringify(r.job)!==JSON.stringify(job)||r.executionAuthority!==false||!Array.isArray(r.occurrences)||r.occurrences.length>255||!['budget',...statuses].includes(r.status))fail('mismatched mechanism return')
 const records=new Map(frame.records.map(record=>[record.address,record])),read=new Set<string>(),edges=new Set<string>()
 for(const [i,o] of r.occurrences.entries()){fields(o,'address,after,before,hadBefore,kind,parentSequence,relation,revision,rootAddress,sequence,sourceId,targetAddress,userRoot,valueDifferent');
  if(o.sequence!==i+1||o.parentSequence!==i||o.userRoot!==frame.userRoot||o.rootAddress!==job.address||o.hadBefore!==false||o.valueDifferent!==false||o.before!==null)fail('invalid child occurrence lineage')
  const source=records.get(o.address);if(!source)fail('return has no source')
  if(o.kind==='record'){if(o.targetAddress!==null||o.relation!==null||o.sourceId!==source.sourceId||o.revision!==source.revision||o.after!==source.value||read.has(o.address))fail('record return differs from pinned source');read.add(o.address)}
  else if(o.kind==='edge'){const edge=source.links.find(e=>e.address===o.targetAddress&&e.relation===o.relation&&e.sourceId===o.sourceId&&e.revision===o.revision);if(!edge||o.after!==null)fail('edge return differs from declared source');edges.add(JSON.stringify([o.address,o.targetAddress,o.relation]))}
  else fail('unknown occurrence kind')
 }
 if(r.status==='complete'){const seen=new Set<string>(),visit=(address:string)=>{if(seen.has(address))return;seen.add(address);const source=records.get(address);if(!source||!read.has(address))fail('incomplete source coverage');for(const edge of source.links){if(!edges.has(JSON.stringify([address,edge.address,edge.relation])))fail('missing declared link return');visit(edge.address)}};visit(job.address)}
 return r
}
export async function runEIMechanism(frame:EIMechanismFrame,options:{runner?:EIMechanismRunner;parallelism?:number;mode?:'serial'|'workers'}={}):Promise<EIMechanismResult>{
 if(!seal.has(frame))fail('unvalidated frame');const plan=deriveEIMechanismJobs(frame),maximum=options.parallelism??1;if(!Number.isInteger(maximum)||maximum<1||maximum>EI_MECHANISM_LIMITS.parallelism)fail('parallel worker bound')
 const runner=options.runner??executeEIMechanismJob,returns:EIMechanismReturn[]=new Array(plan.jobs.length),failures:{job:EIMechanismJob;error:string}[]=[];let next=0,inFlight=0,observed=0,returnedBytes=0
 await Promise.all(Array.from({length:Math.min(maximum,plan.jobs.length)},async()=>{while(next<plan.jobs.length){const index=next++,job=plan.jobs[index];inFlight++;observed=Math.max(observed,inFlight);try{const r=await runner(frame,job);validateEIMechanismReturn(frame,job,r);const size=encoder.encode(JSON.stringify(r)).length;if(returnedBytes+size>EI_MECHANISM_LIMITS.returnBytes)fail('frame return byte capacity');returnedBytes+=size;returns[index]=freeze(r)}catch(reason){failures.push({job,error:reason instanceof Error?reason.message:String(reason)})}finally{inFlight--}}}))
 const result=freeze({format:'ei-mechanism-result/v1' as const,frame,returns:returns.filter(Boolean),failures:failures.sort((a,b)=>plan.jobs.indexOf(a.job)-plan.jobs.indexOf(b.job)),unresolved:plan.unresolved,complete:failures.length===0&&plan.unresolved.length===0&&returns.every(r=>r.status==='complete'),transport:{mode:options.mode??'serial',maximumInFlight:observed},executionAuthority:false as const});results.add(result);return result
}
export function isEIMechanismResult(value:unknown):value is EIMechanismResult{return !!value&&typeof value==='object'&&results.has(value)}

export function restoreEIMechanismResult(frame:EIMechanismFrame,raw:EIMechanismResult):EIMechanismResult{
 checkEIData(raw);fields(raw,'complete,executionAuthority,failures,format,frame,returns,transport,unresolved');fields(raw.transport,'maximumInFlight,mode');if(!seal.has(frame)||raw.format!=='ei-mechanism-result/v1'||JSON.stringify(raw.frame)!==JSON.stringify(frame)||raw.executionAuthority!==false||!Array.isArray(raw.returns)||!Array.isArray(raw.failures)||!Array.isArray(raw.unresolved)||!raw.transport||!['serial','workers'].includes(raw.transport.mode)||!Number.isInteger(raw.transport.maximumInFlight)||raw.transport.maximumInFlight<1||raw.transport.maximumInFlight>2)fail('invalid carrier frame return')
 const plan=deriveEIMechanismJobs(frame),seen=new Set<string>();let bytes=0
 for(const returned of raw.returns){const job=plan.jobs.find(j=>j.address===returned.job.address);if(!job||seen.has(job.address))fail('duplicate or unrelated child return');validateEIMechanismReturn(frame,job,returned);seen.add(job.address);bytes+=encoder.encode(JSON.stringify(returned)).length}
 for(const failure of raw.failures){fields(failure,'error,job');const job=plan.jobs.find(j=>j.address===failure.job.address);if(!job||seen.has(job.address)||JSON.stringify(job)!==JSON.stringify(failure.job)||typeof failure.error!=='string'||failure.error.length>4096)fail('invalid failed child');seen.add(job.address)}
 const complete=raw.failures.length===0&&plan.unresolved.length===0&&raw.returns.every(r=>r.status==='complete')
 if(seen.size!==plan.jobs.length||bytes>EI_MECHANISM_LIMITS.returnBytes||JSON.stringify(raw.unresolved)!==JSON.stringify(plan.unresolved)||raw.complete!==complete)fail('carrier frame coverage differs')
 const result=freeze(raw);results.add(result);return result
}
