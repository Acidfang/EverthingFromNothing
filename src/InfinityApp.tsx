import { useEffect, useMemo, useRef, useState } from "react"
import { FirstActExplorer } from "./model/explorer.ts"
import "./infinity.css"

type Channel = "NONE" | "FILTER" | "ISOLATE" | "RECONSTRUCT"
type FieldAddress = { root:string; grain:number; act:number; x:number; y:number; z:number; depth:number; channel:Channel; subject?:string }
type Receipt = { at:string; from:string; to:string; action:string }

const ROOT="FAMILY/NOTODUS/ZERO"
const DEFAULT_ADDRESS:FieldAddress={root:ROOT,grain:0,act:0,x:0,y:0,z:0,depth:2,channel:"NONE",subject:"USER"}
const encode=(a:FieldAddress)=>`${a.root}/G${a.grain}/A${a.act}/X${a.x}/Y${a.y}/Z${a.z}/D${a.depth}/${a.channel}/${a.subject||"USER"}`
function readAddress():FieldAddress{const source=new URLSearchParams(location.hash.replace(/^#/,"")).get("field");if(!source)return DEFAULT_ADDRESS;try{return{...DEFAULT_ADDRESS,...JSON.parse(decodeURIComponent(source))}}catch{return DEFAULT_ADDRESS}}
function writeAddress(a:FieldAddress){history.replaceState(null,"",`${location.pathname}#field=${encodeURIComponent(JSON.stringify(a))}`)}

export function InfinityApp(){
 const explorer=useMemo(()=>new FirstActExplorer(),[])
 const [address,setAddress]=useState<FieldAddress>(()=>readAddress())
 const [frame,setFrame]=useState(()=>explorer.frame())
 const [receipt,setReceipt]=useState<Receipt|null>(null)
 const canvas=useRef<HTMLCanvasElement>(null)
 const fracture=frame.recursiveQuery.query
 const events=useMemo(()=>fracture.events.map((raw,index)=>({raw,index})),[fracture.events])

 const sync=(next:FieldAddress)=>{
   while(explorer.frame().observer.relativeGrain>next.grain) explorer.enterWhole(0)
   while(explorer.frame().observer.relativeGrain<next.grain) explorer.returnOutward()
   let [cx,cy,cz]=explorer.frame().observer.spatialAddress.split(",").map(Number)
   while(cx<next.x){explorer.moveSpatially(0);cx++} while(cx>next.x){explorer.moveSpatially(1);cx--}
   while(cy<next.y){explorer.moveSpatially(2);cy++} while(cy>next.y){explorer.moveSpatially(3);cy--}
   while(cz<next.z){explorer.moveSpatially(4);cz++} while(cz>next.z){explorer.moveSpatially(5);cz--}
   explorer.setQueryDepth(Math.max(0,Math.min(4,next.depth)))
   return explorer.frame()
 }
 const apply=(next:FieldAddress,action:string)=>{const from=encode(address);const nextFrame=sync(next);setAddress(next);setFrame(nextFrame);writeAddress(next);setReceipt({at:new Date().toISOString(),from,to:encode(next),action})}
 useEffect(()=>{setFrame(sync(address));writeAddress(address)},[])

 useEffect(()=>{const c=canvas.current;if(!c)return;const ctx=c.getContext("2d");if(!ctx)return;const draw=()=>{const r=c.getBoundingClientRect();c.width=Math.max(1,Math.floor(r.width*devicePixelRatio));c.height=Math.max(1,Math.floor(r.height*devicePixelRatio));ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);ctx.fillStyle="#050708";ctx.fillRect(0,0,r.width,r.height);const cx=r.width/2,cy=r.height/2;ctx.strokeStyle="rgba(105,213,206,.28)";ctx.beginPath();ctx.arc(cx,cy,Math.min(r.width,r.height)*.22,0,Math.PI*2);ctx.stroke();events.forEach((event,i)=>{const a=(i/Math.max(1,events.length))*Math.PI*2;const radius=36+(i%7)*13;const x=cx+Math.cos(a)*radius,y=cy+Math.sin(a)*radius;ctx.beginPath();ctx.arc(x,y,i===0?6:2.4,0,Math.PI*2);ctx.fillStyle=i===0?"#eeeade":"#e5ad56";ctx.fill()});ctx.fillStyle="#69d5ce";ctx.font="12px monospace";ctx.textAlign="center";ctx.fillText("USER ZERO",cx,cy-14);ctx.fillText(`${address.x},${address.y},${address.z}`,cx,cy+18)};draw();addEventListener("resize",draw);return()=>removeEventListener("resize",draw)},[events,address])

 const move=(axis:"x"|"y"|"z",delta:number)=>apply({...address,[axis]:address[axis]+delta},`${delta>0?"+":"-"}${axis.toUpperCase()}`)
 const tick=()=>{const f=explorer.resolveOneTick();const next={...address,act:f.observer.act};const from=encode(address);setAddress(next);setFrame(f);writeAddress(next);setReceipt({at:new Date().toISOString(),from,to:encode(next),action:"FRACTURE / RESOLVE ONE TICK"})}
 const reset=()=>{location.hash="";location.reload()}

 return <main className="infinity-map">
  <header className="infinity-hud"><strong>INFINITY · USER ADDRESSED FRACTURE</strong><span>{receipt?`RETURN ✓ ${receipt.action}`:"READY · USER → ZERO → FRACTURE → RETURN"}</span></header>
  <section className="infinity-field" aria-label="User addressed fracture field">
   <canvas ref={canvas} className="infinity-canvas"/>
   <div className="infinity-centre"><div className="infinity-zero">0</div><div className="infinity-address">{encode(address)}</div><div className="infinity-stats">{frame.recursiveQuery.eventCount} fracture states · {frame.recursiveQuery.relationCount} relations · {frame.recursiveQuery.frontierCount} frontier</div></div>
  </section>
  <aside className="infinity-controls">
   <label>User / subject <input value={address.subject||""} onChange={e=>apply({...address,subject:e.target.value},"ADDRESS USER")}/></label>
   <label>Fracture depth <input type="range" min="0" max="4" value={address.depth} onChange={e=>apply({...address,depth:Number(e.target.value)},"SET FRACTURE DEPTH")}/></label>
   <button onClick={()=>move("x",1)}>+X</button><button onClick={()=>move("x",-1)}>−X</button>
   <button onClick={()=>move("y",1)}>+Y</button><button onClick={()=>move("y",-1)}>−Y</button>
   <button onClick={()=>move("z",1)}>+Z</button><button onClick={()=>move("z",-1)}>−Z</button>
   <button onClick={tick}>Fracture / resolve tick</button>
   <button onClick={()=>apply({...address,channel:address.channel==="NONE"?"FILTER":"NONE"},"TOGGLE FILTER")}>Filter: {address.channel}</button>
   <button onClick={()=>navigator.clipboard?.writeText(location.href)}>Copy addressed return</button>
   <button onClick={reset}>Return to root ZERO</button>
   <div className="infinity-address"><b>CURRENT USER ADDRESS</b><br/>{encode(address)}</div>
   {receipt&&<div className="infinity-address"><b>LAST RETURN RECEIPT</b><br/>{receipt.action}<br/>FROM {receipt.from}<br/>TO {receipt.to}<br/>{receipt.at}</div>}
  </aside>
 </main>
}
