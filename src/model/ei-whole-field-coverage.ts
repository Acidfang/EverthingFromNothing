import {findEIAddress,type EILedger} from './ei-engine.ts'
/** Read-only incidence coverage of the one supplied immutable field cut.
 * This does not manufacture missing endpoints or interpret a link as an action. */
export function inspectEIWholeField(ledger:EILedger,userRoot:string){
 if(!findEIAddress(ledger,userRoot))throw Error('User field root is not retained')
 const records=new Map(ledger.records.map(record=>[record.address,record])),edges=ledger.records.flatMap(record=>[
  ...record.parents.map((parent,index)=>({from:record.address,to:parent,relation:'parent',sourceAddress:record.address,sourceId:(record.was[0]??record.is).source.id,sourcePointer:`parents/${index}`})),
  ...record.relations.map((relation,index)=>({from:record.address,to:relation.address,relation:relation.relation,sourceAddress:record.address,sourceId:(record.was[0]??record.is).source.id,sourcePointer:`relations/${index}`}))])
 const incident=new Map(ledger.records.map(record=>[record.address,new Set<string>()]))
 for(const edge of edges){if(records.has(edge.to)){incident.get(edge.from)!.add(edge.to);incident.get(edge.to)!.add(edge.from)}}
 const reached=new Set([userRoot]),queue=[userRoot];for(let i=0;i<queue.length;i++)for(const next of incident.get(queue[i])??[])if(!reached.has(next)){reached.add(next);queue.push(next)}
 return Object.freeze({format:'ei-whole-field-coverage/v1',userRoot,identityScope:'caller-selected-user-field-root',logicalSnapshotRevision:ledger.revision,physicalObservationsSimultaneous:false,wholeExternalSourceEstablished:false,traversal:'retained-incidence-only',addresses:Object.freeze(ledger.records.map(record=>Object.freeze({address:record.address,revision:record.is.revision,sourceId:record.is.source.id,realm:record.is.source.realm??null,retainedStates:record.was.length+1,reachable:reached.has(record.address)}))),relations:Object.freeze(edges.map(edge=>Object.freeze({...edge,targetKnown:records.has(edge.to)}))),unresolvedEndpoints:Object.freeze(edges.filter(edge=>!records.has(edge.to)).map(edge=>Object.freeze({...edge}))),unreachedAddresses:Object.freeze(ledger.records.filter(record=>!reached.has(record.address)).map(record=>record.address)),occurrences:Object.freeze(ledger.receipts.map(receipt=>Object.freeze({address:receipt.id,producer:receipt.producer,parentSnapshot:receipt.snapshotRevision,returnedSnapshot:receipt.resultRevision,status:receipt.status,targets:Object.freeze(receipt.patches.map(p=>p.address))})))})
}
