import {useEffect,useMemo,useState} from 'react'
import type {EILedger} from './model/ei-engine'
import {createEIGrainRegistry,projectEIGrain,type EIGrain} from './model/ei-grain-identity'
import {inspectEIComparisonClauses,resolveEIAuthoredComparison,verifyEIAuthoredComparison} from './model/ei-authored-comparison'

export function EIAuthoredRelations({ledger,address,grain,disabled}:{ledger:EILedger;address:string;grain:EIGrain;disabled:boolean}){
 const handle=useMemo(()=>projectEIGrain(createEIGrainRegistry(ledger),address,grain),[ledger,address,grain])
 const retained=useMemo(()=>inspectEIComparisonClauses(ledger,handle),[ledger,handle])
 const [pair,setPair]=useState(''),[output,setOutput]=useState<{ledger:EILedger;address:string;returned:ReturnType<typeof resolveEIAuthoredComparison>;check:ReturnType<typeof verifyEIAuthoredComparison>}|null>(null),[error,setError]=useState('')
 useEffect(()=>{setPair('');setOutput(null);setError('')},[ledger,address])
 if(!retained.rules.length)return null
 const pairs=[...new Set(retained.premises.map(p=>JSON.stringify([p.left,p.right])))]
 const current=output?.ledger===ledger&&output.address===address?output.returned:null
 return <section aria-label="Retained symbolic comparison">
  <p>{retained.rules[0].exact}</p>
  <label>Source operands<select disabled={disabled} value={pair} onChange={event=>{setPair(event.target.value);setOutput(null);setError('')}}><option value="">Select retained operands</option>{pairs.map(value=>{const [left,right]=JSON.parse(value);return <option key={value} value={value}>{left} · {right}</option>})}</select></label>
  <button disabled={disabled||!pair} onClick={()=>{try{const [left,right]=JSON.parse(pair),returned=resolveEIAuthoredComparison(ledger,handle,left,right);setOutput({ledger,address,returned,check:verifyEIAuthoredComparison(ledger,handle,left,right,returned)});setError('')}catch(reason){setError(reason instanceof Error?reason.message:String(reason))}}}>Resolve source relation</button>
  {error&&<p role="alert">{error}</p>}
  {current&&<div aria-label="Derived symbolic relation"><strong>{current.result.status}{current.result.conflict?' · conflicting premises':''}</strong>{current.result.proofs.map((proof,index)=><pre key={index}>{proof.conclusion.kind==='relation'?`${proof.conclusion.left}⋈${proof.conclusion.right}`:`Δ${proof.conclusion.from.left}${proof.conclusion.from.right}→${proof.conclusion.to}`}</pre>)}<details><summary>Rule, source premises and substitutions · check {output?.check.status}</summary><pre>{JSON.stringify({returned:current,check:output?.check},null,2)}</pre></details></div>}
 </section>
}
