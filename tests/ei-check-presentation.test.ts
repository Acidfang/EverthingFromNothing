import test from 'node:test'
import assert from 'node:assert/strict'
import {presentEICheck} from '../src/model/ei-check-presentation.ts'
import {createEILedger} from '../src/model/ei-engine.ts'
import {verifyEIConversationProjection} from '../src/model/ei-conversation.ts'

test('actual check retains its receipt note while optional presentation omits boilerplate and preserves failures',async()=>{
 const ledger=createEILedger({records:[{address:'root',value:'retained input',source:{id:'source',text:'retained input'}}]})
 const check=await verifyEIConversationProjection(ledger,'root','what did I say before?',{text:'wrong answer',status:'command-return',sourceRefs:['root']})
 const before=JSON.stringify(check),view=presentEICheck(check)
 assert.equal(view.status,'failed');assert.deepEqual(view.checks,check.checks)
 assert.ok(check.note.includes('Checks consistency of declared text projection'))
 assert.equal(Object.hasOwn(view,'note'),false)
 assert.equal(JSON.stringify(check),before)
 assert.equal(JSON.stringify(view).includes('This does not verify world truth'),false)
})
test('unresolved reasons and fingerprints remain inspectable without replacing reply text',()=>{
 const check={status:'unresolved',reason:'Source record missing',actualFingerprint:null}
 assert.deepEqual(presentEICheck(check),check)
 const userQuote={status:'failed',reason:'User quoted: This does not verify world truth',note:'generic extra prose'}
 assert.equal(presentEICheck(userQuote).reason,userQuote.reason)
})
