import { useEffect, useMemo, useRef, useState } from "react"
import { CANONICAL_SEED, OPEN_DIFFERENCES } from "./model/canonicalSeed"
import { ROOT_ADDRESS, addressKey, childAddress, type Address } from "./model/addressEngine"
import { createRootLedger, fractureAt } from "./model/fieldLedger"
import "./infinity.css"

type V3={x:number;y:number;z:number}
type DrawNode={address:Address;p:V3;depth:number}
const BASIS:readonly V3[]=[{x:1,y:1,z:1},{x:-1,y:-1,z:1},{x:-1,y:1,z:-1},{x:1,y:-1,z:-1}]
const add=(a:V3,b:V3):V3=>({x:a.x+b.x,y:a.y+b.y,z:a.z+b.z})
const mul=(a:V3,s:number):V3=>({x:a.x*s,y:a.y*s,z:a.z*s})
const rotate=(p:V3,yaw:number,pitch:number):V3=>{const cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch),x=p.x*cy-p.z*sy,z=p.x*sy+p.z*cy;return{x,y:p.y*cp-z*sp,z:p.y*sp+z*cp}}

// Every visible grain is resolved from its complete address lineage.
// Address is the authority; rendering does not maintain a second geometry state.
const addressPosition=(address:Address):V3=>{
 let p:V3={x:0,y:0,z:0}
 for(const branch of address.path)p=add(p,BASIS[branch])
 return p
}

// The fracture/address field is not depth-limited.  Materialise only addresses
// required by the finite observation window; the window never becomes a model limit.
function buildView(observationBudget:number):DrawNode[]{
 let ledger=createRootLedger(),frontier:[Address,number][]=[[ROOT_ADDRESS,0]]
 const nodes:DrawNode[]=[{address:ROOT_ADDRESS,p:addressPosition(ROOT_ADDRESS),depth:0}]
 while(frontier.length&&nodes.length<observationBudget){
  const [address,depth]=frontier.shift()!
  ledger=fractureAt(ledger,address)
  for(let branch=0;branch<CANONICAL_SEED.fracture.addressedChildren&&nodes.length<observationBudget;branch++){
   const child=childAddress(address,branch)
   nodes.push({address:child,p:addressPosition(child),depth:depth+1})
   frontier.push([child,depth+1])
  }
 }
 return nodes
}

export function InfinityApp(){
 const canvas=useRef<HTMLCanvasElement>(null),pointers=useRef(new Map<number,{x:number;y:number}>()),pinch=useRef<number|null>(null),gesture=useRef<{x:number;y:number;moved:boolean}|null>(null)
 const [zoom,setZoom]=useState(1),[yaw,setYaw]=useState(-.65),[pitch,setPitch]=useState(.45),[selected,setSelected]=useState("ZERO")
 const nodes=useMemo(()=>buildView(4096),[])
 useEffect(()=>{const c=canvas.current;if(!c)return;const ctx=c.getContext("2d");if(!ctx)return;const draw=()=>{const r=c.getBoundingClientRect(),dpr=devicePixelRatio||1;c.width=Math.max(1,Math.floor(r.width*dpr));c.height=Math.max(1,Math.floor(r.height*dpr));ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle="#050708";ctx.fillRect(0,0,r.width,r.height);const projected=nodes.map(n=>({...n,q:rotate(n.p,yaw,pitch)})),extent=Math.max(1,...projected.flatMap(n=>[Math.abs(n.q.x),Math.abs(n.q.y)])),scale=Math.min(r.width,r.height)*.42/extent*zoom;for(const n of projected.sort((a,b)=>a.q.z-b.q.z)){const x=Math.round(r.width/2+n.q.x*scale),y=Math.round(r.height/2-n.q.y*scale);ctx.fillStyle=addressKey(n.address)===selected?"#eeeade":"#e5ad56";ctx.fillRect(x,y,1,1)}};draw();addEventListener("resize",draw);return()=>removeEventListener("resize",draw)},[nodes,zoom,yaw,pitch,selected])
 const pick=(x:number,y:number)=>{const c=canvas.current;if(!c)return;const r=c.getBoundingClientRect(),projected=nodes.map(n=>({...n,q:rotate(n.p,yaw,pitch)})),extent=Math.max(1,...projected.flatMap(n=>[Math.abs(n.q.x),Math.abs(n.q.y)])),scale=Math.min(r.width,r.height)*.42/extent*zoom;let best:{key:string;d:number}|null=null;for(const n of projected){const sx=r.width/2+n.q.x*scale,sy=r.height/2-n.q.y*scale,d=Math.hypot(x-r.left-sx,y-r.top-sy);if(!best||d<best.d)best={key:addressKey(n.address),d}}if(best&&best.d<=8)setSelected(best.key)}
 const move=(id:number,x:number,y:number)=>{const previous=pointers.current.get(id);pointers.current.set(id,{x,y});if(pointers.current.size===2){gesture.current=null;const [a,b]=[...pointers.current.values()],d=Math.hypot(a.x-b.x,a.y-b.y);if(pinch.current&&pinch.current>0)setZoom(z=>Math.max(.125,Math.min(64,z*d/pinch.current!)));pinch.current=d;return}if(previous&&gesture.current){const dx=x-previous.x,dy=y-previous.y;if(Math.hypot(x-gesture.current.x,y-gesture.current.y)>3)gesture.current.moved=true;setYaw(v=>v+dx*.008);setPitch(v=>Math.max(-Math.PI/2,Math.min(Math.PI/2,v+dy*.008)))}}
 const release=(id:number,x:number,y:number)=>{const g=gesture.current;pointers.current.delete(id);if(pointers.current.size<2)pinch.current=null;if(!pointers.current.size){if(g&&!g.moved)pick(x,y);gesture.current=null}}
 return <main className="infinity-map"><section className="infinity-field" aria-label="Notodus recursive addressed field"><canvas ref={canvas} className="infinity-canvas"
  onWheel={e=>{e.preventDefault();setZoom(z=>Math.max(.125,Math.min(64,z*Math.exp(-e.deltaY*.0015))))}}
  onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);pointers.current.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.current.size===1)gesture.current={x:e.clientX,y:e.clientY,moved:false}}}
  onPointerMove={e=>{if(pointers.current.has(e.pointerId))move(e.pointerId,e.clientX,e.clientY)}} onPointerUp={e=>release(e.pointerId,e.clientX,e.clientY)} onPointerCancel={e=>release(e.pointerId,e.clientX,e.clientY)}
  onDoubleClick={()=>{setZoom(1);setYaw(-.65);setPitch(.45)}} />
  <div className="infinity-readout" aria-live="polite"><div>{selected} · {nodes.length} visible addressed nodes · unbounded address continuation</div><div>NODE = CENTRE = PIXEL = ADDRESS · instant address-driven 3D · ledger driven · .infinity1→1 is the full rotate+twist map · full ordered address is authority</div><div>4 children/address · 6 pair gates · 4 triad gates · fixed ZERO lineage</div><div>finite observation only · full fracture map remains unfiltered · all communication forms are addressed in-field · wheel/pinch zoom {zoom.toFixed(2)}× · drag rotates · click selects · double-click resets</div><div>OPEN MODEL DIFFERENCES: {OPEN_DIFFERENCES.join(" · ")}</div></div>
 </section></main>
}
