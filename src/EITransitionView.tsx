import {useMemo,useState} from 'react'
import type {EILedger} from './model/ei-engine'
import {reconstructEIUnifiedTransition,serializeEIUnifiedTransition,EI_UNIFIED_SCOPE_NOTE,type EIUnifiedTransition} from './model/ei-unified-transition'
import {SHARED_TETRAHEDRON_VERTICES} from './model/three-tetrahedron-drawing'

/** Port positions are an observer diagram. All values come from one transition. */
export function EITransitionView({projection,readback=false}:{projection:EIUnifiedTransition;readback?:boolean}){
 const [selected,setSelected]=useState<string|null>(null)
 const gate=projection.gates.find(item=>item.address===selected)??projection.gates[0]
 const [role,setRole]=useState<'WAS'|'IS'|'NEXT'|'DIRECTED'>('NEXT')
 const roles=['WAS','IS','NEXT','DIRECTED'] as const
 const points=SHARED_TETRAHEDRON_VERTICES.map(v=>({x:180+85*(v.x+.4*v.z),y:160-75*(v.y-.3*v.z)}))
 const port=gate?.ports.find(item=>item.role===role)
 const incident=gate?projection.threads.filter(thread=>thread.from===gate.address||thread.to===gate.address):[]
 return <section aria-label="Shared addressed transition">
  <h3>Transition {projection.identity.transactionId}</h3>
  <p>Source {projection.identity.producer} · retained revision {projection.identity.baseRevision} · candidate {projection.identity.candidateId} · return {projection.identity.receiptId}</p>
  <p>One set of addressed records supplies the conversation, gate ports, threads and readback. {readback?'This staged check reads the bound transition records.':'These are reconstructed transition records.'} Geometric completion remains unresolved.</p>
  <section aria-label="Produced source fractures"><h4>Fractures from retained and proposed source changes</h4><p>{projection.sourceFractures.field.differences.length} exact text Differences · {projection.sourceFractures.field.edges.length} declared relations. Text is the declared comparison grain; spatial placement remains unbound.</p>{projection.sourceFractures.field.differences.map(difference=><article key={difference.id}><button disabled={!projection.gates.some(item=>item.address===difference.address)} onClick={()=>setSelected(difference.address)}>{difference.address}</button><small>{projection.sourceFractures.differences.find(item=>item.differenceId===difference.id)?.phase}</small><p>{difference.beforeId} → {difference.afterId}</p><details><summary>Inspect exact text Difference</summary><strong>Before</strong><pre>{projection.sourceFractures.field.sourceRecords.find(record=>record.id===difference.beforeId)?.value}</pre><strong>After · {projection.sourceFractures.differences.find(item=>item.differenceId===difference.id)?.phase}</strong><pre>{projection.sourceFractures.field.sourceRecords.find(record=>record.id===difference.afterId)?.value}</pre></details></article>)}{!projection.sourceFractures.field.differences.length&&<p>No same-address text change in these retained records. New addresses remain source baselines.</p>}</section>
  <div>{projection.gates.map(item=><button key={item.id} aria-pressed={gate?.id===item.id} onClick={()=>setSelected(item.address)}>{item.address}</button>)}</div>
  {gate&&<article className="ei-record-gate">
   <h4>{gate.address} · {gate.operation}</h4>
   <svg viewBox="0 0 360 300" role="group" aria-label={`Transition gate ${gate.address}`}>
    {points.flatMap((a,i)=>points.slice(i+1).map((b,j)=><line key={`${i}:${j}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="currentColor"/>))}
    {points.map((p,i)=><g key={roles[i]} role="button" tabIndex={0} aria-label={`Transition ${roles[i]} at ${gate.address}`} onClick={()=>setRole(roles[i])} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();setRole(roles[i])}}}>
     <rect x={p.x-38} y={p.y-32} width="76" height="56" fill="transparent" pointerEvents="all"/>
     <circle cx={p.x} cy={p.y} r={role===roles[i]?9:6} fill={role===roles[i]?'#ffcd7a':'#85b9ce'}/>
     <text x={p.x} y={p.y-14} textAnchor="middle" fill="currentColor">{roles[i]}</text>
    </g>)}
    <circle cx="180" cy="160" r="3"/><text x="188" y="163" fill="currentColor">SELF</text>
   </svg>
   <div>{roles.map(item=><button key={item} aria-pressed={role===item} onClick={()=>setRole(item)}>Inspect {item}</button>)}</div>
   {port?<><strong>{port.role} · {port.established?'retained':'proposed or absent'}</strong><pre>{port.value??'No supplied value'}</pre><p>Source {port.sourceId??'unbound'} · revision {port.revision??'unbound'}</p></>:<p>The directed-port function and indexed .infinity# binding remain unresolved.</p>}
   <h4>Threads at this address</h4>{incident.length?incident.map(thread=><p key={thread.id}>{thread.from} → {thread.label} → {thread.to} · {thread.fromKnown&&thread.toKnown?'both endpoints addressed':'endpoint unresolved'} · {thread.introduced?'proposed thread':'retained thread'} · source {thread.sourceId}</p>):<p>No supplied incident thread</p>}
  </article>}
  <details><summary>Contributions still open</summary>{projection.openBindings.map((item,index)=><p key={index}>{item.kind}{item.address?` at ${item.address}`:''}: {item.detail}</p>)}</details>
  <details><summary>Exact shared transition records</summary><pre data-transition-readback={readback?'true':undefined}>{serializeEIUnifiedTransition(projection)}</pre></details>
 </section>
}

export function EIReceiptTransition({ledger,receiptId}:{ledger:EILedger;receiptId:string}){
 const result=useMemo(()=>{try{return {projection:reconstructEIUnifiedTransition(ledger,receiptId),error:''}}catch(reason){return {projection:null,error:reason instanceof Error?reason.message:String(reason)}}},[ledger,receiptId])
 return result.projection?<><p>Reconstructed receipt · original scope: {ledger.receipts.find(receipt=>receipt.id===receiptId)?.scope}. This is retained replay, not a new observation or proof of the historical shared display.</p><p>{EI_UNIFIED_SCOPE_NOTE}</p><EITransitionView projection={result.projection}/></>:<p role="alert">Transition reconstruction failed: {result.error}</p>
}
