import {presentEICheck} from './model/ei-check-presentation'
import {createEIGrainRegistry,projectEIGrain,readEIGrain,filterEIGrainAddresses,EI_GRAINS,type EIGrain} from './model/ei-grain-identity'
import {useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react'
import {createEILedger,proposeEI,chooseEI,executeEI,type EILedger,type EIReceipt,type EICondition} from './model/ei-engine'
import {createEILocalStorage} from './model/ei-storage'
import {saveEISession,restoreEISession,type EIPageAttempt} from './model/ei-session'
import {EIRecordGate} from './EIRecordGate'
import {EIConversation} from './EIConversation'
import {EIAddressRelations} from './EIAddressRelations'
import {proposeEIExplicitContinuation} from './model/ei-explicit-continuation'
import {EITransitionView,EIReceiptTransition} from './EITransitionView'
import {prepareEIUnifiedTransition,verifyEIUnifiedTransition,commitEIUnifiedTransition,EIUnifiedTransitionError} from './model/ei-unified-transition'
import {createEIPublicFieldRecords} from './model/ei-public-field'
import {isEIConversationTurnCurrent,prepareEIConversationTurn,readEIConversation} from './model/ei-conversation'
import './ei-model.css'

type Proposal=ReturnType<typeof proposeEI>
type ChatTurn=Extract<Awaited<ReturnType<typeof prepareEIConversationTurn>>,{status:'proposed'}>
type Execution=Extract<ReturnType<typeof executeEI>,{status:'staged'}>
/** Local addressed execution. Raw text is data; nothing here evaluates it as code. */
export function EIModelLayer({open,onClose}:{open:boolean;onClose?:()=>void}){
  const [ledger,setLedger]=useState<EILedger|null>(null)
  const [rootAddress,setRootAddress]=useState('EI/SOURCE'),[raw,setRaw]=useState(''),[includeModel,setIncludeModel]=useState(true)
  const [selected,setSelected]=useState('EI/SOURCE'),[target,setTarget]=useState('EI/SOURCE')
  const [value,setValue]=useState(''),[alternative,setAlternative]=useState(''),[useAlternative,setUseAlternative]=useState(false)
  const [choiceConditions,setChoiceConditions]=useState<readonly (readonly EICondition[])[]>([[],[]])
  const [createChild,setCreateChild]=useState(false),[automatic,setAutomatic]=useState(false)
  const [gateVisible,setGateVisible]=useState(true),[branchSource,setBranchSource]=useState<string|null>(null)
  const [grain,setGrain]=useState<EIGrain>('state'),[filterValue,setFilterValue]=useState(''),[filterBusy,setFilterBusy]=useState(false)
  const [filterResult,setFilterResult]=useState<Awaited<ReturnType<typeof filterEIGrainAddresses>>|null>(null)
  const grainRegistry=useMemo(()=>ledger?createEIGrainRegistry(ledger):null,[ledger])
  useEffect(()=>setFilterResult(null),[ledger])
  const [inspectedReceipt,setInspectedReceipt]=useState<string|null>(null)
  const [proposal,setProposal]=useState<Proposal|null>(null),[execution,setExecution]=useState<Execution|null>(null)
  const [notice,setNotice]=useState(''),[error,setError]=useState(''),[preparingCapture,setPreparingCapture]=useState(false)
  const [persistent,setPersistent]=useState(false),[saving,setSaving]=useState(false),[attempts,setAttempts]=useState<readonly EIPageAttempt[]>([])
  const storage=useRef<ReturnType<typeof createEILocalStorage>|null>(null),storageRevision=useRef<number|null>(null),root=useRef(''),savingNow=useRef(false)
  const inspector=useRef<HTMLDetailsElement>(null),filterRequest=useRef(0),filterOrigin=useRef<EILedger|null>(null)
  const panel=useRef<HTMLDivElement>(null),stage=useRef<HTMLDivElement>(null),closeButton=useRef<HTMLButtonElement>(null)
  const sequence=useRef(0),active=useRef<EILedger|null>(null),run=useRef(0)
  const chatTurn=useRef<ChatTurn|null>(null),captureAbort=useRef<AbortController|null>(null)
  const liveOperation=useRef({proposal,execution,open})
  liveOperation.current={proposal,execution,open}
  active.current=ledger
  const sharedTransition=useMemo(()=>{if(!ledger||!execution)return {projection:null,error:''};try{return {projection:prepareEIUnifiedTransition(ledger,execution),error:''}}catch(reason){return {projection:null,error:reason instanceof Error?reason.message:String(reason)}}},[ledger,execution])
  const record=ledger?.records.find(r=>r.address===selected)
  const selectedHandle=grainRegistry&&record?projectEIGrain(grainRegistry,record.address,grain):null
  const selectedState=ledger&&selectedHandle?readEIGrain(ledger,selectedHandle):null
  const failedReceipt=(receipt:EIReceipt):EIPageAttempt=>({transactionId:receipt.transactionId,producer:receipt.producer,phase:'engine',message:receipt.reasons.join('; '),detail:JSON.stringify(receipt),committed:false})
  const save=async(next:EILedger,pending:Proposal|null,failed:readonly EIPageAttempt[]=attempts)=>{
    if(!persistent)return
    storage.current??=createEILocalStorage({})
    const json=saveEISession(root.current,next,pending,failed)
    savingNow.current=true;setSaving(true)
    try{const stored=await storage.current.compareAndStore(storageRevision.current,{root:root.current,revision:storageRevision.current===null?0:storageRevision.current+1,json});storageRevision.current=stored.revision}
    finally{savingNow.current=false;setSaving(false)}
  }
  useEffect(()=>{if(!open){captureAbort.current?.abort();run.current++;setExecution(null);return}const previous=document.activeElement as HTMLElement|null;closeButton.current?.focus();return()=>previous?.focus()},[open])
  useLayoutEffect(()=>{
    if(!execution||!open)return
    const token=++run.current
    let second=0
    const first=requestAnimationFrame(()=>{second=requestAnimationFrame(async()=>{
      if(token!==run.current||!stage.current||!active.current)return
      try{
        const values=[...stage.current.querySelectorAll<HTMLElement>('[data-readback-address]')].map(element=>({address:element.dataset.readbackAddress!,value:element.textContent??''}))
        if(chatTurn.current&&!isEIConversationTurnCurrent(chatTurn.current,active.current))throw new Error('Conversation cancelled or its context changed before admission')
        if(!sharedTransition.projection)throw new Error(sharedTransition.error||'Shared transition projection is unavailable')
        const projectionText=stage.current.querySelector<HTMLElement>('[data-transition-readback]')?.textContent??''
        const verified=verifyEIUnifiedTransition(active.current,execution,sharedTransition.projection,{values,projectionText})
        const result=commitEIUnifiedTransition(active.current,verified)
        await save(result.ledger,null,result.status==='committed'?attempts:[...attempts,failedReceipt(result.receipt)])
        if(token!==run.current)return
        const conversationStatus=chatTurn.current?.mode
        setLedger(result.ledger);setExecution(null);setProposal(null);chatTurn.current=null
        if(result.status!=='committed')setAttempts(items=>[...items,failedReceipt(result.receipt)])
        setNotice(result.status==='committed'?(conversationStatus==='capture-only'?'Input retained · interpretation unbound':`1 · complete local return verified${persistent?' and durable readback matched':' in this session'}`):'No partial update committed; inspect the receipt')
        setError('')
      }catch(reason){const message=reason instanceof Error?reason.message:String(reason);setAttempts(items=>[...items,{transactionId:execution.proposal.input.id,producer:execution.proposal.input.producer,phase:message.startsWith('EI storage:')?'storage':'render',message,detail:reason instanceof EIUnifiedTransitionError?JSON.stringify(reason):'The staged result was not admitted as current state.',committed:false}]);setExecution(null);setError(message);setNotice('0 retained · execution did not complete')}
    })})
    return()=>{run.current++;cancelAnimationFrame(first);cancelAnimationFrame(second)}
  },[execution,open])
  const protect=async(action:()=>void|Promise<void>)=>{if(savingNow.current)return;try{setError('');await action()}catch(reason){const message=reason instanceof Error?reason.message:String(reason);setError(message);setAttempts(items=>[...items,{transactionId:proposal?.input.id??`local-proposal/${sequence.current}`,producer:selected,phase:message.startsWith('EI storage:')?'storage':'engine',message,detail:'Operation failed before admission; retained state remains current.',committed:false}])}}
  const capture=()=>protect(async()=>{
    savingNow.current=true;setSaving(true);setPreparingCapture(true)
    try{
    const abort=new AbortController();captureAbort.current=abort
    const id=`local-input/${++sequence.current}`
    const next=createEILedger({records:[{address:rootAddress,value:raw,source:{id,text:raw,realm:'user-supplied-local-input'},relations:includeModel?[{relation:'included-public-source',address:'model/inventory-root'}]:[]},...(includeModel?createEIPublicFieldRecords():[])]})
    const firstTurn=await prepareEIConversationTurn({ledger:next,root:rootAddress,input:raw,id:`local-proposal/${++sequence.current}`,signal:abort.signal})
    setPreparingCapture(false)
    if(firstTurn.status!=='proposed')throw new Error(firstTurn.reason)
    if(abort.signal.aborted||!liveOperation.current.open)return
    root.current=rootAddress;await save(next,firstTurn.proposal)
    setLedger(next);active.current=next;setSelected(rootAddress);setTarget(rootAddress);setValue(raw)
    savingNow.current=false;stageChat(firstTurn)
    }finally{savingNow.current=false;setSaving(false);setPreparingCapture(false)}
  })
  const prepare=()=>protect(async()=>{
    if(!ledger||!record||!selectedHandle)throw new Error('Select an addressed source first')
    const id=`local-proposal/${++sequence.current}`
    const next=proposeEIExplicitContinuation(ledger,{id,producer:selectedHandle,target,choices:(useAlternative?[value,alternative]:[value]).map((nextValue,index)=>({value:nextValue,conditions:choiceConditions[index]??[]})),owner:automatic?'engine':'user',createChild,branchSource})
    await save(ledger,next);liveOperation.current={...liveOperation.current,proposal:next};setProposal(next);setNotice('0 · proposal only; retained state has not changed')
  })
  const perform=(candidateId?:string)=>protect(async()=>{
    if(!ledger||!proposal)return
    chatTurn.current=null
    const result=executeEI(ledger,proposal,candidateId?chooseEI(proposal,candidateId):undefined)
    if(result.status==='staged'){liveOperation.current={...liveOperation.current,execution:result};setExecution(result);setNotice('0 → 1 · constructing and reading back the complete addressed output')}
    else {if(result.status!=='replayed'){const updated=[...attempts,failedReceipt(result.receipt)];setAttempts(updated);await save(ledger,proposal,updated)}setNotice(`${result.status} · retained state unchanged`)}
  })
  const stageChat=(turn:ChatTurn)=>{
    if(!active.current||savingNow.current||liveOperation.current.execution||liveOperation.current.proposal||!liveOperation.current.open)throw new Error('Finish the current addressed operation before sending another message')
    if(!isEIConversationTurnCurrent(turn,active.current))throw new Error('Conversation context changed before staging')
    const staged=executeEI(active.current,turn.proposal)
    if(staged.status!=='staged')throw new Error(staged.receipt.reasons.join('; ')||'Conversation could not be staged')
    liveOperation.current={...liveOperation.current,proposal:turn.proposal,execution:staged};chatTurn.current=turn;setProposal(turn.proposal);setExecution(staged);setNotice('Checking addressed input before retention')
  }
  const filterField=()=>protect(async()=>{if(!ledger||!grainRegistry)return;const snapshot=ledger,request=++filterRequest.current;setFilterBusy(true);try{const result=await filterEIGrainAddresses(ledger,grainRegistry.entities.map(entity=>projectEIGrain(grainRegistry,entity.address,grain)),{kind:'exact-text-equality',equals:filterValue});if(active.current===snapshot&&filterRequest.current===request){filterOrigin.current=snapshot;setFilterResult(result)}}finally{setFilterBusy(false)}})
  const cancel=async()=>{if(savingNow.current){setNotice('Finishing the atomic local write; its returned result will remain inspectable');return false}captureAbort.current?.abort();run.current++;setExecution(null);if(ledger&&proposal)await save(ledger,null);liveOperation.current={...liveOperation.current,proposal:null,execution:null};setProposal(null);setNotice('Cancelled uncommitted proposal; retained state unchanged');return true}
  const dismiss=()=>protect(async()=>{if(await cancel())onClose?.()})
  const restore=()=>protect(async()=>{
    savingNow.current=true;setSaving(true)
    try{storage.current??=createEILocalStorage({});const stored=await storage.current.load();if(!stored){setNotice('No saved EI ledger in this browser');return}
      const restored=restoreEISession(stored.json);if(restored.root!==stored.root)throw new Error('Stored root does not match session root')
      root.current=stored.root;storageRevision.current=stored.revision;sequence.current=restored.nextSequence
      const recovered=restored.ledger;readEIConversation(recovered,restored.root)
      setLedger(recovered);setSelected(restored.root);setTarget(restored.root);setValue(recovered.records.find(r=>r.address===restored.root)!.is.value);setProposal(restored.pending);setAttempts(restored.attempts);setPersistent(true)
      setNotice('Recovered the same addressed local ledger, pending choices and attempt history. This does not verify external claims.')
    }finally{savingNow.current=false;setSaving(false)}
  })
  const exportSession=()=>protect(()=>{if(!ledger)return;const blob=new Blob([saveEISession(root.current,ledger,proposal,attempts)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='ei-addressed-session.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setNotice('Local export requested. The file contains your entered source text and receipts.')})
  const importSession=(file:File)=>protect(async()=>{
    if(ledger)throw new Error('An active ledger is already open; import cannot overwrite it')
    if(file.size>1_048_576)throw new Error('EI session exceeds 1 MiB')
    savingNow.current=true;setSaving(true)
    try{const restored=restoreEISession(await file.text());readEIConversation(restored.ledger,restored.root);root.current=restored.root;storageRevision.current=null;sequence.current=restored.nextSequence;setLedger(restored.ledger);setProposal(restored.pending);setAttempts(restored.attempts);setSelected(restored.root);setTarget(restored.root);setValue(restored.ledger.records.find(r=>r.address===restored.root)!.is.value);setPersistent(false);setNotice('Imported and replay-checked in memory. The file supplies history; it does not authenticate external claims.')}
    finally{savingNow.current=false;setSaving(false)}
  })
  const keepLocally=()=>protect(async()=>{
    if(!ledger)return
    storage.current??=createEILocalStorage({});savingNow.current=true;setSaving(true)
    try{const stored=await storage.current.compareAndStore(null,{root:root.current,revision:0,json:saveEISession(root.current,ledger,proposal,attempts)});storageRevision.current=stored.revision;setPersistent(true);setNotice('Local browser write and readback matched. Reload recovery is available.')}
    finally{savingNow.current=false;setSaving(false)}
  })
  if(!open)return null
  return <div className="ei-model-layer" role={onClose?"dialog":"main"} aria-modal={onClose?true:undefined} aria-label="EI conversation and addressed state" ref={panel} onKeyDown={event=>{
    if(event.key==='Escape'&&onClose){event.preventDefault();void dismiss()}
    if(event.key==='Tab'){const list=[...panel.current!.querySelectorAll<HTMLElement>('button,input,textarea,select,a[href]')].filter(e=>!e.hasAttribute('disabled'));if(event.shiftKey&&document.activeElement===list[0]){event.preventDefault();list.at(-1)?.focus()}else if(!event.shiftKey&&document.activeElement===list.at(-1)){event.preventDefault();list[0]?.focus()}}
  }}>
    <header><div><small>SOURCE → DIFFERENCE → CHOICE → ACT → VERIFIED RETURN</small><h1>EI field</h1><p>Source · Difference · retained state</p></div>{onClose&&<button ref={closeButton} disabled={saving} onClick={dismiss}>Close EI model</button>}</header>
    <p className="ei-notice" role="status">{notice||'Capture a source to begin'}</p>{error&&<p className="ei-error" role="alert">{error}</p>}
    {!ledger?<section className="ei-capture"><h2>Start a conversation</h2><label>Source address<input disabled={saving||!!execution||!!proposal} value={rootAddress} onChange={e=>setRootAddress(e.target.value)}/></label><label>First message<textarea disabled={saving||!!execution||!!proposal} value={raw} onChange={e=>setRaw(e.target.value)} rows={6}/></label><label><input disabled={saving} type="checkbox" checked={includeModel} onChange={event=>setIncludeModel(event.target.checked)}/> Include the public fracture model definitions and relations</label><label><input disabled={saving||!!execution||!!proposal} type="checkbox" checked={persistent} onChange={e=>setPersistent(e.target.checked)}/> Keep this EI ledger on this browser, unencrypted</label><button onClick={capture} disabled={!rootAddress||!raw||saving}>Start conversation</button>{preparingCapture&&<button onClick={()=>captureAbort.current?.abort()}>Cancel preparation</button>}<button onClick={restore} disabled={saving}>Restore saved local ledger</button><label>Import exported session<input type="file" accept="application/json,.json" disabled={saving} onChange={event=>{const file=event.currentTarget.files?.[0];event.currentTarget.value='';if(file)void importSession(file)}}/></label><p>No entered content is sent to a server. Input is not automatically a command, fact or approved NEXT. {persistent?'Local browser storage is selected; do not enter secrets.':'This session uses memory only.'}</p></section>:<><EIConversation ledger={ledger} root={root.current} disabled={saving||!!execution||!!proposal} nextId={()=>`local-proposal/${++sequence.current}`} onStage={stageChat} onInspect={address=>{setSelected(address);setTarget(address);setValue(ledger.records.find(r=>r.address===address)?.is.value??'');if(inspector.current){inspector.current.open=true;inspector.current.scrollIntoView({block:'start'})}}}/><details ref={inspector} className="ei-inspector"><summary>Inspect addressed memory, gates and explicit continuations</summary><fieldset className="ei-workspace" disabled={saving||!!execution}>
      <section aria-label="Addressed grain map"><h2>Addressed grains · revision {ledger.revision}</h2><label>Mechanism grain<select aria-label="Mechanism grain" value={grain} onChange={event=>setGrain(event.target.value as EIGrain)}>{EI_GRAINS.map(item=><option key={item}>{item}</option>)}</select></label><p>{selectedState?.entity.address} · {grain} · revision {selectedState?.revision}. One addressed entity; numeric placement unbound.</p><label>IS equals<input value={filterValue} onChange={event=>{filterRequest.current++;setFilterValue(event.target.value);setFilterResult(null)}}/></label><button disabled={filterBusy} onClick={filterField}>Filter field addresses</button>{filterResult&&filterOrigin.current===ledger&&<section aria-label="Field filter results"><h3>Filter · {filterResult.status}</h3>{filterResult.answer?<><p>{filterResult.answer.matches.length} matching addresses · revision {filterResult.answer.origin.ledgerRevision} · check {filterResult.verification?.status}</p>{filterResult.answer.matches.map((match,index)=><article key={`${match.address}:${index}`}><button disabled={!!proposal} onClick={()=>{if(filterOrigin.current!==active.current)return;setSelected(match.address);setTarget(match.address);setValue(match.value);setCreateChild(false);setBranchSource(null);setProposal(null)}}>{match.address}</button><pre>{match.value}</pre></article>)}{filterResult.answer.unknowns.map((unknown,index)=><p key={index}>{unknown.address}: {unknown.reason}</p>)}<details><summary>Source and check record</summary><pre>{JSON.stringify({query:filterResult.query,proof:filterResult.answer.proof,verification:filterResult.verification?presentEICheck(filterResult.verification):null},null,2)}</pre></details></>:<p role="status">{filterResult.code}</p>}</section>}
        <div className="ei-grains">{ledger.records.map(node=><button key={node.address} className="ei-grain" disabled={!!proposal} aria-pressed={selected===node.address} onClick={()=>{setSelected(node.address);setTarget(node.address);setValue(node.is.value);setCreateChild(false);setBranchSource(null);setProposal(null)}}>
          <svg viewBox="0 0 160 125" aria-hidden="true"><path d="M80 12L17 104L145 98ZM80 12L87 74L17 104M87 74L145 98" fill="none" stroke="currentColor"/><text x="80" y="10" textAnchor="middle">NEXT</text><text x="4" y="119">WAS</text><text x="136" y="119">IS</text><circle cx="87" cy="74" r="4"/></svg>
          <strong>{node.address}</strong><span>IS · {node.is.value}</span><small>{node.parents.length?`from ${node.parents.join(', ')}`:'root source'}</small>
        </button>)}</div>
        {record&&<article className="ei-state"><h3>{record.address}</h3><dl><dt>WAS</dt><dd><pre>{record.was.at(-1)?.value??'No earlier retained value'}</pre></dd><dt>IS</dt><dd><pre>{record.is.value}</pre></dd><dt>Source</dt><dd>{record.is.source.id}</dd></dl><details><summary>Exact retained source and scope</summary><pre>{JSON.stringify(record.is.source,null,2)}</pre></details><EIAddressRelations ledger={ledger} address={record.address} grain={grain} disabled={saving||!!execution||!!proposal} onSelect={address=>{setSelected(address);setTarget(address);setValue(ledger.records.find(item=>item.address===address)!.is.value);setCreateChild(false);setBranchSource(null)}}/><button onClick={()=>setGateVisible(v=>!v)}>{gateVisible?'Hide':'Inspect'} moment gate</button><p>Producing and returned receipt addresses: {ledger.receipts.filter(receipt=>receipt.producer===record.address||receipt.patches.some(patch=>patch.address===record.address)).map(receipt=>receipt.id).join(', ')||'Initial captured source'}</p>{record.was.map((past,index)=><button key={index} disabled={!!proposal} onClick={()=>{setCreateChild(true);setTarget(`${selected}/branch-${sequence.current+1}`);setValue(past.value);setBranchSource(`${selected}#was/${index}`)}}>Branch from WAS revision {past.revision}</button>)}</article>}{record&&gateVisible&&<EIRecordGate ledger={ledger} address={record.address} proposal={proposal}/>}
      </section>
      <section aria-label="Allowed continuations"><h2>Choose a continuation</h2><p>Conditions compare exact retained text. They do not decide natural-language truth.</p>
        <label><input disabled={saving||!!execution||!!proposal} type="checkbox" checked={createChild} onChange={e=>{setCreateChild(e.target.checked);setTarget(e.target.checked?`${selected}/child`:selected);setProposal(null)}}/> Add an addressed child grain</label>
        <label>Target address<input disabled={saving||!!execution||!!proposal} value={target} onChange={e=>{setTarget(e.target.value);setProposal(null)}}/></label>
        <label>Proposed value<textarea disabled={saving||!!execution||!!proposal} rows={4} value={value} onChange={e=>{setValue(e.target.value);setBranchSource(null);setProposal(null)}}/></label>
        <label><input disabled={saving||!!execution||!!proposal} type="checkbox" checked={useAlternative} onChange={e=>{setUseAlternative(e.target.checked);setProposal(null)}}/> Keep a second alternative</label>
        {useAlternative&&<label>Alternative value<textarea disabled={saving||!!execution||!!proposal} value={alternative} onChange={e=>{setAlternative(e.target.value);setProposal(null)}}/></label>}
        {(useAlternative?[0,1]:[0]).map(choice=><fieldset key={choice} disabled={saving||!!execution||!!proposal}><legend>Choice {choice+1} · supplied conditions</legend>{choiceConditions[choice].map((condition,index)=><div key={index}><label>Condition address<input value={condition.address} onChange={event=>setChoiceConditions(current=>current.map((list,at)=>at===choice?list.map((item,i)=>i===index?{...item,address:event.target.value}:item):list))}/></label><label>Expected IS<input value={condition.equals} onChange={event=>setChoiceConditions(current=>current.map((list,at)=>at===choice?list.map((item,i)=>i===index?{...item,equals:event.target.value}:item):list))}/></label><button onClick={()=>setChoiceConditions(current=>current.map((list,at)=>at===choice?list.filter((_,i)=>i!==index):list))}>Remove condition</button></div>)}<button onClick={()=>setChoiceConditions(current=>current.map((list,at)=>at===choice?[...list,{address:selected,equals:''}]:list))}>Add condition to Choice {choice+1}</button></fieldset>)}
        <label><input disabled={saving||!!execution||!!proposal} type="checkbox" checked={automatic} onChange={e=>{setAutomatic(e.target.checked);setProposal(null)}}/> Allow the engine to select a uniquely allowed continuation</label>
        <button disabled={!!execution||!!proposal} onClick={prepare}>Filter proposed continuations</button>
        {proposal&&<article><h3>{proposal.status}</h3><p>Pending source: {proposal.input.producer}. Cancel this snapshot before editing its draft.</p>{proposal.candidates.map(item=><div key={item.candidate.id}><strong>{item.candidate.label}</strong><pre>{item.candidate.patches.map(p=>`${p.address}\n${p.value}`).join('\n')}</pre><p>{item.reasons.join('; ')||(item.candidate.conditions.length?'Supplied conditions matched':'No conditions supplied')}</p><button disabled={!item.allowed||item.unresolved||!!execution} onClick={()=>perform(item.candidate.id)}>Select {item.candidate.label} and execute</button></div>)}{proposal.status==='ready'&&<button onClick={()=>perform()} disabled={!!execution}>Execute unique continuation</button>}<button onClick={()=>protect(async()=>{await cancel()})}>Cancel proposal</button></article>}
      </section>
    </fieldset></details></>}
    {execution&&<section ref={stage} className="ei-staged" aria-label="Staged output readback"><h2>Complete staged output · not committed</h2>{sharedTransition.projection?<EITransitionView projection={sharedTransition.projection} readback/>:<p role="alert">{sharedTransition.error}</p>}{execution.expected.map(item=><article key={item.address}><strong>{item.address}</strong><pre data-readback-address={item.address}>{item.value}</pre></article>)}</section>}
    {ledger&&<section className="ei-receipts"><h2>Returned receipts</h2><button onClick={exportSession} disabled={saving||!!execution}>Export local session</button>{!persistent&&<button onClick={keepLocally} disabled={saving||!!execution}>Keep this ledger locally, unencrypted</button>}<p>{persistent?`Durable local generation ${storageRevision.current}`:'Memory-only session'}</p>{ledger.receipts.length?ledger.receipts.map((receipt,index)=><details key={index}><summary>Receipt {index+1} · {receipt.status}</summary><pre>{JSON.stringify(receipt,null,2)}</pre><button onClick={()=>setInspectedReceipt(value=>value===receipt.id?null:receipt.id)}>{inspectedReceipt===receipt.id?'Hide':'Reconstruct'} shared transition</button>{inspectedReceipt===receipt.id&&<EIReceiptTransition ledger={ledger} receiptId={receipt.id}/>}</details>):<p>No model update has been committed.</p>}{attempts.map((receipt,index)=><details key={`attempt-${index}`}><summary>Uncommitted attempt {index+1} · {receipt.phase}</summary><pre>{JSON.stringify(receipt,null,2)}</pre></details>)}</section>}
    <footer>Local addressed text execution and rendered-value readback. Indexed moments, interpretation and geometric motion: unbound.</footer>
  </div>
}
