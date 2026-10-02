import {createEIGrainRegistry,projectEIGrain,type EIGrain} from './ei-grain-identity.ts'
import type {EILedger} from './ei-engine.ts'
/** Screen projection of retained incidence. These positions never enter model state. */
export function projectEIFieldArray(ledger:EILedger,grain:EIGrain,selection?:Readonly<{address:string;revision:number}>,sourceAddress?:string){
 const registry=createEIGrainRegistry(ledger)
 const nodes=registry.entities.map(entity=>{const state=projectEIGrain(registry,entity.address,grain,selection?.address===entity.address?selection.revision:undefined).state;return {address:entity.address,revision:state.revision,role:state.role,value:state.value,sourceId:state.source.id,worldPosition:null,x:0,y:0,component:0,depth:0}})
 const byAddress=new Map(nodes.map(node=>[node.address,node]))
 if(sourceAddress!==undefined&&!byAddress.has(sourceAddress))throw new Error('Field SOURCE address is not retained')
 const edges=ledger.records.flatMap(record=>{
  const origin=record.was[0]??record.is
  return [...record.parents.map((address,index)=>({id:JSON.stringify([record.address,'parent',index]),from:record.address,to:address,label:'parent',sourceId:origin.source.id,sourceRevision:origin.revision})),...record.relations.map((relation,index)=>({id:JSON.stringify([record.address,'relation',index]),from:record.address,to:relation.address,label:relation.relation,sourceId:origin.source.id,sourceRevision:origin.revision}))].map(edge=>({...edge,known:byAddress.has(edge.to)}))
 })
 const adjacent=new Map(nodes.map(node=>[node.address,new Set<string>()]))
 for(const edge of edges)if(edge.known){adjacent.get(edge.from)!.add(edge.to);adjacent.get(edge.to)!.add(edge.from)}
 const seen=new Set<string>();let offset=0,component=0,lastRight=0
 const seeds=sourceAddress?[...nodes].sort((a,b)=>a.address===sourceAddress?-1:b.address===sourceAddress?1:a.address.localeCompare(b.address)):nodes
 for(const seed of seeds){
  if(seen.has(seed.address))continue
  const levels:string[][]=[[seed.address]],queue=[seed.address];seen.add(seed.address)
  for(let i=0;i<queue.length;i++){
   const at=queue[i],depth=byAddress.get(at)!.depth
   for(const next of [...adjacent.get(at)!].sort())if(!seen.has(next)){seen.add(next);byAddress.get(next)!.depth=depth+1;(levels[depth+1]??=[]).push(next);queue.push(next)}
  }
  const radii=[0]
  for(let depth=1;depth<levels.length;depth++)radii.push(Math.max(radii[depth-1]+200,levels[depth].length*17))
  const outer=Math.max(180,...radii)
  offset=component===0?0:lastRight+outer+260
  for(let depth=0;depth<levels.length;depth++){
   const level=levels[depth].sort(),radius=radii[depth]
   level.forEach((address,index)=>{const node=byAddress.get(address)!;const angle=2*Math.PI*index/level.length-Math.PI/2;node.x=radius===0?offset:offset+radius*Math.cos(angle);node.y=radius===0?0:radius*Math.sin(angle);node.component=component})
  }
  lastRight=offset+outer;component++
 }
 const xs=nodes.map(n=>n.x),ys=nodes.map(n=>n.y)
 return {kind:'RETAINED_RELATION_SCREEN_VIEW' as const,nodes,edges,sourceAddress:sourceAddress??null,scope:'supplied-ledger-records' as const,bounds:{left:Math.min(0,...xs)-90,right:Math.max(0,...xs)+90,top:Math.min(0,...ys)-90,bottom:Math.max(0,...ys)+90}}
}
export const clampEIFieldZoom=(zoom:number,minimum=.08)=>Math.min(32,Math.max(Number.isFinite(minimum)&&minimum>0?Math.min(minimum,32):.08,Number.isFinite(zoom)?zoom:1))
