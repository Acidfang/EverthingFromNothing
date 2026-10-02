/** Read-only compilation of explicitly selected addressed sources. The grain
 * handle supplies identity; neither its label nor shared ledger membership
 * supplies semantic equivalence or permission to execute. */
import {proposeEI,type EILedger} from './ei-engine.ts'
import {readEIGrain,referenceEIGrain,resolveEIGrainTarget,type EIGrainHandle} from './ei-grain-identity.ts'
import {parseEILedgerSource,compileEILedgerProgram,inspectEILedgerDependencies,EI_LEDGER_LIMITS,type EILedgerQuery} from './ei-ledger-language.ts'
import {produceSourceFractures,type SourceRecord} from './source-first-fracture.ts'
import type {ComparisonSource,ComparisonProgramScope} from './source-bound-comparison.ts'
const issuedPrograms=new WeakSet<object>()

export function readEIAddressedProgramSource(ledger:EILedger,handle:EIGrainHandle){
 const state=readEIGrain(ledger,handle)
 if(state.phase!=='retained')throw new Error('Proposed source is not a retained program')
 const source:ComparisonSource={recordAddress:state.entity.address,sourceId:state.source.id,revision:state.revision,
  frameId:JSON.stringify([state.entity.address,state.revision,state.source.id,state.source.realm??null]),text:state.source.text,
  provenance:{...(state.source.realm===undefined?{}:{realm:state.source.realm}),...(state.source.locator===undefined?{}:{locator:state.source.locator})}}
 let pointers: string[]|undefined
 if(state.source.realm==='public-repository-inventory'){
  try{const items=JSON.parse(source.text)?.inventory_statements?.retained_binary_relations
   if(Array.isArray(items)&&items.every((item:unknown)=>typeof item==='string'))pointers=items.map((_:unknown,index:number)=>`/inventory_statements/retained_binary_relations/${index}`)
  }catch{/* Preserve malformed or other source as opaque raw text. */}
 }
 return {origin:referenceEIGrain(handle),ast:parseEILedgerSource(source,{pointers})}
}

export function compileEIAddressedProgram(ledger:EILedger,handles:readonly EIGrainHandle[],options:{programScope?:ComparisonProgramScope;queries?:readonly EILedgerQuery[]}={}){
 if(!Array.isArray(handles)||handles.length>EI_LEDGER_LIMITS.maxSources)throw new Error('Addressed program source bound exceeded')
 const selected=handles.map(handle=>readEIAddressedProgramSource(ledger,handle))
 const unique=new Map(selected.map(item=>[JSON.stringify([item.origin.address,item.origin.revision,item.origin.sourceId]),item]))
 const sources=[...unique.values()]
 const program=Object.freeze({origins:Object.freeze(sources.map(item=>item.origin)),compilation:compileEILedgerProgram(sources.map(item=>item.ast),options)})
 issuedPrograms.add(program);return program
}

/** A retained source edit invalidates its dependent code, then the same source
 * is compiled and executed afresh twice. Old programs/receipts remain intact.
 * Snapshot serialization is the declared Difference grain, not spatial geometry. */
export function recompileEIAddressedProgram(ledger:EILedger,previous:ReturnType<typeof compileEIAddressedProgram>,handles:readonly EIGrainHandle[],options:{programScope?:ComparisonProgramScope;queries?:readonly EILedgerQuery[]}={}){
 if(!issuedPrograms.has(previous))throw new Error('Previous program was not compiled from retained addressed sources')
 const current=compileEIAddressedProgram(ledger,handles,options)
 if(JSON.stringify(previous.origins.map(s=>s.address).sort())!==JSON.stringify(current.origins.map(s=>s.address).sort()))throw new Error('Selected program source addresses changed; compile that selection separately')
 const differences:SourceRecord[]=[]
 for(const old of previous.compilation.asts){
  const record=ledger.records.find(r=>r.address===old.source.recordAddress)!,next=current.compilation.asts.find(a=>a.source.recordAddress===old.source.recordAddress)!
  const retained=[...record.was,record.is].find(s=>s.revision===old.source.revision&&s.source.id===old.source.sourceId&&s.source.text===old.source.text)
  if(!retained)throw new Error('Previous source revision is not retained in this field')
  const snapshot=(s:ComparisonSource)=>JSON.stringify({revision:s.revision,sourceId:s.sourceId,text:s.text,provenance:s.provenance??null})
  const first={id:JSON.stringify([old.source.recordAddress,old.source.revision,old.source.sourceId]),address:record.address,sourceRef:old.source.sourceId,value:snapshot(old.source),parentAddresses:record.parents}
  differences.push(first)
  if(snapshot(next.source)!==first.value)differences.push({id:JSON.stringify([next.source.recordAddress,next.source.revision,next.source.sourceId]),address:record.address,sourceRef:next.source.sourceId,value:snapshot(next.source),previousId:first.id,parentAddresses:record.parents})
 }
 const again=compileEIAddressedProgram(ledger,handles,options),verified=JSON.stringify(current)===JSON.stringify(again)
 if(!verified)throw new Error('Source recompilation returned different executable data or behavior')
 return Object.freeze({format:'ei-addressed-recompilation/v1' as const,previous,current,invalidation:inspectEILedgerDependencies(previous.compilation,current.compilation.asts.map(ast=>ast.source)),fracture:produceSourceFractures({sourceAddress:current.origins[0].address,records:differences}),verifiedRebuild:verified,verificationScope:'deterministic-source-rebuild-and-binary-return' as const,compilerHosted:true as const,selfCompilation:false as const})
}

/** Retain a selected, re-derived symbolic consequence through the existing
 * user selection / execution / actual readback path. This does not interpret
 * a join or literal L as permission to operate a file, device or network. */
export async function proposeEIAddressedDerivation(ledger:EILedger,handles:readonly EIGrainHandle[],evaluationIndex:number,id:string,options:{programScope?:ComparisonProgramScope;queries?:readonly EILedgerQuery[]}={}){
 if(!Number.isSafeInteger(evaluationIndex)||evaluationIndex<0)throw new Error('Invalid selected evaluation')
 const addresses=handles.map(handle=>resolveEIGrainTarget(ledger,handle))
 const compiled=compileEIAddressedProgram(ledger,handles,options),evaluation=compiled.compilation.evaluations[evaluationIndex]
 if(!evaluation)throw new Error('No selected source evaluation')
 if(evaluation.result.conflict||!evaluation.result.proofs.length)throw new Error('Selected source relation has no unopposed derived consequence')
 const core={schema:'ei.source-derived-relation.v1',scope:'symbolic-source-consequence',query:evaluation.result.query,
  proofs:evaluation.result.proofs,dependencies:evaluation.dependencies,executionAuthority:false}
 const identityText=JSON.stringify(core),text=JSON.stringify({...core,mechanism:evaluation.result.mechanism})
 const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(identityText)))].map(value=>value.toString(16).padStart(2,'0')).join('')
 const address=`derived/${hash}`,source={id:`derived/${hash}`,text,realm:'local-symbolic-derivation'}
 const value=[...new Set(evaluation.result.proofs.map(proof=>proof.conclusion.kind==='relation'?`${proof.conclusion.left}⋈${proof.conclusion.right}`:`Δ${proof.conclusion.from.left}${proof.conclusion.from.right}→${proof.conclusion.to}`))].join('\n')
 const existing=ledger.records.find(record=>record.address===address)
 if(existing){let retainedCore='';try{const {mechanism:_mechanism,...recorded}=JSON.parse(existing.is.source.text);retainedCore=JSON.stringify(recorded)}catch{/* Malformed retained metadata is a conflict. */}if(retainedCore===identityText&&existing.is.value===value)return null;throw new Error('Derived result address conflict')}
 const parents=[...new Set(addresses)],producer=parents[0]
 if(!producer)throw new Error('A retained source address is required')
 return proposeEI(ledger,{id,producer,input:source,candidates:[{id:'retain-derived-relation',label:'Retain derived relation',owner:'user',source,
  conditions:parents.map(address=>({address,equals:ledger.records.find(record=>record.address===address)!.is.value})),
  patches:[{kind:'create',address,value,source,parents,relations:parents.map(address=>({relation:'derived-from',address}))}]}]})
}
