import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {attachPatternRecords,CHECK_PATTERN_CONTAINERS} from '../src/model/pattern-layer.ts'
import {CAPABILITIES} from '../src/model/reproducibility.ts'
const inventory=JSON.parse(readFileSync(new URL('../docs/FRACTURE-FIELD-INVENTORY.json',import.meta.url),'utf8'))
test('pattern records append content while preserving every existing map/container identity and relation',()=>{
 const before=JSON.stringify(inventory)
 const records=CAPABILITIES.map(c=>({id:`pattern:check:${c.id}`,containerId:CHECK_PATTERN_CONTAINERS[c.id],sourceIds:c.sources,kind:'bounded-check' as const,output:c.id,scope:c.scope}))
 const added=attachPatternRecords(inventory.binary_relation_order.nodes,records)
 assert.equal(added.length,4);assert.equal(JSON.stringify(inventory),before)
 for(const pattern of added){const node=inventory.binary_relation_order.nodes.find((n:{id:string})=>n.id===pattern.containerId);assert.equal(pattern.containerLocator,node.inventory_binary_address);assert.ok(Object.isFrozen(pattern));assert.ok(Object.isFrozen(pattern.sourceIds))}
 assert.equal(records[0].containerId,'topology')
})
test('layer cannot silently invent containers/source addresses or duplicate pattern identities',()=>{
 const record={id:'test',containerId:'scene',sourceIds:['frame'],kind:'video' as const,output:'synthetic-return',scope:'test only'}
 const nodes=inventory.binary_relation_order.nodes
 assert.throws(()=>attachPatternRecords(nodes,[{...record,containerId:'invented'}]))
 assert.throws(()=>attachPatternRecords(nodes,[{...record,sourceIds:['invented']}]))
 assert.throws(()=>attachPatternRecords(nodes,[record,record]))
})
