import {exportEILedger,type EILedger} from './ei-engine.ts'
export type EIRootTreeRow=Readonly<{key:string;address:string;revision:number;sourceId:string;label:string;depth:number;parentKey:string|null;reference:boolean;cycle:boolean;expandable:boolean;expanded:boolean;unreached:boolean}>
/** Parent edges only. Repeated placements reference the same canonical record;
 * neither a non-parent relation nor an unreachable component creates a parent. */
export function projectEIRootTree(ledger:EILedger,expanded:ReadonlySet<string>):readonly EIRootTreeRow[]{
 exportEILedger(ledger)
 const records=new Map(ledger.records.map(record=>[record.address,record])),children=new Map<string,string[]>()
 for(const record of ledger.records)for(const parent of record.parents)if(records.has(parent)){const list=children.get(parent)??[];list.push(record.address);children.set(parent,list)}
 for(const list of children.values())list.sort()
 const roots=ledger.records.filter(record=>!record.parents.length).map(record=>record.address).sort(),reachable=new Set<string>(),queue=[...roots]
 while(queue.length){const address=queue.pop()!;if(reachable.has(address))continue;reachable.add(address);queue.push(...(children.get(address)??[]))}
 const rows:EIRootTreeRow[]=[],seen=new Set<string>()
 const traverse=(address:string,depth:number,parentKey:string|null,path:readonly string[],unreached:boolean)=>{
  const record=records.get(address)!,cycle=path.includes(address),reference=seen.has(address),key=JSON.stringify([...path,address])
  const expandable=!reference&&!cycle&&!!children.get(address)?.length,isExpanded=expandable&&expanded.has(address)
  rows.push(Object.freeze({key,address,revision:record.is.revision,sourceId:record.is.source.id,label:record.is.value.split('\n')[0].slice(0,64)||address,depth,parentKey,reference,cycle,expandable,expanded:isExpanded,unreached}))
  seen.add(address)
  if(isExpanded)for(const child of children.get(address)??[])traverse(child,depth+1,key,[...path,address],unreached)
 }
 for(const address of roots)traverse(address,1,null,[],false)
 for(const address of [...records.keys()].sort())if(!reachable.has(address)&&!seen.has(address))traverse(address,1,null,[],true)
 return Object.freeze(rows)
}
