import { useEffect, useRef, useState } from "react"
import "./infinity.css"

type V3={x:number;y:number;z:number}
type Role="WAS"|"IS"|"NEXT"|"PROCEED"
type Vertex={id:string;tetra:number;role:Role;p:V3}
type ScreenVertex=Vertex&{sx:number;sy:number;depth:number}

const BASE:readonly V3[]=[
 {x:1,y:1,z:1},
 {x:-1,y:-1,z:1},
 {x:-1,y:1,z:-1},
 {x:1,y:-1,z:-1},
]
const ORDERS:readonly (readonly Role[])[]=[
 ["WAS","IS","NEXT","PROCEED"],
 ["NEXT","WAS","IS","PROCEED"],
 ["IS","NEXT","WAS","PROCEED"],
]
const EDGES:readonly [number,number][]=[[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]]

function rotateAxis(p:V3,axis:V3,a:number):V3{
 const l=Math.hypot(axis.x,axis.y,axis.z)||1,x=axis.x/l,y=axis.y/l,z=axis.z/l,c=Math.cos(a),s=Math.sin(a),d=p.x*x+p.y*y+p.z*z
 return{x:p.x*c+(y*p.z-z*p.y)*s+x*d*(1-c),y:p.y*c+(z*p.x-x*p.z)*s+y*d*(1-c),z:p.z*c+(x*p.y-y*p.x)*s+z*d*(1-c)}
}
function viewRotate(p:V3,yaw:number,pitch:number):V3{const cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch),x=p.x*cy-p.z*sy,z=p.x*sy+p.z*cy;return{x,y:p.y*cp-z*sp,z:p.y*sp+z*cp}}

export function InfinityApp(){
 const canvas=useRef<HTMLCanvasElement>(null)
 const [zoom,setZoom]=useState(1)
 const [yaw,setYaw]=useState(-.65)
 const [pitch,setPitch]=useState(.45)
 const [phase,setPhase]=useState(0)
 const pointers=useRef(new Map<number,{x:number;y:number}>())
 const pinch=useRef<number|null>(null)
 const drag=useRef<{x:number;y:number}|null>(null)

 // Three tetrahedrons share ZERO. Their temporal tips are phase-offset.
 // The fourth tip is PROCEED: direction, not another temporal label.
 const vertices=():Vertex[]=>{
   const step=(phase%3+3)%3
   return ORDERS.flatMap((order,tetra)=>{
     const proceed=BASE[3]
     // Both twist and turn. Each tetrahedron follows the previous by 1/3 cycle.
     const cycle=(step+tetra)/3
     const twist=cycle*Math.PI*2
     const turn=cycle*Math.PI*2
     return BASE.map((p,i)=>{
       let q=rotateAxis(p,proceed,twist)
       q=rotateAxis(q,{x:0,y:1,z:0},turn)
       const temporal=i<3?order[(i+step)%3]:"PROCEED"
       return{id:`T${tetra+1}:${i}`,tetra,role:temporal,p:q}
     })
   })
 }

 useEffect(()=>{const c=canvas.current;if(!c)return;const ctx=c.getContext("2d");if(!ctx)return
   const draw=()=>{const r=c.getBoundingClientRect(),dpr=devicePixelRatio||1;c.width=Math.max(1,Math.floor(r.width*dpr));c.height=Math.max(1,Math.floor(r.height*dpr));ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle="#050708";ctx.fillRect(0,0,r.width,r.height)
     const raw=vertices(),rot=raw.map(v=>({...v,...viewRotate(v.p,yaw,pitch)})),extent=Math.max(1,...rot.flatMap(v=>[Math.abs(v.x),Math.abs(v.y)])),scale=Math.min(r.width,r.height)*.34/extent*zoom
     const screen:ScreenVertex[]=rot.map(v=>({...v,sx:r.width/2+v.x*scale,sy:r.height/2-v.y*scale,depth:v.z}))
     const byId=new Map(screen.map(v=>[v.id,v]))
     // Lines are the actual six edges of each tetrahedron, projected from 3D.
     ctx.lineWidth=1;ctx.strokeStyle="rgba(229,173,86,.34)"
     for(let t=0;t<3;t++)for(const [a,b] of EDGES){const A=byId.get(`T${t+1}:${a}`)!,B=byId.get(`T${t+1}:${b}`)!;ctx.beginPath();ctx.moveTo(A.sx,A.sy);ctx.lineTo(B.sx,B.sy);ctx.stroke()}
     // Shared ZERO is explicit and fixed at the common centre.
     ctx.fillStyle="#eeeade";ctx.fillRect(Math.round(r.width/2),Math.round(r.height/2),1,1)
     for(const v of [...screen].sort((a,b)=>a.depth-b.depth)){ctx.fillStyle=v.role==="PROCEED"?"#eeeade":"#e5ad56";ctx.fillRect(Math.round(v.sx),Math.round(v.sy),1,1)}
   }
   draw();addEventListener("resize",draw);return()=>removeEventListener("resize",draw)
 },[zoom,yaw,pitch,phase])

 const move=(id:number,x:number,y:number)=>{const previous=pointers.current.get(id);pointers.current.set(id,{x,y});if(pointers.current.size===2){drag.current=null;const [a,b]=[...pointers.current.values()],d=Math.hypot(a.x-b.x,a.y-b.y);if(pinch.current&&pinch.current>0)setZoom(z=>Math.max(.125,Math.min(64,z*d/pinch.current!)));pinch.current=d;return}if(previous&&drag.current){setYaw(v=>v+(x-drag.current!.x)*.008);setPitch(v=>Math.max(-Math.PI/2,Math.min(Math.PI/2,v+(y-drag.current!.y)*.008)))}drag.current={x,y}}
 const release=(id:number)=>{pointers.current.delete(id);if(pointers.current.size<2)pinch.current=null;if(!pointers.current.size)drag.current=null}

 return <main className="infinity-map"><section className="infinity-field" aria-label="Three tetrahedron fracture map"><canvas ref={canvas} className="infinity-canvas"
   onWheel={e=>{e.preventDefault();setZoom(z=>Math.max(.125,Math.min(64,z*Math.exp(-e.deltaY*.0015))))}}
   onDoubleClick={()=>{setZoom(1);setYaw(-.65);setPitch(.45)}}
   onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);pointers.current.set(e.pointerId,{x:e.clientX,y:e.clientY});drag.current={x:e.clientX,y:e.clientY}}}
   onPointerMove={e=>{if(pointers.current.has(e.pointerId))move(e.pointerId,e.clientX,e.clientY)}} onPointerUp={e=>release(e.pointerId)} onPointerCancel={e=>release(e.pointerId)} />
   <div className="infinity-readout" aria-live="polite"><div>FAMILY/NOTODUS/STATE/DEFAULT · ZERO · three tetrahedrons</div><div>phase {phase} · WAS / IS / NEXT × 3 · PROCEED × 3 · twist + turn · zoom {zoom.toFixed(2)}× · yaw {(yaw*180/Math.PI).toFixed(0)}° · pitch {(pitch*180/Math.PI).toFixed(0)}°</div><button onClick={()=>setPhase(p=>(p+1)%3)}>PROCEED</button></div></section></main>
}
