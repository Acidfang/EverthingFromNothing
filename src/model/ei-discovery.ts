import {checkEIData,encodeEIBits,equalEIBits} from './ei-binary-machine.ts'
import {proposeEI,EI_LIMITS,type EILedger,type EIPatch,type EIProposal} from './ei-engine.ts'
import {readBoundedPublicText} from './ei-public-sync-return.ts'
import type {HomebaseDiscoveryBatch,HomebaseDiscoveryRequest,HomebaseDiscoveryScope} from './ei-discovery-types.ts'
export type EIDiscoveryReturn=Readonly<{carrier:'homebase'|'android'|'web';raw:string;value:HomebaseDiscoveryBatch}>
const issued=new WeakSet<object>()
function fail(s:string):never{throw Error(`Field discovery: ${s}`)}
const freeze=<T>(v:T):T=>{if(v&&typeof v==='object'&&!Object.isFrozen(v)){Object.values(v).forEach(freeze);Object.freeze(v)}return v}
const integer=(v:unknown)=>Number.isSafeInteger(v)&&Number(v)>=0
const text=(v:unknown,max=256):v is string=>typeof v==='string'&&v.length>0&&v.length<=max
function keys(value:object,allowed:readonly string[]){if(Object.keys(value).some(k=>!allowed.includes(k)))fail('unknown return field')}
/** Carrier-specific wire validation; admission below is the common field path. */
export function readEIDiscoveryReturn(raw:string,expected:HomebaseDiscoveryScope,carrier:EIDiscoveryReturn['carrier']='homebase'):EIDiscoveryReturn{
 if(typeof raw!=='string'||raw.length>131072)fail('return size bound');const v=JSON.parse(raw) as HomebaseDiscoveryBatch;checkEIData(v)
 keys(v,['schema','requestId','address','revision','scanId','kind','status','sequence','nextCursor','startedAt','observedAt','platform','root','observations','progress','limits','diagnostics','contentRead','credentialsRead','externalUpload','applied'])
 if(v.schema!==(carrier==='homebase'?'field.homebase.discovery.v1':'ei.provider.discovery.v1')||v.requestId!==expected.requestId||v.address!==expected.address||v.revision!==expected.revision)fail('return scope mismatch')
 if(!text(v.scanId)||!['system','folder'].includes(v.kind)||!['running','complete','limited','cancelled','unavailable','failed'].includes(v.status)||!integer(v.sequence)||!(v.nextCursor===null||integer(v.nextCursor)))fail('invalid scan state')
 if(v.status==='running'&&v.nextCursor!==v.sequence+1)fail('invalid continuation cursor')
 if(v.status!=='running'&&v.nextCursor!==null)fail('terminal scan has a next cursor')
 if(!text(v.startedAt,80)||!text(v.observedAt,80)||!Number.isFinite(Date.parse(v.startedAt))||!Number.isFinite(Date.parse(v.observedAt))||!text(v.platform,80))fail('invalid observation metadata')
 if(v.contentRead!==false||v.credentialsRead!==false||v.externalUpload!==false||v.applied!==false)fail('return exceeds metadata scope')
 if(!v.limits||v.limits.batchSize!==16||v.limits.maxEntries!==1024||v.limits.maxDepth!==6||v.limits.maxSeconds!==120)fail('unexpected scan bounds')
 if(!v.progress||!['visited','returned','skipped','queued'].every(k=>integer(v.progress[k as keyof typeof v.progress])))fail('invalid returned progress');keys(v.progress,['visited','returned','skipped','queued'])
 if(!Array.isArray(v.observations)||v.observations.length>16||!Array.isArray(v.diagnostics)||v.diagnostics.length>32)fail('batch bound')
 if(v.root!==null){if(!v.root||!text(v.root.key)||!text(v.root.label,512))fail('invalid root');keys(v.root,['key','label'])}
 const seen=new Set<string>()
 for(const o of v.observations){keys(o,['key','parentKey','kind','label','metadata','source','observedAt']);if(!text(o.key)||seen.has(o.key)||!(o.parentKey===null||text(o.parentKey))||!text(o.label,512)||!['platform','runtime','cpu','memory','display','software','folder','file','firmware','kernel','os','feature','sensor','permission'].includes(o.kind)||!['node-os','electron-runtime','electron-screen','windows-uninstall-registry','windows-cim','selected-root-filesystem','browser-api','android-os-api'].includes(o.source)||!o.metadata||Array.isArray(o.metadata)||typeof o.metadata!=='object'||!text(o.observedAt,80)||!Number.isFinite(Date.parse(o.observedAt)))fail('invalid observed entry');seen.add(o.key)}
 for(const d of v.diagnostics){keys(d,['code','count']);if(!text(d.code,128)||!integer(d.count))fail('invalid diagnostic')}
 const result=freeze({carrier,raw,value:v});issued.add(result);return result
}
export async function requestEIHomebaseDiscovery(origin:string,request:HomebaseDiscoveryRequest,signal?:AbortSignal,transport:typeof fetch=fetch){
 if(origin!=='https://homebase.local')fail('HOMEBASE provider unavailable on this origin')
 checkEIData(request);if(!text(request.requestId,128)||!/^[A-Za-z0-9._:-]+$/.test(request.requestId)||!text(request.address)||!integer(request.revision))fail('invalid source request')
 const raw=await readBoundedPublicText(await transport(`${origin}/EverthingFromNothing/__native/homebase-discovery.json`,{method:'POST',body:JSON.stringify(request),headers:{'Content-Type':'application/json'},credentials:'omit',cache:'no-store',redirect:'error',signal}),131072)
 return readEIDiscoveryReturn(raw,request)
}
const hash=async(value:unknown)=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value))))].map(n=>n.toString(16).padStart(2,'0')).join('')
const original=(record:EILedger['records'][number])=>record.was[0]??record.is
export function readEIDiscoverySteps(ledger:EILedger){return ledger.records.flatMap(record=>{const state=original(record);if(state.source.realm!=='returned-discovery-step')return [];try{const stored=JSON.parse(state.source.text),data={...stored,batch:JSON.parse(stored.raw)},receipt=ledger.receipts.find(r=>r.status==='committed'&&r.scope==='rendered-address-values'&&r.patches.some(p=>p.address===record.address&&p.source.id===state.source.id&&p.value===state.value));return receipt&&data.format==='ei-discovery-step/v1'&&receipt.producer===data.batch.address&&receipt.transactionId===state.source.id&&receipt.selection?.candidateId==='ingest-returned-neighbours'?[{address:record.address,receiptId:receipt.id,data}]:[]}catch{return []}})}
/** Stable targets and immutable child-step occurrences are different identities.
 * A repeated transport batch is idempotent; a new scan can observe equal values
 * and retain a new occurrence without manufacturing a value Difference. */
export async function proposeEIDiscoveryBatch(ledger:EILedger,userRoot:string,returned:EIDiscoveryReturn):Promise<Readonly<{proposal:EIProposal|null;focusAddress:string;stepAddress:string}>>{
 if(!issued.has(returned))fail('unvalidated provider return');const batch=returned.value,owner=ledger.records.find(r=>r.address===userRoot),origin=ledger.records.find(r=>r.address===batch.address)
 if(!owner||!origin||origin.is.revision!==batch.revision)fail('original user field/source scope changed')
 const namespace=await hash([userRoot,returned.carrier]),scan=await hash([userRoot,returned.carrier,batch.scanId]),providerAddress=`provider/${namespace}`,scanAddress=`discovery/${scan}`,stepAddress=`${scanAddress}/${batch.sequence}`
 const previous=readEIDiscoverySteps(ledger).filter(s=>s.data.userRoot===userRoot&&s.data.carrier===returned.carrier&&s.data.batch.scanId===batch.scanId).sort((a,b)=>a.data.batch.sequence-b.data.batch.sequence),existing=previous.find(s=>s.data.batch.sequence===batch.sequence)
 if(existing){if(existing.data.raw!==returned.raw)fail('replayed batch differs');return {proposal:null,focusAddress:providerAddress,stepAddress}}
 const last=previous.at(-1)
 if((last?last.data.batch.nextCursor:0)!==batch.sequence)fail('missing, stale or reordered provider batch')
 const targetAddress=async(key:string)=>`observed/${await hash([namespace,key])}`,patches:EIPatch[]=[],relations:{relation:string;address:string}[]=[],differences:{address:string;key:string;valueDifferent:boolean;hadBefore:boolean;previousRevision:number|null}[]=[]
 const known=new Map<string,string>()
 for(const record of ledger.records){if(record.is.source.realm!=='returned-device-observation')continue;try{const data=JSON.parse(record.is.source.locator??'');if(data.namespace===namespace&&data.carrier===returned.carrier&&data.userRoot===userRoot&&typeof data.key==='string')known.set(data.key,record.address)}catch{/* Not this provider. */}}
 const source={id:`discovery/${scan}/${batch.sequence}`,text:'',realm:'returned-discovery-step'}
 for(const [address,realm] of [[providerAddress,'discovery-provider'],[scanAddress,'discovery-root']]){const prior=ledger.records.find(r=>r.address===address);if(prior){let binding:Record<string,unknown>|null=null;try{binding=JSON.parse(prior.is.source.text)}catch{}if(prior.is.source.realm!==realm||binding?.carrier!==returned.carrier||binding?.userRoot!==userRoot||(address===scanAddress&&binding?.scanId!==batch.scanId))fail('provider root has a different retained source owner')}}
 if(!ledger.records.some(r=>r.address===providerAddress))patches.push({kind:'create',address:providerAddress,value:`${batch.platform} · ${returned.carrier}`,source:{id:`provider/${namespace}`,text:JSON.stringify({carrier:returned.carrier,userRoot,scope:'current-carrier-provider'}),realm:'discovery-provider'},parents:[userRoot],relations:[]})
 if(!ledger.records.some(r=>r.address===scanAddress))patches.push({kind:'create',address:scanAddress,value:batch.root?.label??`${batch.platform} · ${batch.kind}`,source:{id:`discovery/${scan}`,text:JSON.stringify({carrier:returned.carrier,scanId:batch.scanId,scope:{address:batch.address,revision:batch.revision},userRoot}),realm:'discovery-root'},parents:[providerAddress],relations:[{relation:'observed-from',address:batch.address}]})
 for(const item of batch.observations){const address=await targetAddress(item.key),prior=ledger.records.find(r=>r.address===address),parent=item.parentKey===null?providerAddress:known.get(item.parentKey);if(!parent)fail('provider child arrived before its parent')
  const value=`${item.label}\n${JSON.stringify(item.metadata)}`,observationSource={id:`${source.id}/${differences.length}`,text:JSON.stringify(item),realm:'returned-device-observation',locator:JSON.stringify({namespace,key:item.key,carrier:returned.carrier,scanId:batch.scanId,sequence:batch.sequence,stepAddress,userRoot})}
  // A later scan references the same target; its stable containment remains.
  if(prior){let binding:Record<string,unknown>|null=null;try{binding=JSON.parse(prior.is.source.locator??'')}catch{}if(prior.is.source.realm!=='returned-device-observation'||binding?.namespace!==namespace||binding?.key!==item.key||binding?.carrier!==returned.carrier||binding?.userRoot!==userRoot)fail('observed address has a different retained source owner');patches.push({address,value,source:observationSource})}else patches.push({kind:'create',address,value,source:observationSource,parents:[parent],relations:[]})
  known.set(item.key,address);relations.push({relation:'observed-target',address});differences.push({address,key:item.key,valueDifferent:!!prior&&!equalEIBits(encodeEIBits(prior.is.value),encodeEIBits(value)),hadBefore:!!prior,previousRevision:prior?.is.revision??null})
 }
 const detail={format:'ei-discovery-step/v1',carrier:returned.carrier,userRoot,parentStep:last?.address??null,raw:returned.raw,differences,logicalSnapshotRevision:ledger.revision,simultaneousPhysicalObservation:false,observationInterval:{startedAt:batch.startedAt,returnedAt:batch.observedAt},comparison:'exact-encoded-observation-value',childOccurrences:differences.map((item,index)=>({address:`${stepAddress}/item/${index}`,parentOccurrence:stepAddress,targetAddress:item.address,key:item.key,hadBefore:item.hadBefore,valueDifferent:item.valueDifferent,sourceRef:`${source.id}/${index}`,grain:'returned-observation-within-batch'})),wholeComputerComplete:false};source.text=JSON.stringify(detail)
 patches.push({kind:'create',address:stepAddress,value:`${batch.status} · ${batch.progress.returned} returned`,source,parents:[last?.address??scanAddress],relations})
 if(ledger.records.length+patches.filter(p=>p.kind==='create').length>EI_LIMITS.records)fail('field capacity reached; pending batch remains uncommitted')
 const proposal=proposeEI(ledger,{id:source.id,producer:batch.address,input:source,candidates:[{id:'ingest-returned-neighbours',label:'Ingest returned addressed observations',owner:'engine',source,conditions:[{address:batch.address,equals:origin.is.value}],patches}]})
 return freeze({proposal,focusAddress:batch.root?await targetAddress(batch.root.key):providerAddress,stepAddress})
}
