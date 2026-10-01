import test from 'node:test'
import assert from 'node:assert/strict'
import {createEILedger,exportEILedger,proposeEI,advanceEI} from '../src/model/ei-engine.ts'
import {createEIPublicFieldRecords} from '../src/model/ei-public-field.ts'
import {createEIGrainRegistry,projectEIGrain,EI_GRAINS} from '../src/model/ei-grain-identity.ts'
import {inspectEIComparisonClauses,resolveEIAuthoredComparison,verifyEIAuthoredComparison,resolveEIAuthoredComparisonBatch,verifyEIAuthoredComparisonBatch,expandEIAuthoredComparisonBatchResult} from '../src/model/ei-authored-comparison.ts'
import {AUTHORED_COMPARE_CLAUSE} from '../src/model/source-bound-comparison.ts'

test('actual page source derives witnessed join and Difference through the same five grain identities',()=>{
 const ledger=createEILedger({records:createEIPublicFieldRecords()}),before=exportEILedger(ledger),registry=createEIGrainRegistry(ledger)
 let baseline=''
 for(const grain of EI_GRAINS){
  const handle=projectEIGrain(registry,'model/inventory-root',grain),clauses=inspectEIComparisonClauses(ledger,handle)
  assert.equal(clauses.rules.length,1)
  const joined=resolveEIAuthoredComparison(ledger,handle,'U','R'),different=resolveEIAuthoredComparison(ledger,handle,'T₀','T∞')
  assert.equal(joined.result.status,'known-identity');assert.equal(different.result.status,'known-difference')
  assert.equal(joined.result.proofs[0].premise.source.exact,'U≡R')
  assert.ok(joined.result.proofs[0].premise.source.pointer?.startsWith('/inventory_statements/retained_binary_relations/'))
  const serialized=JSON.stringify(joined);if(baseline)assert.equal(serialized,baseline);else baseline=serialized
  assert.equal(resolveEIAuthoredComparison(ledger,handle,'U₀','R').result.status,'unresolved')
 }
 assert.equal(exportEILedger(ledger),before)
})

test('explicit source clauses resolve arbitrary supplied terms without canned names or prose dispatch',()=>{
 const text=`  cobalt≡ochre ; ${AUTHORED_COMPARE_CLAUSE} `
 const ledger=createEILedger({records:[{address:'source',value:text,source:{id:'synthetic-source',text}}]})
 const handle=projectEIGrain(createEIGrainRegistry(ledger),'source','node')
 const result=resolveEIAuthoredComparison(ledger,handle,'cobalt','ochre')
 assert.equal(result.result.status,'known-identity')
 assert.deepEqual(result.result.proofs[0].conclusion,{kind:'relation',operator:'⋈',left:'cobalt',right:'ochre'})
 assert.equal(resolveEIAuthoredComparison(ledger,handle,'cobalt','cobalt').result.status,'unresolved')
 assert.equal(resolveEIAuthoredComparison(ledger,handle,'ochre','cobalt').result.status,'unresolved')
})

test('source correction invalidates prior handles and reconstructs consequences from current clauses',()=>{
 const text=`a≡b;${AUTHORED_COMPARE_CLAUSE}`,ledger=createEILedger({records:[{address:'source',value:text,source:{id:'before',text}}]})
 const handle=projectEIGrain(createEIGrainRegistry(ledger),'source','state')
 const after=`a≠b;${AUTHORED_COMPARE_CLAUSE}`,source={id:'correction',text:after}
 const next=advanceEI(ledger,proposeEI(ledger,{id:'edit',producer:'source',input:source,candidates:[{id:'one',label:'explicit correction',owner:'engine',source,conditions:[],patches:[{address:'source',value:after,source}]}]})).ledger
 assert.throws(()=>resolveEIAuthoredComparison(next,handle,'a','b'),/stale-snapshot/)
 const result=resolveEIAuthoredComparison(next,projectEIGrain(createEIGrainRegistry(next),'source','coordinate'),'a','b')
 assert.equal(result.result.status,'known-difference');assert.equal(result.result.proofs[0].premise.source.revision,1)
 assert.equal(next.records[0].was[0].source.text,text)
})

test('prose or rule antecedents are not silently promoted to established direct premises',()=>{
 const text=`I think a equals b;x⇒a≡b;${AUTHORED_COMPARE_CLAUSE}`
 const ledger=createEILedger({records:[{address:'source',value:text,source:{id:'source',text}}]})
 const handle=projectEIGrain(createEIGrainRegistry(ledger),'source','state')
 const result=resolveEIAuthoredComparison(ledger,handle,'a','b')
 assert.equal(result.result.status,'unresolved');assert.equal(result.result.proofs.length,0)
 assert.equal(inspectEIComparisonClauses(ledger,handle).premises.length,0)
})


test('returned symbolic proof is checked against original operands and retained source',()=>{
 const text=`a≡b;${AUTHORED_COMPARE_CLAUSE}`,ledger=createEILedger({records:[{address:'source',value:text,source:{id:'source',text}}]})
 const handle=projectEIGrain(createEIGrainRegistry(ledger),'source','state'),returned=resolveEIAuthoredComparison(ledger,handle,'a','b')
 assert.equal(verifyEIAuthoredComparison(ledger,handle,'a','b',returned).status,'passed')
 const forged=JSON.parse(JSON.stringify(returned));forged.result.proofs[0].conclusion.right='c'
 assert.equal(verifyEIAuthoredComparison(ledger,handle,'a','b',forged).status,'failed')
 assert.equal(verifyEIAuthoredComparison(ledger,handle,'b','a',returned).status,'failed')
})


test('batch evaluates each actually witnessed ordered pair with the same individual proof',()=>{
 const ledger=createEILedger({records:createEIPublicFieldRecords()}),before=exportEILedger(ledger)
 let baseline=''
 for(const grain of EI_GRAINS){
  const handle=projectEIGrain(createEIGrainRegistry(ledger),'model/inventory-root',grain),batch=resolveEIAuthoredComparisonBatch(ledger,handle)
  const expectedPairs=new Set(inspectEIComparisonClauses(ledger,handle).premises.map(p=>JSON.stringify([p.left,p.right])))
  assert.equal(batch.evaluatedPairCount,expectedPairs.size)
  for(const [index,result] of batch.results.entries()){
   const individual=resolveEIAuthoredComparison(ledger,handle,result.query.left,result.query.right).result
   assert.deepEqual(expandEIAuthoredComparisonBatchResult(batch,index),individual)
  }
  assert.equal(batch.sourceClauseCount,1+batch.unapplied.length+batch.witnessCount)
  assert.equal(verifyEIAuthoredComparisonBatch(ledger,handle,batch).status,'passed')
  if(baseline)assert.equal(JSON.stringify(batch),baseline);else baseline=JSON.stringify(batch)
 }
 assert.equal(exportEILedger(ledger),before)
})

test('batch preserves all conflicting witnesses while continuing independently established pairs',()=>{
 const text=`a≡b;a≠b;a≡b;c≡d;x⇒u≡v;${AUTHORED_COMPARE_CLAUSE}`
 const ledger=createEILedger({records:[{address:'source',value:text,source:{id:'source',text}}]})
 const handle=projectEIGrain(createEIGrainRegistry(ledger),'source','node'),batch=resolveEIAuthoredComparisonBatch(ledger,handle)
 assert.equal(batch.evaluatedPairCount,2);assert.equal(batch.witnessCount,4)
 const conflict=batch.results.find(item=>item.query.left==='a')!
 assert.equal(conflict.conflict,true);assert.equal(conflict.status,'unresolved');assert.equal(conflict.proofs.length,0)
 assert.equal(conflict.identityWitnesses.length,2);assert.equal(conflict.differenceWitnesses.length,1)
 assert.equal(batch.results.find(item=>item.query.left==='c')!.proofs.length,1)
 assert.deepEqual(batch.unapplied.map(item=>item.source.exact),['x⇒u≡v'])
})

test('batch never enumerates unwitnessed symmetry, identity or transitive pairs',()=>{
 const text=`a≡b;b≡c;uninterpreted prose;${AUTHORED_COMPARE_CLAUSE}`
 const ledger=createEILedger({records:[{address:'source',value:text,source:{id:'source',text}}]})
 const handle=projectEIGrain(createEIGrainRegistry(ledger),'source','address'),before=exportEILedger(ledger)
 const first=resolveEIAuthoredComparisonBatch(ledger,handle),repeat=resolveEIAuthoredComparisonBatch(ledger,handle)
 assert.deepEqual(first.results.map(item=>[item.query.left,item.query.right]),[['a','b'],['b','c']])
 assert.deepEqual(repeat,first);assert.equal(exportEILedger(ledger),before);assert.equal(ledger.receipts.length,0)
 const changed=JSON.parse(JSON.stringify(first));changed.results.pop()
 assert.equal(verifyEIAuthoredComparisonBatch(ledger,handle,changed).status,'failed')
})

test('no admitted witnesses produces no comparisons and preserves unprocessed source clauses',()=>{
 const text=`a⇒b;${AUTHORED_COMPARE_CLAUSE}`,ledger=createEILedger({records:[{address:'source',value:text,source:{id:'source',text}}]})
 const handle=projectEIGrain(createEIGrainRegistry(ledger),'source','state'),batch=resolveEIAuthoredComparisonBatch(ledger,handle)
 assert.equal(batch.evaluatedPairCount,0);assert.deepEqual(batch.results,[]);assert.equal(batch.unapplied[0].source.exact,'a⇒b')
 assert.equal('fieldComplete' in batch,false)
})

test('batch preserves source edits, stale handles and linear-sized grouped evidence',()=>{
 const text=Array.from({length:200},(_,i)=>`a${i}≡b${i}`).concat(AUTHORED_COMPARE_CLAUSE).join(';')
 const ledger=createEILedger({records:[{address:'source',value:text,source:{id:'source',text}}]})
 const handle=projectEIGrain(createEIGrainRegistry(ledger),'source','state'),batch=resolveEIAuthoredComparisonBatch(ledger,handle)
 assert.equal(batch.evaluatedPairCount,200);assert.ok(batch.results.every(item=>!('unused' in item)))
 assert.ok(JSON.stringify(batch).length<400000)
 const source={id:'correction',text:`a0≠b0;${AUTHORED_COMPARE_CLAUSE}`}
 const next=advanceEI(ledger,proposeEI(ledger,{id:'edit',producer:'source',input:source,candidates:[{id:'one',label:'explicit edit',owner:'engine',source,conditions:[],patches:[{address:'source',value:source.text,source}]}]})).ledger
 assert.throws(()=>resolveEIAuthoredComparisonBatch(next,handle),/stale-snapshot/)
 const current=resolveEIAuthoredComparisonBatch(next,projectEIGrain(createEIGrainRegistry(next),'source','pixel'))
 assert.equal(current.evaluatedPairCount,1);assert.equal(current.results[0].status,'known-difference')
 assert.equal(next.records[0].was[0].value,text)
})

test('ordered, reflexive and duplicate-rule witnesses preserve their distinct source occurrences',()=>{
 const text=`a≡b;b≠a;a≡a;${AUTHORED_COMPARE_CLAUSE};${AUTHORED_COMPARE_CLAUSE}`
 const ledger=createEILedger({records:[{address:'source',value:text,source:{id:'source',text}},{address:'other-source',value:'a≠b',source:{id:'other',text:'a≠b'}}]})
 const handle=projectEIGrain(createEIGrainRegistry(ledger),'source','state'),batch=resolveEIAuthoredComparisonBatch(ledger,handle,1)
 assert.deepEqual(batch.results.map(item=>[item.query.left,item.query.right,item.status]),[['a','b','known-identity'],['b','a','known-difference'],['a','a','known-identity']])
 assert.equal(batch.rule.start,text.lastIndexOf(AUTHORED_COMPARE_CLAUSE))
 assert.equal(batch.unapplied.length,1);assert.equal(batch.unapplied[0].source.start,text.indexOf(AUTHORED_COMPARE_CLAUSE))
 for(const [index,result] of batch.results.entries())assert.deepEqual(expandEIAuthoredComparisonBatchResult(batch,index),resolveEIAuthoredComparison(ledger,handle,result.query.left,result.query.right,1).result)
 const missing=JSON.parse(JSON.stringify(batch));missing.unapplied=[]
 assert.equal(verifyEIAuthoredComparisonBatch(ledger,handle,missing,1).status,'failed')
 assert.throws(()=>resolveEIAuthoredComparisonBatch(ledger,handle,2),/No retained comparison rule/)
 const noRule=projectEIGrain(createEIGrainRegistry(ledger),'other-source','node')
 assert.throws(()=>resolveEIAuthoredComparisonBatch(ledger,noRule),/No retained comparison rule/)
})

test('batch validates unsupported clause spans just as an individual evaluation does',()=>{
 const text=JSON.stringify({inventory_statements:{retained_binary_relations:['a≡b','',AUTHORED_COMPARE_CLAUSE]}})
 const ledger=createEILedger({records:[{address:'source',value:'fixture',source:{id:'source',text,realm:'public-repository-inventory'}}]})
 const handle=projectEIGrain(createEIGrainRegistry(ledger),'source','state')
 assert.throws(()=>resolveEIAuthoredComparison(ledger,handle,'a','b'),/invalid source span/)
 assert.throws(()=>resolveEIAuthoredComparisonBatch(ledger,handle),/invalid source span/)
})
