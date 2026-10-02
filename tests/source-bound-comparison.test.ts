import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { AUTHORED_COMPARE_CLAUSE as RULE, AUTHORED_IDENTITY_CLAUSE, evaluateAuthoredComparison as compare, isComparisonTerm,
  type ClauseRef, type ComparisonSource } from '../src/model/source-bound-comparison.ts'
// Exact technical clauses retained in docs/SOURCE-MECHANISM.md.
// This test fixture is a retained excerpt, not a claim to store its whole message.
const clauses = ['Ω≡Ω(Ω)', '⟦Ω⟧≡Ω', 'U₀≡R', 'S≡ℜ(H)', 'T₀≠T∞', '?≠⊥', RULE]
const source: ComparisonSource = { recordAddress:'source/authored-excerpt',sourceId:'authored-comparison-excerpt',revision:0,frameId:'authored-oct1',text:clauses.join(';') }
function ref(s: ComparisonSource, exact: string): ClauseRef {
  const start = s.text.indexOf(exact); assert.ok(start >= 0)
  return { recordAddress:s.recordAddress,sourceId:s.sourceId,revision:s.revision,start,end:start+exact.length,exact }
}
const rule = ref(source,RULE), witnesses = clauses.slice(0,-1).map(c=>ref(source,c))
const run = (left:string,right:string,refs=witnesses)=>compare([source],rule,refs,{frameId:source.frameId,left,right})
test('actual authored U₀≡R derives U₀⋈R with explicit substitution despite unequal text',()=>{
  const r=run('U₀','R'); assert.equal(r.status,'known-identity'); assert.equal(r.proofs.length,1)
  assert.deepEqual(r.proofs[0].substitution,{a:'U₀',b:'R'}); assert.deepEqual(r.proofs[0].conclusion,{kind:'relation',operator:'⋈',left:'U₀',right:'R'})
  assert.equal(r.proofs[0].premise.source.exact,'U₀≡R'); assert.equal(r.proofs[0].rule.exact,RULE)
})
test('actual Ω self-expression and interpreted Ω each derive only their witnessed pair',()=>{
  assert.equal(run('Ω','Ω(Ω)').status,'known-identity'); assert.equal(run('⟦Ω⟧','Ω').status,'known-identity')
  assert.equal(run('⟦Ω⟧','Ω(Ω)').status,'unresolved') // no invented transitivity
})
test('actual T₀≠T∞ derives symbolic Δ(T₀,T∞)→L, not a ledger mutation',()=>{
  const r=run('T₀','T∞'); assert.equal(r.status,'known-difference')
  assert.deepEqual(r.proofs[0].conclusion,{kind:'transition',from:{operator:'Δ',left:'T₀',right:'T∞'},to:'L'})
})
test('equal display terms do not manufacture identity',()=>assert.equal(run('Ω','Ω').status,'unresolved'))
test('absent, reversed, older U and arbitrary operands stay unbound',()=>{
  for(const [a,b] of [['R','U₀'],['U','R'],['unknown','R'],['T∞','T₀']])assert.equal(run(a,b).status,'unresolved')
})
test('generic explicitly supplied operands work without an authored-name dispatch table',()=>{
  const s={...source,sourceId:'synthetic-generic-test',text:`alpha≡beta;${RULE}`}
  const r=compare([s],ref(s,RULE),[ref(s,'alpha≡beta')],{frameId:s.frameId,left:'alpha',right:'beta'})
  assert.equal(r.status,'known-identity');assert.equal(r.proofs[0].substitution.a,'alpha')
})
test('conflicting witnesses are retained with no arbitrary chosen consequence',()=>{
  const s={...source,sourceId:'synthetic-conflict-test',text:`a≡b;a≠b;${RULE}`}
  const r=compare([s],ref(s,RULE),[ref(s,'a≡b'),ref(s,'a≠b')],{frameId:s.frameId,left:'a',right:'b'})
  assert.equal(r.status,'unresolved');assert.equal(r.conflict,true);assert.equal(r.identityWitnesses.length,1);assert.equal(r.differenceWitnesses.length,1);assert.deepEqual(r.proofs,[])
})
test('explicitly scoped parallel premise witnesses remain individually addressable',()=>{
  const second={...source,sourceId:'second-retained-source',recordAddress:'source/second'}
  const programScope={id:'explicit-parallel-test',sources:[source,second].map(({recordAddress,sourceId,revision,frameId})=>({recordAddress,sourceId,revision,frameId}))}
  const r=compare([source,second],rule,[ref(source,'U₀≡R'),ref(second,'U₀≡R')],{frameId:source.frameId,left:'U₀',right:'R'},programScope)
  assert.equal(r.proofs.length,2);assert.notEqual(r.proofs[0].premise.source.sourceId,r.proofs[1].premise.source.sourceId)
})
test('same tokens in different source frame do not supply identity',()=>{
  const other={...source,frameId:'different-frame',recordAddress:'source/other'}
  const r=compare([source,other],rule,[ref(other,'U₀≡R')],{frameId:source.frameId,left:'U₀',right:'R'})
  assert.equal(r.status,'unresolved');assert.equal(r.unused[0].reason,'different-frame')
})
test('altered, stale or ambiguous source refs reject without false proof',()=>{
  assert.throws(()=>compare([source],rule,[{...ref(source,'U₀≡R'),exact:'U₀≠R'}],{frameId:source.frameId,left:'U₀',right:'R'}))
  assert.throws(()=>compare([source],{...rule,revision:1},witnesses,{frameId:source.frameId,left:'U₀',right:'R'}))
  assert.throws(()=>compare([source,source],rule,witnesses,{frameId:source.frameId,left:'U₀',right:'R'}))
})
test('equality inside a conditional is not admitted as an unconditional premise',()=>{
  const s={...source,text:`x⇒a≡b;${RULE}`}
  assert.throws(()=>compare([s],ref(s,RULE),[ref(s,'a≡b')],{frameId:s.frameId,left:'a',right:'b'}))
  const r=compare([s],ref(s,RULE),[ref(s,'x⇒a≡b')],{frameId:s.frameId,left:'a',right:'b'})
  assert.equal(r.status,'unresolved');assert.equal(r.unused[0].reason,'unsupported-clause')
})
test('restricted syntax neither interprets English nor invents operator precedence',()=>{
  for(const term of ['Iᵁ(U₀,Ω)','a⋈b','hello world','a()','a(b)c','a(b','a≡b'])assert.equal(isComparisonTerm(term),false)
  for(const term of ['Ω','U₀','Ω(Ω)','⟦Ω⟧','S','ℜ(H)','a(b(c))'])assert.equal(isComparisonTerm(term),true)
})
test('actual public inventory JSON pointer proof preserves older U distinctly from U₀',()=>{
  const inventory=JSON.parse(readFileSync(new URL('../docs/FRACTURE-FIELD-INVENTORY.json',import.meta.url),'utf8'))
  const retained:string[]=inventory.retained_binary_relations
  const s:ComparisonSource={recordAddress:'model/inventory-root',sourceId:'actual-inventory-test:'+inventory.source_revision,revision:0,frameId:'public-inventory',text:JSON.stringify({inventory_statements:{retained_binary_relations:retained}})}
  const p=(exact:string):ClauseRef=>{const n=retained.indexOf(exact);assert.ok(n>=0);return{recordAddress:s.recordAddress,sourceId:s.sourceId,revision:0,pointer:`/inventory_statements/retained_binary_relations/${n}`,start:0,end:exact.length,exact}}
  const query={frameId:s.frameId,left:'U',right:'R'}
  const r=compare([s],p(RULE),[p('U≡R'),p('T₀≠T∞')],query)
  assert.equal(r.status,'known-identity');assert.equal(r.proofs[0].premise.source.pointer,p('U≡R').pointer)
  assert.equal(compare([s],p(RULE),[p('U≡R')],{...query,left:'U₀'}).status,'unresolved')
  assert.equal(compare([s],p(RULE),[p('T₀≠T∞')],{frameId:s.frameId,left:'T₀',right:'T∞'}).status,'known-difference')
})
test('unknown is not negative evidence, and no source means no proof',()=>{
  assert.equal(run('U₀','R',[]).status,'unresolved');assert.deepEqual(run('U₀','R',[]).proofs,[])
})
test('literal ? and ⊥ form an explicit difference witness, never an absence branch',()=>{
  const result=run('?','⊥')
  assert.equal(result.status,'known-difference')
  assert.deepEqual(result.proofs[0].conclusion,{kind:'transition',from:{operator:'Δ',left:'?',right:'⊥'},to:'L'})
  assert.equal(run('?','⊥',[]).status,'unresolved')
})
test('standalone ≡→⋈ has an identity branch only and retains conflicting evidence',()=>{
  const s={...source,text:`a≡b;c≠d;${AUTHORED_IDENTITY_CLAUSE}`}
  const identityRule=ref(s,AUTHORED_IDENTITY_CLAUSE)
  const identity=compare([s],identityRule,[ref(s,'a≡b')],{frameId:s.frameId,left:'a',right:'b'})
  assert.equal(identity.proofs.length,1)
  const difference=compare([s],identityRule,[ref(s,'c≠d')],{frameId:s.frameId,left:'c',right:'d'})
  assert.equal(difference.status,'known-difference'); assert.deepEqual(difference.proofs,[])
  const conflictSource={...s,text:`a≡b;a≠b;${AUTHORED_IDENTITY_CLAUSE}`}
  const conflict=compare([conflictSource],ref(conflictSource,AUTHORED_IDENTITY_CLAUSE),[ref(conflictSource,'a≡b'),ref(conflictSource,'a≠b')],{frameId:s.frameId,left:'a',right:'b'})
  assert.equal(conflict.conflict,true); assert.deepEqual(conflict.proofs,[])
})
test('same frame label alone cannot bind a different source into the rule',()=>{
  const other={...source,sourceId:'unbound-other',recordAddress:'source/unbound'}
  const result=compare([source,other],rule,[ref(other,'U₀≡R')],{frameId:source.frameId,left:'U₀',right:'R'})
  assert.equal(result.status,'unresolved');assert.equal(result.unused[0].reason,'outside-program-scope')
})
