import type {EILedger} from './ei-engine.ts'
import {readGuideSteps} from './ei-guide-steps.ts'
/** Authored sky/ground presentation of the user's declared possible steps.
 * The mirror is another view of the same address, not another entity or a
 * physical-world feasibility proof. Only supplied prerequisite matches admit it. */
export function deriveEISeedMirrors(ledger:EILedger){
 const contexts=new Set(ledger.records.flatMap(record=>{const source=(record.was[0]??record.is).source;if(source.realm!=='user-declared-guide-step')return [];try{const at=JSON.parse(source.locator??'').intent?.address;return typeof at==='string'?[at]:[]}catch{return []}}))
 return Object.freeze([...contexts].flatMap(environment=>readGuideSteps(ledger,environment).filter(step=>step.status==='available'&&step.conditions.length>0).map(step=>Object.freeze({viewId:`seed-mirror:${step.address}:${step.revision}:${environment}`,address:step.address,revision:step.revision,sourceId:step.source.id,environmentAddress:environment,environmentRevision:step.currentIntent!.revision,conditions:step.conditions.map((condition:any)=>Object.freeze({address:condition.address,expected:condition.equals,observed:condition.actual})),scope:'matched-user-declared-prerequisites' as const,physicalPlacement:null,realized:false as const}))))
}
/** Horizon is an observer projection choice, not a source-coordinate law. */
export function projectEIEnvironmentHorizon(view:{x:number;y:number;zoom:number},size:{width:number;height:number},pitch:number){
 if(![view.x,view.y,view.zoom,size.width,size.height,pitch].every(Number.isFinite)||view.zoom<=0||size.width<=0||size.height<=0)throw new Error('Invalid horizon observer')
 const left=view.x-size.width/(2*view.zoom),right=view.x+size.width/(2*view.zoom),top=view.y-size.height/(2*view.zoom),bottom=view.y+size.height/(2*view.zoom)
 const y=view.y+(size.height/view.zoom)*Math.max(-.35,Math.min(.35,pitch*.2))
 return Object.freeze({scope:'observer-sky-ground-presentation' as const,skyPath:`M${left} ${top}H${right}V${y}H${left}Z`,groundPath:`M${left} ${y}H${right}V${bottom}H${left}Z`,linePath:`M${left} ${y}H${right}`,horizonY:y,modelAdvanced:false as const})
}
