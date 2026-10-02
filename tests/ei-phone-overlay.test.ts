import test from 'node:test'
import assert from 'node:assert/strict'
import {requestEIPhoneOverlay,EI_OVERLAY_OPERATIONS} from '../src/model/ei-phone-overlay.ts'
const origin='https://appassets.androidplatform.net',scope={address:'root/a ? β',revision:2}
test('overlay operations retain exact address/revision and queued is not treated as applied',async()=>{
 for(const op of EI_OVERLAY_OPERATIONS){let called='';const fetcher=(async(url)=>{called=String(url);return new Response(JSON.stringify({schema:'field.android.overlay.v1',requestId:'r',permissionGranted:false,windowAttached:false,mode:'off',lastAction:op==='status'?null:{requestId:'r',op,...scope,state:'queued'}}))}) as typeof fetch
 const result=await requestEIPhoneOverlay(scope,origin,'r',op,fetcher);const query=new URL(called).searchParams;assert.equal(query.get('address'),scope.address);assert.equal(query.get('revision'),'2');assert.equal(result.value.windowAttached,false);assert.deepEqual(result.scope,scope)
 }
})
test('overlay wrong origin and mismatched action cannot become returned success',async()=>{
 let calls=0;await assert.rejects(requestEIPhoneOverlay(scope,'https://acidfang.github.io','r','interact',(async()=>{calls++;return new Response()}) as typeof fetch));assert.equal(calls,0)
 await assert.rejects(requestEIPhoneOverlay(scope,origin,'r','interact',(async()=>new Response(JSON.stringify({schema:'field.android.overlay.v1',requestId:'r',permissionGranted:true,windowAttached:true,mode:'interactive',lastAction:{requestId:'r',op:'interact',address:'other',revision:2,state:'applied'}}))) as typeof fetch))
})
