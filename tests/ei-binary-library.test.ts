import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {AUTHORED_COMPARE_CLAUSE as RULE,AUTHORED_IDENTITY_CLAUSE as JOIN,evaluateAuthoredComparison,parseDirectComparisonPremise,type ComparisonSource,type ClauseRef} from '../src/model/source-bound-comparison.ts'
import {evaluateAuthoredComparison as oracle} from './fixtures/source-comparison-oracle.ts'
import {compileEIBinaryRule,executeEIBinaryRule,restoreEIBinaryRule,recompileEIBinaryRule} from '../src/model/ei-binary-rule-library.ts'
import {encodeEIBits,decodeEIBits,equalEIBits,checkEIBits,runEIBinaryProgram,readEIBinaryProgram} from '../src/model/ei-binary-machine.ts'
import {parseEILedgerSource,compileEILedgerProgram} from '../src/model/ei-ledger-language.ts'
const source=(text:string,revision=0):ComparisonSource=>({recordAddress:'source',sourceId:`source-${revision}`,revision,frameId:'frame',text})
function setup(text:string,rule=RULE){const s=source(text),ast=parseEILedgerSource(s),ref=ast.clauses.find(c=>c.source.exact===rule)!.source;return {s,ref,refs:ast.clauses.filter(c=>c.source!==ref).map(c=>c.source)}}
test('binary boundary preserves exact code units without Unicode repair or normalization',()=>{for(const text of ['', '\ud800','\udfff','�','🧭','a\u0308','ä','\0'])assert.equal(decodeEIBits(encodeEIBits(text)),text);assert.notDeepEqual(encodeEIBits('\ud800'),encodeEIBits('�'));assert.throws(()=>decodeEIBits([0]));assert.throws(()=>decodeEIBits([256,0]))})
test('all baseline rule results agree with independent pre-binary oracle',()=>{
 for(const rule of [RULE,JOIN])for(const facts of ['A≡B','A≠B','A≡B;A≠B','','A≡B;A≡B','B≡A','IF(A≡B)⇒X','?≠⊥']){
  const {s,ref,refs}=setup(`${facts};${rule}`,rule),q={frameId:'frame',left:facts==='?≠⊥'?'?':'A',right:facts==='?≠⊥'?'⊥':'B'},actual=evaluateAuthoredComparison([s],ref,refs,q),{mechanism,...result}=actual
  assert.deepEqual(result,oracle([s],ref,refs,q));assert.ok(mechanism);assert.deepEqual(mechanism.execution.program,mechanism.library.bytes);assert.equal(mechanism.admitted,actual.proofs.length>0)
 }
})
test('the 93 retained clauses keep ten evaluations and nine byte-produced proofs',()=>{
 const raw=JSON.parse(readFileSync(new URL('../docs/FRACTURE-FIELD-INVENTORY.json',import.meta.url),'utf8')),values=raw.retained_binary_relations as string[]
 const s=source(JSON.stringify(values)),ast=parseEILedgerSource(s,{pointers:values.map((_,i)=>`/${i}`)}),compiled=compileEILedgerProgram([ast]);assert.equal(compiled.opaqueClauses.length,86);assert.equal(compiled.evaluations.length,10);assert.equal(compiled.evaluations.flatMap(e=>e.result.proofs).length,9)
 for(const e of compiled.evaluations){const {mechanism,...actual}=e.result;assert.deepEqual(actual,oracle([s],e.result.proofs[0]?.rule??ast.clauses.find(c=>c.id===e.ruleId)!.source,e.dependencies.clauses.slice(1),e.result.query));assert.ok(mechanism);for(const origin of mechanism.library.origins){const selected=JSON.parse(s.text)[Number(origin.branch.pointer!.slice(1))];assert.equal(selected.slice(origin.branch.start,origin.branch.end),origin.branch.exact)}}
})
test('source-selected library bytes determine branches; no rule mode is passed to kernel',()=>{
 const a=setup(`A≠B;${RULE}`),b=setup(`A≠B;${JOIN}`,JOIN),pa=compileEIBinaryRule([a.s],a.ref),pb=compileEIBinaryRule([b.s],b.ref),premise=parseDirectComparisonPremise('A≠B',a.refs[0])!
 assert.equal(executeEIBinaryRule(pa,[premise],'A','B').proofs.length,1);assert.equal(executeEIBinaryRule(pb,[premise],'A','B').proofs.length,0)
 const input=[{tag:2,left:encodeEIBits('A'),right:encodeEIBits('B')}],registers=[encodeEIBits('A'),encodeEIBits('B')] as const
 // Synthetic ABI fixture: remove the second branch from the program itself.
 const firstOnly=[...pa.bytes.slice(0,pa.origins[1].offset)];firstOnly[1]=1
 assert.equal(runEIBinaryProgram(pa.bytes,input,registers).outputs.length,1);assert.equal(runEIBinaryProgram(firstOnly,input,registers).outputs.length,0)
 assert.throws(()=>restoreEIBinaryRule([a.s],{...pa,bytes:firstOnly}),/recompilation/)
})
test('recompile rereads exact source and preserves old byte/proof history',()=>{
 const before=setup(`A≡B;${RULE}`),library=compileEIBinaryRule([before.s],before.ref),premise=parseDirectComparisonPremise('A≡B',before.refs[0])!,saved=JSON.stringify(library)
 const replay=recompileEIBinaryRule([before.s],library,before.ref,[premise],'A','B');assert.equal(replay.sameBytes,true);assert.equal(replay.sameSource,true);assert.deepEqual(replay.returned,executeEIBinaryRule(library,[premise],'A','B'))
 const after=source(`A≠B;${JOIN}`,1),ast=parseEILedgerSource(after),rule=ast.clauses.find(c=>c.source.exact===JOIN)!.source,p=parseDirectComparisonPremise('A≠B',ast.clauses[0].source)!,changed=recompileEIBinaryRule([after],library,rule,[p],'A','B')
 assert.equal(changed.sameSource,false);assert.equal(changed.sameBytes,false);assert.equal(changed.returned.proofs.length,0);assert.equal(JSON.stringify(library),saved);assert.equal(changed.selfCompilation,false)
 assert.throws(()=>compileEIBinaryRule([after],before.ref),/source revision/)
})
test('malformed binary programs fail closed before any returned result',()=>{
 for(const program of [[],[2,0],[1,0,0],[1,1,99],[1,1,1,1,0,1,1,2],[1,1,1,1,0,1,0,0,2,0],[1,33],[1,-1]])assert.throws(()=>readEIBinaryProgram(program))
 const {s,ref}=setup(`A≡B;${RULE}`),library=compileEIBinaryRule([s],ref);assert.throws(()=>executeEIBinaryRule(JSON.parse(JSON.stringify(library)),[],'A','B'),/unvalidated/);assert.deepEqual(restoreEIBinaryRule([s],JSON.parse(JSON.stringify(library))),library)
 assert.throws(()=>restoreEIBinaryRule([s],{...library,origins:[]}),/recompilation/)
 assert.throws(()=>runEIBinaryProgram(library.bytes,Array(10001).fill({tag:1,left:[],right:[]}),[[],[]]),/bound/)
})
test('unknown compiler clauses stay opaque and cannot become libraries',()=>{const s=source('Iᵁ(W)→ℜ(W);a≡b?EXECUTE:IGNORE'),ast=parseEILedgerSource(s);assert.equal(compileEILedgerProgram([ast]).opaqueClauses.length,2);for(const clause of ast.clauses)assert.throws(()=>compileEIBinaryRule([s],clause.source),/unresolved/)})
test('binary input is dense plain data with no custom comparison or decoding behavior',()=>{
 for(const value of [Array(2),[1].concat(Array(1)),Object.assign([0],{every:()=>true}),Object.assign([0],{slice:()=>[255]}),Object.setPrototypeOf([0],null)])assert.throws(()=>checkEIBits(value))
 const accessor=[0];Object.defineProperty(accessor,'0',{get(){throw Error('must not execute getter')}});assert.throws(()=>checkEIBits(accessor),/byte data/)
 assert.equal(equalEIBits([0],[1]),false)
})
test('library execution and recompiler reject fabricated premises and retain conflicts',()=>{
 const {s,ref,refs}=setup(`A≡B;A≠B;${RULE}`),library=compileEIBinaryRule([s],ref),premises=refs.map(p=>parseDirectComparisonPremise(p.exact,p)!)
 assert.equal(executeEIBinaryRule(library,premises,'A','B').proofs.length,0)
 assert.equal(recompileEIBinaryRule([s],library,ref,premises,'A','B').returned.proofs.length,0)
 assert.throws(()=>executeEIBinaryRule(library,[{...premises[0],left:'forged'}],'forged','B'),/differs/)
 assert.throws(()=>recompileEIBinaryRule([s],library,ref,[{...premises[0],source:{...premises[0].source,revision:123}}],'A','B'),/source revision/)
})
test('a changed witness-only source invalidates the retained snapshot even when rule bytes stay equal',()=>{
 const {s,ref,refs}=setup(`${RULE};A≡B`),library=compileEIBinaryRule([s],ref),changed={...s,text:`${RULE};A≠B`},ast=parseEILedgerSource(changed),premise=parseDirectComparisonPremise('A≠B',ast.clauses[1].source)!
 const result=recompileEIBinaryRule([changed],library,ref,[premise],'A','B');assert.equal(result.sameRuleReference,true);assert.equal(result.sameSource,false);assert.equal(result.sameBytes,true);assert.equal(result.verifiedReplay,true);assert.equal(result.returned.proofs[0].conclusion.kind,'transition')
})
test('768 finite witness-set and ordered-query combinations match the independent prior interpreter',()=>{
 let checked=0
 for(const [left,right] of [['A','B'],['U₀','R'],['?','⊥']])for(const rule of [RULE,JOIN])for(let mask=0;mask<64;mask++)for(const reverse of [false,true]){
  const choices=[`${left}≡${right}`,`${left}≠${right}`,`${right}≡${left}`,'X≡Y',`${left}≡${right}`,`IF(${left}≡${right})⇒X`],facts=choices.filter((_,index)=>mask&(1<<index)),{s,ref,refs}=setup([...facts,rule].join(';'),rule),query={frameId:'frame',left:reverse?right:left,right:reverse?left:right},actual=evaluateAuthoredComparison([s],ref,refs,query),{mechanism,...semantic}=actual
  assert.deepEqual(semantic,oracle([s],ref,refs,query));assert.equal(mechanism?.admitted,actual.proofs.length>0);checked++
 }
 assert.equal(checked,768)
})
