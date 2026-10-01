import {useEffect,useMemo,useRef,useState} from 'react'
import type {EILedger} from './model/ei-engine'
import {readEIConversation,prepareEIConversationTurn} from './model/ei-conversation'

type Prepared=Extract<Awaited<ReturnType<typeof prepareEIConversationTurn>>,{status:'proposed'}>
/** Conversation is a projection of the same addressed ledger, never a second memory. */
export function EIConversation({ledger,root,disabled,nextId,onStage,onInspect}:{ledger:EILedger;root:string;disabled:boolean;nextId:()=>string;onStage:(turn:Prepared)=>void;onInspect:(address:string)=>void}){
 const [draft,setDraft]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('')
 const controller=useRef<AbortController|null>(null),live=useRef(ledger),awaiting=useRef<{address:string;text:string}|null>(null)
 live.current=ledger
 useEffect(()=>()=>controller.current?.abort(),[])
 useEffect(()=>{const pending=awaiting.current;if(pending&&ledger.records.some(record=>record.address===pending.address)){setDraft(value=>value===pending.text?'':value);awaiting.current=null}},[ledger])
 const {history,historyError}=useMemo(()=>{try{return {history:readEIConversation(ledger,root),historyError:''}}catch(reason){return {history:{root,turns:[]} as ReturnType<typeof readEIConversation>,historyError:reason instanceof Error?reason.message:String(reason)}}},[ledger,root])
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
  <h2>Conversation</h2>{historyError&&<p role="alert">Conversation reconstruction is unresolved: {historyError}. The addressed ledger remains available for inspection.</p>}<p>Replies use retained messages, addressed state and receipts. Replies derive from supported source relations. Meanings without a resolved rule remain open.</p>
  <div className="ei-messages" role="log" aria-label="Retained conversation">
   {initial&&history.turns.length===0&&<article className="ei-message user"><small>YOU · initial source</small><pre>{(initial.was[0]??initial.is).value}</pre><button onClick={()=>onInspect(root)}>Inspect {root}</button></article>}
   {history.turns.map(turn=><article key={turn.address} className={`ei-message ${turn.role}`}><small>{turn.role==='user'?'YOU':'EI'} · {turn.status==='inference-unavailable'?'unresolved':turn.status}</small><pre>{turn.text}</pre><details><summary>Address and derivation</summary><button onClick={()=>onInspect(turn.address)}>{turn.address}</button><pre>{JSON.stringify(turn.sourceRefs,null,2)}</pre>{turn.selfCheck&&<><strong>Retained mechanism self-check</strong><p>Local consistency scope. Imported receipt text is not fresh source authentication.</p><pre>{JSON.stringify(turn.selfCheck,null,2)}</pre></>}{turn.derivation&&<><strong>Returned derivation</strong><pre>{JSON.stringify(turn.derivation,null,2)}</pre></>}{turn.corrections.length>0&&<><strong>Later explicit corrections</strong>{turn.corrections.map((correction,index)=><pre key={index}>{correction.value}</pre>)}</>}</details></article>)}
  </div>
  <div className="ei-chat-prompts"><button disabled={disabled||busy} onClick={()=>setDraft(`context ${JSON.stringify(root)}`)}>Question the source context</button><button disabled={disabled||busy} onClick={()=>setDraft('what did I say before?')}>Recall prior input</button></div>
  <form onSubmit={event=>{event.preventDefault();void send()}}>
   <label>Message<textarea value={draft} onChange={event=>setDraft(event.target.value)} disabled={disabled||busy||!!historyError} rows={3} placeholder="Ask about the retained source, or use /look address"/></label>
   <button type="submit" disabled={disabled||busy||!!historyError||!draft.trim()}>{busy?'Resolving source…':'Send message'}</button>
   {busy&&<button type="button" onClick={()=>{controller.current?.abort();setBusy(false)}}>Cancel reply</button>}
   <details><summary>Available local operations</summary><p>context "address" · reconstruct all retained incident relations<br/>read "address" · read its retained value and source<br/>compare "A" with "B" · derive exact text Difference<br/>from "A" follow "relation" then "next relation" · compose actual relation paths<br/>What did I say before? · return the prior addressed input</p><p>These are explicit source operations. An unsupported question stays unresolved. A reply is never permission to execute an external action.</p></details>
  </form>{error&&<p role="alert">{error}</p>}
 </section>
}
