import {chooseMediaDiscard,confirmMediaDiscard,type MediaDiscardChoice} from './model/ei-media-discard'
import {mediaActionBinding as binding,matchesMediaActionReturn} from './model/ei-media-presentation'
import {sameEIMediaDescriptor} from './model/ei-media-retention'
import {useEffect,useRef,useState} from 'react'
import {EIFieldAction} from './EIFieldAction'
import {readEIPhoneMedia,type MediaSource,type MediaReceipt,type MediaOperation} from './model/ei-phone-media'
type Scope={address:string;revision:number}
const same=(a:Scope,b:Scope)=>a.address===b.address&&a.revision===b.revision
export function EIPhoneMedia({address,revision,disabled,retained,onRetain}:{address:string;revision:number;disabled:boolean;retained:readonly string[];onRetain:(source:MediaSource)=>Promise<void>}){
 const [receipt,setReceipt]=useState<MediaReceipt|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[timestamp,setTimestamp]=useState('0')
 const [discard,setDiscard]=useState<MediaDiscardChoice|null>(null)
 useEffect(()=>setDiscard(null),[address,revision])
 const pending=useRef(false),mounted=useRef(true),poll=useRef<ReturnType<typeof setTimeout>|null>(null),generation=useRef(0),resumePoll=useRef<(()=>void)|null>(null)
 const issued=useRef(new Map<string,string>())
 const liveScope=useRef({address,revision});liveScope.current={address,revision}
 const supported=typeof window!=='undefined'&&window.location.origin==='https://appassets.androidplatform.net'
 useEffect(()=>{mounted.current=true;const visible=()=>{if(!document.hidden){if(poll.current)clearTimeout(poll.current);resumePoll.current?.()}};document.addEventListener('visibilitychange',visible);return()=>{mounted.current=false;generation.current++;resumePoll.current=null;if(poll.current)clearTimeout(poll.current);document.removeEventListener('visibilitychange',visible)}},[])
 const call=async(op:MediaOperation,params:Record<string,string>={},scope:Scope={address,revision})=>{
  if(pending.current||!supported)return;pending.current=true;setBusy(true);setError('');const token=++generation.current;resumePoll.current=null;if(poll.current)clearTimeout(poll.current)
  try{
   const requestId=crypto.randomUUID();issued.current.set(requestId,binding(op,params,scope));while(issued.current.size>64)issued.current.delete(issued.current.keys().next().value!);const result=await readEIPhoneMedia(scope,window.location.origin,requestId,op,params);if(!mounted.current)return;setReceipt(result)
   const action=result.value.action
   if(action?.state==='pending'){
    let observing=false
    const observe=async()=>{if(!mounted.current||generation.current!==token||document.hidden||observing)return;observing=true;try{const update=await readEIPhoneMedia(scope,window.location.origin,crypto.randomUUID(),'status',{targetRequestId:action.requestId});if(!mounted.current||generation.current!==token)return;setReceipt(update);if(update.value.action?.state==='pending')poll.current=setTimeout(observe,1000);else resumePoll.current=null}catch(reason){if(mounted.current)setError(String(reason))}finally{observing=false}}
    resumePoll.current=()=>{void observe()};poll.current=setTimeout(observe,500)
   }
  }catch(reason){if(mounted.current)setError(reason instanceof Error?reason.message:String(reason))}finally{pending.current=false;if(mounted.current)setBusy(false)}
 }
 const retain=async(source:MediaSource)=>{
  if(pending.current||disabled)return;pending.current=true;setBusy(true);setError('')
  try{const fresh=await readEIPhoneMedia(source,window.location.origin,crypto.randomUUID(),'status');if(!mounted.current)return;setReceipt(fresh);if(!same(source,liveScope.current))throw new Error('Selected field changed before source retention');const current=fresh.value.sources.find(item=>item.id===source.id);if(!current||!sameEIMediaDescriptor(current,source))throw new Error('Native source changed or is no longer available');await onRetain(current)}catch(reason){if(mounted.current)setError(String(reason))}finally{pending.current=false;if(mounted.current)setBusy(false)}
 }
 const snapshot=receipt?.value,action=snapshot?.action,scope={address,revision},active=!!snapshot?.activeRequestId
 const sources=snapshot?.sources??[]
 const control=(op:MediaOperation,label:string,hint:string,unavailable=false,params:Record<string,string>={},target=scope)=><EIFieldAction key={`${op}:${params.sourceId??''}`} address={target.address} revision={target.revision} operation={`phone.media.${op}`} label={label} hint={hint} disabled={disabled||busy||!supported||unavailable} onClick={()=>void call(op,params,target)} form={{kind:'source-return',source:{id:params.sourceId??target.address,label:'Field',address:target.address,revision:target.revision,value:JSON.stringify(params)},destination:{id:`native:media:${op}`,label},...(matchesMediaActionReturn(action,issued.current,op,params,target)?{returned:{id:action!.requestId,label:'Return',address:target.address,revision:target.revision,status:action!.code}}:{})}}/>
 return <section aria-label="Video voice and movement at selected field" data-field-address={address} data-field-revision={revision}>
  <div className="ei-media-actions">{control('pick-video','Choose local video','Video',active)}{snapshot?.microphonePermission==='granted'?control('record-voice','Record local voice, up to 15 seconds','Record',active):control('request-microphone','Ask Android for microphone access; this does not record','Microphone',active)}{control('sample-motion','Observe movement for two seconds','Movement',active)}</div>
  {!supported&&<small>Android carrier required</small>}
  {snapshot?.microphonePermission!=='granted'&&supported&&<small>Microphone access is requested separately. Recording begins only when you choose Record.</small>}
  {action?.state==='pending'&&<div>{action.stage==='recording'&&control('stop-voice','Stop and retain recording','Stop',false,{targetRequestId:action.requestId},action)}{control('cancel','Cancel pending capture','Cancel',false,{targetRequestId:action.requestId},action)}</div>}
  {control('status','Read retained local media','Sources',false,action?.state==='pending'?{targetRequestId:action.requestId}:{},action?.state==='pending'?action:scope)}
  {error&&<p role="alert">{error}</p>}{action&&<small>{action.state} · {action.code}</small>}
  {sources.map(source=><article key={source.id} data-native-media-source={source.id}><strong>{source.kind}</strong><small>{source.address} · {source.revision}</small>
   {source.kind==='video'&&<><video controls preload="none" src={source.contentUrl}/><label>Frame position (microseconds)<input inputMode="numeric" value={timestamp} onChange={event=>setTimestamp(event.target.value)}/></label>{control('video-frame','Read nearby video frame','Frame',active||!/^\d+$/.test(timestamp),{sourceId:source.id,sourceSha256:source.sha256,timestampUs:timestamp},source)}</>}
   {source.kind==='video-frame'&&<img alt={`Returned video frame requested at ${String(source.metadata.requestedTimestampUs)} microseconds`} src={source.contentUrl}/>}
   {source.kind==='voice'&&<audio controls preload="none" src={source.contentUrl}/>}
   {source.kind==='motion'&&<details><summary>Observed sensor return</summary><pre>{JSON.stringify(source.metadata,null,2)}</pre></details>}
   <EIFieldAction address={source.address} revision={source.revision} operation="phone.media.retain-descriptor" label="Retain returned source in the field" hint={retained.includes(source.id)?'Retained':'Retain'} disabled={disabled||busy||retained.includes(source.id)||!same(source,scope)} onClick={()=>void retain(source)} form={{kind:'source-return',source:{id:source.id,label:source.kind,address:source.address,revision:source.revision,value:source.sha256},destination:{id:source.address,label:'Field',address:source.address,revision:source.revision}}}/>
   <button disabled={disabled||busy||active||!supported} onClick={()=>setDiscard(chooseMediaDiscard(source))}>Remove local {source.retainedOriginal?'original':'frame'}</button>
   {discard?.source.id===source.id&&<div role="group" aria-label="Confirm removal of local media"><p>Delete this {discard.description} from this app? Field history stays. {source.retainedOriginal?'This removes the retained media bytes.':'Only this local frame is deleted.'}</p><button onClick={()=>setDiscard(null)} disabled={busy}>Keep</button><button disabled={disabled||busy||active} onClick={()=>{try{const selected=confirmMediaDiscard(discard,sources);setDiscard(null);void call('discard-source',selected.params,selected.scope)}catch(reason){setError(String(reason));setDiscard(null)}}}>Delete {discard.description}</button></div>}
   <details><summary>Source receipt</summary><pre>{JSON.stringify(source,null,2)}</pre></details>
  </article>)}
 </section>
}
