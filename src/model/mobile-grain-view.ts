import {createEIGrainRegistry,projectEIGrain,referenceEIGrain,EI_GRAINS,type EIGrain} from './ei-grain-identity.ts'
import type {EILedger} from './ei-engine.ts'
import {FRACTURE_ROOT,mobileFractureOperators,mobileFractureTips,mobileTipState} from './mobile-fracture.ts'
export function mobileGrainView(ledger:EILedger,address:string,grain:EIGrain){
 const handle=projectEIGrain(createEIGrainRegistry(ledger),address,grain)
 const record=ledger.records.find(record=>record.address===address)!
 const children=ledger.records.filter(record=>record.parents.includes(address)).map(record=>record.address)
 const coordinate={zero:record.parents.at(-1)??address,address,path:address.split('::').slice(1),physicalMapping:null}
 const tip=record.parents.length?mobileTipState(record.parents.at(-1)!,address):null
 const labels:Record<EIGrain,string>={state:tip?`${tip.tip} · ${tip.phase}`:`${handle.state.role} r${handle.state.revision}: ${handle.state.value}`,node:tip?.tip??address,address:address,coordinate:tip?`${tip.tip} · ${tip.phase}`:coordinate.path.at(-1)??'0',pixel:'screen px'}
 return {grain,kind:tip?'tip-state' as const:'whole' as const,tip,tips:mobileFractureTips(address),tripleTetrahedron:{centre:address,presentations:3,coincident:true,isPositions:{centre:{address,role:'IS'},tip:{address,role:'IS NEXT',vertex:3},previousTip:{role:'WAS NEXT',previousRole:'IS NEXT',address:null}},source:'src/model/three-tetrahedron-drawing.ts'},reference:referenceEIGrain(handle),state:handle.state,parents:record.parents,relations:record.relations,children,operators:mobileFractureOperators(address),coordinate,label:labels[grain]}
}
export function readMobileGrainRoute(params:URLSearchParams){
 const requested=params.get('root')?.trim(),root=requested&&requested.length<=120?requested:FRACTURE_ROOT
 const requestedGrain=params.get('grain'),grain:EIGrain=EI_GRAINS.includes(requestedGrain as EIGrain)?requestedGrain as EIGrain:'node'
 let route=[root],routeDifference:string|null=null
 try{const candidate=JSON.parse(params.get('route')??'null');if(Array.isArray(candidate)&&candidate.length>=1&&candidate.length<=5&&candidate[0]===root){for(let index=1;index<candidate.length;index++){const address=candidate[index],parent=route.at(-1)!;if(typeof address!=='string'||address.length>256||!address.startsWith(`${parent}::`))break;const relation=address.slice(parent.length+2);if(/^T[123]:(WAS|IS|NEXT)$/.test(relation)){route.push(address);continue}const operator=mobileFractureOperators(parent).find(operator=>operator.address===address);if(operator)routeDifference=`${address} is a ${operator.kind} operator in this view. No connected endpoint was supplied; its parent view is retained.`;break}}}catch{/* Invalid route is not admitted. */}
 return {root,grain,route,routeDifference}
}
