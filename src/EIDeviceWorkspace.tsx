import {readEIDeviceEncounter,deviceEncounterRows,liveDeviceFolders} from './model/ei-device-encounter'
import type {EncounterOp} from './model/ei-device-encounter-types'
import {useRef,useState,useEffect} from 'react'
import type {EILedger,EIProposal} from './model/ei-engine'
import {EI_DEVICE_KINDS,proposeEIDeviceEncounter,proposeEIDeviceWorkspace,type EIDeviceEncounter} from './model/ei-device-field'
import {describeEIBrowserFiles} from './model/ei-browser-encounter'
import {readEIPhoneReturn} from './model/ei-phone-return'
export function EIDeviceWorkspace({ledger,address,revision,disabled,onStage,onInspect}:{ledger:EILedger;address:string;revision:number;disabled:boolean;onStage:(proposal:EIProposal)=>void;onInspect:(address:string)=>void}){
 const [encounters,setEncounters]=useState<readonly EIDeviceEncounter[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false)
 const [nativeReturn,setNativeReturn]=useState<Awaited<ReturnType<typeof readEIDeviceEncounter>>|null>(null),[pending,setPending]=useState<{id:string;address:string;revision:number}|null>(null)
 const serial=useRef(0),requestBusy=useRef(false),mountedScope=useRef({address,revision});mountedScope.current={address,revision}
 const native=typeof window!=='undefined'&&window.location.origin==='https://appassets.androidplatform.net'
 const category=EI_DEVICE_KINDS.find(kind=>address===`device/${kind}`||address.startsWith(`device/${kind}/`))
 const requestNative=async(op:EncounterOp,params:{targetRequestId?:string;encounterId?:string}={},scope={address,revision})=>{if(requestBusy.current)return;requestBusy.current=true;setBusy(true);setError('');try{const result=await readEIDeviceEncounter(scope,window.location.origin,crypto.randomUUID(),op,params);setNativeReturn(result);const action=result.value.action;if(action?.state==='pending')setPending({id:action.requestId,address:action.address,revision:action.revision});else setPending(null);if(action?.state==='returned')setEncounters(deviceEncounterRows(result))}catch(reason){setError(String(reason));setPending(null)}finally{requestBusy.current=false;setBusy(false)}}
 useEffect(()=>{if(!pending||busy)return;const timer=setTimeout(()=>{if(!document.hidden)void requestNative('status',{targetRequestId:pending.id},{address:pending.address,revision:pending.revision})},500);const wake=()=>{if(!document.hidden)void requestNative('status',{targetRequestId:pending.id},{address:pending.address,revision:pending.revision})};document.addEventListener('visibilitychange',wake);return()=>{clearTimeout(timer);document.removeEventListener('visibilitychange',wake)}},[pending,busy])
 const retain=(item:EIDeviceEncounter)=>{setError('');try{if(item.producer.address!==address||item.producer.revision!==revision)throw new Error('Return belongs to a previous selected state');const next=proposeEIDeviceEncounter(ledger,item,`device-retain/${crypto.randomUUID()}`);if(next)onStage(next)}catch(reason){setError(String(reason))}}
 const readHardware=async()=>{if(requestBusy.current)return;requestBusy.current=true;setBusy(true);setError('');const scope={address,revision};try{
  const id=crypto.randomUUID(),result=await readEIPhoneReturn(scope,window.location.origin,id)
  if(result.check.status!=='os-metadata-return')throw new Error('Hardware metadata is unavailable')
  const value=result.value as Record<string,unknown>,rows:EIDeviceEncounter[]=[]
  for(const key of ['osReportedFeatures','osReportedSensorMetadata','installedManifestPermissions'])for(const [index,row] of (value[key] as unknown[]).entries()){
   const item=row&&typeof row==='object'?row as Record<string,unknown>:null
   rows.push({id:`${id}:${rows.length}`,kind:'hardware',label:String(item?.name??item?.permission??row??key).slice(0,160),sourceText:JSON.stringify(row),realm:'android-os-metadata-return',locator:JSON.stringify({requestId:id,pointer:`/${key}/${index}`,observationScope:value.observationScope}),producer:scope})
  }
  setEncounters(rows)
 }catch(reason){setError(String(reason))}finally{requestBusy.current=false;setBusy(false)}}
 const browserSoftware=()=>{const id=crypto.randomUUID(),value={environment:'browser',userAgent:navigator.userAgent,language:navigator.language,scope:'current-browser-reported-context',installedApplicationsEnumerated:false};setEncounters([{id,kind:'software',label:'Current browser',sourceText:JSON.stringify(value),realm:'browser-runtime-metadata',locator:JSON.stringify({observation:'explicit-current-runtime-read'}),producer:{address,revision}}])}
 const files=(list:FileList|null,folder:boolean)=>{if(!list)return;try{setError('');setEncounters(describeEIBrowserFiles(Array.from(list),{address,revision},`browser-${++serial.current}-${crypto.randomUUID()}`,folder))}catch(reason){setError(String(reason))}}
 if(address!=='device'&&!category)return <button disabled={disabled} onClick={()=>{try{const next=proposeEIDeviceWorkspace(ledger,address,`device-workspace/${crypto.randomUUID()}`);if(next)onStage(next);else onInspect('device')}catch(reason){setError(String(reason))}}}>Device opportunities{error&&<small>{error}</small>}</button>
 return <section aria-label="Device encounters" data-device-category={category??'root'}>
  {(category==='hardware'||address==='device')&&<button disabled={disabled||busy||!native} onClick={readHardware}>Observe hardware</button>}
  {(category==='software'||address==='device')&&!native&&<button disabled={disabled||busy} onClick={browserSoftware}>Observe this browser</button>}
  {(category==='files'||address==='device')&&!native&&<label>Choose files<input type="file" multiple disabled={disabled||busy} onChange={event=>{files(event.currentTarget.files,false);event.currentTarget.value=''}}/></label>}
  {(category==='folders'||address==='device')&&!native&&<label>Choose a folder<input type="file" multiple {...{webkitdirectory:''}} disabled={disabled||busy} onChange={event=>{files(event.currentTarget.files,true);event.currentTarget.value=''}}/></label>}
  {native&&(category==='software'||address==='device')&&<button disabled={disabled||busy||!!pending} onClick={()=>requestNative('software')}>Observe app and renderer</button>}
  {native&&(category==='files'||address==='device')&&<button disabled={disabled||busy||!!pending} onClick={()=>requestNative('pick-file')}>Choose file</button>}
  {native&&(category==='folders'||address==='device')&&<><button disabled={disabled||busy||!!pending} onClick={()=>requestNative('pick-folder')}>Choose folder</button><small>Android grants access to the selected subtree. This reads its metadata; listing children is separate.</small></>}
  {nativeReturn&&<><small>{nativeReturn.value.action?.code??nativeReturn.value.code}</small>{liveDeviceFolders(nativeReturn).map(folder=><button key={folder.encounterId} disabled={disabled||busy||!!pending} onClick={()=>requestNative('list-children',{encounterId:folder.encounterId})}>Open {folder.displayName??'folder'} children</button>)}{nativeReturn.value.action?.result&&'truncated' in nativeReturn.value.action.result&&(nativeReturn.value.action.result.truncated||nativeReturn.value.action.result.providerLoading)&&<small>Partial provider return</small>}</>}
  {pending&&<button disabled={busy} onClick={()=>requestNative('cancel',{targetRequestId:pending.id},{address:pending.address,revision:pending.revision})}>Cancel encounter</button>}
  {!native&&category==='hardware'&&<small>Hardware metadata requires the Android carrier</small>}
  {encounters.length>0&&<small>{encounters.length} returned entries · metadata only</small>}
  {encounters.map(item=><article key={item.id}><button disabled={disabled||busy||item.producer.address!==address||item.producer.revision!==revision} onClick={()=>retain(item)}>{item.label}</button><details><summary>Source</summary><pre>{item.sourceText}</pre></details></article>)}
  {error&&<p role="alert">{error}</p>}
 </section>
}
