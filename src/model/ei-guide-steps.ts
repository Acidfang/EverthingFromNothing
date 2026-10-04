import {proposeEI,type EILedger,type EIRecord,type EIProposal} from './ei-engine.ts'
type Condition=Readonly<{address:string;equals:string}>
const find=(ledger:EILedger,address:string)=>ledger.records.find(record=>record.address===address)
const original=(record:EIRecord)=>record.was[0]??record.is
const sourceState=(record:EIRecord)=>({address:record.address,revision:record.is.revision,value:record.is.value,source:record.is.source})
function metadata(record:EIRecord,realm:string):Record<string,any>|null{
 const state=original(record);if(state.source.realm!==realm)return null
 try{const v=JSON.parse(state.source.locator??'');if(!v||typeof v!=='object'||typeof v.intent?.address!=='string'||!Number.isSafeInteger(v.intent?.revision)||v.intent.revision<0||!record.parents.includes(v.intent.address))return null
  if(realm==='user-reported-guide-context')return v.userReported===true?v:null
  if(typeof v.intent.value!=='string'||typeof v.intent.source?.id!=='string'||typeof v.expected!=='string')return null
  if(realm==='user-reported-guide-outcome')return typeof v.actual==='string'&&v.actual===state.value&&typeof v.attempt?.address==='string'&&record.parents.includes(v.attempt.address)&&v.userReported===true&&v.worldVerified===false&&v.scope==='exact-text-only'&&v.matches===(v.actual===v.expected)&&v.comparison===(v.matches?'exact-match':'mismatch')?v:null
  if(typeof v.action!=='string'||state.value!==v.action||!Array.isArray(v.conditions)||v.conditions.some((c:any)=>!c||typeof c.address!=='string'||typeof c.equals!=='string'))return null
  if(realm==='user-selected-guide-step'&&(v.selectionOnly!==true||v.physicalActionExecuted!==false||typeof v.step?.address!=='string'||!record.parents.includes(v.step.address)))return null
  return v
 }catch{return null}
}
function retained(ledger:EILedger,record:EIRecord){const state=original(record);return ledger.receipts.some(receipt=>receipt.status==='committed'&&receipt.scope==='rendered-address-values'&&receipt.patches.some(patch=>patch.kind==='create'&&patch.address===record.address&&patch.value===state.value&&patch.source.id===state.source.id))}
function proposal(ledger:EILedger,id:string,producer:EIRecord,address:string,value:string,realm:string,detail:unknown,conditions:readonly Condition[],parents:string[]):EIProposal{
 const source={id,text:value,realm,locator:JSON.stringify(detail)}
 return proposeEI(ledger,{id,producer:producer.address,input:source,candidates:[{id:`${id}/retain`,label:value.split('\n')[0].slice(0,120),owner:'user',source,conditions,patches:[{kind:'create',address,value,source,parents}]}]})
}
export function proposeGuideStep(ledger:EILedger,input:{id:string;intentAddress:string;action:string;conditions:readonly Condition[];expected:string}){
 const intent=find(ledger,input.intentAddress);if(!intent)throw new Error('Goal source is missing');if(!input.action.trim()||!input.expected.trim())throw new Error('Supply the proposed action and expected observation')
 const detail={intent:sourceState(intent),action:input.action,conditions:input.conditions.map(condition=>({...condition})),expected:input.expected}
 return proposal(ledger,input.id,intent,`guide/steps/${input.id}`,input.action,'user-declared-guide-step',detail,[{address:intent.address,equals:intent.is.value}],[intent.address])
}
export function readGuideSteps(ledger:EILedger,intentAddress:string){
 return ledger.records.flatMap(record=>{const meta=metadata(record,'user-declared-guide-step');if(!meta||meta.intent?.address!==intentAddress||!retained(ledger,record))return []
  const intent=find(ledger,intentAddress),reasons:string[]=[],current=original(record)===record.is
  const conditions=(Array.isArray(meta.conditions)?meta.conditions:[]).map((condition:Condition)=>{const actual=find(ledger,condition.address);return {...condition,actual:actual?.is.value??null,status:!actual?'unresolved':actual.is.value===condition.equals?'matched':'blocked'}})
  if(!intent||intent.is.revision!==meta.intent.revision||intent.is.source.id!==meta.intent.source?.id)reasons.push('Goal source changed')
  if(!current)reasons.push('Proposed step changed')
  if(conditions.some((condition:any)=>condition.status==='unresolved'))reasons.push('A required addressed observation is missing')
  if(conditions.some((condition:any)=>condition.status==='blocked'))reasons.push('A required observation differs')
  const status=reasons.some(reason=>reason!=='A required observation differs')?'unresolved' as const:conditions.some((condition:any)=>condition.status==='blocked')?'blocked' as const:'available' as const
  return [{address:record.address,revision:record.is.revision,action:meta.action as string,expected:meta.expected as string,intent:meta.intent,currentIntent:intent?sourceState(intent):null,source:original(record).source,current,conditions,status,reasons}]
 })
}
export function proposeGuideSelection(ledger:EILedger,input:{id:string;stepAddress:string}){
 const step=find(ledger,input.stepAddress),meta=step&&metadata(step,'user-declared-guide-step');if(!step||!meta)throw new Error('Step source is missing')
 const resolved=readGuideSteps(ledger,meta.intent.address).find(item=>item.address===step.address);if(!resolved||resolved.status!=='available')throw new Error('The proposed step has unresolved or blocked conditions')
 const detail={intent:resolved.intent,step:sourceState(step),action:resolved.action,expected:resolved.expected,conditions:resolved.conditions.map((condition:any)=>({...condition,revision:find(ledger,condition.address)!.is.revision,source:find(ledger,condition.address)!.is.source})),selectionOnly:true,physicalActionExecuted:false}
 return proposal(ledger,input.id,step,`guide/attempts/${input.id}`,resolved.action,'user-selected-guide-step',detail,[{address:step.address,equals:step.is.value},{address:resolved.intent.address,equals:resolved.intent.value},...resolved.conditions.map((condition:any)=>({address:condition.address,equals:condition.equals}))],[step.address,resolved.intent.address])
}
export function proposeGuideOutcome(ledger:EILedger,input:{id:string;attemptAddress:string;actual:string}){
 const attempt=find(ledger,input.attemptAddress),meta=attempt&&metadata(attempt,'user-selected-guide-step');if(!attempt||!meta||!retained(ledger,attempt))throw new Error('Selected step source is missing');if(!input.actual.trim())throw new Error('Supply the observed return')
 const detail={intent:meta.intent,attempt:{address:attempt.address,revision:original(attempt).revision,source:original(attempt).source},expected:meta.expected,actual:input.actual,matches:input.actual===meta.expected,comparison:input.actual===meta.expected?'exact-match':'mismatch',scope:'exact-text-only',userReported:true,worldVerified:false}
 return proposal(ledger,input.id,attempt,`guide/outcomes/${input.id}`,input.actual,'user-reported-guide-outcome',detail,[{address:attempt.address,equals:attempt.is.value}],[attempt.address,meta.intent.address])
}
export function readGuideAttempts(ledger:EILedger,intentAddress:string){return ledger.records.flatMap(record=>{const meta=metadata(record,'user-selected-guide-step');if(!meta||meta.intent?.address!==intentAddress||!retained(ledger,record))return []
 const intent=find(ledger,intentAddress),step=find(ledger,meta.step?.address),conditions=Array.isArray(meta.conditions)?meta.conditions:[],missing=!intent||!step||conditions.some((c:any)=>!find(ledger,c.address)),changed=intent?.is.revision!==meta.intent.revision||step?.is.revision!==meta.step?.revision||conditions.some((c:any)=>find(ledger,c.address)?.is.revision!==c.revision)
 const outcomes=ledger.records.flatMap(outcome=>{const data=metadata(outcome,'user-reported-guide-outcome');return data?.attempt?.address===record.address&&retained(ledger,outcome)?[{address:outcome.address,revision:outcome.is.revision,expected:data.expected,actual:data.actual,matches:data.matches,comparison:data.comparison,source:original(outcome).source,current:original(outcome)===outcome.is,scope:'exact-text-only',userReported:true,worldVerified:false}]:[]})
 return [{address:record.address,revision:record.is.revision,action:meta.action as string,expected:meta.expected as string,intent:meta.intent,step:meta.step,source:original(record).source,current:original(record)===record.is,conditions,contextStatus:missing?'missing' as const:changed?'changed' as const:'current' as const,outcomes,latestOutcome:outcomes.at(-1)??null,selectionOnly:true as const,physicalActionExecuted:false as const}]
})}
export function resolveGuideIntentAddress(ledger:EILedger,selectedAddress:string){const record=find(ledger,selectedAddress);if(!record||!retained(ledger,record))return selectedAddress;for(const realm of ['user-declared-guide-step','user-selected-guide-step','user-reported-guide-outcome','user-reported-guide-context']){const meta=metadata(record,realm),address=meta?.intent?.address;if(typeof address==='string'&&find(ledger,address)&&record.parents.includes(address))return address}return selectedAddress}
