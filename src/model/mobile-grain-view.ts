import {createEIGrainRegistry,projectEIGrain,referenceEIGrain,EI_GRAINS,type EIGrain} from './ei-grain-identity.ts'
import type {EILedger} from './ei-engine.ts'
import {FRACTURE_ROOT} from './mobile-fracture.ts'
export function mobileGrainView(ledger:EILedger,address:string,grain:EIGrain){
 const handle=projectEIGrain(createEIGrainRegistry(ledger),address,grain)
 const record=ledger.records.find(record=>record.address===address)!
 const children=ledger.records.filter(record=>record.parents.includes(address)).map(record=>record.address)
 const coordinate={zero:record.parents.at(-1)??address,address,path:address.split('::').slice(1),physicalMapping:null}
 const labels:Record<EIGrain,string>={state:`${handle.state.role} r${handle.state.revision}: ${handle.state.value}`,node:address.split('::').at(-1)!,address:address,coordinate:coordinate.path.at(-1)??'0',pixel:'screen px'}
 return {grain,reference:referenceEIGrain(handle),state:handle.state,parents:record.parents,relations:record.relations,children,coordinate,label:labels[grain]}
}
export function readMobileGrainRoute(params:URLSearchParams){
 const requested=params.get('root')?.trim(),root=requested&&requested.length<=120?requested:FRACTURE_ROOT
 const requestedGrain=params.get('grain'),grain:EIGrain=EI_GRAINS.includes(requestedGrain as EIGrain)?requestedGrain as EIGrain:'node'
 let route=[root]
 try{const candidate=JSON.parse(params.get('route')??'null');if(Array.isArray(candidate)&&candidate.length>=1&&candidate.length<=5&&candidate[0]===root&&candidate.every((address,index)=>typeof address==='string'&&address.length<=256&&(index===0||address.startsWith(`${candidate[index-1]}::`)&&/^T[123]:(WAS|IS|NEXT|[+-][XYZ]|PROCEED)$/.test(address.slice(candidate[index-1].length+2)))))route=candidate}catch{/* Invalid route is not admitted. */}
 return {root,grain,route}
}
