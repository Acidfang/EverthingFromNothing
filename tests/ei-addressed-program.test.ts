import test from 'node:test'
import assert from 'node:assert/strict'
import {createEILedger,exportEILedger,advanceEI,proposeEI,executeEI,chooseEI,commitEI,verifyEI,verifyLocalEI} from '../src/model/ei-engine.ts'
import {createEIPublicFieldRecords} from '../src/model/ei-public-field.ts'
import {createEIGrainRegistry,projectEIGrain,EI_GRAINS} from '../src/model/ei-grain-identity.ts'
import {compileEIAddressedProgram,proposeEIAddressedDerivation} from '../src/model/ei-addressed-program.ts'

test('all five grains compile the same retained public program without a commit',()=>{
 const ledger=createEILedger({records:createEIPublicFieldRecords()}),before=exportEILedger(ledger),registry=createEIGrainRegistry(ledger)
 let expected=''
 for(const grain of EI_GRAINS){
  const result=compileEIAddressedProgram(ledger,[projectEIGrain(registry,'model/inventory-root',grain)])
  assert.equal(result.compilation.asts[0].clauses.length,93)
  assert.equal(result.compilation.opaqueClauses.length,86)
  assert.equal(result.compilation.evaluations.length,10)
  assert.equal(result.compilation.executionAuthority,false)
  const raw=JSON.stringify(result);if(expected)assert.equal(raw,expected);else expected=raw
 }
 assert.equal(exportEILedger(ledger),before)
})

test('retained WAS can be inspected while newer source and its proof remain separate',()=>{
 const text='a≡b;≡→⋈',source={id:'first',text},old=createEILedger({records:[{address:'root',value:text,source}]})
 const nextSource={id:'next',text:'a≠b;≡→⋈'}
 const next=advanceEI(old,proposeEI(old,{id:'change',producer:'root',input:nextSource,candidates:[{id:'one',label:'change',owner:'engine',source:nextSource,conditions:[],patches:[{address:'root',value:nextSource.text,source:nextSource}]}]})).ledger
 const registry=createEIGrainRegistry(next),was=compileEIAddressedProgram(next,[projectEIGrain(registry,'root','state',0)]),is=compileEIAddressedProgram(next,[projectEIGrain(registry,'root','node')])
 assert.equal(was.origins[0].role,'WAS');assert.equal(was.compilation.evaluations[0].result.proofs.length,1)
 assert.equal(is.origins[0].role,'IS');assert.equal(is.compilation.evaluations[0].result.proofs.length,0)
 assert.throws(()=>compileEIAddressedProgram(next,[projectEIGrain(createEIGrainRegistry(old),'root','state')]),/stale/)
})

test('same text across selected sources does not automatically create a shared scope',()=>{
 const ledger=createEILedger({records:[{address:'rule',value:'≡→⋈',source:{id:'r',text:'≡→⋈'}},{address:'premise',value:'a≡b',source:{id:'p',text:'a≡b'}}]}),registry=createEIGrainRegistry(ledger)
 const result=compileEIAddressedProgram(ledger,['rule','premise'].map(address=>projectEIGrain(registry,address,'address')))
 assert.equal(result.compilation.evaluations.flatMap(e=>e.result.proofs).length,0)
 assert.equal(result.compilation.programScope,undefined)
})

test('grain duplicates share one program while unreturned NEXT cannot supply premises',()=>{
 const source={id:'before',text:'a≡b;≡→⋈'},ledger=createEILedger({records:[{address:'root',value:source.text,source}]}),registry=createEIGrainRegistry(ledger)
 const result=compileEIAddressedProgram(ledger,EI_GRAINS.map(grain=>projectEIGrain(registry,'root',grain)))
 assert.equal(result.origins.length,1);assert.equal(result.compilation.evaluations.length,1)
 const next={id:'next',text:'a≠b;≡→⋈'},execution=executeEI(ledger,proposeEI(ledger,{id:'proposal',producer:'root',input:next,candidates:[{id:'one',label:'change',owner:'engine',source:next,conditions:[],patches:[{address:'root',value:next.text,source:next}]}]}))
 assert.equal(execution.status,'staged');if(execution.status!=='staged')throw new Error('fixture did not stage')
 const proposed=projectEIGrain(createEIGrainRegistry(ledger,execution),'root','node',1)
 assert.throws(()=>compileEIAddressedProgram(ledger,[proposed]),/not a retained program/)
 assert.equal(ledger.receipts.length,0)
})

test('derived output requires explicit selection and returned result; repeated retention is idempotent',async()=>{
 const source={id:'source',text:'a≡b;≡→⋈'},ledger=createEILedger({records:[{address:'root',value:source.text,source}]}),handle=projectEIGrain(createEIGrainRegistry(ledger),'root','node')
 const proposal=await proposeEIAddressedDerivation(ledger,[handle],0,'derive')
 assert.ok(proposal)
 assert.notEqual(executeEI(ledger,proposal).status,'staged')
 const execution=executeEI(ledger,proposal,chooseEI(proposal,'retain-derived-relation'))
 assert.equal(execution.status,'staged');if(execution.status!=='staged')throw new Error('fixture did not stage')
 const failed=commitEI(ledger,verifyEI(execution,{kind:'rendered-address-values',values:[]}))
 assert.equal(failed.status,'rejected');assert.equal(failed.ledger,ledger)
 const result=commitEI(ledger,verifyLocalEI(execution))
 assert.equal(result.status,'committed');assert.equal(result.ledger.receipts.length,1)
 const output=result.ledger.records.find(record=>record.address.startsWith('derived/'))!
 assert.deepEqual(output.parents,['root']);assert.equal(output.is.value,'a⋈b');assert.equal(JSON.parse(output.is.source.text).proofs[0].conclusion.operator,'⋈')
 assert.equal(JSON.parse(output.is.source.text).executionAuthority,false)
 assert.equal(await proposeEIAddressedDerivation(result.ledger,[projectEIGrain(createEIGrainRegistry(result.ledger),'root','pixel')],0,'again'),null)
})

test('unknown and conflicting comparisons cannot manufacture an executable consequence',async()=>{
 for(const text of ['a≠b;≡→⋈','a≡b;a≠b;≡→⋈']){
  const ledger=createEILedger({records:[{address:'root',value:text,source:{id:'source',text}}]}),handle=projectEIGrain(createEIGrainRegistry(ledger),'root','state')
  await assert.rejects(proposeEIAddressedDerivation(ledger,[handle],0,'none'),/no unopposed/)
  assert.equal(ledger.receipts.length,0)
 }
})
