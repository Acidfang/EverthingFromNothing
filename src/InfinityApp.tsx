import { useEffect, useMemo, useRef, useState } from "react"
import { FirstActExplorer } from "./model/explorer.ts"
import { eventFromKey } from "./model/query.ts"
import "./infinity.css"

type Channel = "NONE" | "FILTER" | "ISOLATE" | "RECONSTRUCT"
type FieldAddress = { root:string; grain:number; act:number; x:number; y:number; z:number; depth:number; channel:Channel; subject?:string }

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
 const [focus,setFocus]=useState("")
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
 const resolveAddress=(next:FieldAddress)=>{const nextFrame=sync(next);setAddress(next);setFrame(nextFrame);writeAddress(next)}
 useEffect(()=>{resolveAddress(address)},[])
 useEffect(()=>{const refresh=()=>{const next=readAddress();setAddress(next);setFrame(sync(next))};addEventListener("hashchange",refresh);addEventListener("popstate",refresh);return()=>{removeEventListener("hashchange",refresh);removeEventListener("popstate",refresh)}},[explorer])

 useEffect(()=>{const c=canvas.current;if(!c)return;const ctx=c.getContext("2d");if(!ctx)return
   const draw=()=>{
     const r=c.getBoundingClientRect(),dpr=devicePixelRatio||1
     c.width=Math.max(1,Math.floor(r.width*dpr));c.height=Math.max(1,Math.floor(r.height*dpr))
     ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle="#050708";ctx.fillRect(0,0,r.width,r.height)
     const q=frame.recursiveQuery.query
     const events=q.events.map(key=>({key,...eventFromKey(key)}))
     if(!events.length)return
     const xs=events.map(e=>e.x),ys=events.map(e=>e.y),zs=events.map(e=>e.z),gs=events.map(e=>e.grain),as=events.map(e=>e.act)
     const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys),minZ=Math.min(...zs),maxZ=Math.max(...zs),minG=Math.min(...gs),maxG=Math.max(...gs),minA=Math.min(...as),maxA=Math.max(...as)
     const spanX=Math.max(1,maxX-minX),spanY=Math.max(1,maxY-minY),spanZ=Math.max(1,maxZ-minZ),spanG=Math.max(1,maxG-minG),spanA=Math.max(1,maxA-minA)
     const pad=24
     const point=(e:ReturnType<typeof eventFromKey>)=>{
       const nx=(e.x-minX)/spanX-.5,ny=(e.y-minY)/spanY-.5,nz=(e.z-minZ)/spanZ-.5,ng=(e.grain-minG)/spanG-.5,na=(e.act-minA)/spanA-.5
       return {x:r.width/2+nx*(r.width-pad*2)+nz*18+ng*10,y:r.height/2+ny*(r.height-pad*2)-nz*18-na*10}
     }
     const byKey=new Map(events.map(e=>[e.key,e]))
     ctx.lineWidth=1
     for(const edge of q.edges){const s=byKey.get(edge.source),t=byKey.get(edge.target);if(!s||!t)continue;const a=point(s),b=point(t);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.strokeStyle=edge.relation==="SPATIAL_FACE"?"rgba(229,173,86,.32)":edge.relation==="INWARD"||edge.relation==="OUTWARD"?"rgba(105,213,206,.28)":"rgba(238,234,222,.16)";ctx.stroke()}
     for(const e of events){const p=point(e);const centre=e.key===q.centre;ctx.fillStyle=centre?"#eeeade":"#e5ad56";ctx.fillRect(Math.round(p.x),Math.round(p.y),centre?2:1,centre?2:1)}
   }
   draw();addEventListener("resize",draw);return()=>removeEventListener("resize",draw)
 },[frame,address])

 const inspect=(clientX:number,clientY:number)=>{const c=canvas.current;if(!c)return;const r=c.getBoundingClientRect(),dpr=devicePixelRatio||1;const px=Math.max(0,Math.min(c.width-1,Math.floor((clientX-r.left)*dpr))),py=Math.max(0,Math.min(c.height-1,Math.floor((clientY-r.top)*dpr)));setFocus(pixelAddress(address,px,py,c.width,c.height))}

 return <main className="infinity-map"><section className="infinity-field" aria-label="Self-addressing recursive fracture map"><canvas ref={canvas} className="infinity-canvas" onPointerDown={e=>inspect(e.clientX,e.clientY)} onPointerMove={e=>{if(e.buttons)inspect(e.clientX,e.clientY)}}/><div className="infinity-readout" aria-live="polite"><div>{focus||encode(address)}</div><div>{frame.recursiveQuery.eventCount} addressed states · {frame.recursiveQuery.relationCount} relations · frontier {frame.recursiveQuery.frontierCount} · act {address.act}</div></div></section></main>
}
