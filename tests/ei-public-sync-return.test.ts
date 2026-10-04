import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {validateEIPublicSyncReturn,readEIPublicSyncReturn,readBoundedPublicText,EI_NATIVE_SYNC_ORIGINS} from '../src/model/ei-public-sync-return.ts'
import {readEIPublicManifest,verifyEIPublicSnapshot} from '../src/model/ei-public-sync.ts'
const scope={address:'device',revision:0},value={schema:'field.android.public-sync.v1',requestId:'poll',state:'pending',code:'checking',foreground:true,activeRequestId:'first',action:{requestId:'first',op:'check',address:'device',revision:0,state:'pending',stage:'fetching-manifest',code:'checking',candidate:null},lastGood:null,applied:false}
const fixtures=JSON.parse(await readFile(new URL('./fixtures/public-sync-returns.json',import.meta.url),'utf8'))
const returned=fixtures.find((item:any)=>item.action?.candidate)
const returnedScope={address:returned.action.address,revision:returned.action.revision}
async function readReturned(item=returned){return readEIPublicSyncReturn(returnedScope,'https://appassets.androidplatform.net',item.requestId,item.action.requestId,async()=>new Response(JSON.stringify(item)))}
test('native public sync preserves original request/address/revision and rejects applied authority',()=>{
 assert.equal(validateEIPublicSyncReturn(value,'poll',scope,'first').action?.requestId,'first')
 for(const [request,at,target] of [['wrong',scope,'first'],['poll',{...scope,revision:1},'first'],['poll',{...scope,address:'other'},'first'],['poll',scope,'other']] as const)assert.throws(()=>validateEIPublicSyncReturn(value,request,at,target))
 for(const edit of [{applied:true},{extra:true},{state:'committed'},{foreground:'yes'}])assert.throws(()=>validateEIPublicSyncReturn({...value,...edit},'poll',scope,'first'))
})
test('wire schema rejects falsy non-null objects and malformed retained identity',()=>{
 for(const action of [0,false,''])assert.throws(()=>validateEIPublicSyncReturn({...value,action},'poll',scope,'first'))
 for(const candidate of [0,false,''])assert.throws(()=>validateEIPublicSyncReturn({...value,action:{...value.action,candidate}},'poll',scope,'first'))
 for(const activeRequestId of [0,{},'bad\nrequest'])assert.throws(()=>validateEIPublicSyncReturn({...value,activeRequestId},'poll',scope,'first'))
 for(const lastGood of [0,false,{}, {...returned.lastGood,revision:-1}, {...returned.lastGood,payloadSha256:'invalid'}])assert.throws(()=>validateEIPublicSyncReturn({...value,lastGood},'poll',scope,'first'))
})
test('native allowlist and request validation prevent unexpected origin or scope transmission',async()=>{
 assert.deepEqual(EI_NATIVE_SYNC_ORIGINS,['https://appassets.androidplatform.net','https://homebase.local']);let calls=0;const request:typeof fetch=async()=>{calls++;return new Response('')}
 await assert.rejects(readEIPublicSyncReturn(scope,'https://untrusted.example','r',undefined,request))
 for(const [at,id,target] of [[{...scope,address:'private\npath'},'r',undefined],[{...scope,revision:-1},'r',undefined],[scope,'invalid/request',undefined],[scope,'r','bad/request'],[scope,'r','x'.repeat(129)]] as const)await assert.rejects(readEIPublicSyncReturn(at,'https://appassets.androidplatform.net',id,target,request))
 assert.equal(calls,0)
})
test('native pending query remains fixed-origin, credentialless and bound to original target',async()=>{
 let called='';const result=await readEIPublicSyncReturn(scope,'https://homebase.local','poll','first',async(input,init)=>{called=String(input);assert.equal(init?.credentials,'omit');assert.equal(init?.cache,'no-store');assert.equal(init?.redirect,'error');return new Response(JSON.stringify(value))})
 const url=new URL(called);assert.equal(url.origin,'https://homebase.local');assert.equal(url.pathname,'/EverthingFromNothing/__native/sync.json');assert.equal(url.searchParams.get('op'),'status');assert.equal(url.searchParams.get('targetRequestId'),'first');assert.equal(url.searchParams.get('address'),'device');assert.equal(result.value.applied,false)
})
test('public body reader bounds raw bytes and strictly decodes UTF8',async()=>{
 assert.equal(await readBoundedPublicText(new Response('abc'),3),'abc');await assert.rejects(readBoundedPublicText(new Response('abcd'),3));await assert.rejects(readBoundedPublicText(new Response(Uint8Array.from([255])),3))
 let cancelled=false;const stream=new ReadableStream<Uint8Array>({start(controller){controller.enqueue(new Uint8Array(100));},cancel(){cancelled=true}});await assert.rejects(readBoundedPublicText(new Response(stream),2));assert.equal(cancelled,true)
 await assert.rejects(readEIPublicSyncReturn(scope,'https://homebase.local','poll','first',async()=>new Response('x'.repeat(2_200_001))),/byte bound/)
})
test('native candidate metadata and exact manifest bytes cannot disagree',async()=>{
 const actual=await readReturned();assert.equal(actual.value.action?.candidate?.payloadSha256,returned.action.candidate.payloadSha256)
 for(const key of ['payloadBytes','recordCount','release','payloadSha256','manifestSha256']){const changed=structuredClone(returned),candidate=changed.action.candidate;candidate[key]=typeof candidate[key]==='number'?candidate[key]+1:key.endsWith('Sha256')?'0'.repeat(64):'different';await assert.rejects(readReturned(changed))}
 const extra=structuredClone(returned);extra.action.candidate.url='https://untrusted.example';await assert.rejects(readReturned(extra))
})
test('altered payload fails model admission even if carrier repeats prior hash claims',async()=>{
 const changed=structuredClone(returned);changed.action.candidate.payloadText=changed.action.candidate.payloadText.replace('Finite source-backed','Tamper source-backed');const carrier=await readReturned(changed),candidate=carrier.value.action!.candidate!
 await assert.rejects(verifyEIPublicSnapshot(readEIPublicManifest(candidate.manifestText),candidate.payloadText))
})
test('all six exact native serializer fixtures remain read-only candidates',async()=>{
 assert.equal(fixtures.length,6)
 for(const item of fixtures){const action=item.action,at={address:action?.address??'public/root',revision:action?.revision??0};const checked=validateEIPublicSyncReturn(item,item.requestId,at,action?.requestId??item.requestId);assert.equal(checked.applied,false);if(action?.candidate){const result=await readEIPublicSyncReturn(at,'https://appassets.androidplatform.net',item.requestId,action.requestId,async()=>new Response(JSON.stringify(item))),candidate=result.value.action!.candidate!,snapshot=await verifyEIPublicSnapshot(readEIPublicManifest(candidate.manifestText),candidate.payloadText);assert.equal(snapshot.records.length,137);assert.equal(snapshot.manifest.payloadSha256,candidate.payloadSha256)}}
})
