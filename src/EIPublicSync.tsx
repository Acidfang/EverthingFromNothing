import {useEffect,useMemo,useRef,useState} from 'react'
import type {EILedger,EIProposal} from './model/ei-engine'
import {createEIPublicFieldRecords} from './model/ei-public-field'
import {EI_PUBLIC_SYNC,readEIPublicManifest,verifyEIPublicSnapshot,compareEIPublicSnapshot,proposeEIPublicSync,advanceEIPublicSyncBaseline,eiPublicSnapshotURL,type EIPublicSnapshot} from './model/ei-public-sync'
import {EI_NATIVE_SYNC_ORIGINS,readEIPublicSyncReturn,readBoundedPublicText} from './model/ei-public-sync-return'
export function EIPublicSync({ledger,address,revision,disabled,onStage}:{ledger:EILedger;address:string;revision:number;disabled:boolean;onStage:(proposal:EIProposal)=>void}){
 const [snapshot,setSnapshot]=useState<EIPublicSnapshot|null>(null),[selected,setSelected]=useState<readonly string[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false),[watch,setWatch]=useState(false),[pending,setPending]=useState<{id:string;address:string;revision:number}|null>(null)
 const abort=useRef<AbortController|null>(null),disposed=useRef(false)
 useEffect(()=>{disposed.current=false;return()=>{disposed.current=true;abort.current?.abort()}},[])
 const busyRef=useRef(false),lastCheck=useRef(0),scopeRef=useRef({address,revision});scopeRef.current={address,revision}
 const [baseline,setBaseline]=useState<ReturnType<typeof createEIPublicFieldRecords>|readonly import('./model/ei-engine').EISeedRecord[]>(()=>createEIPublicFieldRecords()),appliedRequest=useRef<{id:string;snapshot:EIPublicSnapshot}|null>(null)
 useEffect(()=>{const applied=appliedRequest.current;if(!applied)return;const receipt=ledger.receipts.find(receipt=>receipt.transactionId===applied.id);if(!receipt)return;appliedRequest.current=null;if(receipt.status==='committed'){try{setBaseline(advanceEIPublicSyncBaseline({ledger,baselineRecords:baseline,snapshot:applied.snapshot,receiptId:receipt.id}));setSelected([])}catch(reason){setError(String(reason))}}},[ledger])
 const rows=useMemo(()=>snapshot?compareEIPublicSnapshot(ledger,baseline,snapshot):[],[ledger,baseline,snapshot])
 const check=async(target?:{id:string;address:string;revision:number})=>{if(busyRef.current)return;busyRef.current=true;setBusy(true);setError('');const controller=new AbortController();abort.current=controller;const timeout=setTimeout(()=>controller.abort(),30000),boundedFetch:typeof fetch=(input,init)=>fetch(input,{...init,signal:controller.signal});const scope=target?{address:target.address,revision:target.revision}:{...scopeRef.current};if(!target)lastCheck.current=Date.now();try{
  let manifestText:string,payloadText:string
  if(EI_NATIVE_SYNC_ORIGINS.includes(window.location.origin)){
   const returned=await readEIPublicSyncReturn(scope,window.location.origin,crypto.randomUUID(),target?.id,boundedFetch),action=returned.value.action
   if(action?.state==='pending'){setPending({id:action.requestId,address:action.address,revision:action.revision});return}
   setPending(null);if(action?.state!=='returned'||!action.candidate)throw new Error(action?.code??returned.value.code)
   manifestText=action.candidate.manifestText;payloadText=action.candidate.payloadText
  }else{
   const response=await boundedFetch(`${EI_PUBLIC_SYNC.origin}${EI_PUBLIC_SYNC.base}latest.json`,{credentials:'omit',cache:'no-store',redirect:'error'});if(!response.ok)throw new Error(`Public manifest ${response.status}`);manifestText=await readBoundedPublicText(response,EI_PUBLIC_SYNC.manifestBytes)
   const manifest=readEIPublicManifest(manifestText),payload=await boundedFetch(eiPublicSnapshotURL(manifest),{credentials:'omit',cache:'no-store',redirect:'error'});if(!payload.ok)throw new Error(`Public snapshot ${payload.status}`);payloadText=await readBoundedPublicText(payload,EI_PUBLIC_SYNC.payloadBytes)
  }
  const next=await verifyEIPublicSnapshot(readEIPublicManifest(manifestText),payloadText);if(!disposed.current){setSnapshot(next);setSelected([])}
 }catch(reason){if(!disposed.current){setError(String(reason));setPending(null)}}finally{clearTimeout(timeout);if(abort.current===controller)abort.current=null;busyRef.current=false;if(!disposed.current)setBusy(false)}}
 useEffect(()=>{if(!pending||busy)return;const timer=setTimeout(()=>{if(!document.hidden)void check(pending)},500);const wake=()=>{if(!document.hidden)void check(pending)};document.addEventListener('visibilitychange',wake);return()=>{clearTimeout(timer);document.removeEventListener('visibilitychange',wake)}},[pending,busy])
 useEffect(()=>{if(!watch)return;const observe=()=>{if(!document.hidden&&!pending&&Date.now()-lastCheck.current>=900000)void check()};const timer=setInterval(observe,60000);document.addEventListener('visibilitychange',observe);return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',observe)}},[watch,pending])
 const apply=()=>{if(!snapshot)return;try{const proposal=proposeEIPublicSync({ledger,baselineRecords:baseline,snapshot,addresses:selected,producer:address,id:`public-sync/${crypto.randomUUID()}`});onStage(proposal);appliedRequest.current={id:proposal.input.id,snapshot}}catch(reason){setError(String(reason))}}
 return <section aria-label="GitHub shared state"><details><summary>GitHub shared state</summary><button disabled={disabled||busy||!!pending} onClick={()=>check()}>Check shared state</button><label><input type="checkbox" checked={watch} onChange={event=>setWatch(event.target.checked)}/> Check while active, every 15 minutes</label>{pending&&<small>Checking public state</small>}{snapshot&&<><p>{snapshot.manifest.release}</p>{rows.filter(row=>row.status!=='unchanged').map(row=><div key={row.address}><label><input type="checkbox" disabled={disabled||row.status==='conflict'||row.status==='removed'} checked={selected.includes(row.address)} onChange={event=>setSelected(current=>event.target.checked?[...current,row.address]:current.filter(address=>address!==row.address))}/>{row.address} · {row.status}</label><small>{row.reason}</small></div>)}{rows.every(row=>row.status==='unchanged')&&<small>Current public state matches</small>}<button disabled={disabled||!selected.length} onClick={apply}>Apply selected states</button></>}{error&&<p role="alert">{error}</p>}</details></section>
}
