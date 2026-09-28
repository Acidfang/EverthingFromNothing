import { CANONICAL_SEED } from "./canonicalSeed"

export type TemporalRole = (typeof CANONICAL_SEED.temporalRoles)[number]
export type TetraIndex = 0 | 1 | 2
export type TemporalState = Readonly<{
  was: TemporalRole
  is: TemporalRole
  next: TemporalRole
}>
export type TetraState = Readonly<{
  tetra: TetraIndex
  temporal: TemporalState
  relation: "ADVANCE" | "FOLLOW_LOCK"
}>
export type SystemState = Readonly<{
  tetrahedrons: readonly [TetraState, TetraState, TetraState]
  advancing: TetraIndex
  step: number
}>
export type TransitionReceipt = Readonly<{
  before: SystemState
  after: SystemState
  advanced: TetraIndex
  movement: typeof CANONICAL_SEED.transition.movement
  proceed: true
  twist: true
  turn: true
}>

const cycleTemporal=(state:TemporalState):TemporalState=>Object.freeze({
  was: state.is,
  is: state.next,
  next: state.was,
})

const temporal=(was:TemporalRole,is:TemporalRole,next:TemporalRole):TemporalState=>Object.freeze({was,is,next})

export const INITIAL_SYSTEM_STATE:SystemState=Object.freeze({
  tetrahedrons:Object.freeze([
    Object.freeze({tetra:0 as const,temporal:temporal("WAS","IS","NEXT"),relation:"ADVANCE" as const}),
    Object.freeze({tetra:1 as const,temporal:temporal("NEXT","WAS","IS"),relation:"FOLLOW_LOCK" as const}),
    Object.freeze({tetra:2 as const,temporal:temporal("IS","NEXT","WAS"),relation:"FOLLOW_LOCK" as const}),
  ]),
  advancing:0,
  step:0,
})

export function transition(state:SystemState):TransitionReceipt{
  const advanced=state.advancing
  const nextAdvancing=((advanced+1)%CANONICAL_SEED.tetrahedrons) as TetraIndex
  const tetrahedrons=state.tetrahedrons.map((t,i)=>Object.freeze({
    tetra:t.tetra,
    temporal:i===advanced?cycleTemporal(t.temporal):t.temporal,
    relation:(i===nextAdvancing?"ADVANCE":"FOLLOW_LOCK") as "ADVANCE"|"FOLLOW_LOCK",
  })) as unknown as readonly [TetraState,TetraState,TetraState]
  const after:SystemState=Object.freeze({tetrahedrons:Object.freeze(tetrahedrons),advancing:nextAdvancing,step:state.step+1})
  return Object.freeze({before:state,after,advanced,movement:CANONICAL_SEED.transition.movement,proceed:true,twist:true,turn:true})
}

export function verifySequentialHandoff(start:SystemState=INITIAL_SYSTEM_STATE):string[]{
  const differences:string[]=[]
  let state=start
  const advanced:TetraIndex[]=[]
  for(let n=0;n<3;n++){
    const receipt=transition(state)
    advanced.push(receipt.advanced)
    const changed=receipt.before.tetrahedrons.filter((t,i)=>t.temporal!==receipt.after.tetrahedrons[i].temporal).length
    if(changed!==1)differences.push(`step-${n}-must-change-one-tetra`)
    if(receipt.after.tetrahedrons.filter(t=>t.relation==="ADVANCE").length!==1)differences.push(`step-${n}-one-advance`)
    if(!receipt.proceed||!receipt.twist||!receipt.turn)differences.push(`step-${n}-proceed-twist-turn`)
    state=receipt.after
  }
  if(advanced.join(",")!=="0,1,2")differences.push("advance-order")
  if(state.advancing!==0)differences.push("handoff-cycle")
  if(state.step!==start.step+3)differences.push("step-progression")
  return differences
}
