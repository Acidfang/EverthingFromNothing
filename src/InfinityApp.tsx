import { useEffect, useMemo, useRef, useState } from "react"
import { FirstActExplorer } from "./model/explorer.ts"
import { eventFromKey } from "./model/query.ts"
import "./infinity.css"

type Channel = "NONE" | "FILTER" | "ISOLATE" | "RECONSTRUCT"
type FieldAddress = { root:string; grain:number; act:number; x:number; y:number; z:number; depth:number; channel:Channel; subject?:string }
type DrawnNode = { key:string; x:number; y:number; size:number; event:ReturnType<typeof eventFromKey> }

const ROOT="FAMILY/NOTODUS/STATE/DEFAULT"
const DEFAULT_ADDRESS:FieldAddress={root:ROOT,grain:0,act:0,x:0,y:0,z:0,depth:2,channel:"NONE",subject:"USER"}
const encode=(a:FieldAddress)=>`${a.root}/G${a.grain}/A${a.act}/X${a.x}/Y${a.y}/Z${a.z}/D${a.depth}/${a.channel}/${a.subject||"USER"}`
function readAddress():FieldAddress{const source=new URLSearchParams(location.hash.replace(/^#/,"")).get("field");if(!source)return DEFAULT_ADDRESS;try{return{...DEFAULT_ADDRESS,...JSON.parse(decodeURIComponent(source))}}catch{return DEFAULT_ADDRESS}}
function writeAddress(a:FieldAddress){history.replaceState(null,"",`${location.pathname}#field=${encodeURIComponent(JSON.stringify(a))}`)}

export function InfinityApp(){
 const explorer=useMemo(()=>new FirstActExplorer(),[])
 const [address,setAddress]=useState<FieldAddress>(()=>readAddress())
 const [frame,setFrame]=useState(()=>explorer.frame())
 const [zoom,setZoom]=useState(1)
 const [focus,setFocus]=useState("")
 const canvas=useRef<HTMLCanvasElement>(null)
 const drawn=useRef<DrawnNode[]>([])
 const pointers=useRef(new Map<number,{x:number;y:number}>())
 const pinchDistance=useRef<number|null>(null)
 const retainedAddress=useRef(encode(readAddress()))

 const sync=(next:FieldAddress)=>{
   while(explorer.frame().observer.relativeGrain>next.grain) explorer.enterWhole(0)
   while(explorer.frame().observer.relativeGrain<next.grain) explorer.returnOutward()
   while(explorer.frame().observer.act<next.act) explorer.resolveOneTick()
   while(explorer.frame().observer.act>next.act) explorer.returnToWas()
   let [cx,cy,cz]=explorer.frame().observer.spatialAddress.split(",").map(Number)
   while(cx<next.x){explorer.moveSpatially(0);cx++} while(cx>next.x){explorer.moveSpatially(1);cx--}
   while(cy<next.y){explorer.moveSpatially(2);cy++} while(cy>next.y){explorer.moveSpatially(3);cy--}
   while(cz<next.z){explorer.moveSpatially(4);cz++} while(cz>next.z){explorer.moveSpatially(5);cz--}
   explorer.setQueryDepth(next.depth)
   return explorer.frame()
 }
 const resolveAddress=(next:FieldAddress)=>{const nextFrame=sync(next);setAddress(next);setFrame(nextFrame);retainedAddress.current=encode(next);writeAddress(next)}
 useEffect(()=>{resolveAddress(address)},[])
 useEffect(()=>{const refresh=()=>{const next=readAddress(),nextKey=encode(next);if(nextKey===retainedAddress.current)return;retainedAddress.current=nextKey;setAddress(next);setFrame(sync(next))};addEventListener("hashchange",refresh);addEventListener("popstate",refresh);return()=>{removeEventListener("hashchange",refresh);removeEventListener("popstate",refresh)}},[explorer])

 useEffect(()=>{const c=canvas.current;if(!c)return;const ctx=c.getContext("2d");if(!ctx)return
   const draw=()=>{
     const r=c.getBoundingClientRect(),dpr=devicePixelRatio||1
     c.width=Math.max(1,Math.floor(r.width*dpr));c.height=Math.max(1,Math.floor(r.height*dpr))
     ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle="#050708";ctx.fillRect(0,0,r.width,r.height)
     const q=frame.recursiveQuery.query
     const events=q.events.map(key=>({key,...eventFromKey(key)}))
     if(!events.length){drawn.current=[];return}
     const world=events.map(e=>{const unit=2**e.grain;return{...e,unit,wx:e.x*unit,wy:e.y*unit,wz:e.z*unit}})
     const centre=eventFromKey(q.centre),centreUnit=2**centre.grain
     const cwx=centre.x*centreUnit,cwy=centre.y*centreUnit,cwz=centre.z*centreUnit
     const iso=(wx:number,wy:number,wz:number)=>({x:(wx-cwx)+(wz-cwz)*.5,y:(wy-cwy)-(wz-cwz)*.5})
     const projected=world.map(e=>({...e,...iso(e.wx,e.wy,e.wz)}))
     const extent=Math.max(1,...projected.flatMap(p=>[Math.abs(p.x),Math.abs(p.y)]))
     const base=Math.max(1,Math.min(r.width,r.height)*.44/extent)
     const scale=base*zoom
     const nodes:DrawnNode[]=[]
     for(const e of projected){
       const p={x:r.width/2+e.x*scale,y:r.height/2+e.y*scale}
       const size=1
       const isCentre=e.key===q.centre
       ctx.fillStyle=isCentre?"#eeeade":"#e5ad56"
       ctx.fillRect(Math.round(p.x),Math.round(p.y),1,1)
       nodes.push({key:e.key,x:p.x,y:p.y,size,event:e})
     }
     drawn.current=nodes
   }
   draw();addEventListener("resize",draw);return()=>removeEventListener("resize",draw)
 },[frame,zoom])

 const selectAt=(clientX:number,clientY:number)=>{const c=canvas.current;if(!c)return;const r=c.getBoundingClientRect(),x=clientX-r.left,y=clientY-r.top;let best:DrawnNode|null=null,bestDistance=Infinity;for(const node of drawn.current){const d=Math.hypot(x-node.x,y-node.y);const hit=6;if(d<=hit&&d<bestDistance){best=node;bestDistance=d}}if(!best)return;const e=best.event;const next={...address,grain:e.grain,act:e.act,x:e.x,y:e.y,z:e.z};setFocus(encode(next));resolveAddress(next)}
 const updatePointer=(id:number,x:number,y:number)=>{pointers.current.set(id,{x,y});if(pointers.current.size===2){const [a,b]=[...pointers.current.values()];const distance=Math.hypot(a.x-b.x,a.y-b.y);if(pinchDistance.current!==null&&pinchDistance.current>0)setZoom(z=>Math.max(.125,Math.min(64,z*distance/pinchDistance.current!)));pinchDistance.current=distance}}
 const releasePointer=(id:number)=>{pointers.current.delete(id);if(pointers.current.size<2)pinchDistance.current=null}

 return <main className="infinity-map"><section className="infinity-field" aria-label="Self-addressing recursive fracture map"><canvas ref={canvas} className="infinity-canvas" onWheel={e=>{e.preventDefault();setZoom(z=>Math.max(.125,Math.min(64,z*Math.exp(-e.deltaY*.0015))))}} onDoubleClick={()=>setZoom(1)} onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);updatePointer(e.pointerId,e.clientX,e.clientY);if(pointers.current.size===1)selectAt(e.clientX,e.clientY)}} onPointerMove={e=>{if(pointers.current.has(e.pointerId))updatePointer(e.pointerId,e.clientX,e.clientY)}} onPointerUp={e=>releasePointer(e.pointerId)} onPointerCancel={e=>releasePointer(e.pointerId)} /><div className="infinity-readout" aria-live="polite"><div>{focus||encode(address)}</div><div>{frame.recursiveQuery.eventCount} addressed states · {frame.recursiveQuery.relationCount} relations · frontier {frame.recursiveQuery.frontierCount} · act {address.act} · zoom {zoom.toFixed(2)}×</div></div></section></main>
}
