import {AUTHORED_COMPARE_CLAUSE,AUTHORED_IDENTITY_CLAUSE,readRetainedComparisonClause,parseDirectComparisonPremise,type ComparisonProgramScope,type ClauseRef,type ComparisonSource,type DirectPremise,type ComparisonProof} from './source-bound-comparison.ts'
import {checkEIData,EI_BINARY_ABI,encodeEIBits,decodeEIBits,equalEIBits,readEIBinaryProgram,runEIBinaryProgram,type EIBits} from './ei-binary-machine.ts'
type Origin=Readonly<{offset:number;rule:ClauseRef;branch:ClauseRef;fields:readonly ClauseRef[]}>
export type EIBinaryRuleLibrary=Readonly<{format:'ei-binary-rule-library/v1';source:ClauseRef;bytes:EIBits;origins:readonly Origin[];programScope?:ComparisonProgramScope;bootstrap:'two-authored-rule-lowering/v1';admission:'unopposed-retained-witnesses';selfHosted:false}>
const seal=new WeakSet<object>(),sourceSnapshots=new WeakMap<object,readonly ComparisonSource[]>()
function fail(reason:string):never{throw Error(`EI rule library: ${reason}`)}
const frozen=<T>(value:T):T=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(frozen);Object.freeze(value)}return value}
/** Source-to-ABI lowering is an exposed host bootstrap. Only the already
 * witnessed forms are supported; unsupported syntax never gains an opcode. */
export function compileEIBinaryRule(sources:readonly ComparisonSource[],ref:ClauseRef,programScope?:ComparisonProgramScope):EIBinaryRuleLibrary{
 checkEIData({sources,ref,programScope})
 if(!Array.isArray(sources)||sources.length>128)fail('invalid source collection')
 for(const s of sources){if(![s.recordAddress,s.sourceId,s.frameId].every(v=>typeof v==='string'&&v.length>0&&v.length<=4096)||typeof s.text!=='string'||!Number.isSafeInteger(s.revision)||s.revision<0)fail('invalid source binding');if(s.provenance){for(const key of Object.keys(s.provenance))if(!['realm','locator'].includes(key)||typeof s.provenance[key as keyof typeof s.provenance]!=='string')fail('invalid source provenance')}}
 const rule={...ref},snapshot=(Object.isFrozen(sources)&&sources.every(s=>Object.isFrozen(s)&&(!s.provenance||Object.isFrozen(s.provenance)))?sources:frozen(sources.map(source=>({...source,...(source.provenance?{provenance:{...source.provenance}}:{})})))),text=readRetainedComparisonClause(sources,rule).text
 if(programScope){if(!programScope.id||!programScope.sources.length||programScope.sources.length>128)fail('invalid program scope');const keys=new Set<string>();for(const member of programScope.sources){const key=JSON.stringify([member.recordAddress,member.sourceId]);if(keys.has(key))fail('duplicate program source');keys.add(key);if(snapshot.filter(s=>s.recordAddress===member.recordAddress&&s.sourceId===member.sourceId&&s.revision===member.revision&&s.frameId===member.frameId).length!==1)fail('stale program scope')}if(!programScope.sources.some(s=>s.recordAddress===rule.recordAddress&&s.sourceId===rule.sourceId&&s.revision===rule.revision))fail('rule outside program scope')}
 if(text!==AUTHORED_COMPARE_CLAUSE&&text!==AUTHORED_IDENTITY_CLAUSE)fail('unresolved rule form')
 const bytes:number[]=[EI_BINARY_ABI.version,0],origins:Origin[]=[]
 const span=(start:number,end:number):ClauseRef=>({...rule,start:rule.start+start,end:rule.start+end,exact:text.slice(start,end)})
 const emit=(tag:number,shape:number,start:number,end:number,fields:readonly ({register:0|1;origin:ClauseRef}|{literal:ClauseRef})[])=>{
  const offset=bytes.length;bytes.push(EI_BINARY_ABI.branch,tag,shape,fields.length)
  for(const field of fields)if('register'in field)bytes.push(EI_BINARY_ABI.register,field.register);else{const bits=encodeEIBits(field.literal.exact);bytes.push(EI_BINARY_ABI.literal,bits.length>>>8,bits.length&255,...bits)}
  origins.push({offset,rule,branch:span(start,end),fields:fields.map(field=>'register'in field?field.origin:field.literal)});bytes[1]++
 }
 if(text===AUTHORED_IDENTITY_CLAUSE){emit(1,0,0,text.length,[{register:0,origin:rule},{literal:span(2,3)},{register:1,origin:rule}])}
 else{
  const yes=text.indexOf('?')+1,no=text.lastIndexOf(':')+1
  emit(1,0,yes,no-1,[{register:0,origin:span(yes,yes+1)},{literal:span(yes+1,yes+2)},{register:1,origin:span(yes+2,yes+3)}])
  emit(2,1,no,text.length,[{literal:span(no,no+1)},{register:0,origin:span(no+1,no+2)},{register:1,origin:span(no+2,no+3)},{literal:span(no+3,no+4)},{literal:span(no+4,no+5)}])
 }
 readEIBinaryProgram(bytes)
 const result=frozen({format:'ei-binary-rule-library/v1' as const,source:rule,bytes,origins,...(programScope?{programScope:{id:programScope.id,sources:programScope.sources.map(s=>({...s}))}}:{}),bootstrap:'two-authored-rule-lowering/v1' as const,admission:'unopposed-retained-witnesses' as const,selfHosted:false as const});seal.add(result);sourceSnapshots.set(result,snapshot);return result
}
/** Rebuild from the actual retained source before admitting deserialized code.
 * A byte edit alone never authenticates itself as the unchanged source rule. */
export function restoreEIBinaryRule(sources:readonly ComparisonSource[],raw:EIBinaryRuleLibrary){
 checkEIData(raw)
 const expected=compileEIBinaryRule(sources,raw.source,raw.programScope)
 if(!equalEIBits(expected.bytes,raw.bytes)||JSON.stringify(expected)!==JSON.stringify(raw))fail('library differs from retained source recompilation')
 return expected
}
/** The library bytes, not a rule string or mode flag, choose branches and emit
 * returned fields. Text conversion and proof formatting are boundary adapters. */
export function executeEIBinaryRule(library:EIBinaryRuleLibrary,premises:readonly DirectPremise[],left:string,right:string){
 if(!seal.has(library))fail('unvalidated library')
 checkEIData(premises);if(!Array.isArray(premises))fail('invalid premise collection')
 const sources=sourceSnapshots.get(library)!,own=sources.find(s=>s.recordAddress===library.source.recordAddress&&s.sourceId===library.source.sourceId&&s.revision===library.source.revision)!
 const verified=premises.map(p=>{const retained=readRetainedComparisonClause(sources,p.source),parsed=parseDirectComparisonPremise(retained.text,p.source);if(!parsed||parsed.left!==p.left||parsed.right!==p.right||parsed.relation!==p.relation)fail('premise differs from retained source');const allowed=library.programScope?library.programScope.sources.some(s=>s.recordAddress===p.source.recordAddress&&s.sourceId===p.source.sourceId&&s.revision===p.source.revision&&s.frameId===retained.frameId):p.source.recordAddress===library.source.recordAddress&&p.source.sourceId===library.source.sourceId&&p.source.revision===library.source.revision&&retained.frameId===own.frameId;if(!allowed)fail('premise outside library scope');return parsed})
 const matching=verified.filter(p=>equalEIBits(encodeEIBits(p.left),encodeEIBits(left))&&equalEIBits(encodeEIBits(p.right),encodeEIBits(right))),conflict=matching.some(p=>p.relation==='≡')&&matching.some(p=>p.relation==='≠')
 const execution=runEIBinaryProgram(library.bytes,verified.map(p=>({tag:p.relation==='≡'?1:2,left:encodeEIBits(p.left),right:encodeEIBits(p.right)})),[encodeEIBits(left),encodeEIBits(right)])
 const proofs:ComparisonProof[]=conflict?[]:execution.outputs.map(output=>{
  const origin=library.origins.find(item=>item.offset===output.instructionOffset);if(!origin)fail('instruction has no retained source')
  const fields=output.fields.map(decodeEIBits),premise=verified[output.witnessIndex]
  let conclusion:ComparisonProof['conclusion']
  if(output.shape===0&&fields.length===3)conclusion={kind:'relation',left:fields[0],operator:fields[1] as '⋈',right:fields[2]}
  else if(output.shape===1&&fields.length===5)conclusion={kind:'transition',from:{operator:fields[0] as 'Δ',left:fields[1],right:fields[2]},to:fields[4] as 'L'}
  else return fail('unsupported return shape')
  return {rule:{...origin.rule},premise,substitution:{a:left,b:right},conclusion}
 })
 return frozen({proofs,receipt:{format:'ei-binary-rule-return/v1' as const,library,execution,conflict,witnessSelection:'explicit-retained-premise-refs' as const,scope:'binary-library-evaluation' as const,executionAuthority:false as const}})
}
/** Actual recompilation, not deserialization: read retained source again,
 * lower it again, execute those new bytes, and compare the returned behavior. */
export function recompileEIBinaryRule(sources:readonly ComparisonSource[],previous:EIBinaryRuleLibrary,ref:ClauseRef,premises:readonly DirectPremise[],left:string,right:string,programScope?:ComparisonProgramScope){
 if(!seal.has(previous))fail('previous library is not retained')
 const rebuilt=compileEIBinaryRule(sources,ref,programScope),returned=executeEIBinaryRule(rebuilt,premises,left,right)
 const sameRuleReference=JSON.stringify(previous.source)===JSON.stringify(rebuilt.source),sameSource=sameRuleReference&&JSON.stringify(sourceSnapshots.get(previous))===JSON.stringify(sourceSnapshots.get(rebuilt)),sameBytes=equalEIBits(previous.bytes,rebuilt.bytes)
 const rebuiltAgain=compileEIBinaryRule(sources,ref,programScope),checked=executeEIBinaryRule(rebuiltAgain,premises,left,right),verifiedReplay=equalEIBits(rebuilt.bytes,rebuiltAgain.bytes)&&JSON.stringify(returned)===JSON.stringify(checked)
 if(!verifiedReplay)fail('recompilation did not return the same bytes and behavior')
 return frozen({previous,rebuilt,sameSource,sameRuleReference,sameBytes,returned,verifiedReplay,compilerHosted:true as const,selfCompilation:false as const})
}
