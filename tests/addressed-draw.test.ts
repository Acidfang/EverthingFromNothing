import test from "node:test"
import assert from "node:assert/strict"
import {ADDRESSED_DRAW_SOURCE,createAddressedDraw,mayAdvanceAfterDraw} from "../src/model/addressed-draw.ts"
import {searchInventory,relationsAt,validSpatialAddress,sourceHref} from "../src/model/field-inventory.ts"
import {readFileSync} from "node:fs"
const inventory=JSON.parse(readFileSync(new URL("../docs/FRACTURE-FIELD-INVENTORY.json",import.meta.url),"utf8"))
test("every finite pixel constructs output exactly once before TIME, including partial batches",()=>{
 const draw=createAddressedDraw(7,5),out:number[]=[],coordinates:string[]=[]
 const write=(index:number,x:number,y:number)=>{out.push(index);coordinates.push(`${x},${y}`)}
 draw.assign(12,write);assert.equal(mayAdvanceAfterDraw(draw.receipt(),true),false)
 draw.assign(12,write);assert.equal(mayAdvanceAfterDraw(draw.receipt(),true),false)
 draw.assign(12,write);assert.deepEqual(out,Array.from({length:35},(_,i)=>i));assert.equal(new Set(coordinates).size,35)
 assert.equal(mayAdvanceAfterDraw(draw.receipt(),false),false);assert.equal(mayAdvanceAfterDraw(draw.receipt(),true),true)
 draw.assign(12,write);assert.equal(out.length,35)
 assert.equal(ADDRESSED_DRAW_SOURCE.first,".finity1");assert.equal(ADDRESSED_DRAW_SOURCE.next,".infinity2")
})
test("cancelled/resize frames cannot advance, replacement starts a fresh complete frame",()=>{
 const draw=createAddressedDraw(3,3);draw.assign(2,()=>{});draw.cancel();draw.assign(20,()=>assert.fail("cancelled write"))
 assert.equal(draw.receipt().assigned,2);assert.equal(mayAdvanceAfterDraw(draw.receipt(),true),false)
 const replacement=createAddressedDraw(2,4);replacement.assign(8,()=>{});assert.equal(mayAdvanceAfterDraw(replacement.receipt(),true),true)
 assert.throws(()=>createAddressedDraw(0,2));assert.throws(()=>replacement.assign(0,()=>{}))
})
test("inventory search, every endpoint, retained symbols and four unresolved gaps",()=>{
 const {nodes,relations}=inventory.binary_relation_order
 assert.equal(searchInventory(nodes,"00000010")[0].id,"nothing")
 assert.ok(searchInventory(nodes,"Φ").length>0);assert.equal(searchInventory(nodes,"this-matches-nothing-123").length,0)
 const ids=new Set(nodes.map((n:{id:string})=>n.id));for(const edge of relations){assert.ok(ids.has(edge.left));assert.ok(ids.has(edge.right))}
 assert.ok(relationsAt(relations,"zero").length>0)
 for(const id of ["gap-cardinality","gap-basis","gap-twist","gap-projection"])assert.ok(ids.has(id))
 assert.ok(inventory.retained_binary_relations.includes("0≡∅+"))
})
test("spatial addresses cannot be confused with inventory binary locators",()=>{
 assert.equal(validSpatialAddress("-1,0,2"),true);assert.equal(validSpatialAddress("00000010"),false);assert.equal(validSpatialAddress("1.5,0,0"),false);assert.equal(validSpatialAddress("9007199254740992,0,0"),false)
 assert.match(sourceHref({path:"src/model/kernel.ts",revision:"abc"}),/blob\/abc\/src\/model\/kernel.ts$/)
})
