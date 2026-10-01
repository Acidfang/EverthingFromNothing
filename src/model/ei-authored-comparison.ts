/** Bind retained source clauses to the current canonical addressed grain.
 * A source term is a reference inside that source, not a new field entity. */
import type {EILedger} from './ei-engine.ts'
import {readEIGrain,resolveEIGrainTarget,referenceEIGrain,type EIGrainHandle} from './ei-grain-identity.ts'
import {AUTHORED_COMPARE_CLAUSE,readRetainedComparisonClause,evaluateAuthoredComparison,parseDirectComparisonPremise,type ClauseRef,type ComparisonSource,type ComparisonResult} from './source-bound-comparison.ts'

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

/** Instantiate the selected rule once per ordered pair actually witnessed in
 * this source. This is not enumeration of all possible or meaningful pairs.
 * Group first so unrelated clauses are retained once, not copied per result. */
export function resolveEIAuthoredComparisonBatch(ledger:EILedger,handle:EIGrainHandle,ruleIndex=0){
 const input=inspectEIComparisonClauses(ledger,handle),rule=input.rules[ruleIndex]
 if(!rule)throw new Error('No retained comparison rule at the selected source')
 // Validate every retained locator, including clauses this syntax cannot apply.
 for(const ref of input.clauses)readRetainedComparisonClause([input.source],ref)
 const groups=new Map<string,{left:string;right:string;refs:ClauseRef[]}>()
 const unapplied:Readonly<{source:ClauseRef;reason:'outside-direct-comparison'}>[]=[]
 for(const ref of input.clauses){
  if(ref===rule)continue
  const premise=parseDirectComparisonPremise(ref.exact,ref)
  if(!premise){unapplied.push({source:ref,reason:'outside-direct-comparison'});continue}
  const key=JSON.stringify([premise.left,premise.right]),group=groups.get(key)??{left:premise.left,right:premise.right,refs:[]}
  group.refs.push(ref);groups.set(key,group)
 }
 const results=[...groups.values()].map(({left,right,refs})=>{
  const {unused:_unused,...result}=evaluateAuthoredComparison([input.source],rule,refs,{frameId:input.source.frameId,left,right})
  return result
 })
 return {format:'ei-witnessed-comparison-batch/v1' as const,scope:'retained-direct-witness-pairs' as const,
  origin:input.origin,rule,sourceClauseCount:input.clauses.length,witnessCount:input.premises.length,
  evaluatedPairCount:results.length,clauses:input.clauses,results,unapplied}
}

/** Expand shared clause evidence into the existing single-query shape when an
 * individual result is inspected. This recreates its full unused-clause list
 * without embedding that same list in every stored batch member. */
export function expandEIAuthoredComparisonBatchResult(batch:ReturnType<typeof resolveEIAuthoredComparisonBatch>,index:number){
 const result=batch.results[index]
 if(!result)throw new Error('No witnessed pair at that batch index')
 const key=(ref:ClauseRef)=>JSON.stringify([ref.recordAddress,ref.sourceId,ref.revision,ref.pointer??null,ref.start,ref.end,ref.exact])
 const unused=batch.clauses.flatMap<ComparisonResult['unused'][number]>(ref=>{
  if(key(ref)===key(batch.rule))return []
  const premise=parseDirectComparisonPremise(ref.exact,ref)
  if(!premise)return [{source:ref,reason:'unsupported-clause' as const}]
  if(premise.left!==result.query.left||premise.right!==result.query.right)return [{source:ref,reason:'different-operands' as const}]
  return []
 })
 return {...result,unused}
}

/** Re-read the same source, regroup all direct witnesses, then check the actual
 * returned batch. Repeating this read-only operation creates no model commit. */
export function verifyEIAuthoredComparisonBatch(ledger:EILedger,handle:EIGrainHandle,returned:unknown,ruleIndex=0){
 const expected=resolveEIAuthoredComparisonBatch(ledger,handle,ruleIndex)
 let matches=false
 try{matches=JSON.stringify(expected)===JSON.stringify(returned)}catch{/* Non-serializable return cannot match. */}
 return Object.freeze({scope:'retained-source-batch-reconstruction' as const,status:matches?'passed' as const:'failed' as const,origin:expected.origin,matches})
}
