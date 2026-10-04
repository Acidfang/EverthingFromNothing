import {useRef,useState,useEffect} from 'react'
import type {EILedger,EIProposal} from './model/ei-engine'
import {readHomebaseEnvironment,proposeHomebaseEnvironment} from './model/ei-homebase-environment'
export function EIEnvironmentObservation({ledger,address,revision,disabled,onStage}:{ledger:EILedger;address:string;revision:number;disabled:boolean;onStage:(proposal:EIProposal)=>void}){
 const [receipt,setReceipt]=useState<Awaited<ReturnType<typeof readHomebaseEnvironment>>|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),pending=useRef(false)
 const active=useRef(true),abort=useRef<AbortController|null>(null)
 useEffect(()=>{active.current=true;return()=>{active.current=false;abort.current?.abort()}},[])
 const supported=typeof window!=='undefined'&&window.location.origin==='https://homebase.local'
 if(!supported)return null
 const read=async()=>{if(pending.current||disabled)return;pending.current=true;setBusy(true);setError('');const controller=new AbortController();abort.current=controller;const timeout=setTimeout(()=>controller.abort(),30000);try{const request:typeof fetch=(url,init)=>fetch(url,{...init,signal:controller.signal});const result=await readHomebaseEnvironment({address,revision},window.location.origin,crypto.randomUUID(),request);if(active.current)setReceipt(result)}catch(reason){if(active.current)setError(String(reason))}finally{clearTimeout(timeout);if(abort.current===controller)abort.current=null;pending.current=false;if(active.current)setBusy(false)}}
 const current=receipt?.scope.address===address&&receipt?.scope.revision===revision
 return <section aria-label="Current reported environment"><button disabled={disabled||busy} onClick={read}>Read local environment</button>{receipt&&<><small>{receipt.value.platform?.os??'Platform unavailable'} · process {receipt.value.platform?.architecture??'?'} · {receipt.scope.address} · {receipt.scope.revision}</small><button disabled={disabled||busy||!current} onClick={()=>{try{const next=proposeHomebaseEnvironment(ledger,receipt,`environment/${receipt.value.requestId}`);if(next)onStage(next)}catch(reason){setError(String(reason))}}}>Retain returned environment</button></>}{error&&<p role="alert">{error}</p>}</section>
}
