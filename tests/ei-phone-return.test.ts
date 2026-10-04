import test from 'node:test'
import assert from 'node:assert/strict'
import {readEIPhoneReturn,phoneReturnMatches} from '../src/model/ei-phone-return.ts'
const origin='https://appassets.androidplatform.net'
const snapshot=(id='request-1')=>({schema:'field.android.capability-snapshot.v1',requestId:id,evidenceKind:'os_api_return',observationScope:'installed_app_and_os_reported_features',hardwareAttestation:false,rawSensorCapture:false,permissionsRequestedByThisCall:false,apiLevel:35,packageName:'local.field.mechanism',elapsedRealtimeNanos:1,osReportedFeatures:[],osReportedSensorMetadata:[{measurementTaken:false}],installedManifestPermissions:[],permissionMetadataState:'returned'})
const reply=(value:unknown)=> (async()=>new Response(JSON.stringify(value))) as typeof fetch

test('phone request sends only correlation ID and retains immutable initiating address/revision',async()=>{
 const scope={address:'private/source/path',revision:4};let url='',options:RequestInit|undefined
 const fetcher=(async(input,init)=>{url=String(input);options=init;scope.address='changed';return new Response(JSON.stringify(snapshot()))}) as typeof fetch
 const result=await readEIPhoneReturn(scope,origin,'request-1',fetcher)
 assert.equal(url,`${origin}/EverthingFromNothing/__native/capabilities.json?requestId=request-1`);assert.equal(options?.credentials,'omit');assert.equal(options?.redirect,'error')
 assert.deepEqual(result.scope,{address:'private/source/path',revision:4});assert.ok(Object.isFrozen(result.scope));assert.equal(result.check.hardwareVerified,false);assert.equal(result.check.dataAccessGranted,false)
 assert.equal(phoneReturnMatches(result.scope,{address:'other',revision:4}),false);assert.equal(phoneReturnMatches(result.scope,{address:'private/source/path',revision:5}),false)
})
test('non-native origins and invalid correlation identifiers never invoke fetch',async()=>{
 let calls=0;const fetcher=(async()=>{calls++;return new Response('{}')}) as typeof fetch
 await assert.rejects(readEIPhoneReturn({address:'a',revision:0},'https://acidfang.github.io','request-1',fetcher))
 await assert.rejects(readEIPhoneReturn({address:'a',revision:0},origin,'private/a',fetcher));assert.equal(calls,0)
})
test('mismatched correlation or promoted sensor measurements reject the returned evidence',async()=>{
 await assert.rejects(readEIPhoneReturn({address:'a',revision:0},origin,'request-1',reply(snapshot('other'))))
 await assert.rejects(readEIPhoneReturn({address:'a',revision:0},origin,'request-1',reply({...snapshot(),rawSensorCapture:true})))
})
test('unavailable return stays unavailable and failed HTTP is not a receipt',async()=>{
 const result=await readEIPhoneReturn({address:'a',revision:0},origin,'request-1',reply({schema:'field.android.capability-snapshot.v1',state:'unavailable'}));assert.equal(result.check.status,'unavailable')
 await assert.rejects(readEIPhoneReturn({address:'a',revision:0},origin,'request-1',(async()=>new Response('',{status:404})) as typeof fetch))
})
