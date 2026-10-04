/** Lossless addressed relation view. No row is implicitly a tetra or a pixel. */
import type {TickLedger} from './kernel.ts'
export type RelationRow = Readonly<{
  address:string; left:string; right:string; predicate:string; status:string
  source:Readonly<{revision:string;path:string;pointer:string;support:string}>
}>
type Inventory = Readonly<{
  source_revision:string
  binary_relation_order:Readonly<{
    nodes:readonly Readonly<{id:string;inventory_binary_address:string}>[]
    relations:readonly Readonly<{left:string;right:string;relation:string;status:string;support:string}>[]
  }>
}>
export function inventoryRelationGrains(inventory:Inventory):readonly RelationRow[]{
  const ids=new Set(inventory.binary_relation_order.nodes.map(n=>n.id))
  if(ids.size!==inventory.binary_relation_order.nodes.length)throw new Error('Duplicate inventory node identity')
  return Object.freeze(inventory.binary_relation_order.relations.map((edge,index)=>{
    if(!ids.has(edge.left)||!ids.has(edge.right))throw new Error('Unresolved inventory endpoint')
    const pointer=`/binary_relation_order/relations/${index}`
    return Object.freeze({address:`inventory:${inventory.source_revision}#${pointer}`,
      left:edge.left,right:edge.right,predicate:edge.relation,status:edge.status,
      source:Object.freeze({revision:inventory.source_revision,path:'docs/FRACTURE-FIELD-INVENTORY.json',pointer,support:edge.support})})
  }))
}
/** Selection returns every incidence, including parallel rows and both directions.
 * No address is merged because it shares a display pixel or a label. */
export function relationChoices<T extends RelationRow>(rows:readonly T[],node:string){
  return Object.freeze(rows.filter(row=>row.left===node||row.right===node))
}
/** Finite reachability through supplied rows, retaining every actual edge once.
 * This is a record query, not an invented spatial root path or an Act. */
export function reachableRelationGrains(rows:readonly RelationRow[],start:string){
  const nodes=new Set([start]),pending=[start],edges=new Map<string,RelationRow>()
  while(pending.length){
    const node=pending.shift()!
    for(const row of relationChoices(rows,node)){
      edges.set(row.address,row)
      for(const endpoint of [row.left,row.right])if(!nodes.has(endpoint)){nodes.add(endpoint);pending.push(endpoint)}
    }
  }
  return Object.freeze({nodes:Object.freeze([...nodes]),relations:Object.freeze([...edges.values()])})
}
/** Explicit boundary for the actual dataset. Structural containment/dependency
 * rows contain neither ordered geometric rays nor a retained oriented pose. */
export function inventoryGeometryBoundary(rows:readonly RelationRow[]){
  return Object.freeze({relationCount:rows.length,tetrahedra:Object.freeze([]),
    status:'UNRESOLVED_GEOMETRY' as const,
    missing:Object.freeze(['Per-node ordered directional rays/topology',
      'Address-bound placement and retained orientation',
      'Thread incidence linking the actual parent tip to child centre']),
    fallbackUsed:false as const})
}

/** The selected six-face kernel's finest retained causal records are arrivals.
 * Preserve arrivals cancelled by parity too: a missing result is not a missing
 * source contribution. The caller declares whether this is proposed or recorded. */
export function kernelArrivalGrains(ledger:TickLedger,receiptAddress:string,revision:string,stage:'PROPOSED'|'RECORDED'){
  if(!receiptAddress||!revision)throw new Error('Addressed receipt and source revision required')
  return Object.freeze(ledger.entries.flatMap((entry,entryIndex)=>entry.arrivals.map((arrival,arrivalIndex)=>{
    const pointer=`/entries/${entryIndex}/arrivals/${arrivalIndex}`
    return Object.freeze({address:`${receiptAddress}#${pointer}`,left:arrival.source,right:entry.address,
      predicate:'SELECTED_KERNEL_ARRIVAL',status:stage,
      source:Object.freeze({revision,path:'src/model/kernel.ts',pointer,support:'Six-face selected projection; arrival before parity resolution'}),
      face:arrival.face,fromAct:ledger.fromAct,toAct:ledger.toAct,result:entry.result,
      remainsDifferent:entry.remainsDifferent,arrivalCount:entry.arrivalCount})
  })))
}
