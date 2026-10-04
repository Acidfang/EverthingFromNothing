import type {TransitionReceipt,TemporalRole} from './transitionEngine.ts'
import {CANONICAL_SEED} from './canonicalSeed.ts'

export type InfinityMomentBinding=Readonly<{index:string;source:string}>
export type MomentGateInput=Readonly<{
  address:string;receiptAddress:string;receipt:TransitionReceipt
  infinity:InfinityMomentBinding|null;definitionSource:string
  grain?:Readonly<{address:string;parentAddress:string|null;sourceReceipt:string;localDifference:readonly string[]}>
}>
/** A tetra is a mapping gate over moments. Port correspondence is derived from
 * the actual receipt. No Boolean truth function or physical spin is inserted. */
export function tetraMomentGate(input:MomentGateInput){
  if(!input.address||!input.receiptAddress||!input.definitionSource)throw new Error('Gate, receipt and definition addresses required')
  if(input.infinity&&(!input.infinity.index||!input.infinity.source))throw new Error('Indexed infinity binding requires provenance')
  const roles=['WAS','IS','NEXT'] as const
  const slot=(role:TemporalRole)=>role.toLowerCase() as 'was'|'is'|'next'
  const before=input.receipt.before,after=input.receipt.after
  const moved=roles.map(from=>{
    const value=before.temporal[slot(from)]
    const destinations=roles.filter(to=>after.temporal[slot(to)]===value)
    const expected=CANONICAL_SEED.transition[`${slot(from)}Becomes`]
    return Object.freeze({address:`${input.address}/port/${from}`,from,value,
      destinations:Object.freeze(destinations),expected,
      matchesRetainedRule:destinations.length===1&&destinations[0]===expected,
      source:input.receiptAddress})
  })
  const validBefore=new Set(roles.map(role=>before.temporal[slot(role)])).size===3
  const mappingResolved=validBefore&&moved.every(port=>port.matchesRetainedRule)
  const blockers=[
    ...(!mappingResolved?['Receipt does not resolve the retained role correspondence']:[]),
    ...(!input.infinity?['Addressed .infinity# binding not supplied by this ledger']:[]),
    'Directed fourth-port function is not bound by this receipt',
  ]
  return Object.freeze({address:input.address,receiptAddress:input.receiptAddress,
    definitionSource:input.definitionSource,
    mechanism:'RETAINED_MOMENT_CORRESPONDENCE' as const,
    centre:Object.freeze({selfAddress:input.address,worldPosition:null}),
    grain:input.grain?Object.freeze({...input.grain,localDifference:Object.freeze([...input.grain.localDifference])}):null,
    infinity:input.infinity?Object.freeze({...input.infinity}):null,
    beforeMoment:before.step,afterMoment:after.step,
    ports:Object.freeze(moved),mappingResolved,
    flags:Object.freeze({twist:input.receipt.twist,turn:input.receipt.turn,rotate:input.receipt.rotate}),
    blockers:Object.freeze(blockers),
    status:'OPEN_BINDING' as const,
    truthFunction:null,physicalPose:null,
    // The fourth tip's gate function has not yet been retained in this record.
    directedPort:Object.freeze({role:'DIRECTED',binding:null,status:'UNRESOLVED'}),
    committedByThisView:false as const})
}

/** Reuse exactly the same operation at each supplied grain. Threads retain
 * address identities, including cycles; no infinite expansion or new centres. */
export function recursiveMomentGates(inputs:readonly MomentGateInput[]){
  const addresses=new Set(inputs.map(input=>input.address))
  if(addresses.size!==inputs.length)throw new Error('Duplicate gate address')
  const grainIds=inputs.flatMap(input=>input.grain?[input.grain.address]:[])
  const grains=new Set(grainIds)
  if(grains.size!==grainIds.length)throw new Error('Duplicate grain address')
  return Object.freeze({gates:Object.freeze(inputs.map(tetraMomentGate)),
    threads:Object.freeze(inputs.flatMap(input=>input.grain?.parentAddress?[Object.freeze({
      from:input.grain.parentAddress,to:input.grain.address,sourceReceipt:input.grain.sourceReceipt,
      status:grains.has(input.grain.parentAddress)?'RETAINED_PARENT':'OPEN_PARENT',
    })]:[])),
    expansion:'SUPPLIED_FINITE_RECORDS_ONLY' as const})
}
