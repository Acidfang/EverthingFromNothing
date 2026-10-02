import type {EILedger} from './ei-engine.ts'
import type {EIDiscoveryReturn} from './ei-discovery.ts'
import {createEIMechanismFrame,eiMechanismDigest,isEIMechanismResult,runEIMechanism,type EIMechanismRecord,type EIMechanismResult} from './ei-mechanism.ts'
/** The packet's explicit membership and parent references become declared
 * graph edges. These adapter tags do not assert spatial adjacency or meaning. */
export async function createEIDiscoveryMechanismFrame(ledger:EILedger,userRoot:string,returned:EIDiscoveryReturn){
 const b=returned.value,namespace=await eiMechanismDigest(JSON.stringify([userRoot,returned.carrier])),scan=await eiMechanismDigest(JSON.stringify([userRoot,returned.carrier,b.scanId])),sourceAddress=`discovery/${scan}/${b.sequence}`,sourceId=`discovery/${scan}/${b.sequence}`
 const target=async(key:string)=>`observed/${await eiMechanismDigest(JSON.stringify([namespace,key]))}`
 const addresses=new Map<string,string>();for(const item of b.observations)addresses.set(item.key,await target(item.key))
 const records:EIMechanismRecord[]=[{address:sourceAddress,value:JSON.stringify({status:b.status,sequence:b.sequence,sourceBytes:new TextEncoder().encode(returned.raw).length}),sourceId,revision:ledger.revision,links:b.observations.map((item,i)=>({address:addresses.get(item.key)!,relation:'adjacent',sourceId:`${sourceId}/${i}`,revision:b.revision}))}]
 const present=new Set(addresses.values())
 for(const [index,item]of b.observations.entries()){
  const links=[];if(item.parentKey!==null){const parent=await target(item.parentKey);links.push({address:parent,relation:'related' as const,sourceId:`${sourceId}/${index}`,revision:b.revision});if(!present.has(parent)){const prior=ledger.records.find(r=>r.address===parent);if(prior){records.push({address:parent,value:prior.is.value,sourceId:prior.is.source.id,revision:prior.is.revision,links:[]});present.add(parent)}}}
  records.push({address:addresses.get(item.key)!,value:JSON.stringify(item),sourceId:`${sourceId}/${index}`,revision:b.revision,links})
 }
 return createEIMechanismFrame({userRoot,sourceAddress,sourceRevision:ledger.revision,sourceId,records})
}
export async function inspectEIDiscoveryMechanism(ledger:EILedger,userRoot:string,returned:EIDiscoveryReturn,run=runEIMechanism){return run(await createEIDiscoveryMechanismFrame(ledger,userRoot,returned))}
export async function bindEIDiscoveryMechanism(ledger:EILedger,userRoot:string,returned:EIDiscoveryReturn,result:EIMechanismResult){
 if(!isEIMechanismResult(result))throw Error('Discovery mechanism return was not validated')
 const expected=await createEIDiscoveryMechanismFrame(ledger,userRoot,returned)
 if(result.frame.digest!==expected.digest||!result.complete)throw Error('Discovery mechanism source changed or has unresolved children')
 return Object.freeze({format:'ei-recursive-discovery-return/v1',userRoot,frameDigest:result.frame.digest,sourceRevision:ledger.revision,sourceAddress:result.frame.sourceAddress,kernelSha256:result.returns[0].kernelSha256,transport:result.transport,children:await Promise.all(result.returns.map(async r=>({address:r.job.address,parentAddress:r.job.parentAddress,depth:r.job.depth,status:r.status,occurrences:r.occurrences.length,returnDigest:await eiMechanismDigest(JSON.stringify(r))}))),executionAuthority:false})
}
