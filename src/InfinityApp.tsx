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

function buildView(depthLimit:number):DrawNode[]{
  let ledger=createRootLedger()
  const nodes:DrawNode[]=[{address:ROOT_ADDRESS,p:{x:0,y:0,z:0},depth:0}]
  const walk=(address:Address,p:V3,depth:number,scale:number)=>{
    if(depth>=depthLimit)return
    ledger=fractureAt(ledger,address)
    for(let branch=0;branch<CANONICAL_SEED.fracture.addressedChildren;branch++){
      const child=childAddress(address,branch)
      const cp=add(p,mul(BASIS[branch],scale))
      nodes.push({address:child,p:cp,depth:depth+1})
      walk(child,cp,depth+1,scale*.5)
    }
  }
  walk(ROOT_ADDRESS,{x:0,y:0,z:0},0,1)
  return nodes
}

export function InfinityApp(){
  const canvas=useRef<HTMLCanvasElement>(null)
  const [zoom,setZoom]=useState(1)
  const [yaw,setYaw]=useState(-.65)
  const [pitch,setPitch]=useState(.45)
  const [selected,setSelected]=useState("ZERO")
  const drag=useRef<{x:number;y:number}|null>(null)
  const nodes=useMemo(()=>buildView(4),[])

  useEffect(()=>{const c=canvas.current;if(!c)return;const ctx=c.getContext("2d");if(!ctx)return
    const draw=()=>{const r=c.getBoundingClientRect(),dpr=devicePixelRatio||1;c.width=Math.max(1,Math.floor(r.width*dpr));c.height=Math.max(1,Math.floor(r.height*dpr));ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle="#050708";ctx.fillRect(0,0,r.width,r.height)
      const projected=nodes.map(n=>({...n,q:rotate(n.p,yaw,pitch)})),extent=Math.max(1,...projected.flatMap(n=>[Math.abs(n.q.x),Math.abs(n.q.y)])),scale=Math.min(r.width,r.height)*.42/extent*zoom
      for(const n of projected.sort((a,b)=>a.q.z-b.q.z)){const x=Math.round(r.width/2+n.q.x*scale),y=Math.round(r.height/2-n.q.y*scale);ctx.fillStyle=addressKey(n.address)===selected?"#eeeade":"#e5ad56";ctx.fillRect(x,y,1,1)}
    };draw();addEventListener("resize",draw);return()=>removeEventListener("resize",draw)
  },[nodes,zoom,yaw,pitch,selected])

  const pick=(x:number,y:number)=>{const c=canvas.current;if(!c)return;const r=c.getBoundingClientRect(),projected=nodes.map(n=>({...n,q:rotate(n.p,yaw,pitch)})),extent=Math.max(1,...projected.flatMap(n=>[Math.abs(n.q.x),Math.abs(n.q.y)])),scale=Math.min(r.width,r.height)*.42/extent*zoom;let best:{key:string;d:number}|null=null;for(const n of projected){const sx=r.width/2+n.q.x*scale,sy=r.height/2-n.q.y*scale,d=Math.hypot(x-r.left-sx,y-r.top-sy);if(!best||d<best.d)best={key:addressKey(n.address),d}}if(best&&best.d<=8)setSelected(best.key)}

  return <main className="infinity-map"><section className="infinity-field" aria-label="Notodus recursive addressed field"><canvas ref={canvas} className="infinity-canvas"
    onWheel={e=>{e.preventDefault();setZoom(z=>Math.max(.125,Math.min(64,z*Math.exp(-e.deltaY*.0015))))}}
    onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);drag.current={x:e.clientX,y:e.clientY}}}
    onPointerMove={e=>{if(!drag.current)return;const dx=e.clientX-drag.current.x,dy=e.clientY-drag.current.y;drag.current={x:e.clientX,y:e.clientY};setYaw(v=>v+dx*.008);setPitch(v=>Math.max(-Math.PI/2,Math.min(Math.PI/2,v+dy*.008)))}}
    onPointerUp={e=>{if(drag.current)pick(e.clientX,e.clientY);drag.current=null}} onPointerCancel={()=>{drag.current=null}}
    onDoubleClick={()=>{setZoom(1);setYaw(-.65);setPitch(.45)}} />
    <div className="infinity-readout" aria-live="polite"><div>{selected} · {nodes.length} addressed nodes · recursive depth 4</div><div>4 children/address · 6 pair gates · 4 triad gates · fixed ZERO lineage</div><div>view basis only: tetrahedral projection · zoom {zoom.toFixed(2)}× · rotate by drag · reset by double-click</div><div>OPEN MODEL DIFFERENCES: {OPEN_DIFFERENCES.join(" · ")}</div></div>
  </section></main>
}
