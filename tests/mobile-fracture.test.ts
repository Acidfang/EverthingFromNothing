import test from 'node:test'
import assert from 'node:assert/strict'
import {mobileFractureGrain,mobileFractureOperators,mobileFractureTips} from '../src/model/mobile-fracture.ts'
import {deriveEIFieldObject} from '../src/model/ei-field-object.ts'
test('selected user root owns the local field without changing its address',()=>{
 const root='USER/example',ledger=mobileFractureGrain(root)
 assert.equal(ledger.records.length,10)
 assert.equal(deriveEIFieldObject(ledger,root,'node').partAddresses.length,9)
 for(const record of ledger.records.slice(1)){assert.deepEqual(record.parents,[root]);assert.ok(record.relations.some(r=>r.relation==='LOCAL_ZERO'&&r.address===root))}
})
test('child zero preserves the original root and parent route',()=>{
 const root='USER/example',first=mobileFractureGrain(root),child=first.records[1]!.address
 const next=mobileFractureGrain(child,[root])
 assert.equal(next.records.find(r=>r.address===root)!.is.source.locator,root)
 assert.deepEqual(next.records.find(r=>r.address===child)!.parents,[root])
 assert.equal(deriveEIFieldObject(next,child,'node').partAddresses.length,9)
 assert.equal(JSON.stringify(first),JSON.stringify(mobileFractureGrain(root)))
})
test('direction and continuation addresses identify operators without automatic drawable members',()=>{
 const root='USER/example',ledger=mobileFractureGrain(root),operators=mobileFractureOperators(root)
 assert.equal(operators.filter(operator=>operator.kind==='direction').length,18)
 assert.equal(operators.filter(operator=>operator.kind==='continuation').length,3)
 for(const operator of operators){assert.ok(!ledger.records.some(record=>record.address===operator.address));assert.equal(operator.from,root);assert.equal(operator.to,null)}
})

test('each modal tip retains its complete temporal triad at the shared centre',()=>{const tips=mobileFractureTips('USER/example');assert.deepEqual(tips.map(tip=>tip.label),['will be','can be',"won't be"]);for(const tip of tips){assert.deepEqual(tip.states.map(state=>state.phase).sort(),['IS','NEXT','WAS']);assert.ok(tip.states.every(state=>state.owner==='USER/example'&&state.tipIndex===tip.index))}})
