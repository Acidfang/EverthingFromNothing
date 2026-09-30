import { useEffect,useRef,useState } from "react"
import { advanceLedgerContinuum,createLedgerContinuum } from "./model/kernel"
import { fromKey } from "./model/address"
import { BINARY_MODEL,EVERYTHING_METHOD,FULL_SELF_RESOLUTION,WHOLE_INVARIANT,resolveResponse } from "./model/binaryRelationships"
import { THREE_TETRAHEDRON_DRAWING } from "./model/three-tetrahedron-drawing"
import { COMMUNICATION_INVARIANT,communicate } from "./model/communication"
import { createAddressedDraw,mayAdvanceAfterDraw,type DrawReceipt } from "./model/addressed-draw"
import { FieldAddressOverlay } from "./FieldAddressOverlay"
import { validSpatialAddress } from "./model/field-inventory"
import { INITIAL_SYSTEM_STATE, transition } from "./model/transitionEngine"
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
 const [inspecting,setInspecting]=useState(false),[paused,setPaused]=useState(true),[act,setAct]=useState(0),[roleState,setRoleState]=useState(INITIAL_SYSTEM_STATE)
 const [drawReceipt,setDrawReceipt]=useState<DrawReceipt|null>(null)
 const pendingActs=useRef(0)
 const inspectButton=useRef<HTMLButtonElement>(null)
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
 const startListening=()=>{const Ctor=(window as any).SpeechRecognition||(window as any).webkitSpeechRecognition;if(!Ctor){setMediaError("Speech recognition is unavailable in this browser");drive("VOICE","LISTEN","UNAVAILABLE",()=>{});return}speechRecognition.current?.stop?.();const recognition=new Ctor();speechRecognition.current=recognition;recognition.continuous=true;recognition.interimResults=true;recognition.onresult=(event:any)=>{let value="";let finalValue="";for(let i=event.resultIndex;i<event.results.length;i++){const part=event.results[i][0].transcript;value+=part;if(event.results[i].isFinal)finalValue+=part}setHeard(value);if(finalValue.trim())drive("VOICE","HEARD",finalValue.trim(),()=>{const moment=controlReceipts.length;const address=`HUMAN/${moment}`;setSourceAddress(address);setSourceMoment(moment);const interaction=communicate({id:`VOICE/${moment}`,source:{participant:"HUMAN",address,was:`HUMAN/${Math.max(0,moment-1)}`,is:address,next:`HUMAN/${moment+1}`},destination:{participant:"EI_AGENT",address:`EI_AGENT/${moment}`,was:`EI_AGENT/${Math.max(0,moment-1)}`,is:`EI_AGENT/${moment}`,next:`EI_AGENT/${moment+1}`},channel:"VOICE",expression:finalValue.trim()});setTranscript(items=>[...items,`HUMAN → EI_AGENT: ${interaction.expression} · ${interaction.receipt}`]);const resolved=resolveResponse({source:interaction.expression,sourceAddress:address,sourceMoment:moment,currentAddress:address,currentMoment:moment});setGuidance(resolved.action);setNextReply(resolved.reply)})};recognition.onend=()=>setListening(false);recognition.onerror=(event:any)=>{setListening(false);setMediaError(String(event.error??"Speech recognition error"))};recognition.start();drive("VOICE","LISTEN","START",()=>setListening(true))}
 const stopListening=()=>{speechRecognition.current?.stop?.();speechRecognition.current=null;drive("VOICE","LISTEN","STOP",()=>setListening(false))}
 const naturalLive=()=>{if(live){stopListening();stopCapture();if("speechSynthesis" in window)window.speechSynthesis.cancel();drive("UI_CONTROL","LIVE_SESSION","END",()=>setLive(false));return}drive("UI_CONTROL","LIVE_SESSION","START",()=>setLive(true));startListening()}
 const [guidance,setGuidance]=useState("SOURCE"),[reply,setReply]=useState(""),[nextReply,setNextReply]=useState<string|null>(null),[sourceAddress,setSourceAddress]=useState("HUMAN/0"),[sourceMoment,setSourceMoment]=useState(0),[intentCenter,setIntentCenter]=useState("0,0,0"),[menu,setMenu]=useState<{x:number;y:number;address:string}|null>(null),[zoom,setZoom]=useState(1),[yaw,setYaw]=useState(-.65),[pitch,setPitch]=useState(.45),[selected,setSelected]=useState("0,0,0"),[visible,setVisible]=useState(1)
 const advance=()=>{continuum.current=advanceLedgerContinuum(continuum.current);setAct(continuum.current.state.act);setRoleState(state=>transition(state).after)}
 const requestAdvance=()=>{pendingActs.current+=1;setPaused(true)}
 const selectAddress=(address:string)=>{setSelected(address);setSourceAddress(address);setIntentCenter(address)}
 const closeInspector=()=>{setInspecting(false);inspectButton.current?.focus()}
 const view=useRef({zoom,selected,sourceAddress,yaw,pitch,paused,roleState})
 view.current={zoom,selected,sourceAddress,yaw,pitch,paused,roleState}
 useEffect(()=>{const c=canvas.current;if(!c)return;const output=c.getContext("2d");if(!output)return
  const staging=document.createElement("canvas"),ctx=staging.getContext("2d",{willReadFrequently:true});if(!ctx)return
  let disposed=false,timer:ReturnType<typeof setTimeout>|undefined,activeDraw:ReturnType<typeof createAddressedDraw>|undefined
  const draw=(now:number)=>{if(disposed)return
   // One coherent view snapshot finishes before the newest queued view is consumed.
   const {zoom,selected,sourceAddress,yaw,pitch,roleState}=view.current
   const r=c.getBoundingClientRect(),dpr=devicePixelRatio||1,width=Math.max(1,Math.floor(r.width*dpr)),height=Math.max(1,Math.floor(r.height*dpr))
   staging.width=width;staging.height=height;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle="#050708";ctx.fillRect(0,0,r.width,r.height)
   // The canvas is a finite observation window onto an unbounded addressed field.
   // Every physical screen pixel has an address-state relative to one source.
   const source=validSpatialAddress(sourceAddress)?sourceAddress:"0,0,0"
   const o=fromKey(source),pixelStep=1/Math.max(.125,zoom),cx=Math.floor(r.width/2),cy=Math.floor(r.height/2)
   const addressForPixel=(x:number,y:number)=>`${o.x+Math.round((x-cx)*pixelStep)},${o.y+Math.round((cy-y)*pixelStep)},${o.z}`
   // Default grain-out presents the resolved whole, not the proto-grain carrier.\n   // The underlying field remains addressable but is visually suppressed until\n   // a finer grain is explicitly requested.\n   ctx.fillStyle="#050708";ctx.fillRect(0,0,r.width,r.height)
   projected.current=Object.freeze([])

   // Differences already resolved by the continuum are state overlays within
   // the field; they do not define or bound the field itself.
   const stateAddresses=Object.freeze([...new Set([...continuum.current.state.was,...continuum.current.state.is])])
   const projectState=(address:string):ProjectedAddress=>{const p=relativeTo(address,source);return{x:r.width/2+p.x/pixelStep,y:r.height/2-p.y/pixelStep}}
   const stateByAddress=new Map(stateAddresses.map(address=>[address,projectState(address)] as const))
   const edges=causalEdges(continuum.current)
   const detail=Math.max(0,Math.min(1,(zoom-1)/7))
   if(detail>0){drawEdges(ctx,edges,stateByAddress,.22*detail);for(const address of continuum.current.state.is){const q=stateByAddress.get(address);if(q&&q.x>=0&&q.x<r.width&&q.y>=0&&q.y<r.height)putPhysicalPixel(ctx,q.x,q.y,dpr,address===selected||address===source)}}

   // Canonical three-tetrahedron presentation: one shared ZERO, no spatial separation.
   // The three complete tetrahedra occupy the same geometry; cyclic WAS/IS/NEXT
   // order is the Difference carried by each presentation.
   const centre={x:r.width/2,y:r.height/2},scale=Math.min(r.width,r.height)*.18
   const projectVertex=(p:Readonly<{x:number;y:number;z:number}>)=>{
    const a=yaw,b=pitch,ca=Math.cos(a),sa=Math.sin(a),cb=Math.cos(b),sb=Math.sin(b)
    const x=p.x*ca-p.z*sa,z=p.x*sa+p.z*ca,y=p.y*cb-z*sb
    return{x:centre.x+x*scale,y:centre.y-y*scale}
   }
   const edges4=[[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]] as const
   ctx.save();ctx.lineWidth=1
   THREE_TETRAHEDRON_DRAWING.presentations.forEach((tetra,i)=>{
    const pts=tetra.vertices.map(p=>projectVertex(p))
    ctx.strokeStyle=["rgba(229,173,86,.92)","rgba(238,234,222,.72)","rgba(229,173,86,.48)"][i]
    for(const [a,b] of edges4){ctx.beginPath();ctx.moveTo(pts[a].x,pts[a].y);ctx.lineTo(pts[b].x,pts[b].y);ctx.stroke()}
   })
   // Fixed geometry, source-defined role handoff. No invented spatial twist.
   const roles=[roleState.temporal.was,roleState.temporal.is,roleState.temporal.next,"PROGRESSION"]
   THREE_TETRAHEDRON_DRAWING.vertices.forEach((vertex,index)=>{const point=projectVertex(vertex);ctx.fillStyle=roles[index]==="IS"?"#eeeade":"#e5ad56";ctx.fillRect(point.x-2,point.y-2,4,4);ctx.font="11px monospace";ctx.textAlign="center";ctx.fillText(roles[index],point.x,point.y-10)})
   ctx.fillStyle="#eeeade";ctx.beginPath();ctx.arc(centre.x,centre.y,2.5,0,Math.PI*2);ctx.fill()
   ctx.font="11px sans-serif";ctx.textAlign="center";ctx.fillText("ZERO · 3 TETRAHEDRA · WAS / IS / NEXT",centre.x,centre.y+scale*1.8);ctx.font="9px monospace";ctx.fillText("SELECTED slot-to-vertex view · exact twist open",centre.x,centre.y+scale*1.8+16)
   ctx.restore()

   // Avatar and avatar-camera are observations of this same field, not separate
   // bounded models. Their frame may rotate while address relations stay whole.
   avatarPhase.current=(avatarPhase.current+.006)%(Math.PI*2)
   const ar=Math.min(r.width,r.height)*.34,ax=r.width/2+Math.cos(avatarPhase.current)*ar,ay=r.height/2+Math.sin(avatarPhase.current)*ar*.42
   putPhysicalPixel(ctx,ax,ay,dpr,false)
   const insetW=Math.max(150,Math.min(300,r.width*.28)),insetH=Math.max(110,Math.min(220,r.height*.28)),ix=r.width-insetW-16,iy=16
   ctx.save();ctx.beginPath();ctx.rect(ix,iy,insetW,insetH);ctx.clip();ctx.fillStyle="#050708";ctx.fillRect(ix,iy,insetW,insetH)
   const turn=avatarPhase.current,ct=Math.cos(turn),st=Math.sin(turn)
   const cameraPoints=new Map<string,ProjectedAddress>()
   for(const address of stateAddresses){const p=relativeTo(address,source),rx=p.x*ct-p.y*st,ry=p.x*st+p.y*ct;cameraPoints.set(address,{x:ix+insetW/2+rx/pixelStep,y:iy+insetH/2-ry/pixelStep})}
   if(detail>0)drawEdges(ctx,edges,cameraPoints,.22*detail)
   ctx.restore();ctx.strokeStyle="rgba(238,234,222,.75)";ctx.lineWidth=1;ctx.strokeRect(ix+.5,iy+.5,insetW-1,insetH-1)
   const resolvedPixelCount=width*height
   setVisible(v=>v===resolvedPixelCount?v:resolvedPixelCount)
   // Projection/framing above is preparation. Each addressed assignment below
   // constructs the only buffer that may be presented; no partial frame advances TIME.
   const framed=ctx.getImageData(0,0,width,height),presented=output.createImageData(width,height),job=createAddressedDraw(width,height)
   activeDraw=job
   const batch=()=>{if(disposed){job.cancel();return}
    const current=c.getBoundingClientRect()
    if(Math.max(1,Math.floor(current.width*(devicePixelRatio||1)))!==width||Math.max(1,Math.floor(current.height*(devicePixelRatio||1)))!==height){job.cancel();raf.current=requestAnimationFrame(draw);return}
    const receipt=job.assign(262144,(index)=>{const offset=index*4;presented.data[offset]=framed.data[offset];presented.data[offset+1]=framed.data[offset+1];presented.data[offset+2]=framed.data[offset+2];presented.data[offset+3]=framed.data[offset+3]})
    if(!receipt.complete){timer=setTimeout(batch,0);return}
    c.width=width;c.height=height;output.putImageData(presented,0,0)
    const requested=pendingActs.current>0,playback=!view.current.paused&&now-last.current>=1000&&WHOLE_INVARIANT.recursive&&FULL_SELF_RESOLUTION.selfSimilar
    if(mayAdvanceAfterDraw(receipt,true)&&(requested||playback)){if(requested)pendingActs.current--;setDrawReceipt(receipt);advance();last.current=now}
    else setDrawReceipt(previous=>previous&&previous.width===width&&previous.height===height?previous:receipt)
    raf.current=requestAnimationFrame(draw)
   };batch()
  };raf.current=requestAnimationFrame(draw);return()=>{disposed=true;activeDraw?.cancel();if(timer!==undefined)clearTimeout(timer);cancelAnimationFrame(raf.current)}},[])
 return <main className="infinity-map"><section className="infinity-field" aria-label="Ledger-driven fracture field">
  <div className="field-tools"><button ref={inspectButton} type="button" aria-expanded={inspecting} onClick={()=>setInspecting(value=>!value)}>Inspect addresses</button><button type="button" onClick={()=>setPaused(value=>!value)}>{paused?"Play shared Act":"Pause playback"}</button><button type="button" onClick={requestAdvance}>Advance one Act</button><button type="button" onClick={()=>{setYaw(-.65);setPitch(.45)}}>Reset view</button><button type="button" onClick={()=>setYaw(value=>value+.15)}>Turn view left</button><button type="button" onClick={()=>setPitch(value=>Math.min(Math.PI/2,value+.15))}>Tilt view up</button></div>
  {inspecting?<FieldAddressOverlay selected={selected} onSelect={selectAddress} continuum={continuum.current} paused={paused} onPause={()=>setPaused(value=>!value)} onStep={requestAdvance} onClose={closeInspector}/>:null}
  <div className="field-view-status" aria-live="polite">Act {act} · {paused?"paused":"playback"} · slots {roleState.temporal.was} / {roleState.temporal.is} / {roleState.temporal.next} · view {yaw.toFixed(2)} / {pitch.toFixed(2)} · Exact twist transform unresolved · {drawReceipt?`${drawReceipt.assigned}/${drawReceipt.width*drawReceipt.height} pixels completed before TIME`:"framing before TIME"}</div>
  <canvas ref={canvas} className="infinity-canvas"
  onWheel={e=>{e.preventDefault();setZoom(z=>Math.max(.125,Math.min(64,z*Math.exp(-e.deltaY*.0015))))}}
  onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);pointers.current.set(e.pointerId,{x:e.clientX,y:e.clientY});lastPointer.current={x:e.clientX,y:e.clientY};const box=e.currentTarget.getBoundingClientRect(),x=e.clientX-box.left,y=e.clientY-box.top,o=fromKey(validSpatialAddress(sourceAddress)?sourceAddress:"0,0,0"),step=1/Math.max(.125,zoom),address=`${o.x+Math.round((x-box.width/2)*step)},${o.y+Math.round((box.height/2-y)*step)},${o.z}`;setSelected(address)}}
  onPointerMove={e=>{if(!pointers.current.has(e.pointerId))return;const prior=pointers.current.get(e.pointerId)!;pointers.current.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.current.size===2){const pts=[...pointers.current.values()],before=pts.map(p=>({...p}));const movedIndex=[...pointers.current.keys()].indexOf(e.pointerId);before[movedIndex]=prior;const d=Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y),od=Math.hypot(before[0].x-before[1].x,before[0].y-before[1].y);if(od>0)setZoom(z=>Math.max(.125,Math.min(64,z*d/od)));return}if(!lastPointer.current)return;const dx=e.clientX-lastPointer.current.x,dy=e.clientY-lastPointer.current.y;lastPointer.current={x:e.clientX,y:e.clientY};setYaw(v=>v+dx*.008);setPitch(v=>Math.max(-Math.PI/2,Math.min(Math.PI/2,v+dy*.008)))}}
  onPointerUp={e=>{pointers.current.delete(e.pointerId);lastPointer.current=null}} onPointerCancel={e=>{pointers.current.delete(e.pointerId);lastPointer.current=null}}
  onContextMenu={e=>{e.preventDefault();const box=e.currentTarget.getBoundingClientRect(),x=e.clientX-box.left,y=e.clientY-box.top,o=fromKey(validSpatialAddress(sourceAddress)?sourceAddress:"0,0,0"),step=1/Math.max(.125,zoom),address=`${o.x+Math.round((x-box.width/2)*step)},${o.y+Math.round((box.height/2-y)*step)},${o.z}`;setSelected(address);setIntentCenter(address);setSourceAddress(address);setGuidance("SOURCE");drive("UI_CONTROL","CENTER_OF_INTENT",address,()=>{});setMenu({x,y,address})}}
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
  <div className="communication-invariant" aria-label="Communication interaction invariant"><strong>COMMUNICATION</strong> · {COMMUNICATION_INVARIANT.stages.join(" → ")} · WAS / IS / NEXT at every stage · identity retained · Difference explicit · receipt required</div>
  <div className="sr-only" aria-live="polite">{visible} visible pixels · act {continuum.current.state.act} · center of intent {intentCenter} · {guidance} · {sourceChannel} → {destinationChannel}</div>
 </section></main>
}
