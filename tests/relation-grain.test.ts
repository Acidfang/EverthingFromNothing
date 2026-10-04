import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {inventoryRelationGrains,relationChoices,reachableRelationGrains,inventoryGeometryBoundary,kernelArrivalGrains} from '../src/model/relation-grain.ts'
import {firstDifference,resolveTick} from '../src/model/kernel.ts'
const inventory=JSON.parse(readFileSync(new URL('../docs/FRACTURE-FIELD-INVENTORY.json',import.meta.url),'utf8'))
const rows=inventoryRelationGrains(inventory)
test('actual inventory binds every retained binary row without normalising its semantics',()=>{
  assert.equal(rows.length,367)
  assert.equal(new Set(rows.map(row=>row.address)).size,367)
  rows.forEach((row,index)=>{
    const original=inventory.binary_relation_order.relations[index]
    assert.equal(row.left,original.left);assert.equal(row.right,original.right)
    assert.equal(row.predicate,original.relation);assert.equal(row.status,original.status)
    assert.equal(row.source.support,original.support)
    assert.equal(row.source.pointer,`/binary_relation_order/relations/${index}`)
    assert.ok(Object.isFrozen(row));assert.ok(Object.isFrozen(row.source))
  })
})
test('selecting actual nodes retains all incoming and outgoing choices',()=>{
  for(const node of inventory.binary_relation_order.nodes){
    assert.equal(relationChoices(rows,node.id).length,inventory.binary_relation_order.relations.filter((r:any)=>r.left===node.id||r.right===node.id).length)
  }
})
test('record traversal terminates and retains all connected identities',()=>{
  const graph=reachableRelationGrains(rows,'inventory-root')
  assert.equal(graph.nodes.length,137);assert.equal(graph.relations.length,367)
})
test('parallel source rows remain distinct and cycles terminate',()=>{
  const extra={...rows[0],address:'test:parallel'}
  const graph=reachableRelationGrains([...rows,extra],'inventory-root')
  assert.equal(graph.relations.length,368)
})
test('actual record set cannot silently become a fixed tetra population',()=>{
  const boundary=inventoryGeometryBoundary(rows)
  assert.equal(boundary.status,'UNRESOLVED_GEOMETRY')
  assert.equal(boundary.fallbackUsed,false);assert.equal(boundary.tetrahedra.length,0)
  assert.equal(boundary.missing.length,3)
})
test('actual kernel arrivals retain cancelled contributions and proposed status',()=>{
  const first=resolveTick(firstDifference()),second=resolveTick(first.state)
  const grains=kernelArrivalGrains(second.ledger,'test-preview:act2','selected-kernel-test','PROPOSED')
  assert.equal(grains.length,36)
  assert.equal(new Set(grains.map(row=>row.address)).size,36)
  assert.ok(grains.some(row=>!row.remainsDifferent))
  assert.ok(grains.every(row=>row.status==='PROPOSED'))
  for(const entry of second.ledger.entries)assert.equal(grains.filter(row=>row.right===entry.address).length,entry.arrivals.length)
  assert.equal(first.state.act,1)
})
