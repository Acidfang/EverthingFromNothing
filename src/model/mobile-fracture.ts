import {createEILedger,type EISeedRecord} from './ei-engine.ts'
export const FRACTURE_ROOT='EI/SOURCE'
export const FRACTURE_ORDERS={T1:['WAS','IS','NEXT'],T2:['NEXT','WAS','IS'],T3:['IS','NEXT','WAS']} as const
/** Source-preserving local grain. Role order is not a physical pose. */
export function mobileFractureGrain(centre:string,ancestors:readonly string[]=[]){
 const records:EISeedRecord[]=[]
 for(const [i,address] of [...ancestors,centre].entries())records.push({address,value:address===centre?'Local zero':'Retained parent zero',parents:i?[ancestors[i-1]!]:[],source:{id:'retained-zero',text:address,locator:address}})
 for(const [orientation,roles] of Object.entries(FRACTURE_ORDERS))for(const relation of [...roles,'+X','-X','+Y','-Y','+Z','-Z','PROCEED']){
  const address=`${centre}::${orientation}:${relation}`
  records.push({address,value:relation,parents:[centre],relations:[{relation:'LOCAL_ZERO',address:centre}],source:{id:'derived-local-field',text:`${orientation} · ${relation}`,locator:'src/model/mobile-fracture.ts'}})
 }
 return createEILedger({records})
}
