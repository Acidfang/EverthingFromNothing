import {useEffect,useMemo,useRef,useState} from 'react'
import type {EILedger} from './model/ei-engine'
import {createEIVoiceCall,type EIVoiceTranscript,type EIVoiceEvent,type EIVoiceStatus} from './model/ei-voice-call'
import {browserVoicePlatform} from './model/ei-browser-voice'
import {homebaseVoicePlatform} from './model/ei-homebase-voice'
import {androidVoicePlatform} from './model/ei-android-voice'
import {readEIConversation} from './model/ei-conversation'
import {readGuideSteps,resolveGuideIntentAddress} from './model/ei-guide-steps'
export function EIVoiceCall({ledger,root,address,enabled,onDraft,onTicket,draftPresent=false}:{ledger:EILedger;root:string;address:string;enabled:boolean;draftPresent?:boolean;onDraft:(transcript:EIVoiceTranscript)=>void;onTicket:(event:EIVoiceEvent)=>void}){
 const [status,setStatus]=useState<EIVoiceStatus>('ended'),[transcripts,setTranscripts]=useState<readonly EIVoiceTranscript[]>([]),[events,setEvents]=useState<readonly EIVoiceEvent[]>([]),[language,setLanguage]=useState(navigator.language||'en-US'),[error,setError]=useState('')
 const live=useRef({ledger,onTicket});live.current={ledger,onTicket}
 const call=useMemo(()=>createEIVoiceCall(window.location.origin==='https://homebase.local'?homebaseVoicePlatform(window.location.origin):window.location.origin==='https://appassets.androidplatform.net'?androidVoicePlatform(window.location.origin):browserVoicePlatform(),{state:setStatus,transcript:value=>setTranscripts(items=>[...items,value]),event:value=>{setEvents(items=>[...items.slice(-127),value]);live.current.onTicket(value)}}),[])
 const source=ledger.records.find(record=>record.address===address),scopeKey=JSON.stringify(source?[source.address,source.is.revision,source.is.source.id]:null)
 useEffect(()=>()=>{void call.end('source-context-closed')},[call,scopeKey])
 useEffect(()=>{if(!enabled)call.end('workspace-hidden')},[enabled,call])
 useEffect(()=>{const visibility=()=>{if(document.hidden)call.end('application-hidden')};const blur=()=>call.end('application-unfocused');document.addEventListener('visibilitychange',visibility);window.addEventListener('blur',blur);return()=>{document.removeEventListener('visibilitychange',visibility);window.removeEventListener('blur',blur)}},[call])
 const replies=useMemo(()=>{try{return readEIConversation(ledger,root).turns.filter(turn=>turn.role==='assistant').map(turn=>({address:turn.address,text:turn.currentText,label:'Retained reply'}))}catch{return []}},[ledger,root])
 const guide=useMemo(()=>readGuideSteps(ledger,resolveGuideIntentAddress(ledger,address)).filter(step=>step.status==='available').map(step=>({address:step.address,text:step.action,label:'Available guide step'})),[ledger,address])
 const speak=async(item:{address:string;text:string})=>{try{const record=live.current.ledger.records.find(record=>record.address===item.address);if(!record||record.is.value!==item.text)throw Error('Spoken source changed; choose its current returned text');await call.speak({address:record.address,revision:record.is.revision,sourceId:record.is.source.id},item.text);setError('')}catch(reason){setError(String(reason))}}
 return <details onToggle={event=>{if(!event.currentTarget.open)call.end('voice-view-closed')}}><summary>Voice with guide · {status}</summary><p>On-device speech only. Start opens the microphone; End, hiding this view or leaving the app stops it.</p><label>Speech language<input value={language} disabled={call.active()} onChange={event=>setLanguage(event.target.value)}/></label><button disabled={!enabled||!source||call.active()} onClick={()=>{setError('');setTranscripts([]);void call.start(crypto.randomUUID(),{address:source!.address,revision:source!.is.revision,sourceId:source!.is.source.id},language).catch(reason=>setError(String(reason)))}}>Start voice call</button><button disabled={!call.active()} onClick={()=>call.end()}>End</button><button disabled={!call.active()} onClick={()=>call.mute()}>Mute microphone</button><button disabled={!call.canListen()||status==='checking'||status==='listening'} onClick={()=>call.resume()}>Listen</button>
 {status==='unavailable'&&<p role="status">Installed on-device recognition is unavailable for this language or carrier.</p>}
 {transcripts.map(transcript=><article key={transcript.id}><pre>{transcript.text}</pre><button onClick={()=>onDraft(transcript)}>{draftPresent?'Replace draft with speech':'Use speech in message'}</button></article>)}
 {[...replies,...guide].map(item=><button key={item.address} disabled={!call.active()} onClick={()=>speak(item)}>{item.label}: {item.text.slice(0,80)}</button>)}
 {!replies.length&&!guide.length&&<p>No retained reply or available guide step is bound here.</p>}
 {error&&<p role="alert">{error}</p>}<details><summary>Recent voice source and return events</summary><pre>{JSON.stringify(events,null,2)}</pre></details></details>
}
