import { useEffect, useMemo, useRef, useState } from "react"
import { FirstActExplorer } from "./model/explorer.ts"
import "./infinity.css"

type Channel = "NONE" | "FILTER" | "ISOLATE" | "RECONSTRUCT"
type FieldAddress = { root:string; grain:number; act:number; x:number; y:number; z:number; depth:number; channel:Channel; subject?:string }
type Receipt = { at:string; from:string; to:string; action:string }

const ROOT="FAMILY/NOTODUS/ZERO"
const DEFAULT_ADDRESS:FieldAddress={root:ROOT,grain:0,act:0,x:0,y:0,z:0,depth:2,channel:"NONE",subject:"USER"}
const encode=(a:FieldAddress)=>`${a.root}/G${a.grain}/A${a.act}/X${a.x}/Y${a.y}/Z${a.z}/D${a.depth}/${a.channel}/${a.subject||"USER"}`
const pixelAddress=(whole:FieldAddress,px:number,py:number,w:number,h:number)=>`${encode(whole)}/PIXEL/${px},${py}/${w}x${h}/SELF=WHOLE`
function readAddress():FieldAddress{const source=new URLSearchParams(location.hash.replace(/^#/,"")).get("field");if(!source)return DEFAULT_ADDRESS;try{return{...DEFAULT_ADDRESS,...JSON.parse(decodeURIComponent(source))}}catch{return DEFAULT_ADDRESS}}
function writeAddress(a:FieldAddress){history.replaceState(null,"",`${location.pathname}#field=${encodeURIComponent(JSON.stringify(a))}`)}

export function InfinityApp(){
 const explorer=useMemo(()=>new FirstActExplorer(),[])
 const [address,setAddress]=useState<FieldAddress>(()=>readAddress())
 const [frame,setFrame]=useState(()=>explorer.frame())
 const [receipt,setReceipt]=useState<Receipt|null>(null)
 const [focus,setFocus]=useState<string>("")
 const canvas=useRef<HTMLCanvasElement>(null)

 const sync=(next:FieldAddress)=>{
   while(explorer.frame().observer.relativeGrain>next.grain) explorer.enterWhole(0)
   while(explorer.frame().observer.relativeGrain<next.grain) explorer.returnOutward()
   let [cx,cy,cz]=explorer.frame().observer.spatialAddress.split(",").map(Number)
   while(cx<next.x){explorer.moveSpatially(0);cx++} while(cx>next.x){explorer.moveSpatially(1);cx--}
   while(cy<next.y){explorer.moveSpatially(2);cy++} while(cy>next.y){explorer.moveSpatially(3);cy--}
   while(cz<next.z){explorer.moveSpatially(4);cz++} while(cz>next.z){explorer.moveSpatially(5);cz--}
   explorer.setQueryDepth(next.depth)
   return explorer.frame()
 }
 const apply=(next:FieldAddress,action:string)=>{const from=encode(address);const nextFrame=sync(next);setAddress(next);setFrame(nextFrame);writeAddress(next);setReceipt({at:new Date().toISOString(),from,to:encode(next),action})}
 useEffect(()=>{setFrame(sync(address));writeAddress(address)},[])

 // The viewport is the map. Every physical canvas pixel receives an address derived
 // from the current whole; selecting a pixel exposes that self/whole address.
 useEffect(()=>{const c=canvas.current;if(!c)return;const ctx=c.getContext("2d");if(!ctx)return;const draw=()=>{const r=c.getBoundingClientRect();const dpr=devicePixelRatio||1;c.width=Math.max(1,Math.floor(r.width*dpr));c.height=Math.max(1,Math.floor(r.height*dpr));ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle="#050708";ctx.fillRect(0,0,r.width,r.height);const image=ctx.createImageData(c.width,c.height);let seed=2166136261;for(const ch of encode(address)){seed^=ch.charCodeAt(0);seed=Math.imul(seed,16777619)}for(let py=0;py<c.height;py++){for(let px=0;px<c.width;px++){const i=(py*c.width+px)*4;const self=(Math.imul(px+1,73856093)^Math.imul(py+1,19349663)^seed)>>>0;const difference=(self^(self>>>13)^(address.act*83492791))>>>0;const on=(difference&31)===0;image.data[i]=on?229:5;image.data[i+1]=on?173:7;image.data[i+2]=on?86:8;image.data[i+3]=255}}ctx.putImageData(image,0,0)};draw();addEventListener("resize",draw);return()=>removeEventListener("resize",draw)},[address])

 // State resolves continuously. No manual refresh or manual tick is required.
 useEffect(()=>{const id=window.setInterval(()=>{const from=encode(address);const f=explorer.resolveOneTick();const next={...address,act:f.observer.act};setAddress(next);setFrame(f);writeAddress(next);setReceipt({at:new Date().toISOString(),from,to:encode(next),action:"AUTO RESOLVE"})},1000);return()=>clearInterval(id)},[address,explorer])

 const inspect=(clientX:number,clientY:number)=>{const c=canvas.current;if(!c)return;const r=c.getBoundingClientRect();const dpr=devicePixelRatio||1;const px=Math.max(0,Math.min(c.width-1,Math.floor((clientX-r.left)*dpr)));const py=Math.max(0,Math.min(c.height-1,Math.floor((clientY-r.top)*dpr)));setFocus(pixelAddress(address,px,py,c.width,c.height))}

 return <main className="infinity-map">
  <section className="infinity-field" aria-label="Self-addressing recursive fracture map">
   <canvas ref={canvas} className="infinity-canvas" onPointerDown={e=>inspect(e.clientX,e.clientY)} onPointerMove={e=>{if(e.buttons)inspect(e.clientX,e.clientY)}}/>
   <div className="infinity-readout" aria-live="polite">
    <div>{focus||encode(address)}</div>
    <div>{frame.recursiveQuery.eventCount} addressed states · {frame.recursiveQuery.relationCount} relations · frontier {frame.recursiveQuery.frontierCount} · act {address.act}</div>
    {receipt&&<div>{receipt.action} · {receipt.at}</div>}
   </div>
  </section>
 </main>
}
