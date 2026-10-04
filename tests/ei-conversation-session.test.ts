import test from 'node:test'
import assert from 'node:assert/strict'
import {createEILedger,executeEI,verifyEI,commitEI} from '../src/model/ei-engine.ts'
import {prepareEIConversationTurn,readEIConversation} from '../src/model/ei-conversation.ts'
import {saveEISession,restoreEISession} from '../src/model/ei-session.ts'
const seed=()=>createEILedger({records:[{address:'chat/root',value:'First exact source α',source:{id:'seed',text:'First exact source α'}}]})
test('pending capture recovers from the session envelope and commits exactly one user source',async()=>{
 const ledger=seed()
 const turn=await prepareEIConversationTurn({ledger,root:'chat/root',input:'what did I say before?',id:'local-proposal/2'})
 assert.equal(turn.status,'proposed');if(turn.status!=='proposed')return
 assert.equal(turn.mode,'capture-only');assert.equal(turn.reply,null)
 assert.equal(turn.proposal.input.candidates[0].patches.length,1)
 const restored=restoreEISession(saveEISession('chat/root',ledger,turn.proposal,[]))
 assert.equal(readEIConversation(restored.ledger,restored.root).turns.length,0)
 const staged=executeEI(restored.ledger,restored.pending!)
 assert.equal(staged.status,'staged');if(staged.status!=='staged')return
 const result=commitEI(restored.ledger,verifyEI(staged,{kind:'rendered-address-values',values:staged.expected}))
 assert.equal(result.status,'committed')
 const recovered=restoreEISession(saveEISession(restored.root,result.ledger,null,[]))
 const messages=readEIConversation(recovered.ledger,recovered.root).turns
 assert.equal(messages.length,1)
 assert.equal(messages[0].text,'what did I say before?')
 assert.equal(messages[0].source.text,'what did I say before?')
 assert.equal(messages[0].role,'user');assert.equal(messages[0].status,'capture-only')
 assert.equal(messages[0].evidence,undefined)
 assert.equal(recovered.ledger.records.some(record=>record.is.source.realm==='ei-conversation-reply'),false)
 assert.equal(recovered.ledger.receipts.length,1)
 assert.equal(recovered.ledger.receipts[0].patches.length,1)
 assert.deepEqual(readEIConversation(result.ledger,'chat/root'),readEIConversation(recovered.ledger,recovered.root))
})
test('missing or wrong synthetic readback rejects capture while its pending source remains recoverable',async()=>{
 const ledger=seed(),turn=await prepareEIConversationTurn({ledger,root:'chat/root',input:'Unresolved phrase β',id:'local-proposal/2'})
 if(turn.status!=='proposed')throw new Error(turn.reason)
 const staged=executeEI(ledger,turn.proposal);if(staged.status!=='staged')throw new Error('not staged')
 assert.equal(turn.reply,null);assert.equal(staged.expected.length,1)
 for(const values of [[],[{address:staged.expected[0].address,value:'different text'}]]){
  const result=commitEI(ledger,verifyEI(staged,{kind:'rendered-address-values',values}))
  assert.equal(result.status,'rejected')
  assert.equal(readEIConversation(result.ledger,'chat/root').turns.length,0)
  assert.equal(result.ledger,ledger)
 }
 const restored=restoreEISession(saveEISession('chat/root',ledger,turn.proposal,[]))
 assert.equal(restored.pending?.input.input.text,'Unresolved phrase β')
})
test('overlong first message fails preflight without altering source ledger',async()=>{
 const ledger=seed()
 await assert.rejects(prepareEIConversationTurn({ledger,root:'chat/root',input:'x'.repeat(8193),id:'local-proposal/2'}))
 assert.equal(ledger.revision,0);assert.equal(ledger.records.length,1)
})
