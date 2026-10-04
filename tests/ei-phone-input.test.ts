import test from 'node:test'
import assert from 'node:assert/strict'
import {readEIPhoneInputs,phoneInputLocator,phoneInputAdmissionError} from '../src/model/ei-phone-input.ts'
import {createHash} from 'node:crypto'
import {createEILedger,advanceEI,exportEILedger,importEILedger} from '../src/model/ei-engine.ts'
import {prepareEIConversationTurn,readEIConversation} from '../src/model/ei-conversation.ts'
const origin='https://appassets.androidplatform.net'
const item=(text='  🌌\n exact  ',id='native-1')=>({id,channel:'share',mime:'text/plain',text,utf8Sha256:createHash('sha256').update(text).digest('hex'),readOnly:true,source:{kind:'android-explicit-intent'}})
const fetcher=(inputs:unknown[],requestId='r')=>(async()=>new Response(JSON.stringify({schema:'field.android.user-input.v1',requestId,inputs,rejections:[]}))) as typeof fetch

test('native input retains exact UTF8 bytes, source and distinct equal-text occurrences',async()=>{
 const result=await readEIPhoneInputs(origin,'r',fetcher([item(),item(undefined,'native-2')]))
 assert.equal(result.inputs[0].text,'  🌌\n exact  ');assert.equal(result.inputs.length,2);assert.ok(Object.isFrozen(result.inputs[0].source))
})
test('native input refuses mismatched digest, duplicate identities, MIME, correlation and oversized bytes',async()=>{
 for(const inputs of [[{...item(),utf8Sha256:'bad'}],[item(),item()],[{...item(),mime:'text/html'}],[item('x'.repeat(65537))]])await assert.rejects(readEIPhoneInputs(origin,'r',fetcher(inputs)))
 await assert.rejects(readEIPhoneInputs(origin,'r',fetcher([item()],'wrong')))
 let calls=0;await assert.rejects(readEIPhoneInputs('https://acidfang.github.io','r',(async()=>{calls++;return new Response()}) as typeof fetch));assert.equal(calls,0)
})
test('explicitly retained phone-origin input stays a proposal and keeps exact source provenance',async()=>{
 const source=item('raw shared input'),ledger=createEILedger({records:[{address:'root',value:'root',source:{id:'root-source',text:'root'}}]})
 const result=await prepareEIConversationTurn({ledger,root:'root',input:source.text,id:'turn',inputOrigin:{id:source.id,locator:JSON.stringify(source),text:source.text}})
 assert.equal(result.status,'proposed');if(result.status!=='proposed')return
 assert.equal(result.reply,null);assert.equal(ledger.records.length,1);assert.deepEqual(JSON.parse(result.user.source.locator!).inputOrigin,{id:source.id,locator:JSON.stringify(source)})
})

test('native origin survives commit/reload separately from edited input and rejects duplicate intake',async()=>{
 const source=item('original'),ledger=createEILedger({records:[{address:'root',value:'root',source:{id:'root-source',text:'root'}}]})
 const inputOrigin={id:source.id,text:source.text,locator:phoneInputLocator(source)}
 const prepared=await prepareEIConversationTurn({ledger,root:'root',input:'user edit',id:'turn',inputOrigin});assert.equal(prepared.status,'proposed');if(prepared.status!=='proposed')return
 const committed=advanceEI(ledger,prepared.proposal);assert.equal(committed.status,'committed')
 const recovered=importEILedger(exportEILedger(committed.ledger));assert.equal(readEIConversation(recovered,'root').turns[0].text,'user edit');assert.equal(recovered.records.find(r=>r.address.endsWith('/source'))!.is.value,'original')
 await assert.rejects(prepareEIConversationTurn({ledger:recovered,root:'root',input:'again',id:'next',inputOrigin}),/already retained/)
})
test('maximum quote input avoids nested source-text escaping and larger intake remains unadmitted',async()=>{
 const source=item('"'.repeat(8192)),ledger=createEILedger({records:[{address:'root',value:'root',source:{id:'root-source',text:'root'}}]})
 assert.equal(phoneInputAdmissionError(source as any),null)
 const prepared=await prepareEIConversationTurn({ledger,root:'root',input:source.text,id:'turn',inputOrigin:{id:source.id,text:source.text,locator:phoneInputLocator(source as any)}});assert.equal(prepared.status,'proposed')
 assert.ok(phoneInputAdmissionError(item('x'.repeat(8193)) as any))
})

test('acknowledgment requires receipt correlation and retains a rejected native source',async()=>{
 const {acknowledgeEIPhoneInput}=await import('../src/model/ei-phone-input.ts'),input={id:'native-1',utf8Sha256:item().utf8Sha256,receiptId:'actual/receipt'}
 let url='';const fetcher=(async(at)=>{url=String(at);return new Response(JSON.stringify({schema:'field.android.input-ack.v1',requestId:'r',inputId:input.id,receiptId:input.receiptId,status:'invalid'}))}) as typeof fetch
 assert.equal((await acknowledgeEIPhoneInput(origin,'r',input,fetcher)).status,'invalid');assert.equal(new URL(url).searchParams.get('receiptId'),input.receiptId)
 await assert.rejects(acknowledgeEIPhoneInput(origin,'r',{...input,receiptId:''},fetcher))
})

test('explicit discard is correlated and never changes the supplied source',async()=>{
 const {discardEIPhoneInput}=await import('../src/model/ei-phone-input.ts'),source=item(),before=JSON.stringify(source)
 const result=await discardEIPhoneInput(origin,'r',source,(async()=>new Response(JSON.stringify({schema:'field.android.input-discard.v1',requestId:'r',inputId:source.id,status:'discarded'}))) as typeof fetch)
 assert.equal(result.status,'discarded');assert.equal(JSON.stringify(source),before)
 await assert.rejects(discardEIPhoneInput(origin,'r',source,(async()=>new Response(JSON.stringify({schema:'field.android.input-discard.v1',requestId:'wrong',inputId:source.id,status:'discarded'}))) as typeof fetch))
})
