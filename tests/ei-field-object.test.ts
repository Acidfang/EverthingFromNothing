import test from 'node:test'
import assert from 'node:assert/strict'
import {createEILedger,exportEILedger} from '../src/model/ei-engine.ts'
import {deriveEIFieldObject,projectEIFieldTetrahedron} from '../src/model/ei-field-object.ts'
import {resolveEIObserverZero} from '../src/model/ei-observer-zero.ts'
const ledger=createEILedger({records:[{address:'root',value:'root',source:{id:'r',text:'root'},relations:[{relation:'CONTAINS',address:'declared'},{relation:'SUPPORTS',address:'other'},{relation:'CONTAINS',address:'unknown'}]},{address:'child',value:'child',parents:['root'],source:{id:'c',text:'child'}},{address:'declared',value:'declared',source:{id:'d',text:'declared'}},{address:'other',value:'other',source:{id:'o',text:'other'}}]})
test('choosing zero expands actual parent/CONTAINS parts, preserves source and never mints missing entities',()=>{
 const before=exportEILedger(ledger),object=deriveEIFieldObject(ledger,'root','node');assert.deepEqual(object.partAddresses,['child','declared']);assert.deepEqual(object.unknownParts,['unknown']);assert.equal(object.modelAdvanced,false);assert.equal(exportEILedger(ledger),before)
 for(const grain of ['state','node','pixel','address','coordinate'] as const)assert.equal(resolveEIObserverZero(ledger,'child',grain).sourceId,'c')
 assert.throws(()=>resolveEIObserverZero(ledger,'missing','state'))
})
test('observer projection derives four faces/six edges from the same 3D primitive without changing source',()=>{
 const a=projectEIFieldTetrahedron(0,0),b=projectEIFieldTetrahedron(.5,.2);assert.equal(a.faces.length,4);assert.equal((a.path.match(/M/g)??[]).length,6);assert.notEqual(a.path,b.path);assert.equal(a.scope,'observer-projection-of-retained-3d-vertices');assert.throws(()=>projectEIFieldTetrahedron(NaN,0))
})
