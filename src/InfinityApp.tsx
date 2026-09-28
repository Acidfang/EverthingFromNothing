import { useEffect,useRef,useState } from "react"
import { firstDifference,resolveTick,type ResolverState } from "./model/kernel"
import { fromKey } from "./model/address"
import "./infinity.css"

type PixelReference=Readonly<{x:number;y:number;addresses:readonly string[]}>
const mergeByPixel=(addresses:readonly string[],project:(address:string)=>Readonly<{x:number;y:number}>):readonly PixelReference[]=>{
 const pixels=new Map<string,{x:number;y:number;addresses:string[]}>()
 for(const address of addresses){const q=project(address),x=Math.round(q.x),y=Math.round(q.y),k=`${x},${y}`,hit=pixels.get(k);if(hit)hit.addresses.push(address);else pixels.set(k,{x,y,addresses:[address]})}
 return Object.freeze([...pixels.values()].map(p=>Object.freeze({x:p.x,y:p.y,addresses:Object.freeze(p.addresses)})))
}
const putPhysicalPixel=(ctx:CanvasRenderingContext2D,x:number,y:number,dpr:number,selected:boolean)=>{const s=1/dpr;ctx.fillStyle=selected?"#eeeade":"#e5ad56";ctx.fillRect(Math.round(x*dpr)/dpr,Math.round(y*dpr)/dpr,s,s)}

export function InfinityApp(){
 const canvas=useRef<HTMLCanvasElement>(null),state=useRef<ResolverState>(firstDifference()),raf=useRef(0),last=useRef(0)
 const [zoom,setZoom]=useState(1),[selected,setSelected]=useState("0,0,0"),[visible,setVisible]=useState(1)
 useEffect(()=>{const c=canvas.current;if(!c)return;const ctx=c.getContext("2d");if(!ctx)return
  const draw=(now:number)=>{const r=c.getBoundingClientRect(),dpr=devicePixelRatio||1;c.width=Math.max(1,Math.floor(r.width*dpr));c.height=Math.max(1,Math.floor(r.height*dpr));ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle="#050708";ctx.fillRect(0,0,r.width,r.height)
   if(now-last.current>=1000){state.current=resolveTick(state.current).state;last.current=now}
   const addresses=[...state.current.is],coords=addresses.map(fromKey),extent=Math.max(1,...coords.flatMap(p=>[Math.abs(p.x),Math.abs(p.y),Math.abs(p.z)])),scale=Math.max(1,Math.min(r.width,r.height)*.46/extent*zoom)
   const pixels=mergeByPixel(addresses,address=>{const p=fromKey(address);return{x:r.width/2+(p.x-p.z*.5)*scale,y:r.height/2-(p.y+p.z*.5)*scale}})
   setVisible(v=>v===pixels.length?v:pixels.length)
   for(const pixel of pixels)putPhysicalPixel(ctx,pixel.x,pixel.y,dpr,pixel.addresses.includes(selected))
   raf.current=requestAnimationFrame(draw)
  };raf.current=requestAnimationFrame(draw);return()=>cancelAnimationFrame(raf.current)},[zoom,selected])
 return <main className="infinity-map"><section className="infinity-field" aria-label="Ledger-driven fracture field"><canvas ref={canvas} className="infinity-canvas" onWheel={e=>{e.preventDefault();setZoom(z=>Math.max(.125,Math.min(64,z*Math.exp(-e.deltaY*.0015))))}} onDoubleClick={()=>setZoom(1)} onClick={()=>setSelected("0,0,0")} />
  <div className="infinity-readout" aria-live="polite"><div>{selected} · {visible} merged visible pixels · act {state.current.act}</div><div>fracture map draws from resolver ledger · node/address → physical pixel observation</div><div>same pixel reference + location = merged observation · contributing addresses retained by reference</div><div>map advances once per second · wheel zoom · double-click reset</div></div>
 </section></main>
}
