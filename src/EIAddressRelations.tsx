import {useEffect,useRef,useState} from 'react'
import type {EILedger} from './model/ei-engine'
import {createEIGrainRegistry,projectEIGrain,type EIGrain} from './model/ei-grain-identity'
import {resolveEIGrainRelations,type EIGrainResolution} from './model/ei-grain-resolution'
import {presentEICheck} from './model/ei-check-presentation'
import {EIAuthoredRelations} from './EIAuthoredRelations'

/** Controls select existing operations and exact addresses, never interpret prose. */
export function EIAddressRelations({ledger,address,grain,disabled,onSelect}:{ledger:EILedger;address:string;grain:EIGrain;disabled:boolean;onSelect:(address:string)=>void}){
 const [other,setOther]=useState(address),[result,setResult]=useState<Awaited<ReturnType<typeof resolveEIGrainRelations>>|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('')
 const request=useRef(0),origin=useRef({ledger,address}),resultOrigin=useRef<typeof origin.current|null>(null)
 origin.current={ledger,address}
 useEffect(()=>{request.current++;setResult(null);setOther(address);setError('');setBusy(false);return()=>{request.current++}},[ledger,address])
 const run=async(kind:'context'|'trace'|'compare'|'follow',relation?:string)=>{
  const token=++request.current,snapshot={ledger,address};setBusy(true);setError('')
  try{
   const registry=createEIGrainRegistry(ledger),target=projectEIGrain(registry,address,grain)
   const operation:EIGrainResolution=kind==='compare'?{kind,target,other:projectEIGrain(registry,other,grain)}:kind==='follow'?{kind,target,relations:[relation!]}:{kind,target}
   const resolved=await resolveEIGrainRelations(ledger,operation)
   if(token===request.current&&origin.current.ledger===ledger&&origin.current.address===address){resultOrigin.current=snapshot;setResult(resolved)}
  }catch(reason){if(token===request.current)setError(reason instanceof Error?reason.message:String(reason))}
  finally{if(token===request.current)setBusy(false)}
 }
 const record=ledger.records.find(item=>item.address===address)!
 const current=result&&resultOrigin.current?.ledger===ledger&&resultOrigin.current.address===address?result:null
 const select=(target:string)=>{if(ledger.records.some(item=>item.address===target))onSelect(target)}
 return <section aria-label="Addressed relation resolution">
  <EIAuthoredRelations ledger={ledger} address={address} grain={grain} disabled={disabled}/>
  <button disabled={disabled||busy} onClick={()=>void run('context')}>Resolve retained relations</button>
  <button disabled={disabled||busy} onClick={()=>void run('trace')}>Trace source paths</button>
  <label>Compare IS with address<select value={other} disabled={disabled||busy} onChange={event=>{request.current++;setOther(event.target.value);setResult(null);setBusy(false)}}>{ledger.records.map(item=><option key={item.address}>{item.address}</option>)}</select></label>
  <button disabled={disabled||busy} onClick={()=>void run('compare')}>Compare addressed IS</button>
  {[...new Set(record.relations.map(edge=>edge.relation))].map(relation=><button key={relation} disabled={disabled||busy} onClick={()=>void run('follow',relation)}>Follow {relation}</button>)}
  {error&&<p role="alert">{error}</p>}
  {current&&<div aria-label="Resolved addressed result"><strong>{current.query.kind} · {current.status}</strong>
   {current.answer.comparison&&<dl><dt>{current.answer.comparison.left}</dt><dd><pre>{current.answer.comparison.leftValue}</pre></dd><dt>{current.answer.comparison.right}</dt><dd><pre>{current.answer.comparison.rightValue}</pre></dd><dt>Exact retained text comparison</dt><dd>{current.answer.comparison.result}</dd></dl>}
   {current.answer.matches.map((match,index)=><div key={`${match.address}:${index}`}><button disabled={disabled} onClick={()=>select(match.address)}>{match.address}</button><pre>{match.value}</pre></div>)}
   {current.answer.context?.incident.map((item,index)=>{const edge=item.edge,addresses=current.answer.parentGraph.addresses;return <p key={index}><button disabled={disabled||!ledger.records.some(r=>r.address===addresses[edge.from])} onClick={()=>select(addresses[edge.from])}>{addresses[edge.from]}</button> → {edge.relation} → <button disabled={disabled||!ledger.records.some(r=>r.address===addresses[edge.to])} onClick={()=>select(addresses[edge.to])}>{addresses[edge.to]}</button></p>})}
   {current.answer.parentGraph.parents.flatMap((parents,child)=>(parents??[]).map(parent=><p key={`${child}:${parent}`}><button disabled={disabled} onClick={()=>select(current.answer.parentGraph.addresses[parent])}>{current.answer.parentGraph.addresses[parent]}</button> → <button disabled={disabled} onClick={()=>select(current.answer.parentGraph.addresses[child])}>{current.answer.parentGraph.addresses[child]}</button></p>))}
   {current.answer.unknowns.map((item,index)=><p key={index}>{item.address} · {item.kind}</p>)}
   {current.answer.gaps.map((item,index)=><p key={index}>{item.address} → {item.relation} · {item.kind}</p>)}
   <details><summary>Source and returned check · {current.verification.status}</summary><pre>{JSON.stringify({origin:current.origin,query:current.query,answer:current.answer,check:presentEICheck(current.verification)},null,2)}</pre></details>
  </div>}
 </section>
}
