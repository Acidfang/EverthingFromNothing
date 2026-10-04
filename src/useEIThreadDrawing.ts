import {createEIIdleState,observeEIIdle} from './model/ei-idle-observation'
import {useEffect,useLayoutEffect,useMemo,useRef,useState,type RefObject} from 'react'
import type {EIThreadDrawPlan} from './model/ei-thread-draw'
import {fingerprintEIAnimationContent,createEIAnimationCycle,proposeNextEIAnimationFrame,verifyEIAnimationReadback,commitEIAnimationFrame,replayEIAnimationCycle,rebaseEIAnimationCycle,exportEIAnimationCycle,restoreEIAnimationCycle,type EIAnimationCycle} from './model/ei-animation-cycle'
import {projectEISvgWitness,readEISvgWitness,type EISvgSceneGeometry} from './model/ei-svg-frame-witness'
import type {projectEIFieldArray} from './model/ei-field-array-view'
type Field=ReturnType<typeof projectEIFieldArray>
/** Each NEXT is actually rendered and read back before it becomes IS. No timer
 * or interpolated model pose chooses the next state. */
export function useEIThreadDrawing(plan:EIThreadDrawPlan,field:Field,svg:RefObject<SVGSVGElement|null>,initialPhase=0,geometry:EISvgSceneGeometry,initialSaved?:string,initialIdle?:ReturnType<typeof createEIIdleState>,graphicsReady=true){
 const idleObservation=useRef(initialIdle??createEIIdleState())
 const manualIdle=useRef(false)
 const snapshot=JSON.stringify([plan,geometry,field.nodes.map(({address,x,y})=>({address,x,y}))])
 const appliedInput=useRef(snapshot)
 const sourceKey=fingerprintEIAnimationContent(JSON.stringify(plan))
 const seed=useMemo(()=>{const generation=crypto.randomUUID();return proposeNextEIAnimationFrame(createEIAnimationCycle(plan,{generation,snapshotKey:sourceKey,initialPhase}), (phase,retained)=>projectEISvgWitness(field,plan,phase,retained,geometry))},[snapshot])
 const [stored,setStored]=useState(()=>initialSaved?proposeNextEIAnimationFrame(rebaseEIAnimationCycle(restoreEIAnimationCycle(initialSaved,{generation:crypto.randomUUID()}),plan,{generation:seed.generation,snapshotKey:seed.source.snapshotKey}),(phase,basis)=>projectEISvgWitness(field,plan,phase,basis,geometry)):seed),[playing,setPlaying]=useState(true),[attempt,setAttempt]=useState(0)
 const cycle=useMemo(()=>appliedInput.current===snapshot?stored:proposeNextEIAnimationFrame(rebaseEIAnimationCycle(stored,plan,{generation:seed.generation,snapshotKey:seed.source.snapshotKey}),(phase,basis)=>projectEISvgWitness(field,plan,phase,basis,geometry)),[stored,seed]),live=useRef(cycle);live.current=cycle
 useLayoutEffect(()=>{appliedInput.current=snapshot;setStored(cycle);setPlaying(!manualIdle.current)},[seed])
 useEffect(()=>{const media=window.matchMedia?.('(prefers-reduced-motion: reduce)');const apply=()=>{if(media?.matches){manualIdle.current=true;setPlaying(false)}};apply();media?.addEventListener('change',apply);return()=>media?.removeEventListener('change',apply)},[])
 useEffect(()=>{if(!graphicsReady||!playing||cycle.NEXT||cycle.complete||cycle.openReasons.length>0)return;setStored(current=>current===cycle?proposeNextEIAnimationFrame(current,(phase,retained)=>projectEISvgWitness(field,plan,phase,retained,geometry)):current)},[cycle,playing,field,plan,graphicsReady])
 useLayoutEffect(()=>{
  const next=cycle.NEXT;if(!next||!graphicsReady)return
  let first=0,second=0,cancelled=false
  const read=()=>{if(cancelled||live.current.NEXT!==next)return;if(document.hidden)return
   const surface=svg.current;let receipt
   try{if(!surface||surface.getAttribute('data-render-frame')!==next.frameKey)throw new Error('Rendered candidate is missing or stale')
    receipt=verifyEIAnimationReadback(cycle,{frameKey:surface.getAttribute('data-render-frame')!,source:next.source,generation:surface.getAttribute('data-render-generation')!,sequence:Number(surface.getAttribute('data-render-sequence')),content:readEISvgWitness(surface)})
   }catch{receipt=verifyEIAnimationReadback(cycle,null)}
   if(!receipt.verified){manualIdle.current=true;setPlaying(false)}
   setStored(current=>current.NEXT===next?commitEIAnimationFrame(current,receipt):current)
  }
  const resume=()=>{if(!document.hidden&&!cancelled)first=requestAnimationFrame(()=>{second=requestAnimationFrame(read)})};document.addEventListener('visibilitychange',resume)
  first=requestAnimationFrame(()=>{second=requestAnimationFrame(read)})
  return()=>{cancelled=true;cancelAnimationFrame(first);cancelAnimationFrame(second);document.removeEventListener('visibilitychange',resume)}
 },[cycle.NEXT,attempt,graphicsReady])
 // This is a carrier resource budget for actual observation, never source time.
 useEffect(()=>{let timer:number|undefined,cancelled=false;const inspect=()=>{if(cancelled||document.hidden)return;const state=live.current,frame=state.IS,surface=svg.current;if(frame&&!state.NEXT&&surface){try{idleObservation.current=observeEIIdle(idleObservation.current,frame,{frameKey:surface.getAttribute('data-render-frame')??'',source:frame.source,generation:surface.getAttribute('data-render-generation')??'',sequence:Number(surface.getAttribute('data-render-sequence')),content:readEISvgWitness(surface)},Date.now())}catch{idleObservation.current=observeEIIdle(idleObservation.current,frame,null,Date.now())}}timer=window.setTimeout(inspect,1000)};const visible=()=>{if(timer!==undefined)clearTimeout(timer);if(!document.hidden)inspect()};document.addEventListener('visibilitychange',visible);inspect();return()=>{cancelled=true;if(timer!==undefined)clearTimeout(timer);document.removeEventListener('visibilitychange',visible)}},[])
 const frame=cycle.NEXT??cycle.IS
 const retained=frame?.retained??{nodes:[],edges:[]}
 const propose=()=>{setStored(current=>proposeNextEIAnimationFrame(current,(phase,basis)=>projectEISvgWitness(field,plan,phase,basis,geometry)));setAttempt(value=>value+1)}
 return {phase:frame?.phase??0,playing:playing&&!cycle.complete,retained:{nodes:new Set(retained.nodes),edges:new Set(retained.edges)},cycle,frame,idleObservation:idleObservation.current,save:()=>exportEIAnimationCycle(live.current),getIdle:()=>idleObservation.current,
  idle:()=>{manualIdle.current=true;setPlaying(false)},play:()=>{manualIdle.current=false;if(cycle.complete)setStored(current=>proposeNextEIAnimationFrame(replayEIAnimationCycle(current,crypto.randomUUID()),(phase,basis)=>projectEISvgWitness(field,plan,phase,basis,geometry)));else propose();setPlaying(true)},
  step:()=>{manualIdle.current=true;setPlaying(false);propose()},finish:()=>{manualIdle.current=false;propose();setPlaying(true)},complete:cycle.complete}
}
