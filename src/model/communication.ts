export const COMMUNICATION_STAGES=Object.freeze([
 "SOURCE_STATE","EXPRESSION","CARRIER","OBSERVATION","RECONSTRUCTION","RESPONSE","RECEIPT",
] as const)

export const COMMUNICATION_CHANNELS=Object.freeze([
 "HUMAN","EI_AGENT","VOICE","TEXT","VISION","IMAGE_VISION","FILE","CODE","WEB","DEVICE","DEVICE_SENSOR","UI","UI_CONTROL","MEMORY","GUIDANCE","RESPONSE",
] as const)

export type CommunicationChannel=(typeof COMMUNICATION_CHANNELS)[number]
export type CommunicationStage=(typeof COMMUNICATION_STAGES)[number]
export type Triad<T=string>=Readonly<{was:T;is:T;next:T}>
export type ParticipantState=Readonly<{participant:string;address:string;was:string;is:string;next:string}>
export type StageTriads=Readonly<Record<CommunicationStage,Triad>>

const triad=(was:string,is:string,next:string):Triad=>Object.freeze({was,is,next})
const stageTriad=(id:string,stage:CommunicationStage,value:string):Triad=>triad(
 `${id}/${stage}/WAS`,
 `${id}/${stage}/IS:${value}`,
 `${id}/${stage}/NEXT`,
)

export function triadComplete(t:Triad):boolean{return Boolean(t.was&&t.is&&t.next)}
export function cycleTriad<T>(t:Triad<T>):Triad<T>{return Object.freeze({was:t.is,is:t.next,next:t.was})}

export type CommunicationOccurrence=Readonly<{
 id:string
 source:ParticipantState
 destination:ParticipantState
 channel:CommunicationChannel
 expression:string
 carrier:string
 observation:string
 reconstruction:string
 response:string
 receipt:string
 difference:boolean
 triads:StageTriads
 allTriadsMet:true
}>

export function communicate(input:Readonly<{
 id:string;source:ParticipantState;destination:ParticipantState;channel:CommunicationChannel
 expression:string;carrier?:string;observation?:string;reconstruction?:string;response?:string
}>):CommunicationOccurrence{
 if(input.source.participant===input.destination.participant&&input.source.address===input.destination.address)throw new Error("Communication requires independently addressed participant states")
 if(!triadComplete(input.source)||!triadComplete(input.destination))throw new Error("Both participant triads are required")
 const carrier=input.carrier??input.expression
 const observation=input.observation??carrier
 const reconstruction=input.reconstruction??observation
 const response=input.response??""
 const difference=reconstruction!==input.expression
 const receipt=`${input.id}:${input.source.address}->${input.destination.address}:${input.channel}:${difference?"DIFFERENCE":"RETAINED"}`
 const values:Record<CommunicationStage,string>={
  SOURCE_STATE:input.source.is,EXPRESSION:input.expression,CARRIER:carrier,OBSERVATION:observation,
  RECONSTRUCTION:reconstruction,RESPONSE:response,RECEIPT:receipt,
 }
 const triads=Object.freeze(Object.fromEntries(COMMUNICATION_STAGES.map(stage=>[stage,stageTriad(input.id,stage,values[stage])])) as unknown as StageTriads)
 const allTriadsMet=COMMUNICATION_STAGES.every(stage=>triadComplete(triads[stage]))
 if(!allTriadsMet)throw new Error("Every communication stage requires a complete WAS / IS / NEXT triad")
 return Object.freeze({...input,carrier,observation,reconstruction,response,difference,receipt,triads,allTriadsMet:true as const})
}

export const COMMUNICATION_INVARIANT=Object.freeze({
 stages:COMMUNICATION_STAGES,
 channels:COMMUNICATION_CHANNELS,
 triad:["WAS","IS","NEXT"] as const,
 triadRequiredAtEveryStage:true,
 completeChainRequired:true,
 sharedAddressDoesNotMeanSharedState:true,
 interactionCreatesRelationNotMerge:true,
 participantIdentityRetained:true,
 sourceStateRetained:true,
 destinationStateRetained:true,
 differenceExplicit:true,
 receiptRequired:true,
})
