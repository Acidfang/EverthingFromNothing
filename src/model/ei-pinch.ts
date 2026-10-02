import {clampEIFieldZoom} from './ei-field-array-view.ts'
export type PinchPoint={x:number;y:number}
export type PinchCamera={x:number;y:number;zoom:number;roll?:number}
export type PinchViewport={left:number;top:number;width:number;height:number;logicalWidth:number;logicalHeight:number}
const midpoint=(a:PinchPoint,b:PinchPoint)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2})
const distance=(a:PinchPoint,b:PinchPoint)=>Math.hypot(a.x-b.x,a.y-b.y)
function offset(p:PinchPoint,v:PinchViewport){const scale=Math.min(v.width/v.logicalWidth,v.height/v.logicalHeight);if(!Number.isFinite(scale)||scale<=0)throw new Error('Missing pinch viewport');return {x:(p.x-v.left-v.width/2)/scale,y:(p.y-v.top-v.height/2)/scale}}
/** Observer camera only. No canonical address, operation or model state changes. */
const unroll=(p:PinchPoint,roll=0)=>({x:p.x*Math.cos(roll)+p.y*Math.sin(roll),y:-p.x*Math.sin(roll)+p.y*Math.cos(roll)})
const angle=(a:PinchPoint,b:PinchPoint)=>Math.atan2(b.y-a.y,b.x-a.x)
export function createEIPinch(){
 const points=new Map<number,PinchPoint>();let blocked=false
 let basis:{distance:number;angle:number;anchor:PinchPoint;camera:PinchCamera;viewport:string}|null=null
 const start=(camera:PinchCamera,viewport:PinchViewport)=>{const [a,b]=[...points.values()];const d=distance(a,b),o=unroll(offset(midpoint(a,b),viewport),camera.roll);basis=d>0?{distance:d,angle:angle(a,b),anchor:{x:camera.x+o.x/camera.zoom,y:camera.y+o.y/camera.zoom},camera:{...camera},viewport:JSON.stringify(viewport)}:null}
 return {
  down(id:number,p:PinchPoint,camera:PinchCamera,viewport:PinchViewport){points.set(id,p);if(points.size>=2){blocked=true;start(camera,viewport)}return blocked},
  move(id:number,p:PinchPoint,camera:PinchCamera,viewport:PinchViewport,minimum:number):PinchCamera|null{
   if(!points.has(id))return null;points.set(id,p);if(points.size!==2)return null
   if(!basis||basis.viewport!==JSON.stringify(viewport)){start(camera,viewport);return null}
   const [a,b]=[...points.values()],delta=angle(a,b)-basis.angle,roll=(basis.camera.roll??0)+Math.atan2(Math.sin(delta),Math.cos(delta)),zoom=clampEIFieldZoom(basis.camera.zoom*distance(a,b)/basis.distance,minimum),o=unroll(offset(midpoint(a,b),viewport),roll)
   return {x:basis.anchor.x-o.x/zoom,y:basis.anchor.y-o.y/zoom,zoom,...(basis.camera.roll===undefined?{}:{roll})}
  },
  end(id:number){const suppress=blocked;points.delete(id);basis=null;if(points.size===0)blocked=false;return suppress},
  cancel(){points.clear();basis=null;blocked=false},
  get remaining(){return points.size===1?[...points.values()][0]:null},
  has(id:number){return points.has(id)},
  get active(){return points.size>=2},get suppress(){return blocked},get count(){return points.size}
 }
}
export function panEIObserver(camera:PinchCamera,from:PinchPoint,to:PinchPoint,viewport:PinchViewport):PinchCamera{
 const a=unroll(offset(from,viewport),camera.roll),b=unroll(offset(to,viewport),camera.roll);return {...camera,x:camera.x-(b.x-a.x)/camera.zoom,y:camera.y-(b.y-a.y)/camera.zoom}
}
/** Wheel units belong to the observer input, not the source mechanism. */
export function zoomEIObserverAt(camera:PinchCamera,point:PinchPoint,viewport:PinchViewport,deltaY:number,deltaMode:number,minimum:number):PinchCamera{
 if(!Number.isFinite(deltaY)||![0,1,2].includes(deltaMode))throw new Error('Invalid wheel input')
 const pixels=deltaY*(deltaMode===1?16:deltaMode===2?viewport.height:1),zoom=clampEIFieldZoom(camera.zoom*Math.exp(-Math.max(-500,Math.min(500,pixels))*.002),minimum),o=unroll(offset(point,viewport),camera.roll)
 return {...camera,x:camera.x+o.x/camera.zoom-o.x/zoom,y:camera.y+o.y/camera.zoom-o.y/zoom,zoom}
}
export function eiMouseGesture(button:number,shift=false):'pan'|'orbit'|'ignore'{return button===2||button===0&&shift?'orbit':button===0||button===1?'pan':'ignore'}
