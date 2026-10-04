import {useState} from 'react'
import inventory from '../docs/FRACTURE-FIELD-INVENTORY.json'
import {CAPABILITIES,capabilitiesFor,runCapability,sameRun,type CapabilityId,type Run} from './model/reproducibility.ts'
import {attachPatternRecords,CHECK_PATTERN_CONTAINERS} from './model/pattern-layer.ts'
import './reproducibility.css'
const patterns=attachPatternRecords(inventory.binary_relation_order.nodes,CAPABILITIES.map(c=>({id:`pattern:check:${c.id}`,containerId:CHECK_PATTERN_CONTAINERS[c.id],sourceIds:c.sources,kind:'bounded-check' as const,output:c.id,scope:c.scope})))
type Receipt={run:Run;previous?:Run;reproduced:boolean;at:string;attempt:number}
export function ReproducibilityExplorer({onInspect}:{onInspect:(id:string)=>void}){
 const [receipts,setReceipts]=useState<Partial<Record<CapabilityId,Receipt>>>({})
 const [filter,setFilter]=useState('all'),[error,setError]=useState('')
 const mapped=inventory.entries.filter(e=>capabilitiesFor(e.id).length>0)
 const visible=inventory.entries.filter(e=>{const linked=capabilitiesFor(e.id);return filter==='all'||(filter==='runnable'?linked.length>0:filter==='executed'?linked.some(c=>receipts[c.id]?.run.passed):filter==='reproduced'?linked.some(c=>receipts[c.id]?.reproduced):linked.length===0)})
 const run=(id:CapabilityId)=>{try{const result=runCapability(id,inventory.binary_relation_order);setReceipts(previous=>({...previous,[id]:{run:result,previous:previous[id]?.run,reproduced:!!previous[id]&&sameRun(previous[id]!.run,result),at:new Date().toISOString(),attempt:(previous[id]?.attempt??0)+1}}));setError('')}catch(e){setError(String(e))}}
 return <details className="reproducibility"><summary>Pattern layer · reproducible checks</summary>
  <h2>Add patterns inside existing containers</h2><p>Existing map nodes and relations are retained. These content records point to existing inventory addresses; their binary locators are transport only. This layer adds no world grid or geometry. Running checks leaves shared map state unchanged.</p>
  <p>{inventory.entries.length} source entries covered by this finite mapping; {mapped.length} linked to {CAPABILITIES.length} runnable software checks. Remaining entries have no witness in this pass. This is not an exhaustive technology catalogue or physical validation.</p>
  <p>SPECIFIED retains a source statement. IMPLEMENTED has a runnable bounded method. EXECUTED needs its returned checks. REPRODUCED needs a second matching successful run. Repetition alone does not establish source faithfulness.</p>
  <div className="address-actions"><button onClick={()=>CAPABILITIES.forEach(c=>run(c.id))}>Run all bounded checks</button><button onClick={()=>{setReceipts({});setError('')}}>Clear session receipts</button></div>
  {error?<p role="alert">{error}</p>:null}
  <div>{CAPABILITIES.map(c=>{const receipt=receipts[c.id],pattern=patterns.find(p=>p.output===c.id)!;return <article key={c.id} className="reproduction-card">
   <h3>{c.title}</h3><p>Container: <button onClick={()=>onInspect(pattern.containerId)}>{pattern.containerId} · {pattern.containerLocator}</button> · {pattern.id}</p><p><strong>{!receipt?'IMPLEMENTED · not run this session':!receipt.run.passed?'EXECUTED · check failed':receipt.reproduced?'REPRODUCED · bounded checks passed':'EXECUTED · bounded checks passed'}</strong></p>
   <p><b>WAS / inputs:</b> {c.inputs}</p><p><b>Method:</b> {c.method}</p><p><b>Difference / limit:</b> {c.scope}</p>
   <p>Source parents: {c.sources.map(id=><button key={id} onClick={()=>onInspect(id)}>{id}</button>)}</p>
   <button onClick={()=>run(c.id)}>{receipt?'Run again and compare':'Run bounded check'}</button>
   <p aria-live="polite"><b>IS / return:</b> {receipt?`${receipt.run.checks.filter(x=>x.pass).length}/${receipt.run.checks.length} checks passed · attempt ${receipt.attempt} · ${receipt.at}`:'No execution receipt yet'}</p>
   <p><b>NEXT:</b> {receipt?.reproduced?'Independent source-faithfulness review and any required external or hardware observations remain open.':'Run and inspect the return, then repeat with the same declared inputs.'}</p>
   {receipt?<details><summary>Inspect actual / expected and receipt</summary><pre tabIndex={0}>{JSON.stringify({pattern,sourceAddresses:c.sources,inputs:c.inputs,method:c.method,receipt},null,2)}</pre></details>:null}
  </article>})}</div>
  <label>Source coverage filter <select value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">All source entries</option><option value="runnable">Linked runnable mechanism</option><option value="executed">Successful execution this session</option><option value="reproduced">Reproduced this session</option><option value="unwitnessed">No witness in this pass</option></select></label>
  <p>{visible.length} matching entries. A linked check covers only its declared mechanism, not every claim in that source entry.</p>
  <nav className="reproduction-sources" aria-label="Reproducibility source coverage">{visible.map(e=><button key={e.id} onClick={()=>onInspect(e.id)}>{e.inventory_binary_address} · {e.term}<small>{capabilitiesFor(e.id).length?'Bounded mechanism linked':'SPECIFIED · no execution witness in this pass'} · {e.status}</small></button>)}</nav>
  <p>Original symbolic sources remain authoritative. JSON and binary inventory locators are transport. Inspect an address for retained source, parent relations, WAS / IS / NEXT and its unresolved difference. Exact twist, hardware, external observations and broader physical claims are not closed here.</p>
  <p>Runs use the fixed source inventory and synthetic fixtures in this page’s memory; closing the inspector or reloading clears these session receipts. No private vault data or keys are used.</p>
 </details>
}
