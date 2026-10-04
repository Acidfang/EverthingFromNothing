import {useState} from 'react'
import type {EILedger,EIProposal} from './model/ei-engine'
import {SHARED_TETRAHEDRON_VERTICES} from './model/three-tetrahedron-drawing'
export function EIRecordGate({ledger,address,proposal}:{ledger:EILedger;address:string;proposal:EIProposal|null}){
  const [port,setPort]=useState<'WAS'|'IS'|'NEXT'|'DIRECTED'>('IS')
  const record=ledger.records.find(node=>node.address===address)
  if(!record)return null
  const points=SHARED_TETRAHEDRON_VERTICES.map(v=>({x:180+85*(v.x+.4*v.z),y:160-75*(v.y-.3*v.z)}))
  const labels=['WAS','IS','NEXT','DIRECTED'] as const
  const next=proposal?.candidates.flatMap(candidate=>candidate.candidate.patches.filter(patch=>patch.address===address||proposal.input.producer===address).map(patch=>({candidate:candidate.candidate.id,allowed:candidate.allowed,address:patch.address,value:patch.value})))??[]
  return <section className="ei-record-gate" aria-label="Selected EI moment gate"><h3>Moment gate · {address}</h3>
    <svg viewBox="0 0 360 300" role="group" aria-label={`EI gate ports at ${address}`}>
      {points.flatMap((a,i)=>points.slice(i+1).map((b,j)=><line key={`${i}:${j}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="currentColor"/>))}
      {points.map((p,i)=><g key={labels[i]} role="button" tabIndex={0} aria-label={`Inspect EI ${labels[i]}`} onClick={()=>setPort(labels[i])} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();setPort(labels[i])}}}><circle cx={p.x} cy={p.y} r={port===labels[i]?9:6} fill={port===labels[i]?'#ffcd7a':'#85b9ce'}/><text x={p.x} y={p.y-14} textAnchor="middle" fill="currentColor">{labels[i]}</text></g>)}
      <circle cx="180" cy="160" r="3"/><text x="187" y="163" fill="currentColor">SELF</text>
    </svg>
    <div>{labels.map(label=><button key={label} aria-pressed={port===label} onClick={()=>setPort(label)}>Inspect {label}</button>)}</div>
    {port==='WAS'&&<pre>{record.was.at(-1)?.value??'No earlier retained value'}</pre>}
    {port==='IS'&&<pre>{record.is.value}</pre>}
    {port==='NEXT'&&(next.length?next.map(item=><article key={`${item.candidate}/${item.address}`}><strong>{item.address} · {item.allowed?'allowed proposal':'unresolved or excluded'}</strong><pre>{item.value}</pre></article>):<p>No supplied NEXT at this address.</p>)}
    {port==='DIRECTED'&&<p>Directed-port operation remains unbound. Retained parent threads: {record.parents.join(', ')||'root source'}.</p>}
    <p>This gate reads the same ledger and candidate records as the field. Geometry is a drawing projection; .infinity# is not inferred from revision {ledger.revision}.</p>
  </section>
}
