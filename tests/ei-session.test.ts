import test from 'node:test'
import assert from 'node:assert/strict'
import {advanceEI,createEILedger,exportEILedger,proposeEI,verifyLocalEI} from '../src/model/ei-engine.ts'
import {EI_SESSION_LIMITS,saveEISession,restoreEISession,type EIPageAttempt} from '../src/model/ei-session.ts'
import {createEIPublicFieldRecords} from '../src/model/ei-public-field.ts'
import {prepareEIConversationTurn,executeEIConversationTurn,commitEIConversationTurn,readEIConversation} from '../src/model/ei-conversation.ts'
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
 const altered={format:'ei-page-session/v1',root:'test:root',ledger:exportEILedger(ledger),pending:null,attempts:[{...attempt,committed:true}]}
 assert.throws(()=>restoreEISession(JSON.stringify(altered)))
 const v2=JSON.parse(saveEISession('test:root',ledger,null,[attempt]));v2.root='another:root'
 assert.throws(()=>restoreEISession(JSON.stringify(v2)),/root/)
})

test('v1 remains readable and deterministic v2 rewrites preserve exact ledger, pending and attempts',()=>{
 const v1=JSON.stringify({format:'ei-page-session/v1',root:'test:root',ledger:exportEILedger(ledger),pending:proposal.input,attempts:[attempt]},null,2)
 const old=restoreEISession(v1),saved=saveEISession(old.root,old.ledger,old.pending,old.attempts),restored=restoreEISession(saved)
 assert.equal(JSON.parse(saved).format,'ei-page-session/v2')
 assert.equal(exportEILedger(restored.ledger),exportEILedger(ledger))
 assert.deepEqual(restored.pending,old.pending)
 assert.deepEqual(restored.attempts,old.attempts)
 assert.equal(saveEISession(restored.root,restored.ledger,restored.pending,restored.attempts),saved)
 assert.ok(Object.isFrozen(restored.attempts[0]))
})

test('canonical source JSON, inert noncanonical text, UTF-16 and member order round-trip exactly',()=>{
 const texts=[JSON.stringify({z:'α\ud800',a:'x'.repeat(300),nested:{second:2,first:1}}),' {"z":1,"a":"'+ 'x'.repeat(300)+'"} ', '{"escaped":"\\u0061","padding":"'+'x'.repeat(300)+'"}', '{"__proto__":{"polluted":true},"padding":"'+'x'.repeat(300)+'"}']
 for(const text of texts){
  const original=createEILedger({records:[{address:'root',value:'\ud800\u0000',source:{id:'s',text,realm:'literal',locator:text}}]})
  const restored=restoreEISession(saveEISession('root',original,null,[])).ledger
  assert.equal(exportEILedger(restored),exportEILedger(original))
  assert.equal(restored.records[0].is.source.text,text)
  assert.equal(restored.records[0].is.source.locator,text)
 }
 assert.equal(({} as {polluted?:boolean}).polluted,undefined)
})

test('optional JSON-string optimization falls back exactly for nested strings and costly unique arrays',()=>{
 let inner:unknown='x'.repeat(300);for(let i=0;i<32;i++)inner=[inner]
 let outer:unknown=JSON.stringify(inner);for(let i=0;i<32;i++)outer=[outer]
 const text=JSON.stringify(outer),original=createEILedger({records:[{address:'root',value:'v',source:{id:'s',text}}]})
 assert.equal(restoreEISession(saveEISession('root',original,null,[])).ledger.records[0].is.source.text,text)
 const detail=JSON.stringify(Array.from({length:60000},(_,i)=>i.toString(36).padStart(4,'0')))
 const saved=saveEISession('root',original,null,[{...attempt,producer:'root',detail}])
 assert.ok(new TextEncoder().encode(saved).length<EI_SESSION_LIMITS.storedBytes)
 assert.equal(restoreEISession(saved).attempts[0].detail,detail)
 assert.ok(JSON.parse(saved).values.some((node:unknown[])=>node[0]==='s'&&node[1]===detail))
 assert.ok(JSON.parse(saved).values.length<1000,'rejected speculative nodes were rolled back')
 assert.equal(saveEISession('root',original,null,[{...attempt,producer:'root',detail}]),saved)
})

function wire(values:unknown[],document=values.length-1){return JSON.stringify({format:'ei-page-session/v2',root:'test:root',stringMode:'literal',document,values})}
test('malformed tables reject forward, cyclic, dangling, fractional and negative references',()=>{
 for(const ref of [0,1,-1,0.5,'0',null])assert.throws(()=>restoreEISession(wire([['a',[ref]]])),/reference/)
 assert.throws(()=>restoreEISession(wire([['s','x'],['a',[2]],['a',[1]]])),/reference/)
 assert.throws(()=>restoreEISession(wire([['s','x']],2)),/document/)
 assert.throws(()=>restoreEISession(wire([['n',null]])),/primitive/)
 assert.throws(()=>restoreEISession(wire([['s','x','extra']])),/arity/)
 assert.throws(()=>restoreEISession(wire([['unknown',1]])),/unknown/)
 assert.throws(()=>restoreEISession(wire([['s','literal'],['j',0]])),/object or array/)
})

test('aliases preserve repeated values but unused nodes, duplicate members and prototype keys reject',()=>{
 const saved=saveEISession('test:root',ledger,null,Array.from({length:12},()=>attempt)),table=JSON.parse(saved)
 assert.equal(restoreEISession(saved).attempts.length,12)
 assert.throws(()=>restoreEISession(wire([['s','unused'],['z']])),/noncanonical/)
 assert.throws(()=>restoreEISession(wire([['z'],['z']])),/noncanonical/)
 assert.throws(()=>restoreEISession(wire([['s','same'],['z'],['o',[[0,1],[0,1]]]])),/duplicate/)
 for(const key of ['__proto__','prototype','constructor'])assert.throws(()=>restoreEISession(wire([['s',key],['z'],['o',[[0,1]]]])),/unsafe/)
 table.values.push(['s','unused']);assert.throws(()=>restoreEISession(JSON.stringify(table)),/document/)
 assert.equal(({} as {polluted?:boolean}).polluted,undefined)
})

test('stored bytes, expanded bytes/nodes, wire depth and dependency depth have explicit bounds',()=>{
 assert.throws(()=>restoreEISession(' '.repeat(EI_SESSION_LIMITS.storedBytes+1)),/1 MiB/)
 const bytesBomb:unknown[]=[['s','x'.repeat(1000)],['a',Array(2000).fill(0)],['a',[1,1,1]]]
 assert.throws(()=>restoreEISession(wire(bytesBomb)),/expanded/)
 const nodeBomb:unknown[]=[['z']];for(let i=1;i<20;i++)nodeBomb.push(['a',[i-1,i-1]])
 assert.throws(()=>restoreEISession(wire(nodeBomb)),/expanded/)
 const depth:unknown[]=[['z']];for(let i=1;i<35;i++)depth.push(['a',[i-1]])
 assert.throws(()=>restoreEISession(wire(depth)),/depth/)
 assert.throws(()=>restoreEISession('['.repeat(70)+'0'+']'.repeat(70)),/wire JSON depth/)
})

test('duplicate raw keys, malformed v1/v2 envelopes and changed codec metadata reject',()=>{
 const saved=saveEISession('test:root',ledger,null,[])
 assert.throws(()=>restoreEISession(saved.replace('{','{"format":"invalid-version",')),/duplicate raw/)
 assert.throws(()=>restoreEISession(saved.replace('{','{"\\u0066ormat":"invalid-version",')),/duplicate raw/)
 for(const raw of ['{','null','[]',JSON.stringify({format:'ei-page-session/v1',root:'test:root',ledger:{},pending:null,attempts:[]})])assert.throws(()=>restoreEISession(raw))
 for(const mutation of [(e:any)=>{e.format='future'},(e:any)=>{e.stringMode='future'},(e:any)=>{e.extra=true},(e:any)=>{delete e.root}]){
  const envelope=JSON.parse(saved);mutation(envelope);assert.throws(()=>restoreEISession(JSON.stringify(envelope)))
 }
})

test('a changed current-state reference cannot bypass committed-history replay',()=>{
 const input={id:'local-proposal/1',producer:'test:root',input:{id:'instruction',text:'change'},candidates:[{id:'edit',label:'edit',owner:'engine' as const,source:{id:'edit',text:'β'},conditions:[],patches:[{address:'test:root',value:'β',source:{id:'updated',text:'β'}}]}]}
 const committed=advanceEI(ledger,proposeEI(ledger,input));assert.equal(committed.status,'committed')
 const saved=saveEISession('test:root',committed.ledger,null,[]),envelope=JSON.parse(saved),table=envelope.values
 const field=(at:number,key:string):number=>table[at][1].find((pair:number[])=>table[pair[0]][1]===key)[1]
 const records=table[field(field(envelope.document,'ledger'),'records')][1],current=table[field(records[0],'is')]
 const valuePair=current[1].find((pair:number[])=>table[pair[0]][1]==='value')
 valuePair[1]=table.findIndex((node:unknown[])=>node[0]==='s'&&node[1]==='α\n\u0000')
 assert.throws(()=>restoreEISession(JSON.stringify(envelope)))
 assert.equal(restoreEISession(saved).ledger.records[0].is.value,'β')
})

test('fifty raw capture-only turns with the public seed fit 1MiB and replay every user source and receipt',async()=>{
 const publicRecords=createEIPublicFieldRecords()
 let current=createEILedger({records:[{address:'EI/SOURCE',value:'Hello',source:{id:'local-input/1',text:'Hello',realm:'user-supplied-local-input'}},...publicRecords]})
 const inputs:string[]=[]
 for(let index=1;index<=50;index++){
  const input=`${index===1?'bind "model definition" to read "model/zero"':'model definition'}\nRaw captured turn ${index}: ${'raw α '.repeat(700)}`
  inputs.push(input)
  const turn=await prepareEIConversationTurn({ledger:current,root:'EI/SOURCE',input,id:`local-proposal/${index+1}`})
  assert.equal(turn.status,'proposed');if(turn.status!=='proposed')assert.fail(turn.reason)
  assert.equal(turn.mode,'capture-only');assert.equal(turn.reply,null)
  assert.equal(turn.user.text,input);assert.equal(turn.user.source.text,input)
  assert.equal(turn.proposal.input.candidates[0].patches.length,1)
  const staged=executeEIConversationTurn(current,turn);assert.equal(staged.status,'staged');if(staged.status!=='staged')assert.fail('did not stage')
  assert.deepEqual(staged.expected,[{address:turn.user.address,value:input}])
  const result=commitEIConversationTurn(current,turn,verifyLocalEI(staged));assert.equal(result.status,'committed');if(result.status!=='committed')assert.fail('did not commit')
  current=result.ledger
 }
 const saved=saveEISession('EI/SOURCE',current,null,[attempt]),recovered=restoreEISession(saved)
 assert.ok(new TextEncoder().encode(saved).length<EI_SESSION_LIMITS.storedBytes)
 assert.ok(new TextEncoder().encode(exportEILedger(current)).length>1_048_576)
 assert.equal(recovered.ledger.revision,50);assert.equal(recovered.ledger.records.length,188)
 const messages=readEIConversation(recovered.ledger,'EI/SOURCE').turns
 assert.equal(messages.length,50);assert.deepEqual(messages.map(message=>message.text),inputs)
 assert.ok(messages.every(message=>message.role==='user'&&message.status==='capture-only'&&message.source.text===message.text&&message.evidence===undefined))
 assert.ok(recovered.ledger.receipts.every((receipt,index)=>receipt.patches.length===1&&receipt.patches[0].value===inputs[index]))
 assert.equal(recovered.ledger.records.some(record=>record.is.source.realm==='ei-conversation-reply'),false)
 assert.equal(exportEILedger(recovered.ledger),exportEILedger(current))
 assert.deepEqual(recovered.attempts,[attempt]);assert.equal(recovered.nextSequence,52)
 for(const record of publicRecords)assert.equal(recovered.ledger.records.find(r=>r.address===record.address)!.is.source.text,record.source.text)
 assert.equal(saveEISession(recovered.root,recovered.ledger,null,recovered.attempts),saved)
})
test('save and restore enforce the same attempt-history boundary',()=>{
 const maximum=Array.from({length:512},()=>attempt)
 assert.equal(restoreEISession(saveEISession('test:root',ledger,null,maximum)).attempts.length,512)
 assert.throws(()=>saveEISession('test:root',ledger,null,[...maximum,attempt]))
 assert.throws(()=>saveEISession('test:root',ledger,null,[{...attempt,message:'x'.repeat(8193)}]))
 assert.throws(()=>saveEISession('test:root',ledger,null,[{...attempt,transactionId:'local-proposal/9007199254740992'}]))
})
