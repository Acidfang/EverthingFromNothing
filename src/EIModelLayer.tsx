import {useEffect,useLayoutEffect,useRef,useState} from 'react'
import {createEILedger,proposeEI,chooseEI,executeEI,verifyEI,commitEI,type EILedger,type EIReceipt} from './model/ei-engine'
import {createEILocalStorage} from './model/ei-storage'
import {saveEISession,restoreEISession,type EIPageAttempt} from './model/ei-session'
import {EIRecordGate} from './EIRecordGate'
import './ei-model.css'

type Proposal=ReturnType<typeof proposeEI>
type Execution=Extract<ReturnType<typeof executeEI>,{status:'staged'}>
/** Local addressed execution. Raw text is data; nothing here evaluates it as code. */
export function EIModelLayer({open,onClose}:{open:boolean;onClose:()=>void}){
  const [ledger,setLedger]=useState<EILedger|null>(null)
  const [rootAddress,setRootAddress]=useState('EI/SOURCE'),[raw,setRaw]=useState('')
  const [selected,setSelected]=useState('EI/SOURCE'),[target,setTarget]=useState('EI/SOURCE')
  const [value,setValue]=useState(''),[alternative,setAlternative]=useState(''),[useAlternative,setUseAlternative]=useState(false)
  const [createChild,setCreateChild]=useState(false),[automatic,setAutomatic]=useState(false)
  const [gateVisible,setGateVisible]=useState(true),[branchSource,setBranchSource]=useState<string|null>(null)
  const [proposal,setProposal]=useState<Proposal|null>(null),[execution,setExecution]=useState<Execution|null>(null)
  const [notice,setNotice]=useState(''),[error,setError]=useState('')
  const [persistent,setPersistent]=useState(false),[saving,setSaving]=useState(false),[attempts,setAttempts]=useState<readonly EIPageAttempt[]>([])
  const storage=useRef<ReturnType<typeof createEILocalStorage>|null>(null),storageRevision=useRef<number|null>(null),root=useRef(''),savingNow=useRef(false)
  const panel=useRef<HTMLDivElement>(null),stage=useRef<HTMLDivElement>(null),closeButton=useRef<HTMLButtonElement>(null)
  const sequence=useRef(0),active=useRef<EILedger|null>(null),run=useRef(0)
  active.current=ledger
  const record=ledger?.records.find(r=>r.address===selected)
  const failedReceipt=(receipt:EIReceipt):EIPageAttempt=>({transactionId:receipt.transactionId,producer:receipt.producer,phase:'engine',message:receipt.reasons.join('; '),detail:JSON.stringify(receipt),committed:false})
  const save=async(next:EILedger,pending:Proposal|null,failed:readonly EIPageAttempt[]=attempts)=>{
    if(!persistent)return
    storage.current??=createEILocalStorage({})
    const json=saveEISession(root.current,next,pending,failed)
    savingNow.current=true;setSaving(true)
    try{const stored=await storage.current.compareAndStore(storageRevision.current,{root:root.current,revision:storageRevision.current===null?0:storageRevision.current+1,json});storageRevision.current=stored.revision}
    finally{savingNow.current=false;setSaving(false)}
  }
  useEffect(()=>{if(!open){run.current++;setExecution(null);return}const previous=document.activeElement as HTMLElement|null;closeButton.current?.focus();return()=>previous?.focus()},[open])
  useLayoutEffect(()=>{
    if(!execution||!open)return
    const token=++run.current
    let second=0
    const first=requestAnimationFrame(()=>{second=requestAnimationFrame(async()=>{
      if(token!==run.current||!stage.current||!active.current)return
      try{
        const values=[...stage.current.querySelectorAll<HTMLElement>('[data-readback-address]')].map(element=>({address:element.dataset.readbackAddress!,value:element.textContent??''}))
        const verified=verifyEI(execution,{kind:'rendered-address-values',values})
        const result=commitEI(active.current,verified)
        await save(result.ledger,null,result.status==='committed'?attempts:[...attempts,failedReceipt(result.receipt)])
        if(token!==run.current)return
        setLedger(result.ledger);setExecution(null);setProposal(null)
        if(result.status!=='committed')setAttempts(items=>[...items,failedReceipt(result.receipt)])
        setNotice(result.status==='committed'?`1 · complete local return verified${persistent?' and durable readback matched':' in this session'}`:'No partial update committed; inspect the receipt')
        setError('')
      }catch(reason){const message=reason instanceof Error?reason.message:String(reason);setAttempts(items=>[...items,{transactionId:execution.proposal.input.id,producer:execution.proposal.input.producer,phase:message.startsWith('EI storage:')?'storage':'render',message,detail:'The staged result was not admitted as current state.',committed:false}]);setExecution(null);setError(message);setNotice('0 retained · execution did not complete')}
    })})
    return()=>{run.current++;cancelAnimationFrame(first);cancelAnimationFrame(second)}
  },[execution,open])
  const protect=async(action:()=>void|Promise<void>)=>{if(savingNow.current)return;try{setError('');await action()}catch(reason){const message=reason instanceof Error?reason.message:String(reason);setError(message);setAttempts(items=>[...items,{transactionId:proposal?.input.id??`local-proposal/${sequence.current}`,producer:selected,phase:message.startsWith('EI storage:')?'storage':'engine',message,detail:'Operation failed before admission; retained state remains current.',committed:false}])}}
  const capture=()=>protect(async()=>{
    const id=`local-input/${++sequence.current}`
    const next=createEILedger({records:[{address:rootAddress,value:raw,source:{id,text:raw,realm:'user-supplied-local-input'}}]})
    root.current=rootAddress;await save(next,null)
    setLedger(next);setSelected(rootAddress);setTarget(rootAddress);setValue(raw);setNotice('Source captured at its address. Statement content is not thereby verified as true.')
  })
  const prepare=()=>protect(async()=>{
    if(!ledger||!record)throw new Error('Select an addressed source first')
    const id=`local-proposal/${++sequence.current}`
    const source={id:`${id}/instruction`,text:value,realm:'explicit-local-edit'}
    const candidates=(useAlternative?[value,alternative]:[value]).map((nextValue,index)=>({id:`${id}/candidate/${index}`,label:`Choice ${index+1}`,owner:automatic?'engine' as const:'user' as const,source:{...source,id:`${id}/instruction/${index}`,text:nextValue},conditions:[{address:selected,equals:record.is.value}],patches:[{address:target,value:nextValue,source:{...source,id:`${id}/value/${index}`,text:nextValue,...(branchSource&&index===0?{locator:branchSource}:{})},...(createChild?{kind:'create' as const,parents:[selected]}:{})}]}))
    const next=proposeEI(ledger,{id,producer:selected,input:{id:`${id}/input`,text:value},candidates})
    await save(ledger,next);setProposal(next);setNotice('0 · proposal only; retained state has not changed')
  })
  const perform=(candidateId?:string)=>protect(async()=>{
    if(!ledger||!proposal)return
    const result=executeEI(ledger,proposal,candidateId?chooseEI(proposal,candidateId):undefined)
    if(result.status==='staged'){setExecution(result);setNotice('0 → 1 · constructing and reading back the complete addressed output')}
    else {if(result.status!=='replayed'){const updated=[...attempts,failedReceipt(result.receipt)];setAttempts(updated);await save(ledger,proposal,updated)}setNotice(`${result.status} · retained state unchanged`)}
  })
  const cancel=async()=>{if(savingNow.current){setNotice('Finishing the atomic local write; its returned result will remain inspectable');return false}run.current++;setExecution(null);if(ledger&&proposal)await save(ledger,null);setProposal(null);setNotice('Cancelled uncommitted proposal; retained state unchanged');return true}
  const dismiss=()=>protect(async()=>{if(await cancel())onClose()})
  const restore=()=>protect(async()=>{
    savingNow.current=true;setSaving(true)
    try{storage.current??=createEILocalStorage({});const stored=await storage.current.load();if(!stored){setNotice('No saved EI ledger in this browser');return}
      const restored=restoreEISession(stored.json);if(restored.root!==stored.root)throw new Error('Stored root does not match session root')
      root.current=stored.root;storageRevision.current=stored.revision;sequence.current=restored.nextSequence
      const recovered=restored.ledger
      setLedger(recovered);setSelected(restored.root);setTarget(restored.root);setValue(recovered.records.find(r=>r.address===restored.root)!.is.value);setProposal(restored.pending);setAttempts(restored.attempts);setPersistent(true)
      setNotice('Recovered the same addressed local ledger, pending choices and attempt history. This does not verify external claims.')
    }finally{savingNow.current=false;setSaving(false)}
  })
  const exportSession=()=>protect(()=>{if(!ledger)return;const blob=new Blob([saveEISession(root.current,ledger,proposal,attempts)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='ei-addressed-session.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setNotice('Local export requested. The file contains your entered source text and receipts.')})
  const importSession=(file:File)=>protect(async()=>{
    if(ledger)throw new Error('An active ledger is already open; import cannot overwrite it')
    if(file.size>1_048_576)throw new Error('EI session exceeds 1 MiB')
    savingNow.current=true;setSaving(true)
    try{const restored=restoreEISession(await file.text());root.current=restored.root;storageRevision.current=null;sequence.current=restored.nextSequence;setLedger(restored.ledger);setProposal(restored.pending);setAttempts(restored.attempts);setSelected(restored.root);setTarget(restored.root);setValue(restored.ledger.records.find(r=>r.address===restored.root)!.is.value);setPersistent(false);setNotice('Imported and replay-checked in memory. The file supplies history; it does not authenticate external claims.')}
    finally{savingNow.current=false;setSaving(false)}
  })
  const keepLocally=()=>protect(async()=>{
    if(!ledger)return
    storage.current??=createEILocalStorage({});savingNow.current=true;setSaving(true)
    try{const stored=await storage.current.compareAndStore(null,{root:root.current,revision:0,json:saveEISession(root.current,ledger,proposal,attempts)});storageRevision.current=stored.revision;setPersistent(true);setNotice('Local browser write and readback matched. Reload recovery is available.')}
    finally{savingNow.current=false;setSaving(false)}
  })
  if(!open)return null
  return <div className="ei-model-layer" role="dialog" aria-modal="true" aria-label="EI addressed execution" ref={panel} onKeyDown={event=>{
    if(event.key==='Escape'){event.preventDefault();void dismiss()}
    if(event.key==='Tab'){const list=[...panel.current!.querySelectorAll<HTMLElement>('button,input,textarea,select,a[href]')].filter(e=>!e.hasAttribute('disabled'));if(event.shiftKey&&document.activeElement===list[0]){event.preventDefault();list.at(-1)?.focus()}else if(!event.shiftKey&&document.activeElement===list.at(-1)){event.preventDefault();list[0]?.focus()}}
  }}>
    <header><div><small>SOURCE → DIFFERENCE → CHOICE → ACT → VERIFIED RETURN</small><h1>EI addressed execution</h1><p>One mechanism at each supplied grain. Text remains source data.</p></div><button ref={closeButton} disabled={saving} onClick={dismiss}>Close EI model</button></header>
    <p className="ei-notice" role="status">{notice||'Capture a source to begin'}</p>{error&&<p className="ei-error" role="alert">{error}</p>}
    {!ledger?<section className="ei-capture"><h2>Address the input</h2><label>Source address<input disabled={saving||!!execution||!!proposal} value={rootAddress} onChange={e=>setRootAddress(e.target.value)}/></label><label>Exact source text<textarea disabled={saving||!!execution||!!proposal} value={raw} onChange={e=>setRaw(e.target.value)} rows={6}/></label><label><input disabled={saving||!!execution||!!proposal} type="checkbox" checked={persistent} onChange={e=>setPersistent(e.target.checked)}/> Keep this EI ledger on this browser, unencrypted</label><button onClick={capture} disabled={!rootAddress||!raw||saving}>Capture source</button><button onClick={restore} disabled={saving}>Restore saved local ledger</button><label>Import exported session<input type="file" accept="application/json,.json" disabled={saving} onChange={event=>{const file=event.currentTarget.files?.[0];event.currentTarget.value='';if(file)void importSession(file)}}/></label><p>No entered content is sent to a server. Input is not automatically a command, fact or approved NEXT. {persistent?'Local browser storage is selected; do not enter secrets.':'This session uses memory only.'}</p></section>:<fieldset className="ei-workspace" disabled={saving||!!execution}>
      <section aria-label="Addressed grain map"><h2>Addressed grains · revision {ledger.revision}</h2><p>Diagram positions are a view. Parent addresses retain the actual threads.</p>
        <div className="ei-grains">{ledger.records.map(node=><button key={node.address} className="ei-grain" disabled={!!proposal} aria-pressed={selected===node.address} onClick={()=>{setSelected(node.address);setTarget(node.address);setValue(node.is.value);setCreateChild(false);setBranchSource(null);setProposal(null)}}>
          <svg viewBox="0 0 160 125" aria-hidden="true"><path d="M80 12L17 104L145 98ZM80 12L87 74L17 104M87 74L145 98" fill="none" stroke="currentColor"/><text x="80" y="10" textAnchor="middle">NEXT</text><text x="4" y="119">WAS</text><text x="136" y="119">IS</text><circle cx="87" cy="74" r="4"/></svg>
          <strong>{node.address}</strong><span>IS · {node.is.value}</span><small>{node.parents.length?`from ${node.parents.join(', ')}`:'root source'}</small>
        </button>)}</div>
        {record&&<article className="ei-state"><h3>{record.address}</h3><dl><dt>WAS</dt><dd><pre>{record.was.at(-1)?.value??'No earlier retained value'}</pre></dd><dt>IS</dt><dd><pre>{record.is.value}</pre></dd><dt>Source</dt><dd>{record.is.source.id}</dd></dl><button onClick={()=>setGateVisible(v=>!v)}>{gateVisible?'Hide':'Inspect'} moment gate</button><p>Producing and returned receipt addresses: {ledger.receipts.filter(receipt=>receipt.producer===record.address||receipt.patches.some(patch=>patch.address===record.address)).map(receipt=>receipt.id).join(', ')||'Initial captured source'}</p>{record.was.map((past,index)=><button key={index} disabled={!!proposal} onClick={()=>{setCreateChild(true);setTarget(`${selected}/branch-${sequence.current+1}`);setValue(past.value);setBranchSource(`${selected}#was/${index}`)}}>Branch from WAS revision {past.revision}</button>)}</article>}{record&&gateVisible&&<EIRecordGate ledger={ledger} address={record.address} proposal={proposal}/>}
      </section>
      <section aria-label="Allowed continuations"><h2>Choose a continuation</h2><p>Conditions compare exact retained text. They do not decide natural-language truth.</p>
        <label><input disabled={saving||!!execution||!!proposal} type="checkbox" checked={createChild} onChange={e=>{setCreateChild(e.target.checked);setTarget(e.target.checked?`${selected}/child`:selected);setProposal(null)}}/> Add an addressed child grain</label>
        <label>Target address<input disabled={saving||!!execution||!!proposal} value={target} onChange={e=>{setTarget(e.target.value);setProposal(null)}}/></label>
        <label>Proposed value<textarea disabled={saving||!!execution||!!proposal} rows={4} value={value} onChange={e=>{setValue(e.target.value);setBranchSource(null);setProposal(null)}}/></label>
        <label><input disabled={saving||!!execution||!!proposal} type="checkbox" checked={useAlternative} onChange={e=>{setUseAlternative(e.target.checked);setProposal(null)}}/> Keep a second alternative</label>
        {useAlternative&&<label>Alternative value<textarea disabled={saving||!!execution||!!proposal} value={alternative} onChange={e=>{setAlternative(e.target.value);setProposal(null)}}/></label>}
        <label><input disabled={saving||!!execution||!!proposal} type="checkbox" checked={automatic} onChange={e=>{setAutomatic(e.target.checked);setProposal(null)}}/> Allow the engine to select a uniquely allowed continuation</label>
        <button disabled={!!execution||!!proposal} onClick={prepare}>Filter proposed continuations</button>
        {proposal&&<article><h3>{proposal.status}</h3><p>Pending source: {proposal.input.producer}. Cancel this snapshot before editing its draft.</p>{proposal.candidates.map(item=><div key={item.candidate.id}><strong>{item.candidate.label}</strong><pre>{item.candidate.patches.map(p=>`${p.address}\n${p.value}`).join('\n')}</pre><p>{item.reasons.join('; ')||'Exact source condition satisfied'}</p><button disabled={!item.allowed||item.unresolved||!!execution} onClick={()=>perform(item.candidate.id)}>Select {item.candidate.label} and execute</button></div>)}{proposal.status==='ready'&&<button onClick={()=>perform()} disabled={!!execution}>Execute unique continuation</button>}<button onClick={()=>protect(async()=>{await cancel()})}>Cancel proposal</button></article>}
      </section>
    </fieldset>}
    {execution&&<section ref={stage} className="ei-staged" aria-label="Staged output readback"><h2>Complete staged output · not committed</h2>{execution.expected.map(item=><article key={item.address}><strong>{item.address}</strong><pre data-readback-address={item.address}>{item.value}</pre></article>)}</section>}
    {ledger&&<section className="ei-receipts"><h2>Returned receipts</h2><button onClick={exportSession} disabled={saving||!!execution}>Export local session</button>{!persistent&&<button onClick={keepLocally} disabled={saving||!!execution}>Keep this ledger locally, unencrypted</button>}<p>{persistent?`Durable local generation ${storageRevision.current}`:'Memory-only session'}</p>{ledger.receipts.length?ledger.receipts.map((receipt,index)=><details key={index}><summary>Receipt {index+1} · {receipt.status}</summary><pre>{JSON.stringify(receipt,null,2)}</pre></details>):<p>No model update has been committed.</p>}{attempts.map((receipt,index)=><details key={`attempt-${index}`}><summary>Uncommitted attempt {index+1} · {receipt.phase}</summary><pre>{JSON.stringify(receipt,null,2)}</pre></details>)}</section>}
    <footer>Local addressed text execution and rendered-value readback. No external action, learned language model or world-truth verification is implied. Unknown indexed moments and geometric motion remain separate open bindings.</footer>
  </div>
}
