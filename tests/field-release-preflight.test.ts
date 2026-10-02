import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {entryMountsEIField,verifyFieldSurface,fieldContainsOperation} from '../scripts/verify-field-surface.ts'
test('release guard follows actual mounted entry rather than unused component existence',async()=>{
 const entry=await readFile(new URL('../src/main.tsx',import.meta.url),'utf8')
 assert.equal(entryMountsEIField(entry),true)
 assert.equal(entryMountsEIField(entry.replace('<EIModelLayer open />','<div />')),false)
 assert.equal(entryMountsEIField(entry.replace('<EIModelLayer open />','<EIModelLayer open={false} />')),false)
 assert.equal(entryMountsEIField(entry.replace('<EIModelLayer open />','{false && <EIModelLayer open />}')),false)
})
test('actual server-rendered field contains addresses and controls before capture without claiming completed geometry',async()=>{
 const result=await verifyFieldSurface()
 assert.equal(result.scope,'static-mounted-field-surface');assert.equal(result.actualAddresses,10);assert.equal(result.retainedAddresses,137)
 assert.equal(result.wholeFieldComplete,false);assert.ok(Object.values(result.checks).every(Boolean))
})

test('field workspace is address-bound and preserves operation contents while closed',async()=>{
 const {verifyFieldWorkspace}=await import('../scripts/verify-field-surface.ts')
 assert.ok(Object.values(await verifyFieldWorkspace()).every(Boolean))
})

test('capture outside the field cannot pass its containment guard',()=>{
 assert.equal(fieldContainsOperation('<section class="ei-field-array"><div>Start a conversation</div></section>','Start a conversation'),true)
 assert.equal(fieldContainsOperation('<section class="ei-field-array"></section><div>Start a conversation</div>','Start a conversation'),false)
})
