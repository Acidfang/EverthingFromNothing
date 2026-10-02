import {useRef,useState} from 'react'
import {EIFieldAction} from './EIFieldAction'
import {readEIPhoneReturn,phoneReturnMatches,type PhoneScope} from './model/ei-phone-return'
export function EIPhoneBridge({address,revision,disabled}:{address:string;revision:number;disabled:boolean}){
 const [result,setResult]=useState<Awaited<ReturnType<typeof readEIPhoneReturn>>|null>(null),[error,setError]=useState(''),[busyScope,setBusyScope]=useState<PhoneScope|null>(null)
 const pending=useRef(false),busy=busyScope!==null
 const supported=typeof window!=='undefined'&&window.location.origin==='https://appassets.androidplatform.net'
 const read=async()=>{if(pending.current||!supported)return;pending.current=true;setBusyScope({address,revision});setError('');try{setResult(await readEIPhoneReturn({address,revision},window.location.origin,crypto.randomUUID()))}catch(reason){setError(reason instanceof Error?reason.message:String(reason))}finally{pending.current=false;setBusyScope(null)}}
 const current=result&&phoneReturnMatches(result.scope,{address,revision})?result:null
 return <section aria-label="Phone return at selected field address" data-field-address={address} data-field-revision={revision}>
  <EIFieldAction address={address} revision={revision} operation="phone.capabilities.read" label={busy?'Reading phone metadata':'Read phone capabilities'} hint="Read" disabled={disabled||busy||!supported} pending={!!busyScope&&phoneReturnMatches(busyScope,{address,revision})} presented={!!current} onClick={read} form={{kind:'source-return',source:{id:address,label:'Field',address,revision},destination:{id:'native:capabilities',label:'Capabilities'},...(current?{returned:{id:current.requestId,label:'Metadata',address:current.scope.address,revision:current.scope.revision,status:current.check.status,value:JSON.stringify(current.value)}}:{})}}/>
  {error&&<p role="alert">{error}</p>}
  {result&&<div><p>{result.scope.address} · revision {result.scope.revision} · {result.check.status}{!phoneReturnMatches(result.scope,{address,revision})?' · retained return for previous selection':''}</p><p>{result.check.featureCount??'?'} OS-reported features · {result.check.sensorMetadataCount??'?'} sensor metadata records</p><details><summary>Returned phone metadata</summary><pre>{JSON.stringify(result.value,null,2)}</pre></details></div>}
 </section>
}
