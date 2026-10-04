/** Public repository snapshots are inert data. They never grant execution authority. */
import {createEILedger,exportEILedger,proposeEI,EI_LIMITS,type EILedger,type EISeedRecord,type EIProposal,type EIPatch} from './ei-engine.ts'

export const EI_PUBLIC_SYNC = Object.freeze({
  origin:'https://acidfang.github.io', base:'/EverthingFromNothing/shared-field/v1/',
  repository:'Acidfang/EverthingFromNothing', compatibility:'public-field-records-v1',
  manifestSchema:'ei.public-field-manifest.v1', snapshotSchema:'ei.public-field-snapshot.v1',
  manifestBytes:16_384, payloadBytes:1_048_576, records:EI_LIMITS.records,
})
export type EIPublicManifest=Readonly<{schema:'ei.public-field-manifest.v1';release:string;payloadSha256:string;payloadBytes:number;recordCount:number;sourceRepository:'Acidfang/EverthingFromNothing';compatibility:'public-field-records-v1'}>
export type EIPublicSnapshot=Readonly<{manifest:EIPublicManifest;records:readonly EISeedRecord[]}>
export type EIPublicSyncRow=Readonly<{address:string;status:'unchanged'|'update'|'add'|'conflict'|'removed';reason:string}>
const verified=new WeakSet<object>()
const encoder=new TextEncoder()
function fail(message:string):never{throw new Error(`Public sync: ${message}`)}
function freeze<T>(value:T):T{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value)}return value}
function object(value:unknown,keys:readonly string[],name:string):Record<string,unknown>{
  if(!value||typeof value!=='object'||Array.isArray(value)||(Object.getPrototypeOf(value)!==Object.prototype&&Object.getPrototypeOf(value)!==null))fail(`${name} must be a plain object`)
  const result=value as Record<string,unknown>
  if(Object.keys(result).length!==keys.length||keys.some(key=>!Object.hasOwn(result,key))||Object.keys(result).some(key=>!keys.includes(key)))fail(`${name} has unexpected or missing fields`)
  return result
}
function json(text:string,max:number,name:string):unknown{if(typeof text!=='string'||encoder.encode(text).length>max)fail(`${name} exceeds byte limit`);try{return JSON.parse(text)}catch{fail(`invalid ${name} JSON`)}}
function count(value:unknown,max:number,name:string):number{if(!Number.isSafeInteger(value)||Number(value)<1||Number(value)>max)fail(`invalid ${name}`);return value as number}
export function readEIPublicManifest(raw:string):EIPublicManifest{
  const m=object(json(raw,EI_PUBLIC_SYNC.manifestBytes,'manifest'),['schema','release','payloadSha256','payloadBytes','recordCount','sourceRepository','compatibility'],'manifest')
  if(m.schema!==EI_PUBLIC_SYNC.manifestSchema||m.sourceRepository!==EI_PUBLIC_SYNC.repository||m.compatibility!==EI_PUBLIC_SYNC.compatibility)fail('incompatible manifest provenance/schema')
  if(typeof m.release!=='string'||!/^([\x21-\x7e]){1,80}$/.test(m.release))fail('release must be 1–80 visible ASCII characters')
  if(typeof m.payloadSha256!=='string'||!/^[a-f0-9]{64}$/.test(m.payloadSha256))fail('invalid payload SHA256')
  count(m.payloadBytes,EI_PUBLIC_SYNC.payloadBytes,'payload bytes');count(m.recordCount,EI_PUBLIC_SYNC.records,'record count')
  return freeze(m) as EIPublicManifest
}
/** URLs are derived from a validated digest, never supplied by repository data. */
export function eiPublicSnapshotURL(manifest:EIPublicManifest):string{
  const m=readEIPublicManifest(JSON.stringify(manifest));return `${EI_PUBLIC_SYNC.origin}${EI_PUBLIC_SYNC.base}snapshots/${m.payloadSha256}.json`
}
function publicRecords(records:unknown):readonly EISeedRecord[]{
  if(!Array.isArray(records))fail('records must be an array')
  count(records.length,EI_PUBLIC_SYNC.records,'record count')
  const ledger=createEILedger({records:records as EISeedRecord[]}),addresses=new Set(ledger.records.map(r=>r.address))
  if(!addresses.has('model/inventory-root'))fail('public inventory root missing')
  for(const record of ledger.records){
    if(!/^model\/[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(record.address)||record.address.split('/').some(part=>part==='.'||part==='..'))fail('non-public address')
    const source=record.is.source
    if(source.realm!=='public-repository-inventory'||!/^public-inventory:[a-f0-9]{40}#\/binary_relation_order\/nodes\/\d+$/.test(source.id)||!source.locator)fail('non-public source provenance')
    let locator:Record<string,unknown>,retained:Record<string,unknown>
    try{locator=JSON.parse(source.locator);retained=JSON.parse(source.text)}catch{fail('invalid retained public provenance')}
    if(!locator||typeof locator!=='object'||Array.isArray(locator)||!retained||typeof retained!=='object'||Array.isArray(retained))fail('invalid retained public provenance')
    if(locator.path!=='docs/FRACTURE-FIELD-INVENTORY.json'||locator.address_scope!=='selected-inventory-presentation'||typeof locator.source_revision!=='string'||typeof locator.pointer!=='string'||source.id!==`public-inventory:${locator.source_revision}#${locator.pointer}`||retained.source_revision!==locator.source_revision)fail('public source binding mismatch')
    const node=retained.node as Record<string,unknown>|undefined
    if(!node||typeof node!=='object'||Array.isArray(node)||`model/${node.id}`!==record.address)fail('public node address mismatch')
    if(record.relations.some(relation=>!addresses.has(relation.address)))fail('unbound public relation')
  }
  return freeze(ledger.records.map(record=>({address:record.address,value:record.is.value,source:record.is.source,parents:record.parents,relations:record.relations})))
}
/** Verify exact UTF-8 bytes before parsing. A hash proves content equality, not truth. */
export async function verifyEIPublicSnapshot(manifest:EIPublicManifest,raw:string|Uint8Array):Promise<EIPublicSnapshot>{
  const m=readEIPublicManifest(JSON.stringify(manifest)),bytes=typeof raw==='string'?encoder.encode(raw):new Uint8Array(raw)
  if(bytes.byteLength!==m.payloadBytes||bytes.byteLength>EI_PUBLIC_SYNC.payloadBytes)fail('payload byte count mismatch')
  const hash=await crypto.subtle.digest('SHA-256',bytes),digest=Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('')
  if(digest!==m.payloadSha256)fail('payload hash mismatch')
  let text:string;try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes)}catch{fail('payload is not valid UTF-8')}
  if(typeof raw==='string'&&text!==raw)fail('payload text is not exact UTF-8')
  const payload=object(json(text,EI_PUBLIC_SYNC.payloadBytes,'payload'),['schema','records'],'payload')
  if(payload.schema!==EI_PUBLIC_SYNC.snapshotSchema)fail('incompatible snapshot schema')
  const records=publicRecords(payload.records);if(records.length!==m.recordCount)fail('record count mismatch')
  const snapshot=freeze({manifest:m,records});verified.add(snapshot);return snapshot
}
function requireSnapshot(snapshot:EIPublicSnapshot){if(!verified.has(snapshot))fail('snapshot has not passed byte/provenance validation')}
function same(a:unknown,b:unknown):boolean{return JSON.stringify(a)===JSON.stringify(b)}
function state(record:EISeedRecord){return {value:record.value,source:record.source,parents:record.parents??[],relations:record.relations??[]}}
/** Baseline must be the last reviewed public import, initially the bundled public records. */
export function compareEIPublicSnapshot(ledger:EILedger,baselineRecords:readonly EISeedRecord[],snapshot:EIPublicSnapshot):readonly EIPublicSyncRow[]{
  requireSnapshot(snapshot);exportEILedger(ledger)
  const baseline=new Map(publicRecords(baselineRecords).map(r=>[r.address,r])),current=new Map(ledger.records.map(r=>[r.address,r])),incoming=new Map(snapshot.records.map(r=>[r.address,r]))
  const rows:EIPublicSyncRow[]=[]
  for(const next of snapshot.records){
    const live=current.get(next.address),before=baseline.get(next.address),liveState=live?{value:live.is.value,source:live.is.source,parents:live.parents,relations:live.relations}:null
    let status:EIPublicSyncRow['status'],reason:string
    if(live&&same(liveState,state(next))){status='unchanged';reason='Current state already equals the verified public record'}
    else if(!live){if(!next.parents?.length){status='conflict';reason='A new root/group without causal parents needs an explicit migration'}else{status='add';reason='New public record; explicit selection and dependency checks required'}}
    else if(!before){status='conflict';reason='Existing address has no reviewed public baseline'}
    else if(!same(liveState,state(before))){status='conflict';reason='Current record differs from the reviewed public baseline; preserve local state and history'}
    else if(!same(before.parents??[],next.parents??[])||!same(before.relations??[],next.relations??[])){status='conflict';reason='Parent/relation changes require an explicit structural migration'}
    else{status='update';reason='Unmodified public state can advance after explicit selection'}
    rows.push({address:next.address,status,reason})
  }
  for(const before of baseline.values())if(!incoming.has(before.address))rows.push({address:before.address,status:'removed',reason:'Missing from snapshot; local record is retained, never implicitly deleted'})
  return freeze(rows)
}
/** No caller can execute this user-owned candidate without existing explicit selection. */
export function proposeEIPublicSync({ledger,baselineRecords,snapshot,addresses,producer,id}:{ledger:EILedger;baselineRecords:readonly EISeedRecord[];snapshot:EIPublicSnapshot;addresses:readonly string[];producer:string;id:string}):EIProposal{
  const rows=compareEIPublicSnapshot(ledger,baselineRecords,snapshot),allowed=new Map(rows.filter(r=>r.status==='update'||r.status==='add').map(r=>[r.address,r])),selected=new Set(addresses)
  if(!addresses.length||selected.size!==addresses.length)fail('select one or more distinct safe public addresses')
  const current=new Map(ledger.records.map(r=>[r.address,r])),incoming=new Map(snapshot.records.map(r=>[r.address,r]))
  const patches:EIPatch[]=addresses.map(address=>{
    if(!allowed.has(address))fail(`address is not safe to apply: ${address}`)
    const next=incoming.get(address)!,live=current.get(address)
    if(!live){for(const target of [...(next.parents??[]),...(next.relations??[]).map(r=>r.address)])if(!current.has(target)&&!selected.has(target))fail(`select the missing public dependency ${target}`)}
    return {address,value:next.value,source:next.source,kind:live?'update':'create',...(!live?{parents:next.parents,relations:next.relations}:{})}
  })
  const source={id:`public-sync:${snapshot.manifest.payloadSha256}`,text:JSON.stringify(snapshot.manifest),realm:'verified-public-repository-snapshot',locator:eiPublicSnapshotURL(snapshot.manifest)}
  return proposeEI(ledger,{id,producer,input:source,candidates:[{id:'apply-reviewed-public-state',label:`Apply ${addresses.length} reviewed public record(s) from ${snapshot.manifest.release}`,owner:'user',source,conditions:addresses.flatMap(address=>current.has(address)?[{address,equals:current.get(address)!.is.value}]:[]),patches}]})
}
/** Advance only baseline records actually committed by this reviewed snapshot receipt. */
export function advanceEIPublicSyncBaseline({ledger,baselineRecords,snapshot,receiptId}:{ledger:EILedger;baselineRecords:readonly EISeedRecord[];snapshot:EIPublicSnapshot;receiptId:string}):readonly EISeedRecord[]{
  requireSnapshot(snapshot);exportEILedger(ledger)
  const baseline=publicRecords(baselineRecords),receipt=ledger.receipts.find(item=>item.id===receiptId)
  if(!receipt||receipt.status!=='committed'||receipt.scope!=='rendered-address-values'||receipt.selection?.mode!=='explicit-user'||receipt.selection.candidateId!=='apply-reviewed-public-state'||receipt.source.id!==`public-sync:${snapshot.manifest.payloadSha256}`||receipt.source.realm!=='verified-public-repository-snapshot'||receipt.source.text!==JSON.stringify(snapshot.manifest)||receipt.source.locator!==eiPublicSnapshotURL(snapshot.manifest))fail('no matching committed public-sync receipt')
  const incoming=new Map(snapshot.records.map(record=>[record.address,record])),next=new Map(baseline.map(record=>[record.address,record]))
  for(const patch of receipt.patches){
    const record=incoming.get(patch.address)
    if(!record||patch.value!==record.value||!same(patch.source,record.source)||!receipt.checks.some(check=>check.address===patch.address&&check.matches&&check.expected===patch.value&&check.actual===patch.value))fail('receipt differs from verified public snapshot')
    if(patch.kind==='create'&&(!same(patch.parents??[],record.parents??[])||!same(patch.relations??[],record.relations??[])))fail('receipt graph differs from public snapshot')
    next.set(record.address,record)
  }
  return publicRecords([...next.values()])
}
