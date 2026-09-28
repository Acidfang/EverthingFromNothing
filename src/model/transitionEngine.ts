import { CANONICAL_SEED } from "./canonicalSeed"

export type TemporalRole = (typeof CANONICAL_SEED.temporalRoles)[number]
export type TemporalState = Readonly<{was:TemporalRole;is:TemporalRole;next:TemporalRole}>
export type SystemState = Readonly<{temporal:TemporalState;step:number}>
export type TransitionReceipt = Readonly<{before:SystemState;after:SystemState;movement:typeof CANONICAL_SEED.transition.movement;proceed:true;twist:true;rotate:true;turn:true}>

const cycleTemporal=(state:TemporalState):TemporalState=>Object.freeze({was:state.is,is:state.next,next:state.was})
export const INITIAL_SYSTEM_STATE:SystemState=Object.freeze({temporal:Object.freeze({was:"WAS",is:"IS",next:"NEXT"}),step:0})

export function transition(state:SystemState):TransitionReceipt{
 const after:SystemState=Object.freeze({temporal:cycleTemporal(state.temporal),step:state.step+1})
 return Object.freeze({before:state,after,movement:CANONICAL_SEED.transition.movement,proceed:true,twist:true,rotate:true,turn:true})
}

export function verifySequentialHandoff(start:SystemState=INITIAL_SYSTEM_STATE):string[]{
 const differences:string[]=[];let state=start
 for(let n=0;n<3;n++){const receipt=transition(state);if(!receipt.proceed||!receipt.twist||!receipt.rotate||!receipt.turn)differences.push(`step-${n}-proceed-rotate-twist-turn`);state=receipt.after}
 if(state.step!==start.step+3)differences.push("step-progression")
 if(state.temporal.was!==start.temporal.was||state.temporal.is!==start.temporal.is||state.temporal.next!==start.temporal.next)differences.push("temporal-cycle")
 return differences
}
