/** Read-only compilation of explicitly selected addressed sources. The grain
 * handle supplies identity; neither its label nor shared ledger membership
 * supplies semantic equivalence or permission to execute. */
import {proposeEI,type EILedger} from './ei-engine.ts'
import {readEIGrain,referenceEIGrain,resolveEIGrainTarget,type EIGrainHandle} from './ei-grain-identity.ts'
import {parseEILedgerSource,compileEILedgerProgram,EI_LEDGER_LIMITS,type EILedgerQuery} from './ei-ledger-language.ts'
import type {ComparisonSource,ComparisonProgramScope} from './source-bound-comparison.ts'

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
 return Object.freeze({origins:Object.freeze(sources.map(item=>item.origin)),compilation:compileEILedgerProgram(sources.map(item=>item.ast),options)})
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
 const text=JSON.stringify({schema:'ei.source-derived-relation.v1',scope:'symbolic-source-consequence',query:evaluation.result.query,
  proofs:evaluation.result.proofs,dependencies:evaluation.dependencies,executionAuthority:false})
 const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))].map(value=>value.toString(16).padStart(2,'0')).join('')
 const address=`derived/${hash}`,source={id:`derived/${hash}`,text,realm:'local-symbolic-derivation'}
 const value=[...new Set(evaluation.result.proofs.map(proof=>proof.conclusion.kind==='relation'?`${proof.conclusion.left}⋈${proof.conclusion.right}`:`Δ${proof.conclusion.from.left}${proof.conclusion.from.right}→${proof.conclusion.to}`))].join('\n')
 const existing=ledger.records.find(record=>record.address===address)
 if(existing){if(existing.is.source.text===text&&existing.is.value===value)return null;throw new Error('Derived result address conflict')}
 const parents=[...new Set(addresses)],producer=parents[0]
 if(!producer)throw new Error('A retained source address is required')
 return proposeEI(ledger,{id,producer,input:source,candidates:[{id:'retain-derived-relation',label:'Retain derived relation',owner:'user',source,
  conditions:parents.map(address=>({address,equals:ledger.records.find(record=>record.address===address)!.is.value})),
  patches:[{kind:'create',address,value,source,parents,relations:parents.map(address=>({relation:'derived-from',address}))}]}]})
}
