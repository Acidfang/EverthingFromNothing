import type {PublicSyncEnvelope} from './ei-public-sync-types.ts'
export const EI_NATIVE_SYNC_ORIGINS=Object.freeze(['https://appassets.androidplatform.net','https://homebase.local'])
export type EISyncScope=Readonly<{address:string;revision:number}>
function exactKeys(value:unknown,keys:string[]){if(!value||typeof value!=='object'||Array.isArray(value))return false;return Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key))}
export function validateEIPublicSyncReturn(value:unknown,requestId:string,scope:EISyncScope,targetRequestId=requestId):PublicSyncEnvelope{
 const fail=()=>{throw new Error('Invalid scoped public sync return')}
 if(!value||typeof value!=='object'||Array.isArray(value))return fail();const v=value as PublicSyncEnvelope
 if(!exactKeys(v,['schema','requestId','state','code','foreground','activeRequestId','action','lastGood','applied'])||v.schema!=='field.android.public-sync.v1'||v.requestId!==requestId||v.applied!==false||typeof v.foreground!=='boolean'||typeof v.code!=='string'||!['pending','returned','unavailable','failed'].includes(v.state))return fail()
 if(v.activeRequestId!==null&&(typeof v.activeRequestId!=='string'||!/^[A-Za-z0-9._:-]{1,128}$/.test(v.activeRequestId)))return fail()
 if(v.lastGood!==null){const g=v.lastGood;if(!exactKeys(g,['requestId','address','revision','payloadSha256','release'])||typeof g.requestId!=='string'||!/^[A-Za-z0-9._:-]{1,128}$/.test(g.requestId)||typeof g.address!=='string'||!g.address||g.address.length>256||/[\x00-\x1f\x7f]/.test(g.address)||!Number.isSafeInteger(g.revision)||g.revision<0||typeof g.payloadSha256!=='string'||!/^[a-f0-9]{64}$/.test(g.payloadSha256)||typeof g.release!=='string'||! /^[\x21-\x7e]{1,80}$/.test(g.release))return fail()}
 if(v.action!==null){const a=v.action;if(!exactKeys(a,['requestId','op','address','revision','state','stage','code','candidate'])||typeof a.code!=='string'||!['queued','fetching-manifest','fetching-payload','complete'].includes(a.stage)||a.requestId!==targetRequestId||a.address!==scope.address||a.revision!==scope.revision||a.op!=='check'||!['pending','returned','unavailable','failed'].includes(a.state))return fail();if(a.candidate!==null){const c=a.candidate;if(!exactKeys(c,['manifestText','payloadText','manifestSha256','payloadSha256','payloadBytes','recordCount','release','sourceRepository','compatibility','verifiedTransport','applied'])||typeof c.release!=='string'||!Number.isSafeInteger(c.payloadBytes)||c.payloadBytes<1||c.payloadBytes>1048576||!Number.isSafeInteger(c.recordCount)||c.recordCount<1||c.recordCount>256||c.applied!==false||c.sourceRepository!=='Acidfang/EverthingFromNothing'||c.compatibility!=='public-field-records-v1'||c.verifiedTransport!=='https-fixed-origin'||typeof c.manifestText!=='string'||typeof c.payloadText!=='string'||c.manifestText.length>16384||new TextEncoder().encode(c.payloadText).length>1048576||!/^[a-f0-9]{64}$/.test(c.payloadSha256)||!/^[a-f0-9]{64}$/.test(c.manifestSha256))return fail()}}
 return v
}
export async function readEIPublicSyncReturn(scope:EISyncScope,origin:string,requestId:string,targetRequestId?:string,request:typeof fetch=fetch){
 if(!EI_NATIVE_SYNC_ORIGINS.includes(origin))throw new Error('No native public-sync carrier on this origin')
 if(!/^[A-Za-z0-9._:-]{1,128}$/.test(requestId)||targetRequestId!==undefined&&!/^[A-Za-z0-9._:-]{1,128}$/.test(targetRequestId)||!scope.address||/[\x00-\x1f\x7f]/.test(scope.address)||scope.address.length>256||!Number.isSafeInteger(scope.revision)||scope.revision<0)throw new Error('Invalid sync field scope')
 const params=new URLSearchParams({requestId,op:targetRequestId?'status':'check',address:scope.address,revision:String(scope.revision),...(targetRequestId?{targetRequestId}:{})})
 const response=await request(`${origin}/EverthingFromNothing/__native/sync.json?${params}`,{credentials:'omit',cache:'no-store',redirect:'error'});if(!response.ok)throw new Error(`Public sync return ${response.status}`)
 const raw=await readBoundedPublicText(response,2_200_000)
 const value=validateEIPublicSyncReturn(JSON.parse(raw),requestId,scope,targetRequestId),candidate=value.action?.candidate
 if(candidate){const manifest=JSON.parse(candidate.manifestText);for(const key of ['payloadSha256','payloadBytes','recordCount','release','sourceRepository','compatibility'] as const)if(manifest[key]!==candidate[key])throw new Error('Public sync carrier metadata differs from manifest');const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(candidate.manifestText))),byte=>byte.toString(16).padStart(2,'0')).join('');if(digest!==candidate.manifestSha256)throw new Error('Public manifest byte binding differs')}
 return {scope:{...scope},value,raw}
}
export async function readBoundedPublicText(response:Response,limit:number){
 if(!response.ok)throw new Error(`Public state return ${response.status}`)
 if(!response.body)throw new Error('Public state body unavailable')
 const reader=response.body.getReader(),chunks:Uint8Array[]=[],decoder=new TextDecoder('utf-8',{fatal:true});let bytes=0
 try{while(true){const part=await reader.read();if(part.done)break;bytes+=part.value.length;if(bytes>limit)throw new Error('Public state exceeds byte bound');chunks.push(part.value)}const data=new Uint8Array(bytes);let offset=0;for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.length}return decoder.decode(data)}catch(error){await reader.cancel().catch(()=>{});throw error}finally{reader.releaseLock()}
}
