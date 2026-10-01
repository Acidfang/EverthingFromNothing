import {executeEI,exportEILedger,verifyLocalEI,type EILedger,type EIExecution} from './ei-engine.ts'
import {produceSourceFractures,type SourceRecord} from './source-first-fracture.ts'

/** Text is the explicitly selected comparison grain. Creation is a baseline,
 * not a fabricated comparison against nothing or a different message address. */
export function deriveEISourceFractures(previous:EILedger,execution:EIExecution){
 exportEILedger(previous)
 if(!verifyLocalEI(execution).committable)throw new Error('Source fracture execution is not verified locally')
 const restaged=executeEI(previous,execution.proposal,execution.selection.mode==='explicit-user'?execution.selection:undefined)
 if(restaged.status!=='staged'||JSON.stringify(restaged.stagedLedger)!==JSON.stringify(execution.stagedLedger))throw new Error('Source fracture execution does not belong to the retained snapshot')
 const records:SourceRecord[]=[]
 const bindings:{recordId:string;address:string;revision:number;sourceId:string;sourceRealm:string|null;phase:'RETAINED'|'PROPOSED';receiptId:string|null}[]=[]
 for(const record of execution.stagedLedger.records){
  let previousId:string|undefined
  for(const state of [...record.was,record.is]){
   const id=JSON.stringify(['EI_STATE',record.address,state.revision])
   const proposed=state.revision>previous.revision
   records.push({id,address:record.address,value:state.value,sourceRef:JSON.stringify(['EI_SOURCE',record.address,state.revision,state.source.id]),...(previousId?{previousId}:{}),parentAddresses:record.parents})
   bindings.push({recordId:id,address:record.address,revision:state.revision,sourceId:state.source.id,sourceRealm:state.source.realm??null,phase:proposed?'PROPOSED':'RETAINED',receiptId:proposed?null:previous.receipts.find(receipt=>receipt.resultRevision===state.revision&&receipt.patches.some(patch=>patch.address===record.address))?.id??null})
   previousId=id
  }
 }
 const field=produceSourceFractures({sourceAddress:execution.proposal.input.producer,records})
 const phaseByRecord=new Map(bindings.map(binding=>[binding.recordId,binding.phase]))
 return {
  transactionId:execution.proposal.input.id,
  comparisonGrain:'EXACT_RETAINED_TEXT' as const,
  field,
  bindings,
  differences:field.differences.map(difference=>({differenceId:difference.id,fractureId:difference.fractureId,phase:phaseByRecord.get(difference.afterId)!})),
  limit:'Only actual same-address retained or selected staged text changes produce fractures. New messages are baselines; semantic difference and physical placement are not inferred.',
 }
}
