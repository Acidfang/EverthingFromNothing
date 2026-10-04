import {prepareEIUnifiedTransition} from './ei-unified-transition.ts'
import type {EILedger,EIExecution} from './ei-engine.ts'
import {createEIMechanismFrame,eiMechanismDigest,isEIMechanismResult,runEIMechanism,type EIMechanismFrame,type EIMechanismResult} from './ei-mechanism.ts'
/** Common value-return boundary for every field producer. These bounded
 * windows preserve exact addresses. Edges mean explicit transaction membership,
 * never spatial adjacency or newly inferred semantic relationships. The
 * unified transition still verifies declared relations and actual DOM output. */
export async function inspectEIOperationMechanism(base:EILedger,execution:EIExecution,userRoot:string,run:(frame:EIMechanismFrame)=>Promise<EIMechanismResult>=runEIMechanism,current:()=>boolean=()=>true){
 const projection=prepareEIUnifiedTransition(base,execution),sourceDigest=await eiMechanismDigest(JSON.stringify(projection)),children=[]
 for(let offset=0;offset<execution.expected.length;offset+=4){
  if(!current())throw Error('Mechanism operation context changed')
  const producer=execution.stagedLedger.records.find(r=>r.address===execution.proposal.input.producer)!
  const addresses=[...new Set([producer.address,...execution.expected.slice(offset,offset+4).map(r=>r.address)])]
  const records=addresses.map(address=>{const record=execution.stagedLedger.records.find(r=>r.address===address)!;return {address,value:record.is.value,sourceId:record.is.source.id,revision:record.is.revision,links:address===producer.address?addresses.filter(a=>a!==address).map(a=>({address:a,relation:'adjacent' as const,sourceId:execution.proposal.input.id,revision:base.revision})):[]}})
  const frame=await createEIMechanismFrame({userRoot,sourceAddress:producer.address,sourceRevision:base.revision,sourceId:`transition/${sourceDigest}`,records})
  const returned=await run(frame)
  if(!current())throw Error('Mechanism operation context changed')
  if(!isEIMechanismResult(returned)||returned.frame.digest!==frame.digest||!returned.complete)throw Error('Mechanism operation return is missing or mismatched')
  children.push(...await Promise.all(returned.returns.map(async child=>({address:child.job.address,parentAddress:child.job.parentAddress,depth:child.job.depth,window:offset/4,frameDigest:frame.digest,returnDigest:await eiMechanismDigest(JSON.stringify(child)),kernelSha256:child.kernelSha256,transport:returned.transport,occurrences:child.occurrences.length}))))
 }
 return Object.freeze({format:'ei-operation-mechanism-receipt/v1',transactionId:execution.proposal.input.id,userRoot,baseRevision:base.revision,sourceDigest,children:Object.freeze(children),scope:'exact-staged-address-values',externalEffects:false,committed:false})
}
