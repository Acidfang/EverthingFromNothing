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

test('named threads survive field handoff with creation provenance across revisions and replay',()=>{
 const ledger=createEILedger({records:[
  {address:'root',value:'root',source:source('root')},
  {address:'definition',value:'before',parents:['root'],source:source('origin'),relations:[
   {relation:'supports',address:'root'},{relation:'returns-to',address:'root'},
   {relation:'self',address:'definition'},{relation:'unresolved-target',address:'absent'},
  ]},
 ]})
 const execution=proposed(ledger,'after'),projection=prepareEIUnifiedTransition(ledger,execution)
 const links=projection.sourceFractures.field.edges.filter(edge=>edge.kind==='DECLARED_RELATION')
 assert.equal(links.length,4)
 assert.deepEqual(links.map(edge=>edge.relation),['supports','returns-to','self','unresolved-target'])
 assert.equal(new Set(links.map(edge=>edge.id)).size,4)
 for(const link of links){
  assert.equal(link.from,JSON.stringify(['ADDRESS','definition']))
  assert.equal(link.sourceRevision,0)
  assert.equal(link.sourceRecordId,JSON.stringify(['EI_STATE','definition',0]))
  assert.deepEqual(link.sourceRefs,[JSON.stringify(['EI_SOURCE','definition',0,'source:origin'])])
 }
 assert.equal(links[3].to,JSON.stringify(['ADDRESS','absent']));assert.equal(links[3].toKnown,false)
 assert.ok(!projection.sourceFractures.field.nodes.some(node=>node.address==='absent'))
 assert.ok(projection.sourceFractures.field.unresolved.some(item=>item.address==='absent'&&item.reason.startsWith('RELATION_ENDPOINT_NOT_RETAINED:')))
 const text=serializeEIUnifiedTransition(projection),tampered=JSON.parse(text)
 tampered.sourceFractures.field.edges=tampered.sourceFractures.field.edges.filter((edge:{kind:string})=>edge.kind!=='DECLARED_RELATION')
 assert.throws(()=>verifyEIUnifiedTransition(ledger,execution,projection,{values:execution.expected,projectionText:JSON.stringify(tampered,null,2)}),/sourceFractures/)
 const committed=commitEIUnifiedTransition(ledger,verifyEIUnifiedTransition(ledger,execution,projection,{values:execution.expected,projectionText:text}))
 assert.equal(committed.status,'committed')
 const restored=importEILedger(exportEILedger(committed.ledger))
 assert.equal(serializeEIUnifiedTransition(reconstructEIUnifiedTransition(restored,committed.receipt.id)),text)
 const next=deriveEISourceFractures(restored,proposed(restored,'later','later'))
 assert.deepEqual(next.field.edges.filter(edge=>edge.kind==='DECLARED_RELATION'),links)
 assert.ok(next.field.nodes.every(node=>node.position===null))
 assert.equal(ledger.revision,0)
})

test('named relation never silently becomes a parent, geometric direction or root return',()=>{
 const ledger=createEILedger({records:[{address:'root',value:'root',source:source('root')},{address:'definition',value:'before',source:source('before'),relations:[{relation:'points-to',address:'root'}]}]})
 const out=deriveEISourceFractures(ledger,proposed(ledger,'after'))
 const node=out.field.nodes.find(node=>node.kind==='ADDRESS'&&node.address==='definition')!
 assert.equal(out.field.threads.find(thread=>thread.nodeId===node.id)?.reachable,false)
 assert.equal(out.field.edges.filter(edge=>edge.kind==='CONTAINED_BY').length,0)
 assert.equal(out.field.gates[0].mappingResolved,false)
})

test('all public source relation occurrences reach the produced field unchanged',async()=>{
 const {createEIPublicFieldRecords}=await import('../src/model/ei-public-field.ts')
 const ledger=createEILedger({records:[{address:'root',value:'root',source:source('root'),relations:[{relation:'included-public-source',address:'model/inventory-root'}]},...createEIPublicFieldRecords(),{address:'definition',value:'before',parents:['root'],source:source('before')}]})
 const field=deriveEISourceFractures(ledger,proposed(ledger,'after')).field
 const expected=ledger.records.flatMap(record=>record.relations.map(link=>({from:JSON.stringify(['ADDRESS',record.address]),to:JSON.stringify(['ADDRESS',link.address]),relation:link.relation})))
 const actual=field.edges.filter(edge=>edge.kind==='DECLARED_RELATION').map(({from,to,relation})=>({from,to,relation}))
 assert.equal(expected.length,368)
 assert.deepEqual(actual,expected)
})

test('relation source records are immutable and malformed or duplicate incidence identities reject',async()=>{
 const {produceSourceFractures}=await import('../src/model/source-first-fracture.ts')
 const extra={mutable:true}
 const link={id:'edge:1',relation:'supplied',address:'root',sourceRef:'source:link',revision:0,extra}
 const record={id:'state:0',address:'root',sourceRef:'source:root',value:'value',relations:[link]}
 const result=produceSourceFractures({sourceAddress:'root',records:[record]}),before=JSON.stringify(result)
 assert.equal(Object.isFrozen(extra),false);assert.equal('extra' in result.sourceRecords[0].relations![0],false)
 link.address='changed';record.relations.push({...link,id:'edge:2'})
 assert.equal(JSON.stringify(result),before);assert.ok(Object.isFrozen(result.sourceRecords[0].relations![0]))
 for(const invalid of [{...link,revision:-1},{...link,revision:Infinity},{...link,sourceRef:''},{...link,address:''}])assert.throws(()=>produceSourceFractures({sourceAddress:'root',records:[{...record,relations:[invalid]}]}),/invalid addressed relation/)
 assert.throws(()=>produceSourceFractures({sourceAddress:'root',records:[{...record,relations:[link,link]}]}),/duplicate addressed relation/)
})
