import type {EILedger} from './ei-engine.ts'
import {readGuideSteps} from './ei-guide-steps.ts'
/** Fit addressed objects into the unobstructed field, while the environment
 * continues behind its floating controls. Insets are screen presentation only. */
export function fitEIEnvironmentObjects(bounds:{left:number;right:number;top:number;bottom:number},size:{width:number;height:number},maximum=Infinity){
 const dock=Math.min(150,Math.max(82,size.height*.2)),top=Math.min(90,size.height*.15)
 const usable=Math.max(1,size.height-dock-top),zoom=Math.min(size.width/Math.max(1,bounds.right-bounds.left),usable/Math.max(1,bounds.bottom-bounds.top),maximum)
 return {x:(bounds.left+bounds.right)/2,y:(bounds.top+bounds.bottom)/2+(dock-top)/(2*zoom),zoom}
}
/** Authored sky/ground presentation of the user's declared possible steps.
 * The mirror is another view of the same address, not another entity or a
 * physical-world feasibility proof. Only supplied prerequisite matches admit it. */
export function deriveEISeedMirrors(ledger:EILedger){
 const contexts=new Set(ledger.records.flatMap(record=>{const source=(record.was[0]??record.is).source;if(source.realm!=='user-declared-guide-step')return [];try{const at=JSON.parse(source.locator??'').intent?.address;return typeof at==='string'?[at]:[]}catch{return []}}))
 return Object.freeze([...contexts].flatMap(environment=>readGuideSteps(ledger,environment).filter(step=>step.status==='available'&&step.conditions.length>0).map(step=>Object.freeze({viewId:`seed-mirror:${step.address}:${step.revision}:${environment}`,address:step.address,revision:step.revision,sourceId:step.source.id,environmentAddress:environment,environmentRevision:step.currentIntent!.revision,conditions:step.conditions.map((condition:any)=>Object.freeze({address:condition.address,expected:condition.equals,observed:condition.actual})),scope:'matched-user-declared-prerequisites' as const,physicalPlacement:null,realized:false as const}))))
}
/** Fixed viewport presentation requested by the user. Observer movement changes
 * objects, not this screen-space horizon. This is not canonical source geometry. */
export const EI_HORIZON_FRACTION=.816
export function projectEIEnvironmentHorizon(view:{x:number;y:number;zoom:number},size:{width:number;height:number},pitch:number){
 if(![view.x,view.y,view.zoom,size.width,size.height,pitch].every(Number.isFinite)||view.zoom<=0||size.width<=0||size.height<=0)throw new Error('Invalid horizon observer')
 const left=view.x-size.width/(2*view.zoom),right=view.x+size.width/(2*view.zoom),top=view.y-size.height/(2*view.zoom),bottom=view.y+size.height/(2*view.zoom)
 const y=top+size.height/view.zoom*EI_HORIZON_FRACTION
 return Object.freeze({scope:'viewport-sky-ground-presentation' as const,skyPath:`M${left} ${top}H${right}V${y}H${left}Z`,groundPath:`M${left} ${y}H${right}V${bottom}H${left}Z`,linePath:`M${left} ${y}H${right}`,horizonY:y,modelAdvanced:false as const})
}
/** Uniform scale of the existing well/bucket meshes. Their y=0 projected
 * contact points (well133, bucket61) meet the same screen ground plane. */
export function projectEIGroundLandmark(size:{width:number;height:number},slots=3){
 if(![size.width,size.height].every(Number.isFinite)||size.width<=0||size.height<=0||!Number.isSafeInteger(slots)||slots<0||slots>32)throw Error('Invalid ground landmark viewport')
 const width=192+76*slots,unit=Math.min(1,Math.max(1,size.width-24)/width,size.height*(1-EI_HORIZON_FRACTION)/150),contactY=size.height-55*unit
 return Object.freeze({unit,contactY,top:contactY-133*unit,width:width*unit,horizonY:size.height*EI_HORIZON_FRACTION,scope:'viewport-ground-contact' as const})
}
