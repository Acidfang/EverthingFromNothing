import test from 'node:test'
import assert from 'node:assert/strict'
import {readEIPhoneMedia,EI_PHONE_MEDIA_LIMITS,type MediaOperation,type MediaParams} from '../src/model/ei-phone-media.ts'

const origin='https://appassets.androidplatform.net',scope={address:'root/a ? β',revision:2},id='media-12345678-1234-4234-8234-123456789abc',secondId='media-22345678-1234-4234-8234-123456789abc',sha='a'.repeat(64),otherSha='b'.repeat(64)
function source(overrides:Record<string,unknown>={}){return {id,kind:'video',mime:'video/mp4',sha256:sha,bytes:100,...scope,retainedOriginal:true,nativeAvailable:true,contentUrl:`__native/media-content?sourceId=${id}&sourceSha256=${sha}`,metadata:{durationMs:120,width:640,height:480,rotation:0,metadataStatus:'returned'},...overrides}}
function action(op:MediaOperation='pick-video',overrides:Record<string,unknown>={}){return {requestId:'r',op,...scope,state:'pending',stage:'picking',code:'waiting-for-picker',sourceId:null,sourceSha256:null,result:null,...overrides}}
function snapshot(overrides:Record<string,unknown>={}){return {schema:'field.android.media.v1',requestId:'r',state:'returned',code:'snapshot',microphonePermission:'not-granted',foreground:true,activeRequestId:null,action:null,actions:[],sources:[],limits:{...EI_PHONE_MEDIA_LIMITS},storageState:'available',storageCode:null,storageDiagnostics:[],...overrides}}
function mutation(op:MediaOperation='pick-video',overrides:Record<string,unknown>={},sources:unknown[]=[]){const a=action(op,overrides);return snapshot({state:a.state,code:a.code,action:a,actions:[a],sources})}
const fetchFor=(body:unknown)=>(async()=>new Response(JSON.stringify(body))) as typeof fetch
const read=(body:unknown,op:MediaOperation='status',params:MediaParams={})=>readEIPhoneMedia(scope,origin,'r',op,params,fetchFor(body))

test('explicit media request captures immutable scope and uses only the exact local GET endpoint',async()=>{
 let called='',options:RequestInit|undefined,calls=0;const mutable={...scope}
 const receipt=await readEIPhoneMedia(mutable,origin,'r','pick-video',{},(async(url,init)=>{called=String(url);options=init;calls++;mutable.address='changed';return new Response(JSON.stringify(mutation()))}) as typeof fetch)
 const url=new URL(called);assert.equal(url.origin,origin);assert.equal(url.pathname,'/EverthingFromNothing/__native/media.json');assert.equal(url.searchParams.get('address'),scope.address);assert.equal(url.searchParams.get('revision'),'2');assert.equal(url.searchParams.get('op'),'pick-video')
 assert.deepEqual(options,{method:'GET',credentials:'omit',cache:'no-store',redirect:'error'});assert.equal(calls,1);assert.deepEqual(receipt.scope,scope)
 for(const value of [receipt,receipt.scope,receipt.value,receipt.value.actions,receipt.value.action,receipt.value.limits])assert.ok(Object.isFrozen(value))
 assert.equal(receipt.value.state,'pending');assert.equal(receipt.value.action?.state,'pending');assert.equal(receipt.value.sources.length,0)
})

test('wrong origin, invalid scope/request, and invalid operation parameters never fetch',async()=>{
 let calls=0;const fetcher=(async()=>{calls++;return new Response()}) as typeof fetch
 for(const route of ['http://appassets.androidplatform.net',`${origin}/`,`${origin}.evil.example`,'https://acidfang.github.io'])await assert.rejects(readEIPhoneMedia(scope,route,'r','status',{},fetcher))
 for(const bad of [{address:'',revision:2},{address:'a\n',revision:2},{address:'a'.repeat(257),revision:2},{address:'a',revision:-1},{address:'a',revision:2.1},{address:'a',revision:Number.MAX_SAFE_INTEGER+1}])await assert.rejects(readEIPhoneMedia(bad,origin,'r','status',{},fetcher))
 for(const requestId of ['','bad?','a'.repeat(129)])await assert.rejects(readEIPhoneMedia(scope,origin,requestId,'status',{},fetcher))
 for(const [op,params] of [['video-frame',{}],['video-frame',{sourceId:id,sourceSha256:sha,timestampUs:'1e3'}],['video-frame',{sourceId:id,sourceSha256:sha,timestampUs:86400000001}],['video-frame',{sourceId:id,sourceSha256:'A'.repeat(64),timestampUs:1}],['stop-voice',{}],['cancel',{targetRequestId:'r'}],['status',{confirm:'delete-original'}],['discard-source',{sourceId:id,sourceSha256:sha}],['pick-video',{sourceId:id}]] as const)await assert.rejects(readEIPhoneMedia(scope,origin,'r',op,params as MediaParams,fetcher))
 assert.equal(calls,0)
})

test('pending, denied, cancelled, unavailable and failed returns remain distinct from success',async()=>{
 for(const state of ['pending','denied','cancelled','unavailable','failed']){const receipt=await read(mutation('record-voice',{state,stage:state==='pending'?'recording':'complete',code:state}),'record-voice');assert.equal(receipt.value.state,state);assert.equal(receipt.value.action?.state,state);assert.deepEqual(receipt.value.sources,[])}
 const permission=await read(mutation('request-microphone',{state:'returned',stage:'complete',code:'granted'}),'request-microphone');assert.equal(permission.value.state,'returned');assert.equal(permission.value.sources.length,0)
})

test('exact response schema and mutation action correlation reject stale or mismatched results',async()=>{
 for(const changed of [{requestId:'older'},{op:'sample-motion'},{address:'other'},{revision:1}])await assert.rejects(read(mutation('pick-video',changed),'pick-video'),/correlation/)
 for(const changed of [{schema:'field.android.media.v2'},{requestId:'other'},{action:null},{state:'returned'},{code:'other'},{extra:true}])await assert.rejects(read({...mutation(),...changed},'pick-video'))
 const body=mutation();body.actions=[action('pick-video',{code:'different'})];await assert.rejects(read(body,'pick-video'),/duplicate action differs/)
})

test('status permits other scoped catalog/history entries and explicitly targets a bound prior action',async()=>{
 const other={address:'another',revision:9},prior=action('record-voice',{requestId:'recording',state:'pending',stage:'recording'})
 const receipt=await read(snapshot({sources:[source(other)],actions:[action('pick-video',{requestId:'other',...other})]}));assert.equal(receipt.value.sources[0].address,'another')
 assert.equal((await read(snapshot({action:prior,actions:[prior]}),'status',{targetRequestId:'recording'})).value.action?.requestId,'recording')
 assert.equal((await read(snapshot(),'status',{targetRequestId:'no-longer-retained'})).value.action,null)
 for(const changed of [{requestId:'other'},{address:'other'},{revision:3}])await assert.rejects(read(snapshot({action:{...prior,...changed}}),'status',{targetRequestId:'recording'}),/status action correlation/)
 await assert.rejects(read(snapshot({action:prior})),/status action correlation/)
})

test('returned acquisition requires a currently available exact scoped source descriptor',async()=>{
 const returned={state:'returned',stage:'complete',code:'retained',sourceId:id,sourceSha256:sha},body=mutation('pick-video',returned,[source()])
 const receipt=await read(body,'pick-video');assert.equal(receipt.value.sources[0].sha256,sha);assert.ok(Object.isFrozen(receipt.value.sources[0].metadata))
 await assert.rejects(read(mutation('pick-video',returned),'pick-video'),/source missing/)
 for(const changed of [{address:'other'},{revision:1},{sha256:otherSha,contentUrl:`__native/media-content?sourceId=${id}&sourceSha256=${otherSha}`},{nativeAvailable:false}])await assert.rejects(read(mutation('pick-video',returned,[source(changed)]),'pick-video'))
 await assert.rejects(read(mutation('sample-motion',returned,[source()]),'sample-motion'),/source kind/)
 const historical=action('pick-video',{...returned,requestId:'old'});assert.equal((await read(snapshot({action:historical}),'status',{targetRequestId:'old'})).value.sources.length,0)
})

test('frame receipt binds parent source, digest, timestamp and original scope',async()=>{
 const metadata={parentSourceId:id,parentSourceSha256:sha,requestedTimestampUs:'1200',actualTimestampUs:null,width:320,height:240,selection:'closest-sync'}
 const frame=source({id:secondId,kind:'video-frame',mime:'image/png',retainedOriginal:false,sha256:otherSha,contentUrl:`__native/media-content?sourceId=${secondId}&sourceSha256=${otherSha}`,metadata})
 const returned={state:'returned',stage:'complete',code:'frame-returned',sourceId:secondId,sourceSha256:otherSha},params={sourceId:id,sourceSha256:sha,timestampUs:1200}
 assert.equal((await read(mutation('video-frame',returned,[source(),frame]),'video-frame',params)).value.sources[1].retainedOriginal,false)
 for(const changed of [{parentSourceSha256:otherSha},{requestedTimestampUs:'1201'},{width:481},{actualTimestampUs:1200}])await assert.rejects(read(mutation('video-frame',returned,[source(),{...frame,metadata:{...metadata,...changed}}]),'video-frame',params))
 await assert.rejects(read(mutation('video-frame',returned,[source({address:'different'}),frame]),'video-frame',params),/requested source correlation/)
})

test('content URL cannot escape the exact local source-and-digest route',async()=>{
 for(const contentUrl of [`https://evil.example/file`,`https://appassets.androidplatform.net/EverthingFromNothing/__native/media-content?sourceId=${id}&sourceSha256=${sha}`,`//evil.example/file`,`__native/../private?sourceId=${id}&sourceSha256=${sha}`,`__native/media-content?sourceId=${id}&sourceSha256=${otherSha}`,`__native/media-content?sourceId=${secondId}&sourceSha256=${sha}`,`__native/media-content?sourceId=${id}&sourceSha256=${sha}&extra=1`,`__native/media-content?sourceId=${id}&sourceSha256=${sha}#fragment`,`__native/media-content?sourceId=${id}&sourceId=${id}&sourceSha256=${sha}`])await assert.rejects(read(snapshot({sources:[source({contentUrl})]})),/content URL/)
})

test('source kinds and bounded metadata match native video, voice and motion contracts',async()=>{
 const voice=source({kind:'voice',mime:'audio/mp4',metadata:{encoding:'MPEG4/AAC',audioSource:'MIC',maxDurationMs:15000,stopReason:'activity-paused'}})
 const sensors=[{type:'accelerometer',androidType:1,available:true,name:'sensor',vendor:'vendor',units:'m/s^2',sampleCount:40,status:'returned'},{type:'gyroscope',androidType:4,available:false,name:null,vendor:null,units:'rad/s',sampleCount:0,status:'missing-sensor'}]
 const motion=source({kind:'motion',mime:'application/json',metadata:{sensors,durationMs:2000,requestedPeriodUs:50000,maxSamplesPerSensor:40}})
 assert.equal((await read(snapshot({sources:[voice]}))).value.sources[0].kind,'voice');assert.equal((await read(snapshot({sources:[motion]}))).value.sources[0].kind,'motion')
 await assert.rejects(read(snapshot({sources:[{...voice,bytes:2097153}]})),/voice size/)
 await assert.rejects(read(snapshot({sources:[{...motion,metadata:{...motion.metadata,sensors:[{...sensors[0],sampleCount:41}]}}]})))
 await assert.rejects(read(snapshot({sources:[{...motion,metadata:{...motion.metadata,sensors:[{...sensors[0],sampleCount:0,status:'no-event'}]}}]})),/no samples/)
 const unknownMetadata=source({metadata:{durationMs:null,width:null,height:null,rotation:null,metadataStatus:'unavailable'}});assert.equal((await read(snapshot({sources:[unknownMetadata]}))).value.sources.length,1)
})

test('catalog bounds, quotas, duplicate IDs and declared limits are enforced',async()=>{
 for(const changed of [{sources:Array(33).fill(source())},{actions:Array(65).fill(action())},{sources:[source(),source()]},{actions:[action(),action()]},{sources:[source({bytes:33554433})]},{limits:{...EI_PHONE_MEDIA_LIMITS,sourceCount:33}}])await assert.rejects(read(snapshot(changed)))
 const sources=[id,secondId,'media-32345678-1234-4234-8234-123456789abc'].map(id=>source({id,bytes:33554432,contentUrl:`__native/media-content?sourceId=${id}&sourceSha256=${sha}`}));await assert.rejects(read(snapshot({sources})),/quota/)
 await assert.rejects(read(snapshot({storageCode:'a'.repeat(1048576)})),/return size/)
})

test('discard requires explicit confirmation, and a returned deletion cannot leave the original available',async()=>{
 const params={sourceId:id,sourceSha256:sha,confirm:'delete-original' as const},returned={state:'returned',stage:'complete',code:'discarded',sourceId:id,sourceSha256:sha}
 assert.equal((await read(mutation('discard-source',returned),'discard-source',params)).value.state,'returned')
 await assert.rejects(read(mutation('discard-source',returned,[source()]),'discard-source',params),/discard still available/)
 assert.equal((await read(mutation('transcribe-voice',{state:'unavailable',stage:'complete',code:'retained-file-transcription-unavailable'}),'transcribe-voice',{sourceId:id,sourceSha256:sha})).value.state,'unavailable')
})

test('request parameters are captured before asynchronous return and HTTP failures are rejected',async()=>{
 const params={targetRequestId:'recording'},prior=action('record-voice',{requestId:'recording'})
 const result=await readEIPhoneMedia(scope,origin,'r','status',params,(async()=>{params.targetRequestId='mutated';return new Response(JSON.stringify(snapshot({action:prior})))}) as typeof fetch);assert.equal(result.value.action?.requestId,'recording')
 await assert.rejects(readEIPhoneMedia(scope,origin,'r','status',{},(async()=>new Response('{}',{status:500})) as typeof fetch),/HTTP return/)
 await assert.rejects(readEIPhoneMedia(scope,origin,'r','status',{},(async()=>new Response('not-json')) as typeof fetch))
})

test('native optional provenance and measured duration survive without weakening sample budgets',async()=>{
 // Source-schema fixtures cross-checked with MediaBridge.java; these do not
 // represent device runtime, decoder, recorder or sensor verification.
 const video=source({mime:'application/octet-stream',metadata:{durationMs:null,width:null,height:null,rotation:null,metadataStatus:'unavailable',originalMime:'video/mp4'}})
 assert.equal((await read(snapshot({sources:[video]}))).value.sources[0].metadata.originalMime,'video/mp4')
 const motion=source({kind:'motion',mime:'application/json',metadata:{sensors:[{type:'accelerometer',androidType:1,available:true,registered:true,name:'sensor',vendor:'vendor',units:'m/s^2',sampleCount:40,status:'returned'}],durationMs:2037,requestedPeriodUs:50000,maxSamplesPerSensor:40,stopReason:'duration-limit'}})
 assert.equal((await read(snapshot({sources:[motion]}))).value.sources[0].metadata.durationMs,2037)
 const a=action(),reordered=Object.fromEntries(Object.entries(a).reverse());assert.equal((await read({...mutation(),actions:[reordered]},'pick-video')).value.action?.requestId,'r')
})

test('native storage diagnostics and pre-action admission failures remain explicit bounded returns',async()=>{
 const storageDiagnostics=['unrecognized-store-entry',`unavailable-source:${id}`]
 assert.deepEqual((await read(snapshot({storageDiagnostics}))).value.storageDiagnostics,storageDiagnostics)
 for(const value of [Array(33).fill('unavailable-source'),['/private/path'],['x'.repeat(129)],[{code:'bad'}]])await assert.rejects(read(snapshot({storageDiagnostics:value})),/storage diagnostics/)
 for(const state of ['failed','unavailable'])assert.equal((await read(snapshot({state,code:'action-queue-capacity'}),'pick-video')).value.state,state)
 await assert.rejects(read(snapshot(),'pick-video'),/missing action correlation/)
})

test('voice control timing is distinct from the verified encoded duration and 15-second safety limit',async()=>{
 const metadata={encoding:'MPEG4/AAC',audioSource:'MIC',maxDurationMs:15000,stopReason:'explicit-stop',requestedDurationMs:14000,elapsedDurationMs:4250,elapsedTiming:'start-return-to-stop-request',encodedDurationMs:4230}
 const voice=(changes:Record<string,unknown>={})=>source({kind:'voice',mime:'audio/mp4',metadata:{...metadata,...changes}})
 for(const encodedDurationMs of [0,15000,null])assert.equal((await read(snapshot({sources:[voice({encodedDurationMs})]}))).value.sources[0].metadata.encodedDurationMs,encodedDurationMs)
 for(const changes of [{requestedDurationMs:15000},{elapsedDurationMs:-1},{elapsedDurationMs:1.2},{elapsedDurationMs:Number.MAX_SAFE_INTEGER+1},{elapsedTiming:'encoder-duration'},{encodedDurationMs:15001},{encodedDurationMs:-1},{encodedDurationMs:1.5}])await assert.rejects(read(snapshot({sources:[voice(changes)]})),/voice timing/)
 const partial={...metadata} as Record<string,unknown>;delete partial.encodedDurationMs;await assert.rejects(read(snapshot({sources:[source({kind:'voice',mime:'audio/mp4',metadata:partial})]})),/voice timing/)
})

test('motion timestamps retain exact signed-long precision and validate elapsed time independently of requested window',async()=>{
 const metadata={sensors:[{type:'accelerometer',androidType:1,available:true,registered:true,name:'fixture',vendor:'fixture',units:'m/s^2',sampleCount:40,status:'returned'}],durationMs:2001,requestedPeriodUs:50000,maxSamplesPerSensor:40,stopReason:'duration-limit',startedElapsedRealtimeNanos:'9007199254740993123',endedElapsedRealtimeNanos:'9007199256742993122',requestedDurationMs:2000}
 const motion=(changes:Record<string,unknown>={})=>source({kind:'motion',mime:'application/json',metadata:{...metadata,...changes}})
 const result=await read(snapshot({sources:[motion()]}));assert.equal(result.value.sources[0].metadata.durationMs,2001);assert.equal(result.value.sources[0].metadata.startedElapsedRealtimeNanos,metadata.startedElapsedRealtimeNanos)
 for(const changes of [{startedElapsedRealtimeNanos:'-1'},{startedElapsedRealtimeNanos:'1e9'},{startedElapsedRealtimeNanos:'01'},{endedElapsedRealtimeNanos:'9223372036854775808'},{endedElapsedRealtimeNanos:'0'},{durationMs:2000},{requestedDurationMs:2001}])await assert.rejects(read(snapshot({sources:[motion(changes)]})),/motion/)
 const partial={...metadata} as Record<string,unknown>;delete partial.endedElapsedRealtimeNanos;await assert.rejects(read(snapshot({sources:[source({kind:'motion',mime:'application/json',metadata:partial})]})),/motion timing fields/)
})
