import { useEffect,useRef,useState } from "react"
import { OPEN_DIFFERENCES } from "./model/canonicalSeed"
import { ROOT_ADDRESS,addressKey,type Address } from "./model/addressEngine"
import { advanceAt,createRootLedger } from "./model/fieldLedger"
import "./infinity.css"

type Grain=Readonly<{address:Address;moment:number;twist:true;rotate:true;turn:true}>
const putPixel=(ctx:CanvasRenderingContext2D,x:number,y:number,selected:boolean)=>{ctx.fillStyle=selected?"#eeeade":"#e5ad56";ctx.fillRect(Math.round(x),Math.round(y),1,1)}
export function InfinityApp(){
 const canvas=useRef<HTMLCanvasElement>(null),ledger=useRef(createRootLedger()),grains=useRef<Grain[]>([{address:ROOT_ADDRESS,moment:0,twist:true,rotate:true,turn:true}])
 const [selected,setSelected]=useState("ZERO")
 useEffect(()=>{const c=canvas.current;if(!c)return;const ctx=c.getContext("2d");if(!ctx)return;let frame=0,raf=0
  const draw=()=>{const r=c.getBoundingClientRect(),dpr=devicePixelRatio||1;c.width=Math.max(1,Math.floor(r.width*dpr));c.height=Math.max(1,Math.floor(r.height*dpr));ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle="#050708";ctx.fillRect(0,0,r.width,r.height)
   // The page does not manufacture model geometry. Until the ledger resolves a
   // spatial fracture/twist address, ZERO is the only drawable spatial receipt.
   const root=grains.current[0];putPixel(ctx,r.width/2,r.height/2,addressKey(root.address)===selected)
   ledger.current=advanceAt(ledger.current,ROOT_ADDRESS);const receipt=ledger.current.get("ZERO")?.receipts.at(-1);if(receipt)grains.current[0]=Object.freeze({address:ROOT_ADDRESS,moment:receipt.after.step,twist:receipt.twist,rotate:receipt.rotate,turn:receipt.turn})
   raf=requestAnimationFrame(draw)
  };draw();addEventListener("resize",draw);return()=>{cancelAnimationFrame(raf);removeEventListener("resize",draw)}},[selected])
 return <main className="infinity-map"><section className="infinity-field" aria-label="Ledger-driven fracture field"><canvas ref={canvas} className="infinity-canvas" onClick={()=>setSelected("ZERO")} />
  <div className="infinity-readout" aria-live="polite"><div>{selected} · NODE = PIXEL = ADDRESS · ledger driven · limitless unless proven</div><div>ZERO → .infinity1 → BETWEEN → 1 · rotate + twist are ledger receipts</div><div>tetrahedron excluded from field authority · thought/visual aid only</div><div>each resolved address renders exactly one 1×1 pixel · no marker/shape substitution · no manufactured branch count · no manufactured basis</div><div>OPEN MODEL DIFFERENCES: {OPEN_DIFFERENCES.join(" · ")}</div></div>
 </section></main>
}
