import type {PhoneScope} from './ei-phone-return.ts'

export const EI_PHONE_MEDIA_OPERATIONS=['status','pick-video','video-frame','request-microphone','record-voice','stop-voice','sample-motion','cancel','transcribe-voice','discard-source'] as const
export type MediaOperation=typeof EI_PHONE_MEDIA_OPERATIONS[number]
export type MediaState='pending'|'returned'|'cancelled'|'denied'|'unavailable'|'failed'
type Json=null|boolean|number|string|readonly Json[]|{readonly [key:string]:Json}
export type MediaSource=Readonly<{id:string;kind:'video'|'video-frame'|'voice'|'motion';mime:string;sha256:string;bytes:number;address:string;revision:number;retainedOriginal:boolean;nativeAvailable:true;contentUrl:string;metadata:Readonly<Record<string,Json>>}>
export type MediaAction=Readonly<{requestId:string;op:MediaOperation;address:string;revision:number;state:MediaState;stage:'queued'|'permission'|'picking'|'copying'|'recording'|'sampling'|'decoding'|'complete';code:string;sourceId:string|null;sourceSha256:string|null;result:Readonly<Record<string,Json>>|null}>
export const EI_PHONE_MEDIA_LIMITS=Object.freeze({videoBytes:33554432,voiceBytes:2097152,voiceDurationMs:15000,storeBytes:67108864,sourceCount:32,frameMaxDimension:480,motionDurationMs:2000,motionMaxSamplesPerSensor:40,motionRequestedPeriodUs:50000})
export type MediaSnapshot=Readonly<{schema:'field.android.media.v1';requestId:string;state:MediaState;code:string;microphonePermission:'granted'|'not-granted';foreground:boolean;activeRequestId:string|null;action:MediaAction|null;actions:readonly MediaAction[];sources:readonly MediaSource[];limits:typeof EI_PHONE_MEDIA_LIMITS;storageState:'available'|'unavailable';storageCode:string|null;storageDiagnostics:readonly string[]}>
export type MediaReceipt=Readonly<{scope:PhoneScope;requestId:string;value:MediaSnapshot}>
export type MediaParams=Readonly<{targetRequestId?:string;sourceId?:string;sourceSha256?:string;timestampUs?:string|number;confirm?:'delete-original'}>
const ORIGIN='https://appassets.androidplatform.net',BASE=`${ORIGIN}/EverthingFromNothing/`
const states=['pending','returned','cancelled','denied','unavailable','failed'],stages=['queued','permission','picking','copying','recording','sampling','decoding','complete']
const requestIdPattern=/^[A-Za-z0-9._:-]{1,128}$/,sourceIdPattern=/^media-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,digestPattern=/^[0-9a-f]{64}$/
const owns=(value:object,key:string)=>Object.prototype.hasOwnProperty.call(value,key)
function requireValue(condition:unknown,message:string):asserts condition{if(!condition)throw new Error(`Invalid phone media ${message}`)}
function object(value:unknown):Record<string,unknown>{requireValue(!!value&&typeof value==='object'&&!Array.isArray(value),'object');return value as Record<string,unknown>}
function fields(value:Record<string,unknown>,keys:readonly string[],optional:readonly string[]=[]){requireValue(keys.every(key=>owns(value,key))&&Object.keys(value).every(key=>keys.includes(key)||optional.includes(key)),'fields')}
function text(value:unknown,max=256):value is string{return typeof value==='string'&&value.length>0&&value.length<=max&&!/\p{Cc}/u.test(value)}
function integer(value:unknown,max=Number.MAX_SAFE_INTEGER):value is number{return Number.isSafeInteger(value)&&(value as number)>=0&&(value as number)<=max}
function scopeValid(value:PhoneScope|Record<string,unknown>){return text(value.address)&&integer(value.revision)}
function requestIdValid(value:unknown):value is string{return typeof value==='string'&&requestIdPattern.test(value)}
function sourceIdValid(value:unknown):value is string{return typeof value==='string'&&sourceIdPattern.test(value)}
function digestValid(value:unknown):value is string{return typeof value==='string'&&digestPattern.test(value)}
function finiteJson(value:unknown,depth=0):void{requireValue(depth<=12,'result depth');if(value===null||typeof value==='boolean')return;if(typeof value==='number'){requireValue(Number.isFinite(value),'result number');return}if(typeof value==='string'){requireValue(value.length<=16384,'result string');return}if(Array.isArray(value)){requireValue(value.length<=256,'result array');for(const item of value)finiteJson(item,depth+1);return}const record=object(value);requireValue(Object.keys(record).length<=64,'result fields');for(const [key,item] of Object.entries(record)){requireValue(text(key,128),'result key');finiteJson(item,depth+1)}}
function freeze<T>(value:T):T{if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value)}return value}
function canonical(value:unknown):string{if(Array.isArray(value))return `[${value.map(canonical).join(',')}]`;if(value&&typeof value==='object')return `{${Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>`${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`;return JSON.stringify(value)}
function sameScope(a:PhoneScope|Record<string,unknown>,b:PhoneScope|Record<string,unknown>){return a.address===b.address&&a.revision===b.revision}

function validateMetadata(source:Record<string,unknown>){
 const metadata=object(source.metadata);finiteJson(metadata)
 if(source.kind==='video'){
  fields(metadata,['durationMs','width','height','rotation','metadataStatus'],['originalMime'])
  requireValue(['returned','unavailable'].includes(metadata.metadataStatus as string),'video metadata status')
  requireValue(metadata.originalMime===undefined||metadata.originalMime===null||text(metadata.originalMime,256),'video original MIME')
  for(const key of ['durationMs','width','height'])requireValue(metadata[key]===null||integer(metadata[key]),'video dimensions')
  requireValue(metadata.rotation===null||(typeof metadata.rotation==='number'&&Number.isFinite(metadata.rotation)),'video rotation')
 }else if(source.kind==='video-frame'){
  fields(metadata,['parentSourceId','parentSourceSha256','requestedTimestampUs','actualTimestampUs','width','height','selection'])
  requireValue(sourceIdValid(metadata.parentSourceId)&&metadata.parentSourceId!==source.id&&digestValid(metadata.parentSourceSha256),'frame parent')
  requireValue(typeof metadata.requestedTimestampUs==='string'&&/^\d{1,11}$/.test(metadata.requestedTimestampUs)&&Number(metadata.requestedTimestampUs)<=86400000000&&metadata.actualTimestampUs===null,'frame timestamp')
  requireValue(integer(metadata.width,480)&&metadata.width>0&&integer(metadata.height,480)&&metadata.height>0&&metadata.selection==='closest-sync','frame dimensions')
 }else if(source.kind==='voice'){
  const timing=['requestedDurationMs','elapsedDurationMs','elapsedTiming','encodedDurationMs']
  fields(metadata,['encoding','audioSource','maxDurationMs','stopReason'],timing)
  requireValue(metadata.encoding==='MPEG4/AAC'&&metadata.audioSource==='MIC'&&metadata.maxDurationMs===15000&&text(metadata.stopReason,128),'voice metadata')
  if(timing.some(key=>owns(metadata,key))){
   requireValue(timing.every(key=>owns(metadata,key))&&metadata.requestedDurationMs===14000&&integer(metadata.elapsedDurationMs)&&metadata.elapsedTiming==='start-return-to-stop-request'&&(metadata.encodedDurationMs===null||integer(metadata.encodedDurationMs,15000)),'voice timing')
  }
 }else{
  const timing=['startedElapsedRealtimeNanos','endedElapsedRealtimeNanos','requestedDurationMs']
  fields(metadata,['sensors','durationMs','requestedPeriodUs','maxSamplesPerSensor'],['stopReason',...timing])
  // Native duration is actual elapsed time; scheduler delay does not change
  // the separately declared acquisition budget or admitted sample bound.
  requireValue(integer(metadata.durationMs)&&metadata.requestedPeriodUs===50000&&metadata.maxSamplesPerSensor===40&&Array.isArray(metadata.sensors)&&metadata.sensors.length<=2&&(metadata.stopReason===undefined||text(metadata.stopReason,128)),'motion metadata')
  if(timing.some(key=>owns(metadata,key))){
   requireValue(timing.every(key=>owns(metadata,key))&&metadata.requestedDurationMs===2000,'motion timing fields')
   const start=metadata.startedElapsedRealtimeNanos,end=metadata.endedElapsedRealtimeNanos
   requireValue(typeof start==='string'&&typeof end==='string'&&/^(0|[1-9][0-9]{0,18})$/.test(start)&&/^(0|[1-9][0-9]{0,18})$/.test(end),'motion timestamps')
   const startNanos=BigInt(start),endNanos=BigInt(end),longMax=9223372036854775807n
   requireValue(startNanos<=longMax&&endNanos<=longMax&&endNanos>=startNanos&&BigInt(metadata.durationMs)===(endNanos-startNanos)/1000000n,'motion elapsed duration')
  }
  const types=new Set<string>();let samples=0
  for(const item of metadata.sensors){const sensor=object(item);fields(sensor,['type','androidType','available','name','vendor','units','sampleCount','status'],['registered']);requireValue((sensor.type==='accelerometer'||sensor.type==='gyroscope')&&!types.has(sensor.type),'motion sensor type');types.add(sensor.type)
   requireValue(sensor.registered===undefined||typeof sensor.registered==='boolean','motion registration')
   requireValue(sensor.androidType===(sensor.type==='accelerometer'?1:4)&&sensor.units===(sensor.type==='accelerometer'?'m/s^2':'rad/s')&&typeof sensor.available==='boolean'&&(sensor.name===null||typeof sensor.name==='string')&&(sensor.vendor===null||typeof sensor.vendor==='string')&&integer(sensor.sampleCount,40),'motion sensor')
   requireValue(sensor.status===(sensor.available?(sensor.sampleCount>0?'returned':'no-event'):'missing-sensor')&&(sensor.available||sensor.sampleCount===0),'motion sensor status');samples+=sensor.sampleCount
  }
  requireValue(samples>0,'motion source has no samples')
 }
}
function validateSource(value:unknown):MediaSource{
 const source=object(value);fields(source,['id','kind','mime','sha256','bytes','address','revision','retainedOriginal','nativeAvailable','contentUrl','metadata'])
 requireValue(sourceIdValid(source.id)&&digestValid(source.sha256)&&scopeValid(source)&&integer(source.bytes,EI_PHONE_MEDIA_LIMITS.storeBytes)&&source.bytes>0&&source.nativeAvailable===true,'source identity')
 requireValue(['video','video-frame','voice','motion'].includes(source.kind as string)&&source.retainedOriginal===(source.kind!=='video-frame'),'source kind')
 const mime=source.mime
 requireValue(typeof mime==='string'&&(source.kind==='video'?(mime==='application/octet-stream'||/^video\/[A-Za-z0-9!#$&^_.+*-]{1,80}$/.test(mime)):mime===(source.kind==='video-frame'?'image/png':source.kind==='voice'?'audio/mp4':'application/json')),'source mime')
 requireValue(source.kind!=='video'||source.bytes<=EI_PHONE_MEDIA_LIMITS.videoBytes,'video size');requireValue(source.kind!=='voice'||source.bytes<=EI_PHONE_MEDIA_LIMITS.voiceBytes,'voice size')
 requireValue(typeof source.contentUrl==='string'&&source.contentUrl.startsWith('__native/media-content?')&&source.contentUrl.length<=512,'content URL')
 const url=new URL(source.contentUrl,BASE)
 requireValue(url.origin===ORIGIN&&url.pathname==='/EverthingFromNothing/__native/media-content'&&!url.hash&&!url.username&&!url.password&&[...url.searchParams].length===2&&url.searchParams.getAll('sourceId').length===1&&url.searchParams.getAll('sourceSha256').length===1&&url.searchParams.get('sourceId')===source.id&&url.searchParams.get('sourceSha256')===source.sha256,'content URL binding')
 validateMetadata(source);return source as unknown as MediaSource
}
function validateAction(value:unknown):MediaAction{
 const action=object(value);fields(action,['requestId','op','address','revision','state','stage','code','sourceId','sourceSha256','result'])
 requireValue(requestIdValid(action.requestId)&&EI_PHONE_MEDIA_OPERATIONS.includes(action.op as MediaOperation)&&scopeValid(action)&&states.includes(action.state as string)&&stages.includes(action.stage as string)&&text(action.code,128),'action')
 requireValue((action.sourceId===null&&action.sourceSha256===null)||(sourceIdValid(action.sourceId)&&digestValid(action.sourceSha256)),'action source binding')
 if(action.result!==null){object(action.result);finiteJson(action.result)}
 return action as unknown as MediaAction
}

/** Explicit local native request only. Descriptors are not verification of media
 * bytes, availability on another device, semantic translation, or ledger input. */
export async function readEIPhoneMedia(scope:PhoneScope,origin:string,requestId:string,op:MediaOperation,params:MediaParams={},fetcher:typeof fetch=fetch):Promise<MediaReceipt>{
 requireValue(origin===ORIGIN&&scopeValid(scope)&&requestIdValid(requestId)&&EI_PHONE_MEDIA_OPERATIONS.includes(op),'request')
 const captured=Object.freeze({address:scope.address,revision:scope.revision}),query=new URLSearchParams({requestId,op,address:captured.address,revision:String(captured.revision)}),given=object({...params})
 const required=op==='video-frame'?['sourceId','sourceSha256','timestampUs']:op==='transcribe-voice'?['sourceId','sourceSha256']:op==='discard-source'?['sourceId','sourceSha256','confirm']:op==='stop-voice'||op==='cancel'?['targetRequestId']:[]
 fields(given,required,op==='status'?['targetRequestId']:[])
 if(owns(given,'targetRequestId'))requireValue(requestIdValid(given.targetRequestId)&&given.targetRequestId!==requestId,'target request')
 if(owns(given,'sourceId'))requireValue(sourceIdValid(given.sourceId)&&digestValid(given.sourceSha256),'requested source')
 if(op==='video-frame')requireValue((typeof given.timestampUs==='string'&&/^\d{1,11}$/.test(given.timestampUs)&&Number(given.timestampUs)<=86400000000)||integer(given.timestampUs,86400000000),'requested timestamp')
 if(op==='discard-source')requireValue(given.confirm==='delete-original','explicit discard confirmation')
 for(const [key,value] of Object.entries(given))query.set(key,String(value))
 const response=await fetcher(`${BASE}__native/media.json?${query}`,{method:'GET',credentials:'omit',cache:'no-store',redirect:'error'})
 requireValue(response.ok&&!response.redirected&&(!response.url||new URL(response.url).origin===ORIGIN),'HTTP return')
 const raw=await response.text();requireValue(new TextEncoder().encode(raw).length<=1048576,'return size')
 const body=object(JSON.parse(raw));fields(body,['schema','requestId','state','code','microphonePermission','foreground','activeRequestId','action','actions','sources','limits','storageState','storageCode','storageDiagnostics'])
 requireValue(body.schema==='field.android.media.v1'&&body.requestId===requestId&&states.includes(body.state as string)&&text(body.code,128)&&['granted','not-granted'].includes(body.microphonePermission as string)&&typeof body.foreground==='boolean'&&(body.activeRequestId===null||requestIdValid(body.activeRequestId))&&['available','unavailable'].includes(body.storageState as string)&&(body.storageCode===null||text(body.storageCode,128)),'snapshot')
 requireValue(Array.isArray(body.storageDiagnostics)&&body.storageDiagnostics.length<=32&&body.storageDiagnostics.every(value=>text(value,128)&&/^[a-z0-9-]+(?::media-[0-9a-f-]+)?$/.test(value)),'storage diagnostics')
 const limits=object(body.limits);fields(limits,Object.keys(EI_PHONE_MEDIA_LIMITS));requireValue(Object.entries(EI_PHONE_MEDIA_LIMITS).every(([key,value])=>limits[key]===value),'limits')
 requireValue(Array.isArray(body.actions)&&body.actions.length<=64&&Array.isArray(body.sources)&&body.sources.length<=32,'catalog bounds')
 const actions=body.actions.map(validateAction),sources=body.sources.map(validateSource),action=body.action===null?null:validateAction(body.action)
 requireValue(new Set(actions.map(item=>item.requestId)).size===actions.length&&new Set(sources.map(item=>item.id)).size===sources.length&&sources.reduce((sum,item)=>sum+item.bytes,0)<=EI_PHONE_MEDIA_LIMITS.storeBytes,'catalog identity or quota')
 for(const item of [...actions,...(action?[action]:[])]){const source=sources.find(source=>source.id===item.sourceId);if(source)requireValue(source.sha256===item.sourceSha256&&sameScope(source,item),'action source correlation')}
 if(op==='status'){
  requireValue(action===null||(given.targetRequestId!==undefined&&action.requestId===given.targetRequestId&&sameScope(action,captured)),'status action correlation')
 }else if(action===null){
  // A native admission failure (for example a full action queue) can occur
  // before an action exists. It supplies no successful operation evidence.
  requireValue(body.state==='failed'||body.state==='unavailable','missing action correlation')
 }else{
  requireValue(action.requestId===requestId&&action.op===op&&sameScope(action,captured)&&body.state===action.state&&body.code===action.code,'action correlation')
  if(action.state==='returned'&&['pick-video','video-frame','record-voice','stop-voice','sample-motion'].includes(op)){
   const source=sources.find(source=>source.id===action.sourceId);requireValue(source&&source.sha256===action.sourceSha256&&sameScope(source,captured),'successful source missing')
   requireValue(source.kind===({'pick-video':'video','video-frame':'video-frame','record-voice':'voice','stop-voice':'voice','sample-motion':'motion'} as Record<string,string>)[op],'successful source kind')
   if(op==='video-frame')requireValue(source.metadata.parentSourceId===given.sourceId&&source.metadata.parentSourceSha256===given.sourceSha256&&Number(source.metadata.requestedTimestampUs)===Number(given.timestampUs),'frame request correlation')
  }
  if(op==='discard-source'&&action.state==='returned')requireValue(!sources.some(source=>source.id===given.sourceId),'discard still available')
 }
 const requestedSource=sources.find(source=>source.id===given.sourceId)
 if(requestedSource)requireValue(requestedSource.sha256===given.sourceSha256&&sameScope(requestedSource,captured),'requested source correlation')
 const listed=action&&actions.find(item=>item.requestId===action.requestId);if(listed)requireValue(canonical(listed)===canonical(action),'duplicate action differs')
 return freeze({scope:captured,requestId,value:body as unknown as MediaSnapshot})
}
