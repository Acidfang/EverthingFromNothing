export const COMMUNICATION_STAGES=Object.freeze([
 "SOURCE_STATE","EXPRESSION","CARRIER","OBSERVATION","RECONSTRUCTION","RESPONSE","RECEIPT",
] as const)

export const COMMUNICATION_CHANNELS=Object.freeze([
 "HUMAN","EI_AGENT","VOICE","TEXT","VISION","IMAGE_VISION","FILE","CODE","WEB","DEVICE","DEVICE_SENSOR","UI","UI_CONTROL","MEMORY","GUIDANCE","RESPONSE",
] as const)

export type CommunicationChannel=(typeof COMMUNICATION_CHANNELS)[number]
export type ParticipantState=Readonly<{participant:string;address:string;was:string;is:string;next:string}>
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
}>

export function communicate(input:Readonly<{
 id:string;source:ParticipantState;destination:ParticipantState;channel:CommunicationChannel
 expression:string;carrier?:string;observation?:string;reconstruction?:string;response?:string
}>):CommunicationOccurrence{
 if(input.source.participant===input.destination.participant&&input.source.address===input.destination.address)throw new Error("Communication requires independently addressed participant states")
 const carrier=input.carrier??input.expression
 const observation=input.observation??carrier
 const reconstruction=input.reconstruction??observation
 const response=input.response??""
 const difference=reconstruction!==input.expression
 return Object.freeze({...input,carrier,observation,reconstruction,response,difference,
  receipt:`${input.id}:${input.source.address}->${input.destination.address}:${input.channel}:${difference?"DIFFERENCE":"RETAINED"}`})
}

export const COMMUNICATION_INVARIANT=Object.freeze({
 stages:COMMUNICATION_STAGES,
 channels:COMMUNICATION_CHANNELS,
 sharedAddressDoesNotMeanSharedState:true,
 interactionCreatesRelationNotMerge:true,
 participantIdentityRetained:true,
 sourceStateRetained:true,
 destinationStateRetained:true,
 differenceExplicit:true,
 receiptRequired:true,
})
