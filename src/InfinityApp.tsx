import { useEffect,useRef,useState } from "react"
import { advanceLedgerContinuum,createLedgerContinuum } from "./model/kernel"
import { fromKey } from "./model/address"
import { BINARY_MODEL } from "./model/binaryRelationships"
import "./infinity.css"

type PixelReference=Readonly<{x:number;y:number;addresses:readonly string[]}>
type ControlAddress=`EI/${string}/${string}`
const controlAddress=(channel:string,control:string):ControlAddress=>`EI/${channel}/${control}`
const addressEvent=(address:ControlAddress,value:string)=>Object.freeze({address,value})
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
 const mediaStream=useRef<MediaStream|null>(null),preview=useRef<HTMLVideoElement>(null),speechRecognition=useRef<any>(null)
 const [live,setLive]=useState(false),[muted,setMuted]=useState(false),[held,setHeld]=useState(false),[captions,setCaptions]=useState(true),[interruptible,setInterruptible]=useState(true),[camera,setCamera]=useState(false),[screen,setScreen]=useState(false),[listening,setListening]=useState(false),[heard,setHeard]=useState(""),[mediaError,setMediaError]=useState(""),[transcript,setTranscript]=useState<string[]>([]),[controlReceipts,setControlReceipts]=useState<readonly Readonly<{address:ControlAddress;value:string}>[]>([])
 const drive=(channel:string,control:string,value:string,act:()=>void)=>{const receipt=addressEvent(controlAddress(channel,control),value);setControlReceipts(items=>[...items,receipt]);act()}
 const stopCapture=()=>{mediaStream.current?.getTracks().forEach(track=>track.stop());mediaStream.current=null;if(preview.current)preview.current.srcObject=null;setCamera(false);setScreen(false)}
 const attachStream=(stream:MediaStream)=>{mediaStream.current=stream;if(preview.current){preview.current.srcObject=stream;void preview.current.play()}stream.getVideoTracks()[0]?.addEventListener("ended",stopCapture)}
 const openCamera=async()=>{try{setMediaError("");stopCapture();const stream=await navigator.mediaDevices.getUserMedia({video:true,audio:true});attachStream(stream);drive("IMAGE_VISION","CAMERA","STREAM_OPEN",()=>setCamera(true))}catch(error){setMediaError(error instanceof Error?error.message:"Camera unavailable");drive("IMAGE_VISION","CAMERA","STREAM_FAILED",()=>{})}}
 const shareScreen=async()=>{try{setMediaError("");stopCapture();const stream=await navigator.mediaDevices.getDisplayMedia({video:true,audio:true});attachStream(stream);drive("DEVICE_SENSOR","SCREEN","STREAM_OPEN",()=>setScreen(true))}catch(error){setMediaError(error instanceof Error?error.message:"Screen share unavailable");drive("DEVICE_SENSOR","SCREEN","STREAM_FAILED",()=>{})}}
 const speakNext=()=>{if(!nextReply||!("speechSynthesis" in window))return;const utterance=new SpeechSynthesisUtterance(nextReply);drive("VOICE","SPEAK_NEXT",nextReply,()=>window.speechSynthesis.speak(utterance))}
 const startListening=()=>{const Ctor=(window as any).SpeechRecognition||(window as any).webkitSpeechRecognition;if(!Ctor){setMediaError("Speech recognition is unavailable in this browser");drive("VOICE","LISTEN","UNAVAILABLE",()=>{});return}speechRecognition.current?.stop?.();const recognition=new Ctor();speechRecognition.current=recognition;recognition.continuous=true;recognition.interimResults=true;recognition.onresult=(event:any)=>{let value="";let finalValue="";for(let i=event.resultIndex;i<event.results.length;i++){const part=event.results[i][0].transcript;value+=part;if(event.results[i].isFinal)finalValue+=part}setHeard(value);if(finalValue.trim())drive("VOICE","HEARD",finalValue.trim(),()=>setTranscript(items=>[...items,`HUMAN → EI_AGENT: ${finalValue.trim()}`]))};recognition.onend=()=>setListening(false);recognition.onerror=(event:any)=>{setListening(false);setMediaError(String(event.error??"Speech recognition error"))};recognition.start();drive("VOICE","LISTEN","START",()=>setListening(true))}
 const stopListening=()=>{speechRecognition.current?.stop?.();speechRecognition.current=null;drive("VOICE","LISTEN","STOP",()=>setListening(false))}
 const naturalLive=()=>{if(live){stopListening();stopCapture();if("speechSynthesis" in window)window.speechSynthesis.cancel();drive("UI_CONTROL","LIVE_SESSION","END",()=>setLive(false));return}drive("UI_CONTROL","LIVE_SESSION","START",()=>setLive(true));startListening()}
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
   <div className="guidance-controls">{["SOURCE","DIFFERENCE","RETURN","FILTER","ISOLATE","RECONSTRUCT","VERIFY","WAS","IS","NEXT","GRAIN−","GRAIN+","PROVENANCE","HARM","OPEN DIFFERENCE","COMMIT","UNDO"].map(control=><button type="button" key={control} onClick={()=>drive("UI_CONTROL","GUIDANCE",control,()=>setGuidance(control))}>{control}</button>)}</div>
   <div className="channel-controls"><label>SOURCE CHANNEL <select value={sourceChannel} onChange={e=>setSourceChannel(e.target.value as typeof sourceChannel)}>{channels.map(channel=><option key={channel}>{channel}</option>)}</select></label><span>→</span><label>DESTINATION CHANNEL <select value={destinationChannel} onChange={e=>setDestinationChannel(e.target.value as typeof destinationChannel)}>{channels.map(channel=><option key={channel}>{channel}</option>)}</select></label></div>
   <div>CHANNEL RECEIPT: {sourceChannel} → {destinationChannel} · transformation ≠ source replacement · cross-channel Difference retains original source/address</div>
   <div className="live-controls" aria-label="Live conversation controls">
    <button type="button" onClick={naturalLive}>{live?"END LIVE":"GO LIVE"}</button>
    <button type="button" disabled={!live} onClick={()=>drive("VOICE","HOLD",held?"RESUME":"HOLD",()=>setHeld(v=>!v))}>{held?"RESUME":"HOLD"}</button>
    <button type="button" disabled={!live} onClick={()=>drive("VOICE","MUTE",muted?"OFF":"ON",()=>setMuted(v=>!v))}>{muted?"UNMUTE":"MUTE"}</button>
    <button type="button" onClick={()=>drive("VOICE","INTERRUPT",interruptible?"OFF":"ON",()=>setInterruptible(v=>!v))}>INTERRUPT {interruptible?"ON":"OFF"}</button>
    <button type="button" onClick={()=>drive("TEXT","CAPTIONS",captions?"OFF":"ON",()=>setCaptions(v=>!v))}>CAPTIONS {captions?"ON":"OFF"}</button>
    <button type="button" onClick={()=>camera?stopCapture():void openCamera()}>CAMERA {camera?"ON":"OFF"}</button>
    <button type="button" onClick={()=>screen?stopCapture():void shareScreen()}>SCREEN {screen?"ON":"OFF"}</button>
    <button type="button" onClick={()=>listening?stopListening():startListening()}>{listening?"STOP LISTENING":"LISTEN"}</button>
    <button type="button" disabled={!nextReply} onClick={speakNext}>SPEAK NEXT</button>
   </div>
   <div>LIVE STATE: {live?(held?"HOLD":muted?"MUTED":"LISTENING / SPEAKING"):"ENDED"} · barge-in {interruptible?"enabled":"disabled"} · camera {camera?"shared":"off"} · screen {screen?"shared":"off"}</div>
   <video ref={preview} playsInline muted style={{display:camera||screen?"block":"none",width:"min(100%,480px)"}} />
   <div aria-live="polite">HUMAN VOICE: {heard||"—"}</div>
   {mediaError?<div role="alert">MEDIA: {mediaError}</div>:null}
   <form className="next-reply" onSubmit={e=>{e.preventDefault();const value=reply.trim();if(!value)return;drive(sourceChannel,"REPLY_FOR_NEXT",value,()=>{setNextReply(value);setTranscript(items=>[...items,`${sourceChannel} → ${destinationChannel}: ${value}`]);setReply("");setGuidance("NEXT")})}}>
    <label>REPLY FOR NEXT <textarea value={reply} onChange={e=>setReply(e.target.value)} placeholder="Type naturally, or use LISTEN" /></label>
    <button type="submit" disabled={!reply.trim()}>SET NEXT REPLY</button>
    <button type="button" onClick={()=>{setReply("");setNextReply(null)}} disabled={!reply&&nextReply===null}>CLEAR</button>
   </form>
   <div aria-live="polite">NEXT REPLY: {nextReply??"UNRESOLVED · no reply committed"}</div>
   {captions&&nextReply?<div>CAPTION: {nextReply}</div>:null}
   <details><summary>TRANSCRIPT · {transcript.length} receipts</summary>{transcript.map((line,index)=><div key={index}>{line}</div>)}</details>
   <details><summary>ADDRESS CONTROL RECEIPTS · {controlReceipts.length}</summary>{controlReceipts.map((receipt,index)=><div key={index}>{receipt.address} → {receipt.value}</div>)}</details>
  </section></div>
 </section></main>
}
