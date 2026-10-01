import {useState} from 'react'
import type {tetraMomentGate} from './model/tetra-moment-gate.ts'
import {SHARED_TETRAHEDRON_VERTICES} from './model/three-tetrahedron-drawing.ts'
type Gate=ReturnType<typeof tetraMomentGate>
/** Read-only view of supplied gate records. Geometry is the retained drawing
 * projection; it does not create gate truth, an Act, or spatial infinity depth. */
export function TetraMomentGateView({gates}:{gates:readonly Gate[]}){
  const [selected,setSelected]=useState<string|null>(null)
  const [port,setPort]=useState<string|null>(null)
  const [showAfter,setShowAfter]=useState(false)
  const gate=gates.find(g=>g.address===selected)??gates[0]
  if(!gate)return <p>No addressed moment gate records supplied.</p>
  const points=SHARED_TETRAHEDRON_VERTICES.map(v=>({x:180+85*(v.x+.4*v.z),y:160-75*(v.y-.3*v.z)}))
  const labels=['WAS','IS','NEXT','DIRECTED']
  const picked=gate.ports.find(p=>showAfter?p.destinations.includes(port as 'WAS'|'IS'|'NEXT'):p.from===port)
  return <section aria-label="Tetra moment gate records">
    <h2>Moment gates</h2>
    <p>The same mechanism at another grain. All indexed orders use the same drawing centre.</p>
    <div>{gates.map(g=><button key={g.address} aria-pressed={gate.address===g.address} onClick={()=>{setSelected(g.address);setPort(null)}}>{g.infinity?.index??'Index unresolved'} · {g.address}</button>)}</div>
    <button onClick={()=>setShowAfter(value=>!value)}>{showAfter?'Show retained order':'Show proposed order'}</button>
    <svg viewBox="0 0 360 330" role="group" aria-label={`Tetra gate at ${gate.address}`} data-order={showAfter?'proposed':'retained'} style={{width:'min(100%,480px)',background:'#080c10',color:'#eee'}}>
      {points.flatMap((a,i)=>points.slice(i+1).map((b,j)=><line key={`${i}:${i+j+1}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#7b8d9c"/>))}
      {points.map((p,i)=>{const identity=showAfter?gate.ports.find(value=>value.destinations.includes(labels[i] as 'WAS'|'IS'|'NEXT'))?.value:gate.ports.find(value=>value.from===labels[i])?.value;return <g key={labels[i]} role="button" tabIndex={0} aria-label={`Select ${labels[i]} port`} onClick={()=>setPort(labels[i])} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();setPort(labels[i])}}}><circle cx={p.x} cy={p.y} r="7" fill={port===labels[i]?'#ffcc78':'#78bee3'}/><text x={p.x} y={p.y-13} textAnchor="middle" fill="currentColor" fontSize="12">{labels[i]}{identity?` · ${identity}`:''}</text></g>})}
      <circle cx="180" cy="160" r="3" fill="#eee"/><text x="187" y="165" fill="#eee" fontSize="11">shared centre</text>
    </svg>
    <div>{labels.map(label=><button key={label} aria-pressed={port===label} onClick={()=>setPort(label)}>{label}</button>)}</div>
    <p>Retained moment {gate.beforeMoment} → proposed moment {gate.afterMoment}</p>
    {picked?<p>{picked.value}: {picked.from} → {picked.destinations.join(' / ')||'unresolved'}. {picked.matchesRetainedRule?'Matches retained role correspondence.':'Correspondence unresolved.'}</p>:<p>Select a port to inspect its recorded correspondence.</p>}
    {port==='DIRECTED'&&<p>The fourth-port function is not yet bound by this receipt.</p>}
    <p>Receipt: {gate.receiptAddress}</p>
    {gate.grain&&<p>Grain: {gate.grain.address}. Parent: {gate.grain.parentAddress??'none'}. Inherited receipt: {gate.grain.sourceReceipt}. Supplied local Difference records: {gate.grain.localDifference.join(', ')||'none supplied by this adapter'}.</p>}
    <ul>{gate.blockers.map(blocker=><li key={blocker}>{blocker}</li>)}</ul>
    <p>Selected drawing projection. Port inspection does not promote NEXT or commit a state.</p>
  </section>
}
