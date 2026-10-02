import {createEIGrainRegistry,projectEIGrain,readEIGrain,type EIGrain} from './ei-grain-identity.ts'
import type {EILedger} from './ei-engine.ts'
/** Choosing IS as observer ZERO resolves an existing entity; it creates no node,
 * model revision, world coordinate or external action. */
export function resolveEIObserverZero(ledger:EILedger,address:string,grain:EIGrain){
 const registry=createEIGrainRegistry(ledger),handle=projectEIGrain(registry,address,grain),state=readEIGrain(ledger,handle)
 return Object.freeze({scope:'observer-zero' as const,address:state.entity.address,revision:state.revision,sourceId:state.source.id,value:state.value,rootPreserved:true as const,modelAdvanced:false as const})
}
