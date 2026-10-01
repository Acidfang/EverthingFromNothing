import {useEffect,useMemo,useRef} from 'react'
import type {SystemState} from './model/transitionEngine'
import {transition} from './model/transitionEngine'
import type {TickLedger} from './model/kernel'
import {tetraMomentGate} from './model/tetra-moment-gate'
import {kernelArrivalGrains,relationChoices} from './model/relation-grain'
import {TetraMomentGateView} from './TetraMomentGateView'
import './moment-gate.css'
const revision='d0e4b4cf9c1d8212e7d3a1f63c9f5b962689b218'
export function MomentGateLayer({address,stateAddress,roleState,ledger,onSelect,onClose}:{address:string;stateAddress:string;roleState:SystemState;ledger:TickLedger;onSelect:(address:string,role:'IS'|'NEXT')=>void;onClose:()=>void}){
  const panel=useRef<HTMLDivElement>(null),close=useRef<HTMLButtonElement>(null)
  useEffect(()=>{const previous=document.activeElement as HTMLElement|null;close.current?.focus();return()=>previous?.focus()},[])
  useEffect(()=>{const frame=requestAnimationFrame(()=>close.current?.focus());return()=>cancelAnimationFrame(frame)},[stateAddress])
  const gate=useMemo(()=>tetraMomentGate({address:`${stateAddress}/moment-gate`,receiptAddress:`role-state/step/${roleState.step}/proposed-handoff`,receipt:transition(roleState),infinity:null,definitionSource:`${revision}/src/model/canonicalSeed.ts`,grain:{address:stateAddress,parentAddress:'selected-kernel',sourceReceipt:`role-state/step/${roleState.step}`,localDifference:[...ledger.entries.filter(e=>e.address===address).map(e=>`Proposed target result ${e.result}: ${e.arrivalCount} arrivals`)]}}),[address,stateAddress,roleState,ledger])
  const arrivals=useMemo(()=>relationChoices(kernelArrivalGrains(ledger,`selected-kernel/proposed/${ledger.fromAct}-${ledger.toAct}`,revision,'PROPOSED'),address),[ledger,address])
  return <div className="moment-gate-layer" role="dialog" aria-modal="true" aria-label="Recursive moment gates" ref={panel} onKeyDown={event=>{
    if(event.key==='Escape'){event.stopPropagation();onClose()}
    if(event.key==='Tab'){const controls=[...panel.current!.querySelectorAll<HTMLElement>('button,a[href],input,select')].filter(e=>!e.hasAttribute('disabled'));const first=controls[0],last=controls.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}}
  }}>
    <header><div><small>ANOTHER GRAIN · SAME MECHANISM</small><h1>Self-centred moment gates</h1><p>{stateAddress}</p></div><button ref={close} onClick={onClose}>Close moment gates</button></header>
    <div className="moment-gate-grid"><TetraMomentGateView gates={[gate]}/><aside>
      <h2>Threads and choices</h2><p>Actual selected-kernel arrivals for this address. Proposed results remain proposed, including cancelled contributions.</p>
      <p>The gate reads the retained shared role state at step {roleState.step}. Its displayed proposal is a calculated correspondence, not a completed field Act.</p>
      {arrivals.length?arrivals.map(row=><article key={row.address}><strong>{row.left} → {row.right}</strong><p>{row.status} · {row.result} · {row.arrivalCount} arrivals · face {row.face}</p><p>{row.address}</p><button onClick={()=>onSelect(row.left,'IS')}>Inspect source {row.left}</button><button onClick={()=>onSelect(row.right,'NEXT')}>Inspect proposed target {row.right}</button></article>):<p>No incoming or outgoing arrivals in this receipt.</p>}
      <h2>Source relations</h2><a href={`https://github.com/Acidfang/EverthingFromNothing/blob/${revision}/src/model/canonicalSeed.ts`} target="_blank" rel="noreferrer">Retained role correspondence</a><br/><a href={`https://github.com/Acidfang/EverthingFromNothing/blob/${revision}/src/model/kernel.ts`} target="_blank" rel="noreferrer">Selected-kernel arrival producer</a>
      <p>Each grain retains its own address, inherited source and local Difference. This view introduces no new world centre, grid or gate truth table.</p>
    </aside></div>
  </div>
}
