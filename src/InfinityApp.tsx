import { useEffect,useRef,useState } from "react"
import { advanceLedgerContinuum,createLedgerContinuum } from "./model/kernel"
import { fromKey } from "./model/address"
import { BINARY_MODEL,EVERYTHING_METHOD,FULL_SELF_RESOLUTION,WHOLE_INVARIANT,resolveResponse } from "./model/binaryRelationships"
import "./infinity.css"

type PixelReference=Readonly<{x:number;y:number;addresses:readonly string[]}>
type ProjectedAddress=Readonly<{x:number;y:number}>
type FieldEdge=Readonly<{from:string;to:string}>
type ControlAddress=`EI/${string}/${string}`
const controlAddress=(channel:string,control:string):ControlAddress=>`EI/${channel}/${control}`
const addressEvent=(address:ControlAddress,value:string)=>Object.freeze({address,value})
const mergeByPixel=(addresses:readonly string[],project:(address:string)=>Readonly<{x:number;y:number}>):readonly PixelReference[]=>{
 const pixels=new Map<string,{x:number;y:number;addresses:string[]}>()
 for(const address of addresses){const q=project(address),x=Math.round(q.x),y=Math.round(q.y),k=`${x},${y}`,hit=pixels.get(k);if(hit)hit.addresses.push(address);else pixels.set(k,{x,y,addresses:[address]})}
 return Object.freeze([...pixels.values()].map(p=>Object.freeze({x:p.x,y:p.y,addresses:Object.freeze(p.addresses)})))
}
const putPhysicalPixel=(ctx:CanvasRenderingContext2D,x:number,y:number,dpr:number,selected:boolean)=>{const s=1/dpr;ctx.fillStyle=selected?"#eeeade":"#e5ad56";ctx.fillRect(Math.round(x*dpr)/dpr,Math.round(y*dpr)/dpr,s,s)}
const relativeTo=(address:string,source:string)=>{const p=fromKey(address),o=fromKey(source);return{x:p.x-o.x,y:p.y-o.y,z:p.z-o.z}}
const visibleAtGrain=(address:string,source:string,grain:number)=>{const p=relativeTo(address,source);return Math.max(Math.abs(p.x),Math.abs(p.y),Math.abs(p.z))<=grain}
const causalEdges=(continuum:ReturnType<typeof createLedgerContinuum>):readonly FieldEdge[]=>{
 const latest=continuum.receipts.at(-1)
 if(!latest)return Object.freeze([])
 const edges:FieldEdge[]=[]
 for(const entry of latest.entries)for(const arrival of entry.arrivals)edges.push(Object.freeze({from:arrival.source,to:entry.address}))
 return Object.freeze(edges)
}
const drawEdges=(ctx:CanvasRenderingContext2D,edges:readonly FieldEdge[],points:ReadonlyMap<string,ProjectedAddress>,alpha:number)=>{
 ctx.save();ctx.strokeStyle=`rgba(229,173,86,${alpha})`;ctx.lineWidth=.5
 for(const edge of edges){const a=points.get(edge.from),b=points.get(edge.to);if(!a||!b)continue;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke()}
 ctx.restore()
}

export function InfinityApp(){
 const canvas=useRef<HTMLCanvasElement>(null),continuum=useRef(createLedgerContinuum()),raf=useRef(0),last=useRef(0),projected=useRef<readonly PixelReference[]>([]),avatarPhase=useRef(0)
 const pointers=useRef(new Map<number,{x:number;y:number}>()),lastPointer=useRef<{x:number;y:number}|null>(null)
 const channels=EVERYTHING_METHOD.domains
 const [sourceChannel,setSourceChannel]=useState<(typeof channels)[number]>("HUMAN"),[destinationChannel,setDestinationChannel]=useState<(typeof channels)[number]>("EI_AGENT")
 const mediaStream=useRef<MediaStream|null>(null),preview=useRef<HTMLVideoElement>(null),speechRecognition=useRef<any>(null)
 const [live,setLive]=useState(false),[muted,setMuted]=useState(false),[held,setHeld]=useState(false),[captions,setCaptions]=useState(true),[interruptible,setInterruptible]=useState(true),[camera,setCamera]=useState(false),[screen,setScreen]=useState(false),[listening,setListening]=useState(false),[heard,setHeard]=useState(""),[mediaError,setMediaError]=useState(""),[transcript,setTranscript]=useState<string[]>([]),[controlReceipts,setControlReceipts]=useState<readonly Readonly<{address:ControlAddress;value:string}>[]>([])
 const drive=(channel:string,control:string,value:string,act:()=>void)=>{const receipt=addressEvent(controlAddress(channel,control),value);setControlReceipts(items=>[...items,receipt]);act()}
 const stopCapture=()=>{mediaStream.current?.getTracks().forEach(track=>track.stop());mediaStream.current=null;if(preview.current)preview.current.srcObject=null;setCamera(false);setScreen(false)}
 const attachStream=(stream:MediaStream)=>{mediaStream.current=stream;if(preview.current){preview.current.srcObject=stream;void preview.current.play()}stream.getVideoTracks()[0]?.addEventListener("ended",stopCapture)}
 const openCamera=async()=>{try{setMediaError("");stopCapture();const stream=await navigator.mediaDevices.getUserMedia({video:true,audio:true});attachStream(stream);drive("IMAGE_VISION","CAMERA","STREAM_OPEN",()=>setCamera(true))}catch(error){setMediaError(error instanceof Error?error.message:"Camera unavailable");drive("IMAGE_VISION","CAMERA","STREAM_FAILED",()=>{})}}
 const shareScreen=async()=>{try{setMediaError("");stopCapture();const stream=await navigator.mediaDevices.getDisplayMedia({video:true,audio:true});attachStream(stream);drive("DEVICE_SENSOR","SCREEN","STREAM_OPEN",()=>setScreen(true))}catch(error){setMediaError(error instanceof Error?error.message:"Screen share unavailable");drive("DEVICE_SENSOR","SCREEN","STREAM_FAILED",()=>{})}}
 const speakNext=()=>{if(!nextReply||!("speechSynthesis" in window))return;const utterance=new SpeechSynthesisUtterance(nextReply);drive("VOICE","SPEAK_NEXT",nextReply,()=>window.speechSynthesis.speak(utterance))}
 const startListening=()=>{const Ctor=(window as any).SpeechRecognition||(window as any).webkitSpeechRecognition;if(!Ctor){setMediaError("Speech recognition is unavailable in this browser");drive("VOICE","LISTEN","UNAVAILABLE",()=>{});return}speechRecognition.current?.stop?.();const recognition=new Ctor();speechRecognition.current=recognition;recognition.continuous=true;recognition.interimResults=true;recognition.onresult=(event:any)=>{let value="";let finalValue="";for(let i=event.resultIndex;i<event.results.length;i++){const part=event.results[i][0].transcript;value+=part;if(event.results[i].isFinal)finalValue+=part}setHeard(value);if(finalValue.trim())drive("VOICE","HEARD",finalValue.trim(),()=>{const moment=controlReceipts.length;const address=`HUMAN/${moment}`;setSourceAddress(address);setSourceMoment(moment);setTranscript(items=>[...items,`HUMAN → EI_AGENT: ${finalValue.trim()}`]);const resolved=resolveResponse({source:finalValue.trim(),sourceAddress:address,sourceMoment:moment,currentAddress:address,currentMoment:moment});setGuidance(resolved.action);setNextReply(resolved.reply)})};recognition.onend=()=>setListening(false);recognition.onerror=(event:any)=>{setListening(false);setMediaError(String(event.error??"Speech recognition error"))};recognition.start();drive("VOICE","LISTEN","START",()=>setListening(true))}
 const stopListening=()=>{speechRecognition.current?.stop?.();speechRecognition.current=null;drive("VOICE","LISTEN","STOP",()=>setListening(false))}
 const naturalLive=()=>{if(live){stopListening();stopCapture();if("speechSynthesis" in window)window.speechSynthesis.cancel();drive("UI_CONTROL","LIVE_SESSION","END",()=>setLive(false));return}drive("UI_CONTROL","LIVE_SESSION","START",()=>setLive(true));startListening()}
 const [guidance,setGuidance]=useState("SOURCE"),[reply,setReply]=useState(""),[nextReply,setNextReply]=useState<string|null>(null),[sourceAddress,setSourceAddress]=useState("HUMAN/0"),[sourceMoment,setSourceMoment]=useState(0),[intentCenter,setIntentCenter]=useState("0,0,0"),[menu,setMenu]=useState<{x:number;y:number;address:string}|null>(null),[zoom,setZoom]=useState(1),[yaw,setYaw]=useState(-.65),[pitch,setPitch]=useState(.45),[selected,setSelected]=useState("0,0,0"),[visible,setVisible]=useState(1)
 useEffect(()=>{const c=canvas.current;if(!c)return;const ctx=c.getContext("2d");if(!ctx)return
  const draw=(now:number)=>{const r=c.getBoundingClientRect(),dpr=devicePixelRatio||1;c.width=Math.max(1,Math.floor(r.width*dpr));c.height=Math.max(1,Math.floor(r.height*dpr));ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle="#050708";ctx.fillRect(0,0,r.width,r.height)
   if(now-last.current>=1000&&WHOLE_INVARIANT.recursive&&FULL_SELF_RESOLUTION.selfSimilar){continuum.current=advanceLedgerContinuum(continuum.current);last.current=now}
   // One source address re-addresses the whole matrix. WAS/IS remain relations of
   // the same continuum; they are not independent coordinate roots.
   const allAddresses=Object.freeze([...new Set([...continuum.current.state.was,...continuum.current.state.is])])
   const source=allAddresses.includes(sourceAddress)?sourceAddress:"0,0,0"
   const grain=Math.max(1,Math.ceil(8/zoom))
   const addresses=Object.freeze(allAddresses.filter(address=>visibleAtGrain(address,source,grain)))
   const coords=addresses.map(address=>relativeTo(address,source)),extent=Math.max(1,...coords.flatMap(p=>[Math.abs(p.x),Math.abs(p.y),Math.abs(p.z)])),scale=Math.max(1,Math.min(r.width,r.height)*.46/extent*zoom)
   const rotate=(address:string,turn:number)=>{const p=relativeTo(address,source),cy=Math.cos(turn),sy=Math.sin(turn),cp=Math.cos(pitch),sp=Math.sin(pitch),x=p.x*cy-p.z*sy,z=p.x*sy+p.z*cy,y=p.y*cp-z*sp;return{x,y}}
   const projectMain=(address:string):ProjectedAddress=>{const p=rotate(address,yaw);return{x:r.width/2+p.x*scale,y:r.height/2-p.y*scale}}
   const mainByAddress=new Map(addresses.map(address=>[address,projectMain(address)] as const))
   const visibleIs=[...continuum.current.state.is].filter(address=>visibleAtGrain(address,source,grain))
   const pixels=mergeByPixel(visibleIs,projectMain)
   projected.current=pixels
   const edges=causalEdges(continuum.current).filter(edge=>mainByAddress.has(edge.from)&&mainByAddress.has(edge.to))
   drawEdges(ctx,edges,mainByAddress,.34)

   // The avatar is an observation address in the same field. Its orbit changes
   // the observer frame, never the underlying field or adjacency.
   avatarPhase.current=(avatarPhase.current+.006)%(Math.PI*2)
   const ar=Math.min(r.width,r.height)*.34,ax=r.width/2+Math.cos(avatarPhase.current)*ar,ay=r.height/2+Math.sin(avatarPhase.current)*ar*.42
   const projectAvatar=(address:string):ProjectedAddress=>{const p=rotate(address,yaw+avatarPhase.current),s=Math.max(1,scale*.08);return{x:ax+p.x*s,y:ay-p.y*s}}
   const avatarByAddress=new Map(addresses.map(address=>[address,projectAvatar(address)] as const))
   const avatarPixels=mergeByPixel(visibleIs,projectAvatar)
   drawEdges(ctx,edges,avatarByAddress,.5)
   for(const pixel of avatarPixels)putPhysicalPixel(ctx,pixel.x,pixel.y,dpr,false)

   // Avatar camera: the locked view from the orbiting observer back into this
   // same addressed field. Rotation comes only from the avatar's current frame.
   const insetW=Math.max(150,Math.min(300,r.width*.28)),insetH=Math.max(110,Math.min(220,r.height*.28)),ix=r.width-insetW-16,iy=16
   ctx.save();ctx.beginPath();ctx.rect(ix,iy,insetW,insetH);ctx.clip();ctx.fillStyle="#050708";ctx.fillRect(ix,iy,insetW,insetH)
   const cameraScale=Math.max(1,Math.min(insetW,insetH)*.42/extent)
   const projectCamera=(address:string):ProjectedAddress=>{const p=rotate(address,yaw+avatarPhase.current+Math.PI);return{x:ix+insetW/2+p.x*cameraScale,y:iy+insetH/2-p.y*cameraScale}}
   const cameraByAddress=new Map(addresses.map(address=>[address,projectCamera(address)] as const))
   drawEdges(ctx,edges,cameraByAddress,.5)
   for(const pixel of mergeByPixel(visibleIs,projectCamera))putPhysicalPixel(ctx,pixel.x,pixel.y,dpr,pixel.addresses.includes(source))
   ctx.restore();ctx.strokeStyle="rgba(229,173,86,.55)";ctx.lineWidth=1;ctx.strokeRect(ix+.5,iy+.5,insetW-1,insetH-1)

   setVisible(v=>v===pixels.length?v:pixels.length)
   for(const pixel of pixels)putPhysicalPixel(ctx,pixel.x,pixel.y,dpr,pixel.addresses.includes(selected)||pixel.addresses.includes(source))
   raf.current=requestAnimationFrame(draw)
  };raf.current=requestAnimationFrame(draw);return()=>cancelAnimationFrame(raf.current)},[zoom,yaw,pitch,selected,sourceAddress])
 return <main className="infinity-map"><section className="infinity-field" aria-label="Ledger-driven fracture field"><canvas ref={canvas} className="infinity-canvas"
  onWheel={e=>{e.preventDefault();setZoom(z=>Math.max(.125,Math.min(64,z*Math.exp(-e.deltaY*.0015))))}}
  onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);pointers.current.set(e.pointerId,{x:e.clientX,y:e.clientY});lastPointer.current={x:e.clientX,y:e.clientY};const box=e.currentTarget.getBoundingClientRect(),x=e.clientX-box.left,y=e.clientY-box.top;let best:PixelReference|undefined,dist=Infinity;for(const pixel of projected.current){const d=(pixel.x-x)**2+(pixel.y-y)**2;if(d<dist){dist=d;best=pixel}}if(best&&dist<=144)setSelected(best.addresses[0])}}
  onPointerMove={e=>{if(!pointers.current.has(e.pointerId))return;const prior=pointers.current.get(e.pointerId)!;pointers.current.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.current.size===2){const pts=[...pointers.current.values()],before=pts.map(p=>({...p}));const movedIndex=[...pointers.current.keys()].indexOf(e.pointerId);before[movedIndex]=prior;const d=Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y),od=Math.hypot(before[0].x-before[1].x,before[0].y-before[1].y);if(od>0)setZoom(z=>Math.max(.125,Math.min(64,z*d/od)));return}if(!lastPointer.current)return;const dx=e.clientX-lastPointer.current.x,dy=e.clientY-lastPointer.current.y;lastPointer.current={x:e.clientX,y:e.clientY};setYaw(v=>v+dx*.008);setPitch(v=>Math.max(-Math.PI/2,Math.min(Math.PI/2,v+dy*.008)))}}
  onPointerUp={e=>{pointers.current.delete(e.pointerId);lastPointer.current=null}} onPointerCancel={e=>{pointers.current.delete(e.pointerId);lastPointer.current=null}}
  onContextMenu={e=>{e.preventDefault();const box=e.currentTarget.getBoundingClientRect(),x=e.clientX-box.left,y=e.clientY-box.top;let best:PixelReference|undefined,dist=Infinity;for(const pixel of projected.current){const d=(pixel.x-x)**2+(pixel.y-y)**2;if(d<dist){dist=d;best=pixel}}if(!best||dist>144){setMenu(null);return}const address=best.addresses[0];setSelected(address);setIntentCenter(address);setSourceAddress(address);setGuidance("SOURCE");drive("UI_CONTROL","CENTER_OF_INTENT",address,()=>{});setMenu({x:best.x,y:best.y,address})}}
  onDoubleClick={()=>{setZoom(1);setYaw(-.65);setPitch(.45)}} />
  {menu?<div className="map-context-menu" style={{position:"absolute",left:menu.x,top:menu.y,zIndex:5}} onPointerLeave={()=>setMenu(null)}>
   <button type="button" onClick={()=>{setSelected(menu.address);setMenu(null)}}>SET ZERO HERE</button>
   <button type="button" onClick={()=>{setSelected(menu.address);setZoom(z=>Math.min(64,z*2));setMenu(null)}}>ENTER / ZOOM</button>
   <button type="button" onClick={()=>{setZoom(z=>Math.max(.125,z/2));setMenu(null)}}>OUTWARD</button>
   <button type="button" onClick={()=>{setYaw(-.65);setPitch(.45);setMenu(null)}}>RESET ORIENTATION</button>
   <button type="button" onClick={()=>{setGuidance("PROVENANCE");setSourceAddress(menu.address);setMenu(null)}}>TRACE ADDRESS</button>
   <button type="button" onClick={()=>{setGuidance("RETURN");setSourceAddress(menu.address);setMenu(null)}}>RETURN TO ADDRESS</button>
   <button type="button" onClick={()=>{setGuidance("SOURCE");setSourceAddress(menu.address);setMenu(null)}}>SOURCE</button>
   <button type="button" onClick={()=>{setGuidance("DIFFERENCE");setSourceAddress(menu.address);setMenu(null)}}>DIFFERENCE</button>
   <button type="button" onClick={()=>{setGuidance("FILTER");setSourceAddress(menu.address);setMenu(null)}}>FILTER</button>
   <button type="button" onClick={()=>{setGuidance("ISOLATE");setSourceAddress(menu.address);setMenu(null)}}>ISOLATE</button>
   <button type="button" onClick={()=>{setGuidance("RECONSTRUCT");setSourceAddress(menu.address);setMenu(null)}}>RECONSTRUCT</button>
   <button type="button" onClick={()=>{setGuidance("VERIFY");setSourceAddress(menu.address);setMenu(null)}}>VERIFY</button>
   <button type="button" onClick={()=>{setGuidance("OPEN_DIFFERENCE");setSourceAddress(menu.address);setMenu(null)}}>OPEN DIFFERENCE</button>
  </div>:null}
  <div className="sr-only" aria-live="polite">{visible} visible pixels · act {continuum.current.state.act} · center of intent {intentCenter} · {guidance} · {sourceChannel} → {destinationChannel}</div>
 </section></main>
}
