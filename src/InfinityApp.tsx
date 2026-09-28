import { useEffect,useRef,useState } from "react"
import { advanceLedgerContinuum,createLedgerContinuum } from "./model/kernel"
import { fromKey } from "./model/address"
import { BINARY_MODEL } from "./model/binaryRelationships"
import "./infinity.css"

type PixelReference=Readonly<{x:number;y:number;addresses:readonly string[]}>
const mergeByPixel=(addresses:readonly string[],project:(address:string)=>Readonly<{x:number;y:number}>):readonly PixelReference[]=>{
 const pixels=new Map<string,{x:number;y:number;addresses:string[]}>()
 for(const address of addresses){const q=project(address),x=Math.round(q.x),y=Math.round(q.y),k=`${x},${y}`,hit=pixels.get(k);if(hit)hit.addresses.push(address);else pixels.set(k,{x,y,addresses:[address]})}
 return Object.freeze([...pixels.values()].map(p=>Object.freeze({x:p.x,y:p.y,addresses:Object.freeze(p.addresses)})))
}
const putPhysicalPixel=(ctx:CanvasRenderingContext2D,x:number,y:number,dpr:number,selected:boolean)=>{const s=1/dpr;ctx.fillStyle=selected?"#eeeade":"#e5ad56";ctx.fillRect(Math.round(x*dpr)/dpr,Math.round(y*dpr)/dpr,s,s)}

export function InfinityApp(){
 const canvas=useRef<HTMLCanvasElement>(null),continuum=useRef(createLedgerContinuum()),raf=useRef(0),last=useRef(0)
 const pointers=useRef(new Map<number,{x:number;y:number}>()),lastPointer=useRef<{x:number;y:number}|null>(null)
 const channels=["HUMAN","EI_AGENT","TEXT","VOICE","IMAGE_VISION","FILE_DOCUMENT","CODE_EXECUTION","WEB_EXTERNAL","DEVICE_SENSOR","UI_CONTROL","MEMORY_HISTORY","LEDGER_RECEIPT"] as const
 const [sourceChannel,setSourceChannel]=useState<(typeof channels)[number]>("HUMAN"),[destinationChannel,setDestinationChannel]=useState<(typeof channels)[number]>("EI_AGENT")
 const [guidance,setGuidance]=useState("SOURCE"),[reply,setReply]=useState(""),[nextReply,setNextReply]=useState<string|null>(null),[zoom,setZoom]=useState(1),[yaw,setYaw]=useState(-.65),[pitch,setPitch]=useState(.45),[selected,setSelected]=useState("0,0,0"),[visible,setVisible]=useState(1)
 useEffect(()=>{const c=canvas.current;if(!c)return;const ctx=c.getContext("2d");if(!ctx)return
  const draw=(now:number)=>{const r=c.getBoundingClientRect(),dpr=devicePixelRatio||1;c.width=Math.max(1,Math.floor(r.width*dpr));c.height=Math.max(1,Math.floor(r.height*dpr));ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle="#050708";ctx.fillRect(0,0,r.width,r.height)
   if(now-last.current>=1000){continuum.current=advanceLedgerContinuum(continuum.current);last.current=now}
   const addresses=[...continuum.current.state.is],coords=addresses.map(fromKey),extent=Math.max(1,...coords.flatMap(p=>[Math.abs(p.x),Math.abs(p.y),Math.abs(p.z)])),scale=Math.max(1,Math.min(r.width,r.height)*.46/extent*zoom)
   const pixels=mergeByPixel(addresses,address=>{const p=fromKey(address),cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch),x=p.x*cy-p.z*sy,z=p.x*sy+p.z*cy,y=p.y*cp-z*sp;return{x:r.width/2+x*scale,y:r.height/2-y*scale}})
   setVisible(v=>v===pixels.length?v:pixels.length)
   for(const pixel of pixels)putPhysicalPixel(ctx,pixel.x,pixel.y,dpr,pixel.addresses.includes(selected))
   raf.current=requestAnimationFrame(draw)
  };raf.current=requestAnimationFrame(draw);return()=>cancelAnimationFrame(raf.current)},[zoom,yaw,pitch,selected])
 return <main className="infinity-map"><section className="infinity-field" aria-label="Ledger-driven fracture field"><canvas ref={canvas} className="infinity-canvas"
  onWheel={e=>{e.preventDefault();setZoom(z=>Math.max(.125,Math.min(64,z*Math.exp(-e.deltaY*.0015))))}}
  onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);pointers.current.set(e.pointerId,{x:e.clientX,y:e.clientY});lastPointer.current={x:e.clientX,y:e.clientY}}}
  onPointerMove={e=>{if(!pointers.current.has(e.pointerId)||!lastPointer.current)return;const dx=e.clientX-lastPointer.current.x,dy=e.clientY-lastPointer.current.y;lastPointer.current={x:e.clientX,y:e.clientY};setYaw(v=>v+dx*.008);setPitch(v=>Math.max(-Math.PI/2,Math.min(Math.PI/2,v+dy*.008)))}}
  onPointerUp={e=>{pointers.current.delete(e.pointerId);lastPointer.current=null}} onPointerCancel={e=>{pointers.current.delete(e.pointerId);lastPointer.current=null}}
  onDoubleClick={()=>{setZoom(1);setYaw(-.65);setPitch(.45)}} onClick={()=>setSelected("0,0,0")} />
  <div className="infinity-readout" aria-live="polite"><div>{selected} · {visible} merged visible pixels · act {continuum.current.state.act}</div><div>ledger ↻ ledger continuum · fracture map is an observation at the selected grain</div><div>Difference · address · orientation · merge · fracture · return remain receipts in the same continuum</div><div>map advances once per second · orientation preserved in 3D projection · drag rotates · wheel zoom · double-click reset</div>
  <div>ERROR-CORRECTION WORD ROOTS: ANALYSIS → ANAL · WHY · IS → strict boundary/set · interrogate Difference · retain what IS</div>
  <div>BINARY MODEL: {BINARY_MODEL.relationCount} retained source relations · FILTER → ISOLATE → RECONSTRUCT · continuum</div>
  <div>FRAME PRESERVATION: before adding a correction, test whether the source already contains it · source-contained Difference ≠ missing Difference</div>
  <div>BLIND SPOT: ambition may hide Difference → hidden Difference may propagate harm → expose Difference · share · reduce harm · correct before continuation</div>
  <section className="ei-guidance" aria-label="EI Agent guidance controls">
   <div><strong>EI AGENT GUIDANCE</strong> · active: {guidance}</div>
   <div className="guidance-controls">{["SOURCE","DIFFERENCE","RETURN","FILTER","ISOLATE","RECONSTRUCT","VERIFY","WAS","IS","NEXT","GRAIN−","GRAIN+","PROVENANCE","HARM","OPEN DIFFERENCE","COMMIT","UNDO"].map(control=><button type="button" key={control} onClick={()=>setGuidance(control)}>{control}</button>)}</div>
   <div className="channel-controls"><label>SOURCE CHANNEL <select value={sourceChannel} onChange={e=>setSourceChannel(e.target.value as typeof sourceChannel)}>{channels.map(channel=><option key={channel}>{channel}</option>)}</select></label><span>→</span><label>DESTINATION CHANNEL <select value={destinationChannel} onChange={e=>setDestinationChannel(e.target.value as typeof destinationChannel)}>{channels.map(channel=><option key={channel}>{channel}</option>)}</select></label></div>
   <div>CHANNEL RECEIPT: {sourceChannel} → {destinationChannel} · transformation ≠ source replacement · cross-channel Difference retains original source/address</div>
   <form className="next-reply" onSubmit={e=>{e.preventDefault();const value=reply.trim();if(!value)return;setNextReply(value);setReply("");setGuidance("NEXT")}}>
    <label>REPLY FOR NEXT <textarea value={reply} onChange={e=>setReply(e.target.value)} placeholder="Reply at the current source/address" /></label>
    <button type="submit" disabled={!reply.trim()}>SET NEXT REPLY</button>
    <button type="button" onClick={()=>{setReply("");setNextReply(null)}} disabled={!reply&&nextReply===null}>CLEAR</button>
   </form>
   <div aria-live="polite">NEXT REPLY: {nextReply??"UNRESOLVED · no reply committed"}</div>
  </section></div>
 </section></main>
}
