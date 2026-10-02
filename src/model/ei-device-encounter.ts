import type {EncounterEnvelope,EncounterOp,DocumentMetadata} from './ei-device-encounter-types.ts'
import type {EIDeviceEncounter} from './ei-device-field.ts'
export type EncounterScope=Readonly<{address:string;revision:number}>
const states=['pending','returned','cancelled','unavailable','failed']
function check(ok:unknown):asserts ok{if(!ok)throw new Error('Invalid addressed device return')}
function obj(v:unknown):Record<string,unknown>{check(v&&typeof v==='object'&&!Array.isArray(v));return v as Record<string,unknown>}
const text=(v:unknown,max=512)=>typeof v==='string'&&v.length<=max
const nullableText=(v:unknown,max=512)=>v===null||text(v,max)
const nullableCount=(v:unknown)=>v===null||(Number.isSafeInteger(v)&&Number(v)>=0)
function diagnostics(v:unknown){check(Array.isArray(v)&&v.length<=64&&v.every(x=>text(x,256)))}
function document(v:unknown){const d=obj(v);check(['file','folder','unknown'].includes(String(d.kind))&&text(d.observationId,128)&&text(d.encounterId,128)&&nullableText(d.parentEncounterId,128));check(d.evidenceKind==='document_provider_metadata_return'&&nullableText(d.displayName)&&nullableText(d.mimeType,256)&&nullableText(d.providerAuthority,256));check(nullableCount(d.sizeBytes)&&nullableCount(d.lastModifiedMs)&&nullableCount(d.providerFlags));check(d.contentRead===false&&d.contentSha256===null&&d.persistedGrantTaken===false&&d.accessLifetime==='transient_provider_grant'&&d.handleLifetime==='native_process_session');diagnostics(d.diagnostics)}
export function validateEIDeviceEnvelope(value:unknown,requestId:string,scope:EncounterScope,op:EncounterOp,target?:string):EncounterEnvelope{
 const e=obj(value);check(e.schema==='field.android.encounters.v1'&&e.requestId===requestId&&states.includes(String(e.state))&&text(e.code,256)&&typeof e.foreground==='boolean'&&nullableText(e.activeRequestId,128)&&e.handleLifetime==='native_process_session')
 if(e.action!==null){const a=obj(e.action);check(text(a.requestId,128)&&a.address===scope.address&&a.revision===scope.revision&&states.includes(String(a.state))&&['queued','picking','querying','complete'].includes(String(a.stage))&&text(a.code,256));check(['software','pick-file','pick-folder','list-children','cancel'].includes(String(a.op))&&nullableText(a.encounterId,128)&&nullableText(a.targetRequestId,128));check(a.requestId===(op==='status'?target??a.requestId:requestId));if(op!=='status')check(a.op===op)
  if(a.result!==null){const r=obj(a.result)
   if(r.kind==='software'){check(r.evidenceKind==='android_package_metadata_return'&&r.scope==='this_app_and_current_webview_provider'&&text(r.observationId,128)&&r.contentRead===false&&r.contentSha256===null);for(const key of ['ownApp','webViewProvider']){const p=obj(r[key]);check(['returned','unavailable'].includes(String(p.state))&&text(p.code,256)&&nullableText(p.packageName,256)&&nullableText(p.versionName,256)&&nullableCount(p.versionCode));diagnostics(p.diagnostics)}diagnostics(r.diagnostics)}
   else if(r.kind==='children'){check(text(r.observationId,128)&&text(r.encounterId,128)&&nullableText(r.parentEncounterId,128)&&r.evidenceKind==='document_provider_metadata_return'&&r.coverage==='direct_children_only'&&typeof r.truncated==='boolean'&&typeof r.providerLoading==='boolean'&&r.contentRead===false&&r.contentSha256===null&&r.persistedGrantTaken===false&&r.accessLifetime==='transient_provider_grant'&&r.handleLifetime==='native_process_session');check(Array.isArray(r.children)&&r.children.length<=64);r.children.forEach(document);diagnostics(r.diagnostics)}
   else if(r.kind==='cancellation')check(text(r.targetRequestId,128)&&typeof r.pickerMayRemainOpen==='boolean')
   else {document(r);check(r.coverage==='selected_item_only'&&typeof r.truncated==='boolean'&&typeof r.providerLoading==='boolean')}
  }
 }
 return value as EncounterEnvelope
}
export async function readEIDeviceEncounter(scope:EncounterScope,origin:string,requestId:string,op:EncounterOp,params:{targetRequestId?:string;encounterId?:string}={},request:typeof fetch=fetch){
 if(origin!=='https://appassets.androidplatform.net')throw new Error('Native device encounter unavailable here')
 if(!/^[A-Za-z0-9._:-]{1,128}$/.test(requestId)||!scope.address||scope.address.length>256||!Number.isSafeInteger(scope.revision)||scope.revision<0)throw new Error('Invalid selected field scope')
 const query=new URLSearchParams({requestId,op,address:scope.address,revision:String(scope.revision),...params})
 const response=await request(`${origin}/EverthingFromNothing/__native/encounters.json?${query}`,{credentials:'omit',redirect:'error',cache:'no-store'})
 if(!response.ok)throw new Error(`Device encounter return ${response.status}`)
 const raw=await response.text();if(new TextEncoder().encode(raw).length>131072)throw new Error('Device encounter exceeds return bound')
 const value=validateEIDeviceEnvelope(JSON.parse(raw),requestId,scope,op,params.targetRequestId)
 if(op==='list-children'&&value.action&&value.action.encounterId!==params.encounterId)throw new Error('Device folder return is for a different handle')
 return Object.freeze({scope:Object.freeze({...scope}),raw,value})
}
export function deviceEncounterRows(receipt:Awaited<ReturnType<typeof readEIDeviceEncounter>>):EIDeviceEncounter[]{
 const action=receipt.value.action,result=action?.result;if(!action||action.state!=='returned'||!result||result.kind==='cancellation')return []
 const producer={address:action.address,revision:action.revision},rows:EIDeviceEncounter[]=[]
 const push=(id:string,kind:EIDeviceEncounter['kind'],label:string,value:unknown,pointer:string)=>rows.push({id,kind,label,sourceText:JSON.stringify(value),realm:'android-device-encounter',locator:JSON.stringify({requestId:action.requestId,pointer,evidence:'native-metadata-return'}),producer})
 if(result.kind==='software'){for(const role of ['ownApp','webViewProvider'] as const){const p=result[role];if(p.state==='returned')push(`${result.observationId}:${role}`,'software',p.packageName??role,p,`/action/result/${role}`)}}
 else if(result.kind==='children'){for(const [index,item] of result.children.entries())push(item.observationId,item.kind==='folder'?'folders':'files',item.displayName??item.encounterId,item,`/action/result/children/${index}`)}
 else push(result.observationId,result.kind==='folder'?'folders':'files',result.displayName??result.encounterId,result,'/action/result')
 return rows
}
export function liveDeviceFolders(receipt:Awaited<ReturnType<typeof readEIDeviceEncounter>>):DocumentMetadata[]{const result=receipt.value.action?.result;if(receipt.value.action?.state!=='returned'||!result)return [];return (result.kind==='children'?result.children:result.kind==='folder'?[result]:[]).filter(item=>item.kind==='folder')}
