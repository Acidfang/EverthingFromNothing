import {useEffect,useRef} from 'react'
import type {EILedger} from './model/ei-engine'
import {readHomebaseEnvironment} from './model/ei-homebase-environment'
export function EIEnvironmentBootstrap({ledger,address,revision,onReturn,onState,onRejectedReturn}:{ledger:EILedger;address:string;revision:number;onReturn:(receipt:Awaited<ReturnType<typeof readHomebaseEnvironment>>,context:EILedger)=>void;onState:(state:string)=>void;onRejectedReturn:(receipt:Awaited<ReturnType<typeof readHomebaseEnvironment>>)=>void}){
 const handlers=useRef({onReturn,onState,onRejectedReturn});handlers.current={onReturn,onState,onRejectedReturn}
 useEffect(()=>{
  if(window.location.origin!=='https://homebase.local')return
  let live=true;const controller=new AbortController();let timeout:ReturnType<typeof setTimeout>|null=null
  // The deferred start survives React's setup/cleanup probe without two reads.
  const start=setTimeout(()=>{if(!live)return;handlers.current.onState('reading local environment');timeout=setTimeout(()=>controller.abort(),30000);const scope={address,revision},request:typeof fetch=(url,init)=>fetch(url,{...init,signal:controller.signal});void readHomebaseEnvironment(scope,window.location.origin,crypto.randomUUID(),request).then(receipt=>{if(live){try{handlers.current.onReturn(receipt,ledger);handlers.current.onState('environment returned')}catch{handlers.current.onRejectedReturn(receipt);handlers.current.onState('environment retained for its original context')}}}).catch(()=>{if(live)handlers.current.onState('environment unavailable')}).finally(()=>{if(timeout)clearTimeout(timeout)})},0)
  return()=>{live=false;clearTimeout(start);if(timeout)clearTimeout(timeout);controller.abort()}
 },[])
 return null
}
