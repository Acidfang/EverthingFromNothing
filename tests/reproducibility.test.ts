import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {CAPABILITIES,capabilitiesFor,graphValid,runCapability,sameRun} from '../src/model/reproducibility.ts'
const inventory=JSON.parse(readFileSync(new URL('../docs/FRACTURE-FIELD-INVENTORY.json',import.meta.url),'utf8'))
const graph=inventory.binary_relation_order
for(const capability of CAPABILITIES){
 test(`${capability.id}: returns independent checks, bounded output and repeatable receipt`,()=>{
  const first=runCapability(capability.id,graph),second=runCapability(capability.id,graph)
  assert.equal(first.passed,true,JSON.stringify(first.checks));assert.ok(first.checks.length>=2)
  assert.equal(sameRun(first,second),true)
  assert.equal(sameRun(first,{...second,output:'tampered'}),false)
  assert.equal(sameRun({...first,passed:false},{...first,passed:false}),false)
 })
}
test('finite source mappings name retained entries and leave unresolved twist unwitnessed',()=>{
 assert.equal(inventory.entries.length,127)
 const ids=new Set(inventory.entries.map((e:{id:string})=>e.id))
 for(const capability of CAPABILITIES)for(const id of capability.sources)assert.ok(ids.has(id),id)
 assert.equal(capabilitiesFor('gap-twist').length,0)
 assert.ok(inventory.entries.some((e:{id:string})=>capabilitiesFor(e.id).length===0))
})
test('binary graph rejects duplicate identity, duplicate locator, nonbinary address and broken endpoint',()=>{
 assert.equal(graphValid(graph),true)
 assert.equal(graphValid({...graph,nodes:[...graph.nodes,graph.nodes[0]]}),false)
 assert.equal(graphValid({...graph,nodes:[...graph.nodes,{id:'unique',inventory_binary_address:graph.nodes[0].inventory_binary_address}]}),false)
 assert.equal(graphValid({...graph,nodes:[...graph.nodes,{id:'unique',inventory_binary_address:'2'}]}),false)
 assert.equal(runCapability('graph',{...graph,relations:[...graph.relations,{left:'missing',right:'nothing'}]}).passed,false)
})

test('reproduction requires matching graph content, not matching counts',()=>{
 const changed={...graph,relations:graph.relations.map((r:{left:string;right:string},i:number)=>i===0?{...r,right:'nothing'}:r)}
 assert.equal(graphValid(changed),true)
 assert.equal(sameRun(runCapability('graph',graph),runCapability('graph',changed)),false)
})
