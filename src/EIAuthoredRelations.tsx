import {useEffect,useMemo,useRef,useState} from 'react'
import type {EILedger,EIProposal} from './model/ei-engine'
import {createEIGrainRegistry,projectEIGrain,type EIGrain} from './model/ei-grain-identity'
import {compileEIAddressedProgram,proposeEIAddressedDerivation} from './model/ei-addressed-program'
import {AUTHORED_COMPARE_CLAUSE} from './model/source-bound-comparison'

export function EIAuthoredRelations({ledger,address,grain,disabled,onStage}:{ledger:EILedger;address:string;grain:EIGrain;disabled:boolean;onStage?:(proposal:EIProposal)=>void}){
 const handle=useMemo(()=>projectEIGrain(createEIGrainRegistry(ledger),address,grain),[ledger,address,grain])
 const parsed=useMemo(()=>{try{return {program:compileEIAddressedProgram(ledger,[handle]),error:''}}catch(reason){return {program:null,error:reason instanceof Error?reason.message:String(reason)}}},[ledger,handle])
 const program=parsed.program?.compilation
 const rules=useMemo(()=>program?.asts.flatMap(ast=>ast.clauses).filter(clause=>clause.syntax.kind==='comparison-rule').sort((a,b)=>Number(b.source.exact===AUTHORED_COMPARE_CLAUSE)-Number(a.source.exact===AUTHORED_COMPARE_CLAUSE))??[],[program])
 const [ruleId,setRuleId]=useState(''),[pair,setPair]=useState(''),[shown,setShown]=useState<readonly string[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false)
 const current=useRef({ledger,address});current.current={ledger,address};const pending=useRef(false),alive=useRef(true),epoch=useRef(0),allowed=useRef(!disabled)
 allowed.current=!disabled
 useEffect(()=>{epoch.current++},[disabled,ledger,address])
 useEffect(()=>{alive.current=true;return()=>{alive.current=false}},[])
 useEffect(()=>{setRuleId('');setPair('');setShown([]);setError('')},[ledger,address])
 if(!program||!rules.length)return parsed.error?<p role="alert">{parsed.error}</p>:null
 const selectedRule=rules.find(rule=>rule.id===ruleId)??rules[0]
 const evaluations=program.evaluations.filter(item=>item.ruleId===selectedRule.id)
 const retain=async(index:number)=>{
  if(disabled||pending.current||!onStage)return
  pending.current=true;setBusy(true);setError('');const origin=current.current,token=epoch.current
  try{const proposal=await proposeEIAddressedDerivation(ledger,[handle],index,`derive/${crypto.randomUUID()}`)
   if(!alive.current||!allowed.current||token!==epoch.current||origin.ledger!==current.current.ledger||origin.address!==current.current.address)return
   if(proposal)onStage(proposal)
  }catch(reason){if(alive.current&&origin.ledger===current.current.ledger&&origin.address===current.current.address)setError(reason instanceof Error?reason.message:String(reason))}
  finally{pending.current=false;if(alive.current)setBusy(false)}
 }
 return <section aria-label="Retained symbolic comparison">
  <label>Retained rule<select disabled={disabled||busy} value={selectedRule.id} onChange={event=>{setRuleId(event.target.value);setPair('');setShown([])}}>{rules.map(rule=><option key={rule.id} value={rule.id}>{rule.source.exact}</option>)}</select></label>
  <label>Source operands<select disabled={disabled||busy} value={pair} onChange={event=>{setPair(event.target.value);setShown([])}}><option value="">Select retained operands</option>{evaluations.map(item=><option key={item.id} value={item.id}>{item.result.query.left} · {item.result.query.right}</option>)}</select></label>
  <button disabled={disabled||busy||!pair} onClick={()=>setShown([pair])}>Resolve source relation</button>
  <button disabled={disabled||busy} onClick={()=>setShown(evaluations.map(item=>item.id))}>Resolve witnessed pairs</button>
  {program.evaluations.filter(item=>shown.includes(item.id)).map(item=><div key={item.id} aria-label="Derived symbolic relation"><strong>{item.result.status}{item.result.conflict?' · conflicting premises':''}</strong>{item.result.proofs.map((proof,index)=><pre key={index}>{proof.conclusion.kind==='relation'?`${proof.conclusion.left}⋈${proof.conclusion.right}`:`Δ${proof.conclusion.from.left}${proof.conclusion.from.right}→${proof.conclusion.to}`}</pre>)}{onStage&&item.result.proofs.length>0&&!item.result.conflict&&<button disabled={disabled||busy} onClick={()=>void retain(program.evaluations.indexOf(item))}>Retain derived relation</button>}<details><summary>Rule, premises and source addresses</summary><pre>{JSON.stringify(item,null,2)}</pre></details></div>)}
  <details><summary>Other retained clauses · {program.opaqueClauses.length}</summary>{program.opaqueClauses.map(item=><pre key={item.id}>{item.source.exact}</pre>)}</details>
  {error&&<p role="alert">{error}</p>}
 </section>
}
