import {proposeEI,type EILedger} from './ei-engine.ts'
export function proposeGuideObservation(ledger:EILedger,input:{id:string;intentAddress:string;observation:string}){
 const intent=ledger.records.find(record=>record.address===input.intentAddress);if(!intent||!input.observation.trim())throw new Error('Goal and observation are required')
 const source={id:input.id,text:input.observation,realm:'user-reported-guide-context',locator:JSON.stringify({intent:{address:intent.address,revision:intent.is.revision,sourceId:intent.is.source.id},userReported:true})}
 return proposeEI(ledger,{id:input.id,producer:intent.address,input:source,candidates:[{id:`${input.id}/retain`,label:'Retain reported observation',owner:'user',source,conditions:[{address:intent.address,equals:intent.is.value}],patches:[{kind:'create',address:`guide/context/${input.id}`,value:input.observation,source,parents:[intent.address]}]}]})
}
