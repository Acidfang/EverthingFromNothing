import { useEffect,useRef,useState } from "react"
import { OPEN_DIFFERENCES } from "./model/canonicalSeed"
import { ROOT_ADDRESS,addressKey,type Address } from "./model/addressEngine"
import { advanceAt,createRootLedger } from "./model/fieldLedger"
import "./infinity.css"

type Grain=Readonly<{address:Address;moment:number;twist:true;rotate:true;turn:true}>
type PixelReference=Readonly<{x:number;y:number;addresses:readonly string[]}>
const mergeByPixel=(grains:readonly Grain[],project:(grain:Grain)=>Readonly<{x:number;y:number}>):readonly PixelReference[]=>{
 const pixels=new Map<string,{x:number;y:number;addresses:string[]}>()
 for(const grain of grains){
  const q=project(grain),x=Math.round(q.x),y=Math.round(q.y),key=`${x},${y}`
  const hit=pixels.get(key)
  if(hit)hit.addresses.push(addressKey(grain.address))
  else pixels.set(key,{x,y,addresses:[addressKey(grain.address)]})
 }
 return Object.freeze([...pixels.values()].map(p=>Object.freeze({x:p.x,y:p.y,addresses:Object.freeze(p.addresses)})))
}
const putPixel=(ctx:CanvasRenderingContext2D,x:number,y:number,selected:boolean,dpr:number)=>{
 // One model node remains one physical display pixel. Compensate for the
 // canvas DPR transform so high-DPI screens do not shrink it below visibility.
 const s=1/dpr
 ctx.fillStyle=selected?"#eeeade":"#e5ad56"
 ctx.fillRect(Math.round(x*dpr)/dpr,Math.round(y*dpr)/dpr,s,s)
}
export function InfinityApp(){
 const canvas=useRef<HTMLCanvasElement>(null),ledger=useRef(createRootLedger()),grains=useRef<Grain[]>([{address:ROOT_ADDRESS,moment:0,twist:true,rotate:true,turn:true}])
 const [selected,setSelected]=useState("ZERO")
 useEffect(()=>{const c=canvas.current;if(!c)return;const ctx=c.getContext("2d");if(!ctx)return;let frame=0,raf=0
  const draw=()=>{const r=c.getBoundingClientRect(),dpr=devicePixelRatio||1;c.width=Math.max(1,Math.floor(r.width*dpr));c.height=Math.max(1,Math.floor(r.height*dpr));ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle="#050708";ctx.fillRect(0,0,r.width,r.height)
   // The page does not manufacture model geometry. Until the ledger resolves a
   // spatial fracture/twist address, ZERO is the only drawable spatial receipt.
   const pixels=mergeByPixel(grains.current,()=>({x:r.width/2,y:r.height/2}))
   for(const pixel of pixels)putPixel(ctx,pixel.x,pixel.y,pixel.addresses.includes(selected),dpr)
   ledger.current=advanceAt(ledger.current,ROOT_ADDRESS);const receipt=ledger.current.get("ZERO")?.receipts.at(-1);if(receipt)grains.current[0]=Object.freeze({address:ROOT_ADDRESS,moment:receipt.after.step,twist:receipt.twist,rotate:receipt.rotate,turn:receipt.turn})
   raf=requestAnimationFrame(draw)
  };draw();addEventListener("resize",draw);return()=>{cancelAnimationFrame(raf);removeEventListener("resize",draw)}},[selected])
 return <main className="infinity-map"><section className="infinity-field" aria-label="Ledger-driven fracture field"><canvas ref={canvas} className="infinity-canvas" onClick={()=>setSelected("ZERO")} />
  <div className="infinity-readout" aria-live="polite"><div>{selected} · NODE = PIXEL = ADDRESS · ledger driven · limitless unless proven</div><div>ZERO → .infinity1 → BETWEEN → 1 · rotate + twist are ledger receipts</div><div>tetrahedron excluded from field authority · thought/visual aid only</div><div>same pixel reference + location = merged observation · pixel retains source-address provenance · zoom may resolve referenced fracture · no marker/shape substitution</div><div>OPEN MODEL DIFFERENCES: {OPEN_DIFFERENCES.join(" · ")}</div></div>
 </section></main>
}
