import test from 'node:test'
import assert from 'node:assert/strict'
import {createEILedger,proposeEI,executeEI,advanceEI,exportEILedger,importEILedger,type EIExecution} from '../src/model/ei-engine.ts'
import {deriveEISourceFractures} from '../src/model/ei-source-fractures.ts'
import {prepareEIConversationTurn} from '../src/model/ei-conversation.ts'
import {prepareEIUnifiedTransition,serializeEIUnifiedTransition,verifyEIUnifiedTransition,commitEIUnifiedTransition,reconstructEIUnifiedTransition} from '../src/model/ei-unified-transition.ts'

const source=(text:string)=>({id:`source:${text}`,text,realm:'synthetic-test'})
function initial(){return createEILedger({records:[{address:'root',value:'question',source:source('question')},{address:'other-parent',value:'support',parents:['root'],source:source('support')},{address:'definition',value:'before',parents:['root','other-parent'],source:source('before')}]})}
function proposed(ledger:ReturnType<typeof initial>,value:string,id='change'){
 const proposal=proposeEI(ledger,{id,producer:'root',input:source(value),candidates:[{id:`${id}/choice`,label:'Supplied correction',owner:'engine',source:source(value),conditions:[],patches:[{address:'definition',value,source:source(value)}]}]})
 const execution=executeEI(ledger,proposal);assert.equal(execution.status,'staged');return execution as EIExecution
}
test('actual retained-to-staged text Difference produces one proposed fracture and preserves both parents',()=>{
 const ledger=initial(),execution=proposed(ledger,'after'),out=deriveEISourceFractures(ledger,execution)
 assert.equal(out.field.differences.length,1);assert.equal(out.differences[0].phase,'PROPOSED')
 assert.equal(out.field.gates.length,1);assert.equal(out.field.gates[0].moment,null)
 const addressNode=out.field.nodes.find(node=>node.kind==='ADDRESS'&&node.address==='definition')!
 assert.equal(out.field.edges.filter(edge=>edge.from===addressNode.id&&edge.kind==='CONTAINED_BY').length,2)
 assert.ok(out.field.nodes.every(node=>node.position===null));assert.equal(ledger.revision,0)
})
test('equal text and new conversation addresses do not invent fractures against absent baselines',async()=>{
 const ledger=initial();assert.equal(deriveEISourceFractures(ledger,proposed(ledger,'before')).field.differences.length,0)
 const turn=await prepareEIConversationTurn({ledger,root:'root',input:'read "definition"',id:'chat'})
 assert.equal(turn.status,'proposed');if(turn.status!=='proposed')return
 const execution=executeEI(ledger,turn.proposal);assert.equal(execution.status,'staged');if(execution.status!=='staged')return
 const out=deriveEISourceFractures(ledger,execution)
 assert.equal(out.field.differences.length,0)
 assert.ok(out.bindings.some(binding=>binding.address===turn.user.address&&binding.phase==='PROPOSED'))
})
test('source producer participates in shared readback and exact receipt reconstruction',()=>{
 const ledger=initial(),execution=proposed(ledger,'after'),projection=prepareEIUnifiedTransition(ledger,execution)
 const text=serializeEIUnifiedTransition(projection),tampered=JSON.parse(text);tampered.sourceFractures.field.differences=[]
 assert.throws(()=>verifyEIUnifiedTransition(ledger,execution,projection,{values:execution.expected,projectionText:JSON.stringify(tampered,null,2)}),/sourceFractures/)
 const result=commitEIUnifiedTransition(ledger,verifyEIUnifiedTransition(ledger,execution,projection,{values:execution.expected,projectionText:text}))
 assert.equal(result.status,'committed')
 const restored=importEILedger(exportEILedger(result.ledger))
 assert.equal(serializeEIUnifiedTransition(reconstructEIUnifiedTransition(restored,result.receipt.id)),text)
 const next=deriveEISourceFractures(restored,proposed(restored,'later','later'))
 assert.deepEqual(next.differences.map(item=>item.phase),['RETAINED','PROPOSED'])
})
test('stale source or forged execution cannot populate a fracture map',()=>{
 const ledger=initial(),execution=proposed(ledger,'after')
 assert.throws(()=>deriveEISourceFractures(ledger,{...execution}),/execution/)
 const result=advanceEI(ledger,execution.proposal)
 assert.equal(result.status,'committed');assert.throws(()=>deriveEISourceFractures(result.ledger,execution),/snapshot/)
})

test('an explicit correction of a retained conversation message produces its own sourced fracture',async()=>{
 const ledger=initial(),turn=await prepareEIConversationTurn({ledger,root:'root',input:'read "definition"',id:'conversation'})
 assert.equal(turn.status,'proposed');if(turn.status!=='proposed')return
 const captured=advanceEI(ledger,turn.proposal);assert.equal(captured.status,'committed')
 const proposal=proposeEI(captured.ledger,{id:'correction',producer:'root',input:source('Explicit message correction'),candidates:[{id:'correction/selected',label:'Correct the retained input',owner:'engine',source:source('Explicit message correction'),conditions:[{address:turn.user.address,equals:'read "definition"'}],patches:[{address:turn.user.address,value:'trace "definition"',source:source('trace "definition"')}]}]})
 const execution=executeEI(captured.ledger,proposal);assert.equal(execution.status,'staged');if(execution.status!=='staged')return
 const out=deriveEISourceFractures(captured.ledger,execution)
 assert.equal(out.field.differences.length,1);assert.equal(out.field.differences[0].address,turn.user.address)
 const gate=out.field.gates[0]
 assert.equal(out.bindings.find(binding=>binding.recordId===gate.wasRecordId)?.receiptId,captured.receipt.id)
 assert.equal(out.bindings.find(binding=>binding.recordId===gate.isRecordId)?.phase,'PROPOSED')
 assert.equal(captured.ledger.records.find(record=>record.address===turn.user.address)?.is.value,'read "definition"')
})
