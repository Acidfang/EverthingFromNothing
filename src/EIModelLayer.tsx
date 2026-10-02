import {useEIOverlayServices} from './useEIOverlayServices'
import {EIEnvironmentObservation} from './EIEnvironmentObservation'
import {EIEnvironmentBootstrap} from './EIEnvironmentBootstrap'
import {proposeHomebaseEnvironment,EI_ENVIRONMENT_ADDRESS} from './model/ei-homebase-environment'
import {EIGuidance} from './EIGuidance'
import {EIPublicSync} from './EIPublicSync'
import {EIDeviceWorkspace} from './EIDeviceWorkspace'
import {createEIDeviceFieldRecords,EI_DEVICE_ROOT} from './model/ei-device-field'
import {EIPhoneMedia} from './EIPhoneMedia'
import {proposeEIMediaRetention} from './model/ei-media-retention'
import type {MediaSource} from './model/ei-phone-media'
import {packEIFieldSave,unpackEIFieldSave,EI_FIELD_SAVE_LIMITS,type EIFieldPresentationSnapshot} from './model/ei-field-save'
import {EIPhoneOverlay} from './EIPhoneOverlay'
import {phoneInputLocator} from './model/ei-phone-input'
import {EIPhoneInputControl} from './EIPhoneInput'
import type {EIPhoneInput} from './model/ei-phone-input'
import {EIPhoneBridge} from './EIPhoneBridge'
import {EIFieldArray} from './EIFieldArray'
import {emptyEIStateHistory,visitEIState,moveEIState} from './model/ei-state-navigation'
import {presentEICheck} from './model/ei-check-presentation'
import {createEIGrainRegistry,projectEIGrain,readEIGrain,filterEIGrainAddresses,EI_GRAINS,type EIGrain} from './model/ei-grain-identity'
import {useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react'
import {createEILedger,proposeEI,chooseEI,executeEI,type EILedger,type EIReceipt,type EICondition} from './model/ei-engine'
import {createEILocalStorage,type EIStoredState} from './model/ei-storage'
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
  const [startupArchive,setStartupArchive]=useState<string|null>(null),startupLedger=useRef<EILedger|null>(null)
  const [presentationEpoch,setPresentationEpoch]=useState(0)
  const [presentation,setPresentation]=useState<EIFieldPresentationSnapshot|null>(null),presentationReader=useRef<(()=>EIFieldPresentationSnapshot)|null>(null)
  const [environmentInitializing,setEnvironmentInitializing]=useState(typeof window!=='undefined'&&window.location.origin==='https://homebase.local')
  const [environmentStatus,setEnvironmentStatus]=useState(''),[backgroundExecution,setBackgroundExecution]=useState(false)
  const publicContext=useMemo(()=>createEILedger({records:[...createEIDeviceFieldRecords(),...createEIPublicFieldRecords()]}),[])
  const [publicAddress,setPublicAddress]=useState(EI_DEVICE_ROOT)
  const [workspaceOpen,setWorkspaceOpen]=useState(false)
  const [phoneInput,setPhoneInput]=useState<EIPhoneInput|null>(null),[captureOrigin,setCaptureOrigin]=useState<EIPhoneInput|null>(null)
  const [rootAddress,setRootAddress]=useState('EI/SOURCE'),[raw,setRaw]=useState(''),[includeModel,setIncludeModel]=useState(true)
  const [selected,setSelectedAddress]=useState('EI/SOURCE'),[target,setTarget]=useState('EI/SOURCE')
  const [selectedRevision,setSelectedRevision]=useState<number|null>(null),[stateHistory,setStateHistory]=useState(emptyEIStateHistory)
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
  const [persistent,setPersistent]=useState(false),[isSaving,setSaving]=useState(false),[attempts,setAttempts]=useState<readonly EIPageAttempt[]>([])
  const storage=useRef<ReturnType<typeof createEILocalStorage>|null>(null),storageRevision=useRef<number|null>(null),root=useRef(''),savingNow=useRef(false)
  const services=useEIOverlayServices(ledger??publicContext,root.current||EI_DEVICE_ROOT)
  const saving=isSaving||environmentInitializing||(services.pending&&!services.error)
  const sceneLedger=services.error?(ledger??publicContext):services.scene.ledger,workspaceLedger=services.error?(ledger??publicContext):services.workspace.ledger
  const inspector=useRef<HTMLDetailsElement>(null),filterRequest=useRef(0),filterOrigin=useRef<EILedger|null>(null)
  const panel=useRef<HTMLDivElement>(null),stage=useRef<HTMLDivElement>(null),closeButton=useRef<HTMLButtonElement>(null)
  const sequence=useRef(0),active=useRef<EILedger|null>(null),run=useRef(0)
  const chatTurn=useRef<ChatTurn|null>(null),captureAbort=useRef<AbortController|null>(null)
  const liveOperation=useRef({proposal,execution,open,workspaceOpen})
  liveOperation.current={proposal,execution,open,workspaceOpen}
  active.current=ledger
  const sharedTransition=useMemo(()=>{if(!ledger||!execution)return {projection:null,error:''};try{return {projection:prepareEIUnifiedTransition(ledger,execution),error:''}}catch(reason){return {projection:null,error:reason instanceof Error?reason.message:String(reason)}}},[ledger,execution])
  const record=ledger?.records.find(r=>r.address===selected)
  const selectedHandle=grainRegistry&&record?projectEIGrain(grainRegistry,record.address,grain,selectedRevision??undefined):null
  const selectedState=ledger&&selectedHandle?readEIGrain(ledger,selectedHandle):null
  const historical=selectedState?.role==='WAS'
  const setSelected=(address:string)=>{setCreateChild(false);setBranchSource(null);setSelectedAddress(address);setSelectedRevision(active.current?.records.find(item=>item.address===address)?.is.revision??null)}
  const inspectRevision=(revision:number)=>{if(proposal||execution)return;setCreateChild(false);setBranchSource(null);setTarget(selected);setValue(record?.is.value??'');setSelectedRevision(revision)}
  const moveState=(offset:-1|1)=>{if(proposal||execution)return;const next=moveEIState(stateHistory,offset),at=next.items[next.index];if(!at)return;setCreateChild(false);setBranchSource(null);setStateHistory(next);setSelectedAddress(at.address);setSelectedRevision(at.revision);setTarget(at.address);setValue(ledger?.records.find(item=>item.address===at.address)?.is.value??'')}
  useEffect(()=>{if(!selectedState)return;setSelectedRevision(selectedState.revision);setStateHistory(history=>visitEIState(history,{address:selectedState.entity.address,revision:selectedState.revision}))},[selectedState])
  const failedReceipt=(receipt:EIReceipt):EIPageAttempt=>({transactionId:receipt.transactionId,producer:receipt.producer,phase:'engine',message:receipt.reasons.join('; '),detail:JSON.stringify(receipt),committed:false})
  const save=async(next:EILedger,pending:Proposal|null,failed:readonly EIPageAttempt[]=attempts)=>{
    if(!persistent)return
    storage.current??=createEILocalStorage({})
    const json=saveEISession(root.current,next,pending,failed)
    savingNow.current=true;setSaving(true)
    try{const stored=await storage.current.compareAndStore(storageRevision.current,{root:root.current,revision:storageRevision.current===null?0:storageRevision.current+1,json});storageRevision.current=stored.revision}
    finally{savingNow.current=false;setSaving(false)}
  }
  useEffect(()=>{if(!open){captureAbort.current?.abort();run.current++;setExecution(null);return}const previous=document.activeElement as HTMLElement|null;panel.current?.querySelector<HTMLElement>('.ei-field-tools button')?.focus();return()=>previous?.focus()},[open])
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
        const previous=active.current
        const result=commitEIUnifiedTransition(previous,verified)
        await save(result.ledger,null,result.status==='committed'?attempts:[...attempts,failedReceipt(result.receipt)])
        if(token!==run.current)return
        const conversationStatus=chatTurn.current?.mode
        if(result.status==='committed'&&backgroundExecution){try{const archive=packEIFieldSave(saveEISession(root.current,result.ledger,null,attempts),null);startupLedger.current=result.ledger;setStartupArchive(archive)}catch{startupLedger.current=null}}
        services.publishCommitted(previous,result)
        setLedger(result.ledger);setExecution(null);setProposal(null);setBackgroundExecution(false);chatTurn.current=null
        if(result.status!=='committed')setAttempts(items=>[...items,failedReceipt(result.receipt)])
        setNotice(result.status==='committed'?(conversationStatus==='capture-only'?'Input retained · interpretation unbound':`1 · complete local return verified${persistent?' and durable readback matched':' in this session'}`):'No partial update committed; inspect the receipt')
        setError('')
      }catch(reason){const message=reason instanceof Error?reason.message:String(reason);setAttempts(items=>[...items,{transactionId:execution.proposal.input.id,producer:execution.proposal.input.producer,phase:message.startsWith('EI storage:')?'storage':'render',message,detail:reason instanceof EIUnifiedTransitionError?JSON.stringify(reason):'The staged result was not admitted as current state.',committed:false}]);setExecution(null);setBackgroundExecution(false);setError(message);setNotice('0 retained · execution did not complete')}
    })})
    return()=>{run.current++;cancelAnimationFrame(first);cancelAnimationFrame(second)}
  },[execution,open])
  const protect=async(action:()=>void|Promise<void>)=>{if(savingNow.current)return;try{setError('');await action()}catch(reason){const message=reason instanceof Error?reason.message:String(reason);setError(message);setAttempts(items=>[...items,{transactionId:proposal?.input.id??`local-proposal/${sequence.current}`,producer:selected,phase:message.startsWith('EI storage:')?'storage':'engine',message,detail:'Operation failed before admission; retained state remains current.',committed:false}])}}
  const capture=()=>protect(async()=>{
    savingNow.current=true;setSaving(true);setPreparingCapture(true)
    try{
    const abort=new AbortController();captureAbort.current=abort
    const id=`local-input/${++sequence.current}`
    const next=createEILedger({records:[{address:rootAddress,value:raw,source:{id,text:raw,realm:'user-supplied-local-input',...(captureOrigin?{locator:phoneInputLocator(captureOrigin)}:{})},relations:[{relation:'included-device-workspace',address:EI_DEVICE_ROOT},...(includeModel?[{relation:'included-public-source',address:'model/inventory-root'}]:[])]},...createEIDeviceFieldRecords(),...(includeModel?createEIPublicFieldRecords():[])]})
    const firstTurn=await prepareEIConversationTurn({ledger:next,root:rootAddress,input:raw,id:`local-proposal/${++sequence.current}`,signal:abort.signal,...(captureOrigin?{inputOrigin:{id:captureOrigin.id,locator:phoneInputLocator(captureOrigin),text:captureOrigin.text}}:{})})
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
  const mediaScope=useRef({address:ledger?selected:publicAddress,revision:ledger?(selectedRevision??record?.is.revision??0):0});mediaScope.current={address:ledger?selected:publicAddress,revision:ledger?(selectedRevision??record?.is.revision??0):0}
  const stageEnvironment=(receipt:Parameters<typeof proposeHomebaseEnvironment>[1],context:EILedger)=>{
    const base=active.current??publicContext
    if(base!==context||receipt.scope.address!==mediaScope.current.address||receipt.scope.revision!==mediaScope.current.revision||savingNow.current||liveOperation.current.proposal||liveOperation.current.execution)throw new Error('Initialization context changed')
    const next=proposeHomebaseEnvironment(base,receipt,`environment/${receipt.value.requestId}`);if(!next)return
    const staged=executeEI(base,next);if(staged.status!=='staged')throw new Error('Environment could not be staged')
    if(!active.current){setPresentation(presentationReader.current?.()??null);root.current=EI_DEVICE_ROOT;active.current=base;setLedger(base);setSelected(next.input.producer);setTarget(next.input.producer);setValue(base.records.find(record=>record.address===next.input.producer)!.is.value)}
    setBackgroundExecution(true);chatTurn.current=null;liveOperation.current={...liveOperation.current,proposal:next,execution:staged};setProposal(next);setExecution(staged)
  }
  const stageField=(next:ReturnType<typeof proposeEI>)=>{
    if(!liveOperation.current.open||!liveOperation.current.workspaceOpen)throw new Error('Field workspace closed before operation selection')
    if(historical)throw new Error('Select the current IS before choosing an operation')
    if(savingNow.current||liveOperation.current.proposal||liveOperation.current.execution)throw new Error('Finish the current field operation first')
    const base=active.current??publicContext,staged=executeEI(base,next,chooseEI(next,next.candidates[0].candidate.id))
    if(staged.status!=='staged')throw new Error(staged.receipt.reasons.join('; '))
    if(!active.current){setPresentation(presentationReader.current?.()??null);root.current=EI_DEVICE_ROOT;active.current=base;setLedger(base);setSelected(next.input.producer);setTarget(next.input.producer);setValue(base.records.find(record=>record.address===next.input.producer)!.is.value)}
    chatTurn.current=null;liveOperation.current={...liveOperation.current,proposal:next,execution:staged};setProposal(next);setExecution(staged)
  }
  const retainMedia=async(source:MediaSource)=>{
    if(source.address!==mediaScope.current.address||source.revision!==mediaScope.current.revision)throw new Error('Selected field changed before source retention')
    if(savingNow.current||liveOperation.current.proposal||liveOperation.current.execution)throw new Error('Finish the current field operation first')
    const base=active.current??publicContext
    const next=proposeEIMediaRetention(base,source,`local-media/${++sequence.current}`)
    if(!next)return
    const staged=executeEI(base,next,chooseEI(next,next.candidates[0].candidate.id))
    if(staged.status!=='staged')throw new Error(staged.receipt.reasons.join('; '))
    if(!active.current){setPresentation(presentationReader.current?.()??null);root.current=EI_DEVICE_ROOT;active.current=base;setLedger(base);setSelected(source.address);setTarget(source.address);setValue(base.records.find(record=>record.address===source.address)!.is.value)}
    chatTurn.current=null;liveOperation.current={...liveOperation.current,proposal:next,execution:staged};setProposal(next);setExecution(staged)
  }
  const filterField=()=>protect(async()=>{if(!ledger||!grainRegistry)return;const snapshot=ledger,request=++filterRequest.current;setFilterBusy(true);try{const result=await filterEIGrainAddresses(ledger,grainRegistry.entities.map(entity=>projectEIGrain(grainRegistry,entity.address,grain)),{kind:'exact-text-equality',equals:filterValue});if(active.current===snapshot&&filterRequest.current===request){filterOrigin.current=snapshot;setFilterResult(result)}}finally{setFilterBusy(false)}})
  const cancel=async()=>{if(savingNow.current){setNotice('Finishing the atomic local write; its returned result will remain inspectable');return false}captureAbort.current?.abort();run.current++;setExecution(null);if(ledger&&proposal)await save(ledger,null);liveOperation.current={...liveOperation.current,proposal:null,execution:null};setProposal(null);setNotice('Cancelled uncommitted proposal; retained state unchanged');return true}
  const dismiss=()=>protect(async()=>{if(await cancel())onClose?.()})
  const restoreStoredField=(stored:EIStoredState)=>{
    const restored=restoreEISession(stored.json);if(restored.root!==stored.root)throw new Error('Stored root does not match session root')
    const recovered=restored.ledger;readEIConversation(recovered,restored.root)
    root.current=stored.root;storageRevision.current=stored.revision;sequence.current=restored.nextSequence
    setLedger(recovered);active.current=recovered;setStateHistory(emptyEIStateHistory());setSelected(restored.root);setTarget(restored.root);setValue(recovered.records.find(r=>r.address===restored.root)!.is.value);setProposal(restored.pending);setAttempts(restored.attempts);setPersistent(true)
  }
  const restore=()=>protect(async()=>{
    savingNow.current=true;setSaving(true)
    try{storage.current??=createEILocalStorage({});const stored=await storage.current.load();if(!stored){setNotice('No saved EI ledger in this browser');return}
      restoreStoredField(stored)
      setNotice('Recovered the same addressed local ledger, pending choices and attempt history. This does not verify external claims.')
    }finally{savingNow.current=false;setSaving(false)}
  })
  const exportSession=()=>protect(()=>{if(!ledger)return;const blob=new Blob([packEIFieldSave(saveEISession(root.current,ledger,proposal,attempts),presentationReader.current?.())],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='ei-addressed-session.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setNotice('Local export requested. The file contains your entered source text and receipts.')})
  const importSession=(file:File)=>protect(async()=>{
    const original=active.current
    if(ledger&&(ledger!==startupLedger.current||!startupArchive))throw new Error('An active ledger is already open; import cannot overwrite it')
    if(file.size>EI_FIELD_SAVE_LIMITS.storedBytes)throw new Error('Field save exceeds the local import capacity')
    savingNow.current=true;setSaving(true)
    try{const saved=unpackEIFieldSave(await file.text()),restored=restoreEISession(saved.sessionString);if(active.current!==original)throw new Error('Active field changed during import');readEIConversation(restored.ledger,restored.root);root.current=restored.root;setPresentation(saved.presentation);setPresentationEpoch(value=>value+1);if(saved.presentation)setGrain(saved.presentation.grain);storageRevision.current=null;sequence.current=restored.nextSequence;setLedger(restored.ledger);active.current=restored.ledger;setStateHistory(emptyEIStateHistory());setProposal(restored.pending);setAttempts(restored.attempts);setSelected(saved.presentation?.selectedAddress??restored.root);setSelectedRevision(saved.presentation?.selectedRevision??null);setTarget(saved.presentation?.selectedAddress??restored.root);setValue(restored.ledger.records.find(r=>r.address===(saved.presentation?.selectedAddress??restored.root))!.is.value);setPersistent(false);setNotice('Imported and replay-checked in memory. The file supplies history; it does not authenticate external claims.')}
    finally{savingNow.current=false;setSaving(false)}
  })
  const exportStartup=()=>{if(!startupArchive)return;const url=URL.createObjectURL(new Blob([startupArchive],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download='ei-startup-environment.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
  const keepLocally=()=>protect(async()=>{
    if(!ledger)return
    storage.current??=createEILocalStorage({});savingNow.current=true;setSaving(true)
    try{const stored=await storage.current.compareAndStore(null,{root:root.current,revision:0,json:saveEISession(root.current,ledger,proposal,attempts)});storageRevision.current=stored.revision;setPersistent(true);setNotice('Local browser write and readback matched. Reload recovery is available.')}
    finally{savingNow.current=false;setSaving(false)}
  })
  if(!open)return null
  return <div className="ei-model-layer" role={onClose?"dialog":"main"} aria-modal={onClose?true:undefined} aria-label="EI conversation and addressed state" ref={panel} onKeyDown={event=>{
    if(event.key==='Escape'&&workspaceOpen&&!saving&&!execution&&!proposal){event.preventDefault();setWorkspaceOpen(false);return}
    if(event.key==='Escape'&&onClose){event.preventDefault();void dismiss()}
    if(event.key==='Tab'&&(onClose||workspaceOpen||execution||proposal)){const scope=panel.current!.querySelector<HTMLElement>('.ei-field-workspace:not([hidden])')??panel.current!;const list=[...scope.querySelectorAll<HTMLElement>('button,input,textarea,select,a[href],[tabindex],summary')].filter(e=>e.tabIndex>=0&&!e.hasAttribute('disabled')&&!e.closest('[hidden],[inert],fieldset[disabled]')&&e.getClientRects().length>0);if(list.length&&event.shiftKey&&(document.activeElement===list[0]||document.activeElement===scope)){event.preventDefault();list.at(-1)?.focus()}else if(list.length&&!event.shiftKey&&(document.activeElement===list.at(-1)||document.activeElement===scope)){event.preventDefault();list[0]?.focus()}}
  }}>
    {environmentInitializing&&<EIEnvironmentBootstrap onFailure={setError} ledger={ledger??publicContext} address={ledger?selected:publicAddress} revision={ledger?(selectedRevision??record?.is.revision??0):0} onReturn={stageEnvironment} onState={state=>{setEnvironmentStatus(state);if(state!=='reading local environment')setEnvironmentInitializing(false)}} onSavedState={stored=>{if(active.current||liveOperation.current.proposal||liveOperation.current.execution)throw new Error('Field changed before saved state returned');restoreStoredField(stored)}} onRejectedReturn={receipt=>setAttempts(items=>items.some(item=>item.transactionId===`environment/${receipt.value.requestId}`)?items:[...items,{transactionId:`environment/${receipt.value.requestId}`,producer:receipt.scope.address,phase:'engine',message:'Environment returned to a changed initialization context',detail:receipt.raw,committed:false}])}/>}
    <EIFieldArray activity={{state:services.error?'local delivery failed':services.pending?'delivering addressed state':execution?'checking return':proposal?'proposed':environmentStatus==='reading local environment'?environmentStatus:'idle',environment:(()=>{const source=(ledger??publicContext).records.find(record=>record.address===EI_ENVIRONMENT_ADDRESS)?.is.source;if(source?.realm!=='homebase-runtime-observation')return undefined;try{const value=JSON.parse(source.text);return typeof value.platform?.os==='string'?`${value.platform.os} · process ${value.platform.architecture}`:undefined}catch{return undefined}})(),operation:execution?.proposal.candidates[0]?.candidate.label??proposal?.candidates[0]?.candidate.label??null,result:(ledger??publicContext).receipts.at(-1)?.status??null}} initialPresentation={presentation} onSnapshot={read=>{presentationReader.current=read}} key={`${ledger?root.current:EI_DEVICE_ROOT}:${presentationEpoch}`} ledger={sceneLedger} sourceAddress={ledger?root.current:EI_DEVICE_ROOT} address={ledger?selected:publicAddress} revision={ledger?selectedRevision:0} grain={grain} disabled={saving||!!execution||!!proposal} contextLabel={ledger?undefined:'Device encounter workspace'} workspaceOpen={workspaceOpen||!backgroundExecution&&(!!execution||!!proposal)} onCloseWorkspace={()=>setWorkspaceOpen(false)} onChooseZero={address=>{if(!ledger){setPublicAddress(address);return}setSelected(address);setTarget(address);setValue(ledger.records.find(item=>item.address===address)?.is.value??'')}} onReaddress={address=>{if(!ledger){setPublicAddress(address);return}if(address!==selected){setSelected(address);setTarget(address);setValue(ledger.records.find(item=>item.address===address)?.is.value??'')}}} onSelect={address=>{setWorkspaceOpen(true);if(!ledger){setPublicAddress(address);return}if(address!==selected){setSelected(address);setTarget(address);setValue(ledger.records.find(item=>item.address===address)?.is.value??'')}if(inspector.current)inspector.current.open=true}}>
    <EIGuidance ledger={workspaceLedger} address={ledger?selected:publicAddress} disabled={saving||!!execution||!!proposal||!!historical} onStage={stageField}/>
    <EIEnvironmentObservation ledger={workspaceLedger} address={ledger?selected:publicAddress} revision={ledger?(selectedRevision??record?.is.revision??0):0} disabled={saving||!!execution||!!proposal||!!historical} onStage={stageField}/>
    <EIPublicSync ledger={workspaceLedger} address={ledger?selected:publicAddress} revision={ledger?(selectedRevision??record?.is.revision??0):0} disabled={saving||!!execution||!!proposal||!!historical} onStage={stageField}/>
    <EIDeviceWorkspace onInspect={address=>{if(!ledger){setPublicAddress(address);return}setSelected(address);setTarget(address);setValue(ledger.records.find(record=>record.address===address)?.is.value??'')}} ledger={ledger??publicContext} address={ledger?selected:publicAddress} revision={ledger?(selectedRevision??record?.is.revision??0):0} disabled={saving||!!execution||!!proposal||!!historical} onStage={stageField}/>
    <EIPhoneInputControl address={ledger?selected:publicAddress} revision={ledger?(selectedRevision??record?.is.revision??0):0} sourceId={ledger?selectedState?.source.id:publicContext.records.find(record=>record.address===publicAddress)?.is.source.id} retained={(ledger?.records??[]).flatMap(record=>{const state=record.was[0]??record.is;if(state.source.realm!=='android-explicit-intent')return [];const receipt=ledger?.receipts.find(item=>item.status==='committed'&&item.patches.some(patch=>patch.kind==='create'&&patch.address===record.address&&patch.source.id===state.source.id&&patch.value===state.value));if(!receipt)return [];try{const metadata=JSON.parse(state.source.locator??'');return typeof metadata.utf8Sha256==='string'?[{id:state.source.id,utf8Sha256:metadata.utf8Sha256,receiptId:receipt.id}]:[]}catch{return []}})} used={(ledger?.records??[]).flatMap(record=>{const source=(record.was[0]??record.is).source;return source.realm==='android-explicit-intent'?[source.id]:[]})} disabled={saving||!!execution||!!proposal||!!phoneInput} onChoose={input=>{const at=ledger?selectedState:projectEIGrain(createEIGrainRegistry(publicContext),publicAddress,grain,0);setPhoneInput(Object.freeze({...input,fieldScope:Object.freeze({address:ledger?selected:publicAddress,revision:ledger?(selectedRevision??record?.is.revision??0):0,sourceId:ledger?selectedState?.source.id??'':at&&'state' in at?at.state.source.id:''})}))}}/>
    <EIPhoneOverlay address={ledger?selected:publicAddress} revision={ledger?(selectedRevision??record?.is.revision??0):0} disabled={saving||!!execution||!!proposal}/>
    <EIPhoneMedia address={ledger?selected:publicAddress} revision={ledger?(selectedRevision??record?.is.revision??0):0} disabled={saving||!!execution||!!proposal} retained={(ledger?.records??[]).map(record=>record.was[0]??record.is).filter(state=>state.source.realm==='android-explicit-media-descriptor').map(state=>state.source.id)} onRetain={retainMedia}/>
    <EIPhoneBridge address={ledger?selected:publicAddress} revision={ledger?(selectedRevision??record?.is.revision??0):0} disabled={saving||!!execution||!!proposal}/>
    {notice&&<p className="ei-notice" role="status">{notice}</p>}{error&&<p className="ei-error" role="alert">{error}</p>}
    {!ledger?<section className="ei-capture"><h2>Start a conversation</h2>{phoneInput&&<details><summary>Staged phone source · {phoneInput.id}</summary><pre>{phoneInput.text}</pre><button disabled={saving} onClick={()=>{setRaw(phoneInput.text);setCaptureOrigin(phoneInput);setPhoneInput(null)}}>{raw?'Replace first input with this source':'Use source as first input'}</button></details>}<label>Source address<input disabled={saving||!!execution||!!proposal} value={rootAddress} onChange={e=>setRootAddress(e.target.value)}/></label><label>First message<textarea disabled={saving||!!execution||!!proposal} value={raw} onChange={e=>setRaw(e.target.value)} rows={6}/></label><label><input disabled={saving} type="checkbox" checked={includeModel} onChange={event=>setIncludeModel(event.target.checked)}/> Include the public fracture model definitions and relations</label><label><input disabled={saving||!!execution||!!proposal} type="checkbox" checked={persistent} onChange={e=>setPersistent(e.target.checked)}/> Keep this EI ledger on this browser, unencrypted</label><button onClick={capture} disabled={!rootAddress||!raw||saving}>Start conversation</button>{preparingCapture&&<button onClick={()=>captureAbort.current?.abort()}>Cancel preparation</button>}<button onClick={restore} disabled={saving}>Restore saved local ledger</button><label>Import exported session<input type="file" accept="application/json,.json" disabled={saving} onChange={event=>{const file=event.currentTarget.files?.[0];event.currentTarget.value='';if(file)void importSession(file)}}/></label><p>No entered content is sent to a server. Input is not automatically a command, fact or approved NEXT. {persistent?'Local browser storage is selected; do not enter secrets.':'This session uses memory only.'}</p></section>:<><EIConversation onPhoneInputUsed={()=>setPhoneInput(null)} phoneInput={phoneInput} ledger={ledger} root={root.current} disabled={saving||!!execution||!!proposal} nextId={()=>`local-proposal/${++sequence.current}`} onStage={stageChat} onInspect={address=>{setSelected(address);setTarget(address);setValue(ledger.records.find(r=>r.address===address)?.is.value??'');if(inspector.current){inspector.current.open=true;inspector.current.scrollIntoView({block:'start'})}}}/><details ref={inspector} className="ei-inspector"><summary>Inspect addressed memory, gates and explicit continuations</summary><fieldset className="ei-workspace" disabled={saving||!!execution}>
      <section aria-label="Addressed grain map"><h2>Addressed grains · revision {ledger.revision}</h2><label>Mechanism grain<select aria-label="Mechanism grain" value={grain} onChange={event=>setGrain(event.target.value as EIGrain)}>{EI_GRAINS.map(item=><option key={item}>{item}</option>)}</select></label><p>{selectedState?.entity.address} · {grain} · revision {selectedState?.revision}. One addressed entity; numeric placement unbound.</p>{record&&selectedState&&<nav aria-label="Retained state navigation"><button disabled={!!proposal||stateHistory.index<=0} onClick={()=>moveState(-1)}>Previous inspected state</button><button disabled={!!proposal||stateHistory.index>=stateHistory.items.length-1} onClick={()=>moveState(1)}>Next inspected state</button><label>Retained revision<select aria-label="Retained revision" disabled={!!proposal} value={selectedState.revision} onChange={event=>inspectRevision(Number(event.target.value))}>{[...record.was,record.is].map(state=><option key={state.revision} value={state.revision}>{state===record.is?'IS':'WAS'} · revision {state.revision}</option>)}</select></label><button disabled={!!proposal||!historical} onClick={()=>inspectRevision(record.is.revision)}>Current IS</button><span>{historical?'Inspecting retained WAS · read only':'Inspecting current IS'}</span></nav>}<label>IS equals<input value={filterValue} onChange={event=>{filterRequest.current++;setFilterValue(event.target.value);setFilterResult(null)}}/></label><button disabled={filterBusy} onClick={filterField}>Filter field addresses</button>{filterResult&&filterOrigin.current===ledger&&<section aria-label="Field filter results"><h3>Filter · {filterResult.status}</h3>{filterResult.answer?<><p>{filterResult.answer.matches.length} matching addresses · revision {filterResult.answer.origin.ledgerRevision} · check {filterResult.verification?.status}</p>{filterResult.answer.matches.map((match,index)=><article key={`${match.address}:${index}`}><button disabled={!!proposal} onClick={()=>{if(filterOrigin.current!==active.current)return;setSelected(match.address);setTarget(match.address);setValue(match.value);setCreateChild(false);setBranchSource(null);setProposal(null)}}>{match.address}</button><pre>{match.value}</pre></article>)}{filterResult.answer.unknowns.map((unknown,index)=><p key={index}>{unknown.address}: {unknown.reason}</p>)}<details><summary>Source and check record</summary><pre>{JSON.stringify({query:filterResult.query,proof:filterResult.answer.proof,verification:filterResult.verification?presentEICheck(filterResult.verification):null},null,2)}</pre></details></>:<p role="status">{filterResult.code}</p>}</section>}
        <details><summary>All retained address records</summary><div className="ei-grains">{ledger.records.map(node=><button key={node.address} className="ei-grain" disabled={!!proposal} aria-pressed={selected===node.address} onClick={()=>{setSelected(node.address);setTarget(node.address);setValue(node.is.value);setCreateChild(false);setBranchSource(null);setProposal(null)}}>
          <svg viewBox="0 0 160 125" aria-hidden="true"><path d="M80 12L17 104L145 98ZM80 12L87 74L17 104M87 74L145 98" fill="none" stroke="currentColor"/><text x="80" y="10" textAnchor="middle">NEXT</text><text x="4" y="119">WAS</text><text x="136" y="119">IS</text><circle cx="87" cy="74" r="4"/></svg>
          <strong>{node.address}</strong><span>IS · {node.is.value}</span><small>{node.parents.length?`from ${node.parents.join(', ')}`:'root source'}</small>
        </button>)}</div></details>
        {record&&<article className="ei-state"><h3>{record.address}</h3><dl><dt>{selectedState?.role} · revision {selectedState?.revision}</dt><dd><pre>{selectedState?.value}</pre></dd><dt>Source</dt><dd>{selectedState?.source.id}</dd></dl><details><summary>Exact retained source and scope</summary><pre>{JSON.stringify(selectedState?.source,null,2)}</pre></details>{!historical&&<EIAddressRelations onStage={stageField} ledger={ledger} address={record.address} grain={grain} disabled={!workspaceOpen||saving||!!execution||!!proposal} onSelect={address=>{setSelected(address);setTarget(address);setValue(ledger.records.find(item=>item.address===address)!.is.value);setCreateChild(false);setBranchSource(null)}}/>}<button disabled={historical} onClick={()=>setGateVisible(v=>!v)}>{gateVisible?'Hide':'Inspect'} moment gate</button><p>Producing and returned receipt addresses: {ledger.receipts.filter(receipt=>receipt.producer===record.address||receipt.patches.some(patch=>patch.address===record.address)).map(receipt=>receipt.id).join(', ')||'Initial captured source'}</p>{record.was.map((past,index)=><button key={index} disabled={!!proposal||historical} onClick={()=>{setCreateChild(true);setTarget(`${selected}/branch-${sequence.current+1}`);setValue(past.value);setBranchSource(`${selected}#was/${index}`)}}>Branch from WAS revision {past.revision}</button>)}</article>}{record&&!historical&&gateVisible&&<EIRecordGate ledger={ledger} address={record.address} proposal={proposal}/>}
      </section>
      <fieldset disabled={historical}><section aria-label="Allowed continuations"><h2>Choose a continuation</h2><p>Conditions compare exact retained text. They do not decide natural-language truth.</p>
        <label><input disabled={saving||!!execution||!!proposal} type="checkbox" checked={createChild} onChange={e=>{setCreateChild(e.target.checked);setTarget(e.target.checked?`${selected}/child`:selected);setProposal(null)}}/> Add an addressed child grain</label>
        <label>Target address<input disabled={saving||!!execution||!!proposal} value={target} onChange={e=>{setTarget(e.target.value);setProposal(null)}}/></label>
        <label>Proposed value<textarea disabled={saving||!!execution||!!proposal} rows={4} value={value} onChange={e=>{setValue(e.target.value);setBranchSource(null);setProposal(null)}}/></label>
        <label><input disabled={saving||!!execution||!!proposal} type="checkbox" checked={useAlternative} onChange={e=>{setUseAlternative(e.target.checked);setProposal(null)}}/> Keep a second alternative</label>
        {useAlternative&&<label>Alternative value<textarea disabled={saving||!!execution||!!proposal} value={alternative} onChange={e=>{setAlternative(e.target.value);setProposal(null)}}/></label>}
        {(useAlternative?[0,1]:[0]).map(choice=><fieldset key={choice} disabled={saving||!!execution||!!proposal}><legend>Choice {choice+1} · supplied conditions</legend>{choiceConditions[choice].map((condition,index)=><div key={index}><label>Condition address<input value={condition.address} onChange={event=>setChoiceConditions(current=>current.map((list,at)=>at===choice?list.map((item,i)=>i===index?{...item,address:event.target.value}:item):list))}/></label><label>Expected IS<input value={condition.equals} onChange={event=>setChoiceConditions(current=>current.map((list,at)=>at===choice?list.map((item,i)=>i===index?{...item,equals:event.target.value}:item):list))}/></label><button onClick={()=>setChoiceConditions(current=>current.map((list,at)=>at===choice?list.filter((_,i)=>i!==index):list))}>Remove condition</button></div>)}<button onClick={()=>setChoiceConditions(current=>current.map((list,at)=>at===choice?[...list,{address:selected,equals:''}]:list))}>Add condition to Choice {choice+1}</button></fieldset>)}
        <label><input disabled={saving||!!execution||!!proposal} type="checkbox" checked={automatic} onChange={e=>{setAutomatic(e.target.checked);setProposal(null)}}/> Allow the engine to select a uniquely allowed continuation</label>
        <button disabled={!!execution||!!proposal} onClick={prepare}>Filter proposed continuations</button>
        {proposal&&<article><h3>{proposal.status}</h3><p>Pending source: {proposal.input.producer}. Cancel this snapshot before editing its draft.</p>{proposal.candidates.map(item=><div key={item.candidate.id}><strong>{item.candidate.label}</strong><pre>{item.candidate.patches.map(p=>`${p.address}\n${p.value}`).join('\n')}</pre><p>{item.reasons.join('; ')||(item.candidate.conditions.length?'Supplied conditions matched':'No conditions supplied')}</p><button disabled={!item.allowed||item.unresolved||!!execution} onClick={()=>perform(item.candidate.id)}>Select {item.candidate.label} and execute</button></div>)}{proposal.status==='ready'&&<button onClick={()=>perform()} disabled={!!execution}>Execute unique continuation</button>}<button onClick={()=>protect(async()=>{await cancel()})}>Cancel proposal</button></article>}
      </section></fieldset>
    </fieldset></details></>}
    {execution&&<section ref={stage} className="ei-staged" aria-label="Staged output readback"><h2>Complete staged output · not committed</h2>{sharedTransition.projection?<EITransitionView projection={sharedTransition.projection} readback/>:<p role="alert">{sharedTransition.error}</p>}{execution.expected.map(item=><article key={item.address}><strong>{item.address}</strong><pre data-readback-address={item.address}>{item.value}</pre></article>)}</section>}
    {ledger&&<section className="ei-receipts"><h2>Returned receipts</h2><details><summary>Local overlay services</summary><p data-service-scene={services.scene.eventId??'initial-read'} data-service-workspace={services.workspace.eventId??'initial-read'}>Renderer revision {services.scene.ledger.revision} · workspace revision {services.workspace.ledger.revision}</p>{services.error&&<><p role="alert">{services.error}</p><button onClick={services.retry} disabled={isSaving}>Retry retained deliveries</button></>}<pre>{JSON.stringify(services.inspect()?.outbox??[],null,2)}</pre></details>{startupArchive&&<button onClick={exportStartup} disabled={saving}>Export retained startup environment</button>}{ledger===startupLedger.current&&startupArchive&&<label>Import exported session<input type="file" accept="application/json,.json" disabled={saving||!!proposal||!!execution} onChange={event=>{const file=event.currentTarget.files?.[0];event.currentTarget.value='';if(file)void importSession(file)}}/></label>}<button onClick={exportSession} disabled={saving||!!execution}>Export local session</button>{!persistent&&<button onClick={keepLocally} disabled={saving||!!execution}>Keep this ledger locally, unencrypted</button>}<p>{persistent?`Durable local generation ${storageRevision.current}`:'Memory-only session'}</p>{ledger.receipts.length?ledger.receipts.map((receipt,index)=><details key={index}><summary>Receipt {index+1} · {receipt.status}</summary><pre>{JSON.stringify(receipt,null,2)}</pre><button onClick={()=>setInspectedReceipt(value=>value===receipt.id?null:receipt.id)}>{inspectedReceipt===receipt.id?'Hide':'Reconstruct'} shared transition</button>{inspectedReceipt===receipt.id&&<EIReceiptTransition ledger={ledger} receiptId={receipt.id}/>}</details>):<p>No model update has been committed.</p>}{attempts.map((receipt,index)=><details key={`attempt-${index}`}><summary>Uncommitted attempt {index+1} · {receipt.phase}</summary><pre>{JSON.stringify(receipt,null,2)}</pre></details>)}</section>}
    {onClose&&<button ref={closeButton} disabled={saving} onClick={dismiss}>Close EI model</button>}
    </EIFieldArray>
  </div>
}
