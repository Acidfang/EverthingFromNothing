import {createEILedger,type EISeedRecord} from './ei-engine.ts'
import {THREE_TETRAHEDRON_ORDERS} from './three-tetrahedron-drawing.ts'
export const FRACTURE_ROOT='EI/SOURCE'
export const FRACTURE_ORDERS={T1:THREE_TETRAHEDRON_ORDERS[0],T2:THREE_TETRAHEDRON_ORDERS[1],T3:THREE_TETRAHEDRON_ORDERS[2]} as const
export const FRACTURE_TIP_LABELS=['will be','can be',"won't be"] as const
export function mobileTipState(centre:string,address:string){
 for(const [orientation,roles] of Object.entries(FRACTURE_ORDERS)){const index=roles.findIndex(role=>address===`${centre}::${orientation}:${role}`);if(index>=0)return {kind:'tip-state' as const,owner:centre,orientation,tipIndex:index,tip:FRACTURE_TIP_LABELS[index]!,phase:roles[index]!,address}}
 return null
}
export function mobileFractureTips(centre:string){
 return FRACTURE_TIP_LABELS.map((label,index)=>({kind:'tip-relation' as const,label,owner:centre,index,states:Object.entries(FRACTURE_ORDERS).map(([orientation,roles])=>mobileTipState(centre,`${centre}::${orientation}:${roles[index]}`)!)}))
}
export const FRACTURE_DIRECTIONS=['+X','-X','+Y','-Y','+Z','-Z'] as const
/** Operators keep their former addresses, but are not contained things or zeros.
 * No endpoint or physical movement is inferred from a direction name. */
export function mobileFractureOperators(centre:string){
 return Object.keys(FRACTURE_ORDERS).flatMap(orientation=>[...FRACTURE_DIRECTIONS,'PROCEED'].map(relation=>({address:`${centre}::${orientation}:${relation}`,kind:relation==='PROCEED'?'continuation' as const:'direction' as const,orientation,relation,from:centre,to:null,status:'unresolved-endpoint' as const,source:'src/model/mobile-fracture.ts'})))
}
/** Source-preserving local grain. Role order is not a physical pose. */
export function mobileFractureGrain(centre:string,ancestors:readonly string[]=[]){
 const records:EISeedRecord[]=[]
 for(const [i,address] of [...ancestors,centre].entries()){const parent=i?ancestors[i-1]!:null,tip=parent?mobileTipState(parent,address):null;records.push({address,value:tip?`${tip.tip} · ${tip.phase}`:'Local zero',parents:parent?[parent]:[],relations:tip?[{relation:'LOCAL_ZERO',address:parent!}]:[],source:tip?{id:'derived-tip-state',text:`${tip.tip} · ${tip.orientation} · ${tip.phase}`,locator:'src/model/mobile-fracture.ts'}:{id:'retained-zero',text:address,locator:address}})}
 for(const [orientation,roles] of Object.entries(FRACTURE_ORDERS))for(const relation of roles){
  const address=`${centre}::${orientation}:${relation}`
  const tip=mobileTipState(centre,address)!
  records.push({address,value:`${tip.tip} · ${relation}`,parents:[centre],relations:[{relation:'LOCAL_ZERO',address:centre}],source:{id:'derived-tip-state',text:`${tip.tip} · ${orientation} · ${relation}`,locator:'src/model/mobile-fracture.ts'}})
 }
 return createEILedger({records})
}
