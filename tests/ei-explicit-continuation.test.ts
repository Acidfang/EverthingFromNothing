import test from 'node:test'
import assert from 'node:assert/strict'
import {createEILedger,executeEI,chooseEI,verifyEI,commitEI,exportEILedger} from '../src/model/ei-engine.ts'
import {createEIGrainRegistry,projectEIGrain,EI_GRAINS} from '../src/model/ei-grain-identity.ts'
import {proposeEIExplicitContinuation} from '../src/model/ei-explicit-continuation.ts'

function setup(){return createEILedger({records:[{address:'root',value:'0',source:{id:'seed',text:'0'}},{address:'condition',value:'1',source:{id:'condition-seed',text:'1'},parents:['root']}]})}
test('independently supplied binary conditions distinguish alternatives through every grain',()=>{
 for(const grain of EI_GRAINS){
  const ledger=setup(),before=exportEILedger(ledger)
  const proposal=proposeEIExplicitContinuation(ledger,{id:'operation',producer:projectEIGrain(createEIGrainRegistry(ledger),'root',grain),target:'root',choices:[{value:'left',conditions:[{address:'condition',equals:'0'}]},{value:'right',conditions:[{address:'condition',equals:'1'}]}],owner:'user',createChild:false})
  assert.deepEqual(proposal.candidates.map(item=>item.allowed),[false,true])
  assert.equal(proposal.status,'selection-required')
  assert.equal(executeEI(ledger,proposal).status,'blocked')
  const staged=executeEI(ledger,proposal,chooseEI(proposal,'operation/candidate/1'))
  assert.equal(staged.status,'staged');if(staged.status!=='staged')throw Error('expected staged')
  const rejected=commitEI(ledger,verifyEI(staged,{kind:'rendered-address-values',values:[{address:'root',value:'wrong'}]}))
  assert.equal(rejected.status,'rejected');assert.equal(exportEILedger(rejected.ledger),before)
  const result=commitEI(ledger,verifyEI(staged,{kind:'rendered-address-values',values:[{address:'root',value:'right'}]}))
  assert.equal(result.status,'committed');assert.equal(result.ledger.records[0].is.value,'right')
  assert.equal(result.ledger.records[0].was[0].value,'0')
  assert.deepEqual(result.receipt.candidates[1].candidate.conditions,[{address:'condition',equals:'1'}])
 }
})
test('unknown condition remains open and cannot become a fabricated mismatch',()=>{
 const ledger=setup(),proposal=proposeEIExplicitContinuation(ledger,{id:'operation',producer:projectEIGrain(createEIGrainRegistry(ledger),'root','state'),target:'root',choices:[{value:'next',conditions:[{address:'unsupplied',equals:'1'}]}],owner:'engine',createChild:false})
 assert.equal(proposal.status,'unresolved');assert.equal(proposal.candidates[0].unresolved,true);assert.equal(executeEI(ledger,proposal).status,'blocked')
})
test('absence of supplied conditions stays empty and does not invent current-value evidence',()=>{
 const ledger=setup(),proposal=proposeEIExplicitContinuation(ledger,{id:'operation',producer:projectEIGrain(createEIGrainRegistry(ledger),'root','state'),target:'root',choices:[{value:'next',conditions:[]}],owner:'user',createChild:false})
 assert.deepEqual(proposal.candidates[0].candidate.conditions,[]);assert.equal(proposal.status,'selection-required')
})

test('individually valid source and condition values do not acquire a duplicate aggregate text bound',()=>{
 const long='x'.repeat(32768),ledger=createEILedger({records:[{address:'root',value:long,source:{id:'seed',text:long}}]})
 const proposal=proposeEIExplicitContinuation(ledger,{id:'long',producer:projectEIGrain(createEIGrainRegistry(ledger),'root','state'),target:'root',choices:[{value:'next',conditions:[{address:'root',equals:long}]}],owner:'user',createChild:false})
 assert.equal(proposal.status,'selection-required');assert.equal(proposal.candidates[0].candidate.conditions[0].equals,long)
 assert.equal(proposal.input.input.text,'next')
})
