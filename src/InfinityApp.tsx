import { useEffect, useMemo, useRef, useState } from "react"
import { FirstActExplorer } from "./model/explorer.ts"
import { eventFromKey } from "./model/query.ts"
import "./infinity.css"

type Channel = "NONE" | "FILTER" | "ISOLATE" | "RECONSTRUCT"
type FieldAddress = { root:string; grain:number; act:number; x:number; y:number; z:number; depth:number; channel:Channel; subject?:string }
type DrawnNode = { key:string; x:number; y:number; size:number; event:ReturnType<typeof eventFromKey> }
type ViewPoint = { x:number;y:number;z:number }

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
 const [yaw,setYaw]=useState(-.65)
 const [pitch,setPitch]=useState(.45)
 const [focus,setFocus]=useState("")
 const canvas=useRef<HTMLCanvasElement>(null)
 const drawn=useRef<DrawnNode[]>([])
 const pointers=useRef(new Map<number,{x:number;y:number}>())
 const pinchDistance=useRef<number|null>(null)
 const dragLast=useRef<{x:number;y:number}|null>(null)
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
     const centre=eventFromKey(q.centre),centreUnit=2**centre.grain
     const cwx=centre.x*centreUnit,cwy=centre.y*centreUnit,cwz=centre.z*centreUnit
     const world=events.map(e=>{const unit=2**e.grain;return{...e,wx:e.x*unit-cwx,wy:e.y*unit-cwy,wz:e.z*unit-cwz}})
     const rotate=(p:ViewPoint):ViewPoint=>{const cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch);const x1=p.x*cy-p.z*sy,z1=p.x*sy+p.z*cy;return{x:x1,y:p.y*cp-z1*sp,z:p.y*sp+z1*cp}}
     const rotated=world.map(e=>({...e,...rotate({x:e.wx,y:e.wy,z:e.wz})}))
     const extent=Math.max(1,...rotated.flatMap(p=>[Math.abs(p.x),Math.abs(p.y)]))
     const scale=Math.max(1,Math.min(r.width,r.height)*.44/extent)*zoom
     const screen=new Map(rotated.map(e=>[e.key,{x:r.width/2+e.x*scale,y:r.height/2-e.y*scale,z:e.z,event:e}]))

     // Render only relations supplied by the field query. No proximity-derived links.
     ctx.lineWidth=1
     ctx.strokeStyle="rgba(229,173,86,.22)"
     ctx.beginPath()
     for(const edge of q.edges){const a=screen.get(edge.source),b=screen.get(edge.target);if(!a||!b)continue;ctx.moveTo(Math.round(a.x)+.5,Math.round(a.y)+.5);ctx.lineTo(Math.round(b.x)+.5,Math.round(b.y)+.5)}
     ctx.stroke()

     const nodes:DrawnNode[]=[]
     const ordered=[...screen.entries()].sort((a,b)=>a[1].z-b[1].z)
     for(const [key,p] of ordered){const isCentre=key===q.centre;ctx.fillStyle=isCentre?"#eeeade":"#e5ad56";ctx.fillRect(Math.round(p.x),Math.round(p.y),1,1);nodes.push({key,x:p.x,y:p.y,size:1,event:p.event})}
     drawn.current=nodes
   }
   draw();addEventListener("resize",draw);return()=>removeEventListener("resize",draw)
 },[frame,zoom,yaw,pitch])

 const selectAt=(clientX:number,clientY:number)=>{const c=canvas.current;if(!c)return;const r=c.getBoundingClientRect(),x=clientX-r.left,y=clientY-r.top;let best:DrawnNode|null=null,bestDistance=Infinity;for(const node of drawn.current){const d=Math.hypot(x-node.x,y-node.y);if(d<=6&&d<bestDistance){best=node;bestDistance=d}}if(!best)return;const e=best.event;const next={...address,grain:e.grain,act:e.act,x:e.x,y:e.y,z:e.z};setFocus(encode(next));resolveAddress(next)}
 const updatePointer=(id:number,x:number,y:number)=>{const previous=pointers.current.get(id);pointers.current.set(id,{x,y});if(pointers.current.size===2){dragLast.current=null;const [a,b]=[...pointers.current.values()];const distance=Math.hypot(a.x-b.x,a.y-b.y);if(pinchDistance.current!==null&&pinchDistance.current>0)setZoom(z=>Math.max(.125,Math.min(64,z*distance/pinchDistance.current!)));pinchDistance.current=distance;return}if(previous&&dragLast.current){const dx=x-dragLast.current.x,dy=y-dragLast.current.y;setYaw(v=>v+dx*.008);setPitch(v=>Math.max(-Math.PI/2,Math.min(Math.PI/2,v+dy*.008)))}dragLast.current={x,y}}
 const releasePointer=(id:number)=>{pointers.current.delete(id);if(pointers.current.size<2)pinchDistance.current=null;if(pointers.current.size===0)dragLast.current=null}

 return <main className="infinity-map"><section className="infinity-field" aria-label="Self-addressing recursive fracture map"><canvas ref={canvas} className="infinity-canvas"
   onWheel={e=>{e.preventDefault();setZoom(z=>Math.max(.125,Math.min(64,z*Math.exp(-e.deltaY*.0015))))}}
   onDoubleClick={()=>{setZoom(1);setYaw(-.65);setPitch(.45)}}
   onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);pointers.current.set(e.pointerId,{x:e.clientX,y:e.clientY});dragLast.current={x:e.clientX,y:e.clientY};if(pointers.current.size===1)selectAt(e.clientX,e.clientY)}}
   onPointerMove={e=>{if(pointers.current.has(e.pointerId))updatePointer(e.pointerId,e.clientX,e.clientY)}}
   onPointerUp={e=>releasePointer(e.pointerId)} onPointerCancel={e=>releasePointer(e.pointerId)} />
   <div className="infinity-readout" aria-live="polite"><div>{focus||encode(address)}</div><div>{frame.recursiveQuery.eventCount} addressed states · {frame.recursiveQuery.relationCount} relations · act {address.act} · zoom {zoom.toFixed(2)}× · yaw {(yaw*180/Math.PI).toFixed(0)}° · pitch {(pitch*180/Math.PI).toFixed(0)}°</div></div></section></main>
}
