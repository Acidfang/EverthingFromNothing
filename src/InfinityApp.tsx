import { INTEGRATED_MODEL_BOUNDARY } from "./model/integrated-transition"
import { useEffect,useMemo,useRef,useState } from "react"
import { advanceLedgerContinuum,createLedgerContinuum,resolveTick } from "./model/kernel"
import { fromKey } from "./model/address"
import { BINARY_MODEL,EVERYTHING_METHOD,FULL_SELF_RESOLUTION,WHOLE_INVARIANT,resolveResponse } from "./model/binaryRelationships"
import { constrainedNodes,directedTetra } from "./model/constrained-node"
import { MODEL_DIRECTIONS,projectInDirection } from "./model/directional-view"
import { COMMUNICATION_INVARIANT,communicate } from "./model/communication"
import { createAddressedDraw,mayAdvanceAfterDraw,type DrawReceipt } from "./model/addressed-draw"
import { FieldAddressOverlay } from "./FieldAddressOverlay"
import { validSpatialAddress } from "./model/field-inventory"
import { INITIAL_SYSTEM_STATE, transition } from "./model/transitionEngine"
import {clampViewZoom,fitView,usableFieldView,isCurrentActFrame,createViewAdvanceQueue,pickNodes,stateAddress,parseStateAddress,continuumAtAct,type NodeHit,type StateSelection} from "./model/view-navigation"
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
 const [viewAct,setViewAct]=useState<number|null>(null),[pan,setPan]=useState({x:0,y:0}),[fitMode,setFitMode]=useState<"field"|"selected"|null>("field"),[candidates,setCandidates]=useState<readonly string[]>([]),[addressError,setAddressError]=useState("")
 const [history,setHistory]=useState<{items:StateSelection[];index:number}>({items:[{act:0,role:"IS",address:"0,0,0"}],index:0})
 const toolsBar=useRef<HTMLDivElement>(null),nodeHits=useRef<readonly NodeHit[]>([]),hitContext=useRef({act:0,role:"IS" as "WAS"|"IS"|"NEXT"}),candidateContext=useRef({act:0,role:"IS" as "WAS"|"IS"|"NEXT"}),gesture=useRef<{x:number;y:number;moved:boolean}|null>(null)
 const [direction,setDirection]=useState(0),[fieldRole,setFieldRole]=useState<"WAS"|"IS"|"NEXT">("IS"),[traversalReceipt,setTraversalReceipt]=useState("IS · initial addressed field")
 const [inspecting,setInspecting]=useState(false),[paused,setPaused]=useState(true),[act,setAct]=useState(0),[roleState,setRoleState]=useState(INITIAL_SYSTEM_STATE)
 const [drawReceipt,setDrawReceipt]=useState<DrawReceipt|null>(null)
 const pendingActs=useRef(createViewAdvanceQueue())
 const [stepNotice,setStepNotice]=useState("")
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
 const [guidance,setGuidance]=useState("SOURCE"),[reply,setReply]=useState(""),[nextReply,setNextReply]=useState<string|null>(null),[sourceAddress,setSourceAddress]=useState("HUMAN/0"),[sourceMoment,setSourceMoment]=useState(0),[intentCenter,setIntentCenter]=useState("0,0,0"),[menu,setMenu]=useState<{x:number;y:number;address:string}|null>(null),[zoom,setZoom]=useState(16),[yaw,setYaw]=useState(-.65),[pitch,setPitch]=useState(.45),[selected,setSelected]=useState("0,0,0"),[visible,setVisible]=useState(1)
 const requestAdvance=()=>{pendingActs.current.cancel();setPaused(true);setStepNotice("0 retained · complete transition unresolved; no partial 1 committed")}
 const advance=requestAdvance
 const observed=useMemo(()=>continuumAtAct(continuum.current,viewAct??act),[act,viewAct])
 const navigateState=(target:StateSelection,record=true)=>{const cancelled=pendingActs.current.cancel();if(cancelled)setStepNotice(`Cancelled ${cancelled} uncommitted step(s)`);setPaused(true);setViewAct(target.act);setFieldRole(target.role);setSelected(target.address);setInspecting(true);setCandidates([]);setAddressError("");if(record)setHistory(h=>{const current=h.items[h.index];return stateAddress(current)===stateAddress(target)?h:{items:[...h.items.slice(0,h.index+1),target],index:h.index+1}})}
 const selectAddress=(address:string)=>navigateState({act:observed.state.act,role:fieldRole,address})
 const openState=(value:string)=>{const target=parseStateAddress(value);if(!target){setAddressError("Use selected-kernel/act/NUMBER/WAS|IS|NEXT/x,y,z");return}if(target.act>act){setAddressError("That Act has not been retained in this session");return}navigateState(target)}
 const visitHistory=(offset:number)=>{const index=history.index+offset,target=history.items[index];if(target){navigateState(target,false);setHistory(h=>({...h,index}))}}
 const chooseAt=(x:number,y:number)=>{const hits=pickNodes(nodeHits.current,{x,y});if(hits.length===1)navigateState({...hitContext.current,address:hits[0]});else if(hits.length>1){candidateContext.current=hitContext.current;setCandidates(hits);setPaused(true)}else setCandidates([])}
 const closeInspector=()=>{setInspecting(false);inspectButton.current?.focus()}
 const calculated=useMemo(()=>resolveTick(observed.state),[observed])
 const following=useMemo(()=>resolveTick(calculated.state),[calculated])
 const traverse=(role:"WAS"|"IS"|"NEXT")=>{setTraversalReceipt(`${fieldRole} → ${role} @ ${selected} · Act ${observed.state.act} · ${role==="NEXT"?"calculated, not committed":"retained state"}`);navigateState({act:observed.state.act,role,address:selected})}
 const projectUnit=(p:Readonly<{x:number;y:number;z:number}>)=>{const ca=Math.cos(yaw),sa=Math.sin(yaw),cb=Math.cos(pitch),sb=Math.sin(pitch),rx=p.x*ca-p.z*sa,rz=p.x*sa+p.z*ca;return projectInDirection({x:rx,y:p.y*cb-rz*sb,z:p.y*sb+rz*cb},direction)}
 const fitCamera=()=>{const box=canvas.current?.getBoundingClientRect();if(!box||!fitMode)return;const source=validSpatialAddress(sourceAddress)?sourceAddress:"0,0,0",field=fieldRole==="WAS"?observed.state.was:fieldRole==="NEXT"?calculated.state.is:observed.state.is,ledger=fieldRole==="WAS"?observed.receipts.at(-1):fieldRole==="IS"?calculated.ledger:following.ledger,addresses=fitMode==="selected"?new Set([selected]):field,points=[...addresses].map(a=>projectUnit(relativeTo(a,source)));if(ledger)for(const node of constrainedNodes(addresses,ledger)){const anchor=relativeTo(node.address,source);for(const n of node.next)for(const p of directedTetra(n.delta)??[])points.push(projectUnit({x:anchor.x+p.x,y:anchor.y+p.y,z:anchor.z+p.z}))}const region=usableFieldView(box.width,box.height,(toolsBar.current?.getBoundingClientRect().bottom??80)-box.top,inspecting),fit=fitView(points,region.width,region.height);if(fit){setZoom(fit.zoom);setPan({x:-fit.x,y:-fit.y})}}
 useEffect(()=>{fitCamera();const observer=new ResizeObserver(fitCamera);if(canvas.current)observer.observe(canvas.current);if(toolsBar.current)observer.observe(toolsBar.current);return()=>observer.disconnect()},[fitMode,selected,sourceAddress,yaw,pitch,direction,fieldRole,observed,inspecting])
 const manualZoom=(value:number)=>{setFitMode(null);setZoom(clampViewZoom(value))}
 const view=useRef({zoom,selected,sourceAddress,yaw,pitch,paused,roleState,direction,fieldRole,calculated,following,observed,pan,inspecting})
 view.current={zoom,selected,sourceAddress,yaw,pitch,paused,roleState,direction,fieldRole,calculated,following,observed,pan,inspecting}
 useEffect(()=>{const c=canvas.current;if(!c)return;const output=c.getContext("2d");if(!output)return
  const staging=document.createElement("canvas"),ctx=staging.getContext("2d",{willReadFrequently:true});if(!ctx)return
  let lastPresented="",lastFrameAt=0
  let disposed=false,timer:ReturnType<typeof setTimeout>|undefined,activeDraw:ReturnType<typeof createAddressedDraw>|undefined
  const draw=(now:number)=>{if(disposed)return
   // One coherent view snapshot finishes before the newest queued view is consumed.
   const {zoom,selected,sourceAddress,yaw,pitch,roleState,direction,fieldRole,calculated,following,observed,pan,inspecting}=view.current
   const r=c.getBoundingClientRect(),dpr=devicePixelRatio||1,width=Math.max(1,Math.floor(r.width*dpr)),height=Math.max(1,Math.floor(r.height*dpr))
   const frameIdentity=[width,height,zoom,selected,sourceAddress,yaw,pitch,direction,fieldRole,observed.state.act,pan.x,pan.y,inspecting,roleState.step].join("|")
   if(pendingActs.current.pending===0&&((view.current.paused&&frameIdentity===lastPresented)||(!view.current.paused&&now-lastFrameAt<1000/15))){raf.current=requestAnimationFrame(draw);return}
   lastFrameAt=now
   staging.width=width;staging.height=height;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle="#050708";ctx.fillRect(0,0,r.width,r.height)
   // The canvas is a finite observation window onto an unbounded addressed field.
   // Every physical screen pixel has an address-state relative to one source.
   const source=validSpatialAddress(sourceAddress)?sourceAddress:"0,0,0"
   const o=fromKey(source),pixelStep=1/Math.max(.125,zoom),cx=Math.floor(r.width/2),cy=Math.floor(r.height/2)
   const addressForPixel=(x:number,y:number)=>`${o.x+Math.round((x-cx)*pixelStep)},${o.y+Math.round((cy-y)*pixelStep)},${o.z}`
   // Default grain-out presents the resolved whole, not the proto-grain carrier.\n   // The underlying field remains addressable but is visually suppressed until\n   // a finer grain is explicitly requested.\n   ctx.fillStyle="#050708";ctx.fillRect(0,0,r.width,r.height)

   // Differences already resolved by the continuum are state overlays within
   // the field; they do not define or bound the field itself.
   const activeField=fieldRole==="WAS"?observed.state.was:fieldRole==="NEXT"?calculated.state.is:observed.state.is
   const stateAddresses=Object.freeze([...activeField])
   const region=usableFieldView(r.width,r.height,(toolsBar.current?.getBoundingClientRect().bottom??80)-r.top,inspecting),viewCenter={x:region.left+region.width/2,y:region.top+region.height/2}
   const projectPoint=(p:Readonly<{x:number;y:number;z:number}>):ProjectedAddress=>{const ca=Math.cos(yaw),sa=Math.sin(yaw),cb=Math.cos(pitch),sb=Math.sin(pitch),rx=p.x*ca-p.z*sa,rz=p.x*sa+p.z*ca,q=projectInDirection({x:rx,y:p.y*cb-rz*sb,z:p.y*sb+rz*cb},direction);return{x:viewCenter.x+(q.x+pan.x)/pixelStep,y:viewCenter.y-(q.y+pan.y)/pixelStep}}
   const projectState=(address:string)=>projectPoint(relativeTo(address,source))
   const stateByAddress=new Map(stateAddresses.map(address=>[address,projectState(address)] as const))
   const frameProjected=mergeByPixel(stateAddresses,projectState)
   const ledger=fieldRole==="NEXT"?calculated.ledger:fieldRole==="WAS"?observed.receipts.at(-2):observed.receipts.at(-1)
   const edges:readonly FieldEdge[]=ledger?.entries.flatMap(entry=>entry.arrivals.map(arrival=>({from:arrival.source,to:entry.address})))??[]
   const edgeByAddress=new Map([...new Set(edges.flatMap(edge=>[edge.from,edge.to]))].map(address=>[address,projectState(address)] as const))
   const detail=Math.max(.35,Math.min(1,zoom/8))
   if(detail>0){drawEdges(ctx,edges,edgeByAddress,.22*detail);for(const address of activeField){const q=stateByAddress.get(address);if(q&&q.x>=0&&q.x<r.width&&q.y>=0&&q.y<r.height)putPhysicalPixel(ctx,q.x,q.y,dpr,address===selected||address===source)}}

   const successor=fieldRole==="WAS"?observed.receipts.at(-1):fieldRole==="IS"?calculated.ledger:following.ledger
   const constraints=successor?constrainedNodes(activeField,successor):[]
   const frameHits:NodeHit[]=stateAddresses.map(address=>({...projectState(address),address,polygons:[]}))
   const frameHitByAddress=new Map(frameHits.map(hit=>[hit.address,hit]))
   ctx.save();ctx.lineWidth=.7
   for(const node of constraints){const anchor=relativeTo(node.address,source),q=projectPoint(anchor)
    if(!node.next.length){ctx.strokeStyle="#929c9f";ctx.strokeRect(q.x-2,q.y-2,4,4);continue}
    ctx.strokeStyle=node.next.length===1?"#e5ad56":"rgba(229,173,86,.48)";ctx.setLineDash(node.next.length>1?[2,2]:[])
    for(const candidate of node.next){const tetra=directedTetra(candidate.delta);if(!tetra)continue;const points=tetra.map(p=>projectPoint({x:anchor.x+p.x,y:anchor.y+p.y,z:anchor.z+p.z}));const hit=frameHitByAddress.get(node.address);if(hit)(hit.polygons as ProjectedAddress[][]).push(points);for(const [a,b] of [[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]]){ctx.beginPath();ctx.moveTo(points[a].x,points[a].y);ctx.lineTo(points[b].x,points[b].y);ctx.stroke()}}
   }
   ctx.restore()
   const selectedPoint=stateByAddress.get(selected);if(selectedPoint){ctx.save();ctx.strokeStyle="#fff0b3";ctx.lineWidth=2;ctx.beginPath();ctx.arc(selectedPoint.x,selectedPoint.y,7,0,Math.PI*2);ctx.stroke();ctx.fillStyle="#fff0b3";ctx.font="12px monospace";ctx.fillText(selected,selectedPoint.x+10,selectedPoint.y-10);ctx.restore()}
   // Source points are modelling directions, not a solid to showcase.
   // The selected direction basis above projects every live address and edge.
   const centre=projectPoint({x:0,y:0,z:0}),vector=MODEL_DIRECTIONS[direction]
   ctx.save();ctx.fillStyle="#eeeade";ctx.fillRect(centre.x-1,centre.y-1,2,2)
   ctx.font="11px monospace";ctx.textAlign="center";ctx.fillText(`ZERO · ${fieldRole} · OBSERVER ${direction+1} (${vector.x},${vector.y},${vector.z})`,centre.x,centre.y+30)
   ctx.font="9px monospace";ctx.fillText("SELECTED PREVIEW · six-face alternatives · inherited pose unresolved",centre.x,centre.y+46)
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
    c.width=width;c.height=height;output.putImageData(presented,0,0);projected.current=frameProjected;nodeHits.current=frameHits;hitContext.current={act:observed.state.act,role:fieldRole};lastPresented=frameIdentity
    const requested=pendingActs.current.pending>0,playback=!view.current.paused&&now-last.current>=1000&&WHOLE_INVARIANT.recursive&&FULL_SELF_RESOLUTION.selfSimilar
    if(mayAdvanceAfterDraw(receipt,true)&&isCurrentActFrame(observed.state.act,continuum.current.state.act)&&(requested||playback)){if(requested)pendingActs.current.consumeCurrentFrame(observed.state.act,continuum.current.state.act);setDrawReceipt(receipt);advance();last.current=now}
    else setDrawReceipt(previous=>previous&&previous.width===width&&previous.height===height?previous:receipt)
    raf.current=requestAnimationFrame(draw)
   };batch()
  };raf.current=requestAnimationFrame(draw);return()=>{disposed=true;activeDraw?.cancel();if(timer!==undefined)clearTimeout(timer);cancelAnimationFrame(raf.current)}},[])
 return <main className="infinity-map"><section className="infinity-field" aria-label="Ledger-driven fracture field">
  <div ref={toolsBar} className="field-tools"><label>Model relation <select aria-label="Model relation" value={fieldRole} onChange={e=>traverse(e.target.value as "WAS"|"IS"|"NEXT")}><option>WAS</option><option>IS</option><option>NEXT</option></select></label><label>Observer projection <select aria-label="Observer projection" value={direction} onChange={e=>{setDirection(Number(e.target.value));drive("UI_CONTROL","OBSERVER_DIRECTION",e.target.value,()=>{})}}>{MODEL_DIRECTIONS.map((v,i)=><option key={i} value={i}>{i+1}: {v.x},{v.y},{v.z}</option>)}</select></label><button ref={inspectButton} type="button" aria-expanded={inspecting} onClick={()=>setInspecting(value=>!value)}>Inspect addresses</button><button type="button" onClick={requestAdvance}>{paused?"Play shared Act":"Pause playback"}</button><button type="button" onClick={requestAdvance}>Advance one Act</button><button type="button" onClick={()=>{setYaw(-.65);setPitch(.45)}}>Reset view</button><button type="button" onClick={()=>setYaw(value=>value+.15)}>Turn view left</button><button type="button" onClick={()=>manualZoom(zoom*2)}>Grain in</button><button type="button" onClick={()=>manualZoom(zoom/2)}>Grain out</button><button type="button" onClick={()=>{setFitMode("selected");fitCamera()}}>Fit selected</button><button type="button" onClick={()=>{setFitMode("field");fitCamera()}}>Fit field</button><span className="zoom-readout">{zoom.toFixed(1)} px/unit</span><button type="button" onClick={()=>setPitch(value=>Math.min(Math.PI/2,value+.15))}>Tilt view up</button></div>
  <aside className="transition-boundary" aria-label="Complete transition at 1"><strong>All done at 1 · {INTEGRATED_MODEL_BOUNDARY.status}</strong><p>0 is retained until placement, inherited twist and turn, all threading, stitched root paths and the successor drawing resolve together. No partial 1 is committed.</p><details><summary>Requirements and unresolved derivation</summary><ul>{INTEGRATED_MODEL_BOUNDARY.requirements.map(item=><li key={item}>{item}</li>)}</ul><p>Still unresolved: {INTEGRATED_MODEL_BOUNDARY.blockers.join("; ")}. Exact model intersections require returned evidence; screen overlap does not stitch paths.</p></details><small>The existing six-face glyphs and NEXT are a selected preview, not the resolved model. “Might/may as well be” remains proposed.</small></aside>
  {candidates.length>0?<div className="node-choice" role="dialog" aria-label="Choose overlapping node"><strong>{candidates.length} nodes under this point</strong>{candidates.map(address=><button type="button" key={address} onClick={()=>navigateState({...candidateContext.current,address})}>{address}</button>)}<button type="button" onClick={()=>setCandidates([])}>Cancel selection</button></div>:null}
  <div className="state-navigation"><span>{viewAct===null?"Following live Act":"Pinned state · playback paused"}</span><strong>{stateAddress({act:observed.state.act,role:fieldRole,address:selected})}</strong><button type="button" disabled={history.index===0} onClick={()=>visitHistory(-1)}>Previous state address</button><button type="button" disabled={history.index===history.items.length-1} onClick={()=>visitHistory(1)}>Next state address</button><button type="button" onClick={()=>{setViewAct(null);setFieldRole("IS");setAddressError("")}}>Live Act {act}</button></div>
  {inspecting?<FieldAddressOverlay stateAddressValue={stateAddress({act:observed.state.act,role:fieldRole,address:selected})} onOpenState={openState} stateAddressError={addressError} fieldRole={fieldRole} selected={selected} onSelect={selectAddress} onFollowNext={address=>{setTraversalReceipt(`${fieldRole} @ ${selected} → ${fieldRole==="WAS"?"IS":"proposed NEXT"} @ ${address} · Act ${act} · navigation only`);navigateState({act:observed.state.act,role:fieldRole==="WAS"?"IS":"NEXT",address})}} continuum={observed} paused={paused} onPause={requestAdvance} onStep={requestAdvance} onClose={closeInspector}/>:null}
  <div className="field-view-status" aria-live="polite">Act {act} · {stepNotice} · {paused?"paused":"playback"} · slots {roleState.temporal.was} / {roleState.temporal.is} / {roleState.temporal.next} · view {yaw.toFixed(2)} / {pitch.toFixed(2)} · {traversalReceipt} · observer {direction+1} · SELECTED observer basis; six-face rule unchanged · Exact twist transform unresolved · {drawReceipt?`${drawReceipt.assigned}/${drawReceipt.width*drawReceipt.height} preview pixels complete; model transition unresolved`:"framing before TIME"}</div>
  <canvas ref={canvas} className="infinity-canvas"
  onWheel={e=>{e.preventDefault();manualZoom(zoom*Math.exp(-e.deltaY*.0015))}}
  onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);pointers.current.set(e.pointerId,{x:e.clientX,y:e.clientY});lastPointer.current={x:e.clientX,y:e.clientY};gesture.current={x:e.clientX,y:e.clientY,moved:pointers.current.size>1}}}
  onPointerMove={e=>{if(!pointers.current.has(e.pointerId))return;if(gesture.current&&Math.hypot(e.clientX-gesture.current.x,e.clientY-gesture.current.y)>4)gesture.current.moved=true;const prior=pointers.current.get(e.pointerId)!;pointers.current.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.current.size===2){const pts=[...pointers.current.values()],before=pts.map(p=>({...p}));const movedIndex=[...pointers.current.keys()].indexOf(e.pointerId);before[movedIndex]=prior;const d=Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y),od=Math.hypot(before[0].x-before[1].x,before[0].y-before[1].y);if(gesture.current)gesture.current.moved=true;if(od>0)manualZoom(zoom*d/od);return}if(!lastPointer.current||!gesture.current?.moved)return;const dx=e.clientX-lastPointer.current.x,dy=e.clientY-lastPointer.current.y;lastPointer.current={x:e.clientX,y:e.clientY};setYaw(v=>v+dx*.008);setPitch(v=>Math.max(-Math.PI/2,Math.min(Math.PI/2,v+dy*.008)))}}
  onPointerUp={e=>{if(gesture.current&&!gesture.current.moved&&pointers.current.size===1){const box=e.currentTarget.getBoundingClientRect();chooseAt(e.clientX-box.left,e.clientY-box.top)}pointers.current.delete(e.pointerId);lastPointer.current=null;gesture.current=null}} onPointerCancel={e=>{pointers.current.delete(e.pointerId);lastPointer.current=null}}
  onContextMenu={e=>{e.preventDefault();const box=e.currentTarget.getBoundingClientRect();chooseAt(e.clientX-box.left,e.clientY-box.top)}}
  onDoubleClick={()=>setFitMode("selected")} />
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

