import {createEILocalStorage,type EIStoredState} from './model/ei-storage'
import {useEffect,useRef} from 'react'
import type {EILedger} from './model/ei-engine'
import {readHomebaseEnvironment} from './model/ei-homebase-environment'
export function EIEnvironmentBootstrap({ledger,address,revision,onReturn,onState,onRejectedReturn,onSavedState,onFailure}:{ledger:EILedger;address:string;revision:number;onReturn:(receipt:Awaited<ReturnType<typeof readHomebaseEnvironment>>,context:EILedger)=>void;onState:(state:string)=>void;onRejectedReturn:(receipt:Awaited<ReturnType<typeof readHomebaseEnvironment>>)=>void;onSavedState:(state:EIStoredState)=>void;onFailure:(message:string)=>void}){
 const handlers=useRef({onReturn,onState,onRejectedReturn,onSavedState,onFailure});handlers.current={onReturn,onState,onRejectedReturn,onSavedState,onFailure}
 useEffect(()=>{
  if(window.location.origin!=='https://homebase.local')return
  let live=true;const controller=new AbortController();let timeout:ReturnType<typeof setTimeout>|null=null
  // The deferred start survives React's setup/cleanup probe without two reads.
  const start=setTimeout(()=>{if(!live)return;handlers.current.onState('reading local environment');timeout=setTimeout(()=>controller.abort(),30000);const scope={address,revision},request:typeof fetch=(url,init)=>fetch(url,{...init,signal:controller.signal});void (async()=>{const saved=await Promise.race([createEILocalStorage({}).load(),new Promise<never>((_,reject)=>controller.signal.addEventListener('abort',()=>reject(new Error('Local initialization timed out')), {once:true}))]);if(!live)return null;if(saved){handlers.current.onSavedState(saved);handlers.current.onState('saved field restored');return null}return readHomebaseEnvironment(scope,window.location.origin,crypto.randomUUID(),request)})().then(receipt=>{if(live&&receipt){try{handlers.current.onReturn(receipt,ledger);handlers.current.onState('environment returned')}catch{handlers.current.onRejectedReturn(receipt);handlers.current.onState('environment retained for its original context')}}}).catch(reason=>{if(live){handlers.current.onFailure(reason instanceof Error?reason.message:String(reason));handlers.current.onState('environment unavailable')}}).finally(()=>{if(timeout)clearTimeout(timeout)})},0)
  return()=>{live=false;clearTimeout(start);if(timeout)clearTimeout(timeout);controller.abort()}
 },[])
 return null
}
