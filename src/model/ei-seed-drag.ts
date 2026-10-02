export type EISeedDropTarget=Readonly<{id:string;seedAddress:string;seedRevision:number;seedSourceId:string;environmentAddress:string;environmentRevision:number;screenToLocal:readonly [number,number,number,number,number,number];radius:number}>
type Point=Readonly<{x:number;y:number}>
/** One explicit observer gesture. It never mutates a ledger or invents a target. */
export function createEISeedDrag(){
 let active:{pointerId:number;start:Point;point:Point;context:string;targets:readonly EISeedDropTarget[]}|null=null
 const hit=(point:Point,target:EISeedDropTarget)=>{const [a,b,c,d,e,f]=target.screenToLocal;return Math.hypot(a*point.x+c*point.y+e,b*point.x+d*point.y+f)<=target.radius}
 return {
  start(pointerId:number,point:Point,context:string,targets:readonly EISeedDropTarget[]){if(active||!targets.length||!Number.isFinite(point.x)||!Number.isFinite(point.y))return false;if(targets.some(t=>!Number.isFinite(t.radius)||t.radius<=0||t.screenToLocal.some(n=>!Number.isFinite(n))))throw Error('Invalid returned target geometry');active={pointerId,start:{...point},point:{...point},context,targets:targets.map(t=>({...t,screenToLocal:[...t.screenToLocal] as unknown as EISeedDropTarget['screenToLocal']}))};return true},
  move(pointerId:number,point:Point,context:string){if(!active||active.pointerId!==pointerId)return false;if(context!==active.context||!Number.isFinite(point.x)||!Number.isFinite(point.y)){active=null;return false}active.point={...point};return true},
  finish(pointerId:number,point:Point,context:string){if(!active||active.pointerId!==pointerId)return null;const was=active;active=null;if(context!==was.context||Math.hypot(point.x-was.start.x,point.y-was.start.y)<6)return null;const matches=was.targets.filter(t=>hit(point,t));return matches.length===1?matches[0]:null},
  cancel(){active=null},get active(){return active!==null},get pointerId(){return active?.pointerId??null},get context(){return active?.context??null}
 }
}
