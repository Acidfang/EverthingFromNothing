/** Additive content only. Container IDs and binary locators are retained inventory transport, not new world geometry. */
export type PatternRecord=Readonly<{id:string;containerId:string;sourceIds:readonly string[];kind:'bounded-check'|'video';output:string;scope:string}>
export type ContainerNode=Readonly<{id:string;inventory_binary_address:string}>
export const CHECK_PATTERN_CONTAINERS:Readonly<Record<string,string>>=Object.freeze({graph:'topology',replay:'ledger',orientation:'tetrahedra',pixels:'render-boundary'})
export function attachPatternRecords(nodes:readonly ContainerNode[],records:readonly PatternRecord[]){
 const containers=new Map(nodes.map(node=>[node.id,node])),seen=new Set<string>()
 return Object.freeze(records.map(record=>{
  if(seen.has(record.id))throw new Error('Duplicate pattern record');seen.add(record.id)
  const container=containers.get(record.containerId)
  if(!container||record.sourceIds.some(id=>!containers.has(id)))throw new Error('Pattern target/source must already exist')
  return Object.freeze({...record,sourceIds:Object.freeze([...record.sourceIds]),containerLocator:container.inventory_binary_address})
 }))
}
