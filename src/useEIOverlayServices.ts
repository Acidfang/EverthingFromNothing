import {useEffect,useRef,useState} from 'react'
import type {EILedger,EIResult} from './model/ei-engine'
import {createEIOverlayServices} from './model/ei-overlay-services'
type Runtime=Awaited<ReturnType<typeof createEIOverlayServices>>
type View=Readonly<{ledger:EILedger;eventId:string|null}>
/** Each local overlay consumes addressed committed events. The view-model
 * acknowledgment is separate from the existing actual SVG/DOM readback. */
export function useEIOverlayServices(base:EILedger,userRoot:string){
 const [scene,setScene]=useState<View>({ledger:base,eventId:null}),[workspace,setWorkspace]=useState<View>({ledger:base,eventId:null}),[error,setError]=useState('')
 const current=useRef<{base:EILedger;root:string;generation:number;ready:Promise<Runtime>;runtime?:Runtime;close:()=>void}|null>(null),generation=useRef(0),expected=useRef(base),live=useRef(true)
 const initialize=(initial:EILedger,root:string)=>{
  current.current?.close();const token=++generation.current;expected.current=initial
  const state={base:initial,root,generation:token,ready:null as unknown as Promise<Runtime>,runtime:undefined as Runtime|undefined,close:()=>{}}
  state.ready=createEIOverlayServices(initial,root,`local-field/${token}`).then(runtime=>{
   state.runtime=runtime;if(!live.current||current.current!==state)return runtime
   const a=runtime.subscribe('field-renderer',root,(ledger,event)=>{if(!live.current||current.current!==state)return false;setScene({ledger,eventId:event.eventId});return true})
   const b=runtime.subscribe('field-workspace',root,(ledger,event)=>{if(!live.current||current.current!==state)return false;setWorkspace({ledger,eventId:event.eventId});return true})
   state.close=()=>{a.close();b.close()};return runtime
  })
  current.current=state;setScene({ledger:initial,eventId:null});setWorkspace({ledger:initial,eventId:null});setError('');return state
 }
 useEffect(()=>{live.current=true;return()=>{live.current=false;current.current?.close();current.current=null}},[])
 useEffect(()=>{if(!current.current||current.current.root!==userRoot||expected.current!==base){const state=initialize(base,userRoot);void state.ready.catch(reason=>{if(live.current&&current.current===state)setError(reason instanceof Error?reason.message:String(reason))})}},[base,userRoot])
 const publishCommitted=(previous:EILedger,result:EIResult)=>{
  if(result.status!=='committed')return
  let state=current.current
  if(!state||state.root!==userRoot||expected.current!==previous)state=initialize(previous,userRoot)
  expected.current=result.ledger
  const owner=state
  void owner.ready.then(runtime=>runtime.enqueue(previous,result)).then(snapshot=>{if(live.current&&current.current===owner){const failed=snapshot.outbox.find(item=>item.status==='failed');setError(failed?.error??'')}}).catch(reason=>{if(live.current&&current.current===owner)setError(reason instanceof Error?reason.message:String(reason))})
 }
 const retry=()=>{const state=current.current;if(!state)return;void state.ready.then(runtime=>runtime.retry()).then(()=>{if(live.current&&current.current===state)setError(state.runtime?.inspect().outbox.find(item=>item.status==='failed')?.error??'')}).catch(reason=>{if(live.current&&current.current===state)setError(reason instanceof Error?reason.message:String(reason))})}
 const isCurrent=!!current.current&&current.current.root===userRoot&&expected.current===base
 return {scene:isCurrent?scene:{ledger:base,eventId:null},workspace:isCurrent?workspace:{ledger:base,eventId:null},pending:isCurrent&&(scene.ledger!==base||workspace.ledger!==base),error,retry,publishCommitted,inspect:()=>current.current?.runtime?.inspect()??null}
}
