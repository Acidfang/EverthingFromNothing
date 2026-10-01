import {createLedgerContinuum,type LedgerContinuum} from "./kernel.ts"
export type StateRole="WAS"|"IS"|"NEXT"
export type StateSelection=Readonly<{act:number;role:StateRole;address:string}>
export const MIN_VIEW_ZOOM=.125
export const MAX_VIEW_ZOOM=65536
export function clampViewZoom(value:number){return Math.min(MAX_VIEW_ZOOM,Math.max(MIN_VIEW_ZOOM,Number.isFinite(value)?value:MIN_VIEW_ZOOM))}
export type ViewPoint=Readonly<{x:number;y:number}>
export function fitView(points:readonly ViewPoint[],width:number,height:number){
 if(!points.length)return null
 let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity
 for(const p of points){minX=Math.min(minX,p.x);maxX=Math.max(maxX,p.x);minY=Math.min(minY,p.y);maxY=Math.max(maxY,p.y)}
 const spanX=Math.max(.8,maxX-minX),spanY=Math.max(.8,maxY-minY)
 return{zoom:clampViewZoom(Math.min(Math.max(32,width-64)/spanX,Math.max(32,height-64)/spanY)*.8),x:(minX+maxX)/2,y:(minY+maxY)/2}
}
export type NodeHit=Readonly<{address:string;x:number;y:number;polygons:readonly (readonly ViewPoint[])[]}>
function inTriangle(p:ViewPoint,a:ViewPoint,b:ViewPoint,c:ViewPoint){const s=(u:ViewPoint,v:ViewPoint,w:ViewPoint)=>(u.x-w.x)*(v.y-w.y)-(v.x-w.x)*(u.y-w.y);const d=[s(p,a,b),s(p,b,c),s(p,c,a)];return !(d.some(x=>x<0)&&d.some(x=>x>0))&&Math.abs(s(a,b,c))>1e-8}
export function pickNodes(nodes:readonly NodeHit[],point:ViewPoint,tolerance=12):readonly string[]{
 return nodes.filter(n=>Math.hypot(n.x-point.x,n.y-point.y)<=tolerance||n.polygons.some(p=>p.length===4&&[[0,1,2],[0,1,3],[0,2,3],[1,2,3]].some(([a,b,c])=>inTriangle(point,p[a],p[b],p[c])))).sort((a,b)=>Math.hypot(a.x-point.x,a.y-point.y)-Math.hypot(b.x-point.x,b.y-point.y)||a.address.localeCompare(b.address)).map(n=>n.address).filter((a,i,all)=>all.indexOf(a)===i)
}
export function stateAddress(selection:StateSelection){return `selected-kernel/act/${selection.act}/${selection.role}/${selection.address}`}
export function parseStateAddress(value:string):StateSelection|null{const m=/^selected-kernel\/act\/(\d+)\/(WAS|IS|NEXT)\/(-?\d+,-?\d+,-?\d+)$/.exec(value.trim());if(!m||!Number.isSafeInteger(+m[1])||!m[3].split(',').every(n=>Number.isSafeInteger(+n)))return null;return{act:+m[1],role:m[2] as StateRole,address:m[3].split(',').map(Number).join(',')}}
export function continuumAtAct(live:LedgerContinuum,act:number):LedgerContinuum{
 if(!Number.isSafeInteger(act)||act<0||act>live.state.act)throw new Error("That Act has not been retained in this session")
 if(act===live.state.act)return live
 if(act===0)return createLedgerContinuum()
 const receipt=live.receipts.find(r=>r.toAct===act);if(!receipt)throw new Error("Missing retained Act receipt")
 const prior=act===1?createLedgerContinuum().state.is:new Set(live.receipts.find(r=>r.toAct===act-1)!.entries.filter(e=>e.remainsDifferent).map(e=>e.address))
 return{state:{act,was:prior,is:new Set(receipt.entries.filter(e=>e.remainsDifferent).map(e=>e.address))},receipts:live.receipts.filter(r=>r.toAct<=act),activeAddress:live.activeAddress}
}

export function usableFieldView(width:number,height:number,toolbarBottom:number,inspecting:boolean){
 const left=inspecting&&width>800?490:0,top=Math.max(340,toolbarBottom+12,Math.max(110,Math.min(220,height*.28))+28)
 return{left,top,width:Math.max(32,width-left),height:Math.max(32,height-top-70)}
}

export function isCurrentActFrame(framedAct:number,liveAct:number){return Number.isSafeInteger(framedAct)&&framedAct>=0&&framedAct===liveAct}
/** Pending view actions only; cancellation never changes a committed kernel state. */
export function createViewAdvanceQueue(){
 let pending=0
 return{get pending(){return pending},request(){pending++;return pending},cancel(){const cancelled=pending;pending=0;return cancelled},consumeCurrentFrame(framedAct:number,liveAct:number){if(pending===0||!isCurrentActFrame(framedAct,liveAct))return false;pending--;return true}}
}
