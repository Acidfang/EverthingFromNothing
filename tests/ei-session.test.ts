import test from 'node:test'
import assert from 'node:assert/strict'
import {createEILedger,proposeEI} from '../src/model/ei-engine.ts'
import {saveEISession,restoreEISession,type EIPageAttempt} from '../src/model/ei-session.ts'
const ledger=createEILedger({records:[{address:'test:root',value:'α\n\u0000',source:{id:'test:input',text:'α\n\u0000'}}]})
const proposal=proposeEI(ledger,{id:'local-proposal/19',producer:'test:root',input:{id:'test:instruction',text:'change'},candidates:[{id:'test:choice',label:'choice',owner:'user',source:{id:'test:choice-source',text:'β'},conditions:[{address:'test:root',equals:'α\n\u0000'}],patches:[{address:'test:root',value:'β',source:{id:'test:value',text:'β'}}]}]})
const attempt:EIPageAttempt={transactionId:'local-proposal/23',producer:'test:root',phase:'storage',message:'synthetic rejected write',detail:'No current state changed',committed:false}
test('session recovery retains exact source, pending choices and failed attempts',()=>{
 const restored=restoreEISession(saveEISession('test:root',ledger,proposal,[attempt]))
 assert.equal(restored.ledger.records[0].is.value,'α\n\u0000');assert.equal(restored.pending?.input.id,'local-proposal/19')
 assert.deepEqual(restored.attempts,[attempt]);assert.equal(restored.nextSequence,24)
})
test('durable cancellation can remove pending proposal without changing IS',()=>{
 const restored=restoreEISession(saveEISession('test:root',ledger,null,[attempt]))
 assert.equal(restored.pending,null);assert.equal(restored.ledger.revision,0);assert.deepEqual(restored.attempts,[attempt])
})
test('another root or asserted committed failure is rejected',()=>{
 assert.throws(()=>saveEISession('different',ledger,null,[]))
 const altered=JSON.parse(saveEISession('test:root',ledger,null,[attempt]));altered.attempts[0].committed=true
 assert.throws(()=>restoreEISession(JSON.stringify(altered)))
})
test('save and restore enforce the same attempt-history boundary',()=>{
 const maximum=Array.from({length:512},()=>attempt)
 assert.equal(restoreEISession(saveEISession('test:root',ledger,null,maximum)).attempts.length,512)
 assert.throws(()=>saveEISession('test:root',ledger,null,[...maximum,attempt]))
 assert.throws(()=>saveEISession('test:root',ledger,null,[{...attempt,message:'x'.repeat(8193)}]))
 assert.throws(()=>saveEISession('test:root',ledger,null,[{...attempt,transactionId:'local-proposal/9007199254740992'}]))
})
