import test from 'node:test'
import assert from 'node:assert/strict'
import {mobileFractureGrain} from '../src/model/mobile-fracture.ts'
import {deriveEIFieldObject} from '../src/model/ei-field-object.ts'
test('selected user root owns the local field without changing its address',()=>{
 const root='USER/example',ledger=mobileFractureGrain(root)
 assert.equal(ledger.records.length,31)
 assert.equal(deriveEIFieldObject(ledger,root,'node').partAddresses.length,30)
 for(const record of ledger.records.slice(1)){assert.deepEqual(record.parents,[root]);assert.ok(record.relations.some(r=>r.relation==='LOCAL_ZERO'&&r.address===root))}
})
test('child zero preserves the original root and parent route',()=>{
 const root='USER/example',first=mobileFractureGrain(root),child=first.records[1]!.address
 const next=mobileFractureGrain(child,[root])
 assert.equal(next.records.find(r=>r.address===root)!.is.source.locator,root)
 assert.deepEqual(next.records.find(r=>r.address===child)!.parents,[root])
 assert.equal(deriveEIFieldObject(next,child,'node').partAddresses.length,30)
 assert.equal(JSON.stringify(first),JSON.stringify(mobileFractureGrain(root)))
})
