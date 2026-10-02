import {fingerprintEIAnimationContent,type EIAnimationFrame,type EIAnimationReadback} from './ei-animation-cycle.ts'
export type EIIdleObservation=Readonly<{frameKey:string;entityAddress:string;revision:number;generation:string;observedAt:number;content:EIAnimationReadback['content']}>
export type EIIdleState=Readonly<{WAS:EIIdleObservation|null;IS:EIIdleObservation|null;NEXT:Readonly<{frameKey:string;expectedFingerprint:string}>|null;observations:number;unchanged:number;differences:number;status:'unobserved'|'unchanged'|'difference'|'unavailable'|'stale'}>
export const createEIIdleState=():EIIdleState=>Object.freeze({WAS:null,IS:null,NEXT:null,observations:0,unchanged:0,differences:0,status:'unobserved'})
/** Bounded two-observation memory. Observation time is actual carrier evidence;
 * it does not schedule model evolution or manufacture a changed source state. */
export function observeEIIdle(state:EIIdleState,expected:EIAnimationFrame,readback:EIAnimationReadback|null,observedAt:number):EIIdleState{
 if(!Number.isFinite(observedAt)||observedAt<0)throw new Error('An actual finite observation time is required')
 if(!readback||readback.failure)return Object.freeze({...state,status:'unavailable'})
 if(readback.frameKey!==expected.frameKey||readback.generation!==expected.generation||readback.sequence!==expected.sequence||JSON.stringify(readback.source)!==JSON.stringify(expected.source))return Object.freeze({...state,status:'stale'})
 const content=typeof readback.content==='string'?readback.content:JSON.parse(JSON.stringify(readback.content))
 const changed=typeof content==='string'&&typeof expected.content==='string'?content!==expected.content:JSON.stringify(content)!==JSON.stringify(expected.content)
 const IS=Object.freeze({frameKey:expected.frameKey,entityAddress:expected.source.entityAddress,revision:expected.source.revision,generation:expected.generation,observedAt,content})
 return Object.freeze({WAS:state.IS,IS,NEXT:Object.freeze({frameKey:expected.frameKey,expectedFingerprint:fingerprintEIAnimationContent(expected.content)}),observations:state.observations+1,unchanged:state.unchanged+(changed?0:1),differences:state.differences+(changed?1:0),status:changed?'difference':'unchanged'})
}
