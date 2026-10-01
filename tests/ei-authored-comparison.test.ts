import test from 'node:test'
import assert from 'node:assert/strict'
import {createEILedger,exportEILedger,proposeEI,advanceEI} from '../src/model/ei-engine.ts'
import {createEIPublicFieldRecords} from '../src/model/ei-public-field.ts'
import {createEIGrainRegistry,projectEIGrain,EI_GRAINS} from '../src/model/ei-grain-identity.ts'
import {inspectEIComparisonClauses,resolveEIAuthoredComparison,verifyEIAuthoredComparison} from '../src/model/ei-authored-comparison.ts'
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
