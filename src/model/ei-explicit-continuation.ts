/** Draft adapter for the engine's existing user-supplied condition/patch schema. */
import {proposeEI,type EILedger,type EICondition} from './ei-engine.ts'
import {resolveEIGrainTarget,type EIGrainHandle} from './ei-grain-identity.ts'

export type EIExplicitChoice=Readonly<{value:string;conditions:readonly EICondition[]}>
export function proposeEIExplicitContinuation(ledger:EILedger,input:Readonly<{
 id:string;producer:EIGrainHandle;target:string;choices:readonly EIExplicitChoice[];
 owner:'user'|'engine';createChild:boolean;branchSource?:string|null;
}>){
 const producer=resolveEIGrainTarget(ledger,input.producer)
 const candidates=input.choices.map((choice,index)=>{
  const source={id:`${input.id}/instruction/${index}`,text:choice.value,realm:'explicit-local-edit'}
  return {id:`${input.id}/candidate/${index}`,label:`Choice ${index+1}`,owner:input.owner,source,
   conditions:choice.conditions.map(condition=>({...condition})),
   patches:[{address:input.target,value:choice.value,source:{...source,id:`${input.id}/value/${index}`,...(input.branchSource&&index===0?{locator:input.branchSource}:{})},...(input.createChild?{kind:'create' as const,parents:[producer]}:{})}]}
 })
 return proposeEI(ledger,{id:input.id,producer,input:{id:`input:${input.id}`,text:input.choices[0]?.value??'',realm:'explicit-local-continuations'},candidates})
}
