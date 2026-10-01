/** Bind retained source clauses to the current canonical addressed grain.
 * A source term is a reference inside that source, not a new field entity. */
import type {EILedger} from './ei-engine.ts'
import {readEIGrain,resolveEIGrainTarget,referenceEIGrain,type EIGrainHandle} from './ei-grain-identity.ts'
import {AUTHORED_COMPARE_CLAUSE,evaluateAuthoredComparison,parseDirectComparisonPremise,type ClauseRef,type ComparisonSource} from './source-bound-comparison.ts'

export function inspectEIComparisonClauses(ledger:EILedger,handle:EIGrainHandle){
 const address=resolveEIGrainTarget(ledger,handle),state=readEIGrain(ledger,handle)
 const frameId=JSON.stringify([address,state.revision,state.source.id,state.source.realm??null])
 const source:ComparisonSource={recordAddress:address,sourceId:state.source.id,revision:state.revision,frameId,text:state.source.text}
 const clauses:ClauseRef[]=[]
 const add=(text:string,pointer?:string,start=0,end=text.length)=>clauses.push({recordAddress:address,sourceId:state.source.id,revision:state.revision,...(pointer===undefined?{}:{pointer}),start,end,exact:text.slice(start,end)})
 let inventory=false
 if(state.source.realm==='public-repository-inventory'){
  try{
   const payload=JSON.parse(state.source.text),values=payload?.inventory_statements?.retained_binary_relations
   if(Array.isArray(values)&&values.every((item:unknown)=>typeof item==='string')){values.forEach((value:string,index:number)=>add(value,`/inventory_statements/retained_binary_relations/${index}`));inventory=true}
  }catch{/* Source text remains retained; no guessed JSON structure is evaluated. */}
 }
 if(!inventory){
  let start=0
  for(const piece of state.source.text.split(';')){
   const leading=piece.length-piece.trimStart().length,trailing=piece.length-piece.trimEnd().length
   if(piece.trim())add(state.source.text,undefined,start+leading,start+piece.length-trailing)
   start+=piece.length+1
  }
 }
 const rules=clauses.filter(ref=>ref.exact===AUTHORED_COMPARE_CLAUSE)
 const premises=clauses.flatMap(ref=>{const parsed=parseDirectComparisonPremise(ref.exact,ref);return parsed?[parsed]:[]})
 return {source,clauses,rules,premises,origin:referenceEIGrain(handle)}
}

export function resolveEIAuthoredComparison(ledger:EILedger,handle:EIGrainHandle,left:string,right:string,ruleIndex=0){
 const input=inspectEIComparisonClauses(ledger,handle),rule=input.rules[ruleIndex]
 if(!rule)throw new Error('No retained comparison rule at the selected source')
 const result=evaluateAuthoredComparison([input.source],rule,input.clauses.filter(ref=>ref!==rule),{frameId:input.source.frameId,left,right})
 return {origin:input.origin,result}
}

/** Reconstruct from the originating handles and operands, then compare an
 * actually supplied returned proof. This checks the local symbolic derivation. */
export function verifyEIAuthoredComparison(ledger:EILedger,handle:EIGrainHandle,left:string,right:string,returned:unknown,ruleIndex=0){
 const expected=resolveEIAuthoredComparison(ledger,handle,left,right,ruleIndex)
 let matches=false
 try{matches=JSON.stringify(expected)===JSON.stringify(returned)}catch{/* Non-serializable return cannot match. */}
 return Object.freeze({scope:'retained-source-rule-reconstruction' as const,status:matches?'passed' as const:'failed' as const,origin:expected.origin,operands:{left,right},matches})
}
