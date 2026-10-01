import {useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react'
import type {EILedger} from './model/ei-engine'
import {readEIConversation,prepareEIConversationTurn} from './model/ei-conversation'
import {presentEICheck} from './model/ei-check-presentation'

type Prepared=Extract<Awaited<ReturnType<typeof prepareEIConversationTurn>>,{status:'proposed'}>
/** Conversation is a projection of the same addressed ledger, never a second memory. */
export function EIConversation({ledger,root,disabled,nextId,onStage,onInspect}:{ledger:EILedger;root:string;disabled:boolean;nextId:()=>string;onStage:(turn:Prepared)=>void;onInspect:(address:string)=>void}){
 const [draft,setDraft]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('')
 const messages=useRef<HTMLDivElement>(null),controller=useRef<AbortController|null>(null),live=useRef(ledger),awaiting=useRef<{address:string;text:string}|null>(null)
 live.current=ledger
 useEffect(()=>()=>controller.current?.abort(),[])
 useEffect(()=>{const pending=awaiting.current;if(pending&&ledger.records.some(record=>record.address===pending.address)){setDraft(value=>value===pending.text?'':value);awaiting.current=null}},[ledger])
 const {history,historyError}=useMemo(()=>{try{return {history:readEIConversation(ledger,root),historyError:''}}catch(reason){return {history:{root,turns:[]} as ReturnType<typeof readEIConversation>,historyError:reason instanceof Error?reason.message:String(reason)}}},[ledger,root])
 useLayoutEffect(()=>{if(messages.current)messages.current.scrollTop=messages.current.scrollHeight},[history.turns.length])
 const initial=ledger.records.find(record=>record.address===root)
 const send=async()=>{
  if(disabled||busy||!draft.trim())return
  const snapshot=ledger,abort=new AbortController();controller.current=abort;setBusy(true);setError('')
  try{
   const result=await prepareEIConversationTurn({ledger:snapshot,root,input:draft,id:nextId(),signal:abort.signal})
   if(abort.signal.aborted)return
   if(live.current!==snapshot)throw new Error('The addressed context changed. Your message is still in the composer; send it against the current state.')
   if(result.status!=='proposed')throw new Error(result.reason)
   onStage(result);awaiting.current={address:result.user.address,text:draft}
  }catch(reason){if(!abort.signal.aborted)setError(reason instanceof Error?reason.message:String(reason))}
  finally{if(controller.current===abort)setBusy(false)}
 }
 return <section className="ei-conversation" aria-label="EI conversation">
  <h2>Conversation</h2>{historyError&&<p role="alert">Conversation reconstruction is unresolved: {historyError}. The addressed ledger remains available for inspection.</p>}<p>Interpretation and reply rules: unbound.</p>
  <div ref={messages} className="ei-messages" role="log" aria-label="Retained conversation">
   {initial&&history.turns.length===0&&<article className="ei-message user"><small>YOU · initial source</small><pre>{(initial.was[0]??initial.is).value}</pre><button onClick={()=>onInspect(root)}>Inspect {root}</button></article>}
   {history.turns.map(turn=><article key={turn.address} className={`ei-message ${turn.role}`}><small>{turn.role==='user'?'YOU':'RECORDED REPLY'} · {turn.status==='inference-unavailable'?'unresolved':turn.status==='capture-only'?'input retained':turn.status}</small>{turn.corrections.length>0&&<small>Original capture</small>}<pre>{turn.text}</pre>{turn.corrections.length>0&&<><small>Current IS</small><pre>{turn.currentText}</pre></>}<details><summary>Address and derivation</summary><button onClick={()=>onInspect(turn.address)}>{turn.address}</button><pre>{JSON.stringify(turn.sourceRefs,null,2)}</pre>{turn.selfCheck&&<details><summary>Check record · {turn.selfCheck.status}</summary><pre>{JSON.stringify(presentEICheck(turn.selfCheck),null,2)}</pre></details>}{turn.binding&&<><strong>Scoped phrase binding</strong><pre>{JSON.stringify(turn.binding,null,2)}</pre></>}{turn.bindingSources&&<><strong>Binding source addresses</strong><pre>{JSON.stringify(turn.bindingSources,null,2)}</pre></>}{turn.derivation&&<><strong>Returned derivation</strong><pre>{JSON.stringify(turn.derivation,null,2)}</pre></>}{turn.corrections.length>0&&<><strong>Later explicit corrections</strong>{turn.corrections.map((correction,index)=><pre key={index}>{correction.value}</pre>)}</>}</details></article>)}
  </div>
  <form onSubmit={event=>{event.preventDefault();void send()}}>
   <label>Message<textarea value={draft} onChange={event=>setDraft(event.target.value)} disabled={disabled||busy||!!historyError} rows={3} placeholder="Input"/></label>
   <button type="submit" disabled={disabled||busy||!!historyError||!draft.trim()}>{busy?'Retaining source…':'Retain input'}</button>
   {busy&&<button type="button" onClick={()=>{controller.current?.abort();setBusy(false)}}>Cancel input</button>}
  </form>{error&&<p role="alert">{error}</p>}
 </section>
}
