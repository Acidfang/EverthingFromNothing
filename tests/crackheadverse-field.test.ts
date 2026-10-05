import {test} from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {localField,backtrace} from '../src/model/crackheadverse/field-relations.mjs'
import {mobileFractureGrain} from '../src/model/mobile-fracture.ts'
import {mobileGrainView} from '../src/model/mobile-grain-view.ts'
test('Crackheadverse source projection preserves retained bytes and exact local field addresses',()=>{
 const file=new URL('../src/model/crackheadverse/field-relations.mjs',import.meta.url),p=JSON.parse(fs.readFileSync(new URL('../src/model/crackheadverse/provenance.json',import.meta.url),'utf8'))
 assert.equal(createHash('sha256').update(fs.readFileSync(file)).digest('hex'),p.sha256)
 const field=localField('user/root','coordinate'),ledger=mobileFractureGrain('user/root')
 assert.deepEqual(ledger.records.slice(1).map(r=>r.address),field.orientations.flatMap(o=>o.roles.map(r=>r.address)))
 const view=mobileGrainView(ledger,'user/root','coordinate');assert.equal(view.crackheadverseField.grain,'coordinate');assert.equal(view.crackheadverseField.zero,'user/root');assert.equal(view.crackheadverseField.metricTransform,null)
 assert.deepEqual(backtrace([{resultState:'child',parentState:'root'},{resultState:'root',parentState:null}],'child').map(r=>r.resultState),['root','child'])
 assert.throws(()=>backtrace([{resultState:'x',parentState:'x'}],'x'),/Cyclic/)
})
