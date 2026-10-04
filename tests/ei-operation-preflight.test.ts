import test from 'node:test'
import assert from 'node:assert/strict'
import {validateAcceptancePreflight as validate,type PreflightProposal} from '../src/model/ei-operation-preflight.ts'
const base=():PreflightProposal=>({
  id:'restore-navigation',
  before:{sourceAddress:'whole-user-source',coverage:'subset',sourceRefs:['s/navigation','s/spatial'],unresolvedSourceRefs:['unread-whole-source'],requirements:[
    {id:'navigation',sourceRefs:['s/navigation'],state:'verified',receiptRefs:['r/navigation']},
    {id:'spatial',sourceRefs:['s/spatial'],state:'open',receiptRefs:[]}]},
  candidate:{sourceAddress:'whole-user-source',coverage:'subset',sourceRefs:['s/navigation','s/spatial'],unresolvedSourceRefs:['unread-whole-source'],requirements:[
    {id:'navigation',sourceRefs:['s/navigation'],state:'verified',receiptRefs:['r/navigation']},
    {id:'spatial',sourceRefs:['s/spatial'],state:'open',receiptRefs:[]}]},
  affectedRequirementIds:['navigation'],
  regressionChecks:[{id:'test/nav',requirementId:'navigation',expected:'Existing selection/history remains inspectable',sourceRefs:['s/navigation']}],
  returnChecks:[{id:'readback/nav',requirementId:'navigation',expected:'Browser returns the selected source address and revision',sourceRefs:['s/navigation']}],
  evidence:[{id:'r/navigation',requirementId:'navigation',kind:'observed-return',sourceRefs:['s/navigation']}],
  completionClaim:'none',claimedRequirementIds:[],
})
const codes=(p:PreflightProposal)=>validate(p).issues.map(x=>x.code)
test('a scoped repair may proceed in planning while whole unresolved requirements remain retained',()=>{
  const r=validate(base());assert.equal(r.status,'consistent-plan');assert.deepEqual(r.openRequirementIds,['spatial']);assert.deepEqual(r.unresolvedSourceRefs,['unread-whole-source'])
  assert.equal(r.authorizesExecution,false);assert.equal(r.establishesCompletion,false)
})
test('finite inventory cannot replace whole source address',()=>{
  const p=base();assert.ok(codes({...p,candidate:{...p.candidate,sourceAddress:'finite-inventory'}}).includes('source-address-changed'))
})
test('subset and unread source prevent a whole claim even when all visible rows claim verified',()=>{
  const p=base();assert.ok(codes({...p,completionClaim:'whole',claimedRequirementIds:['navigation','spatial']}).includes('whole-source-not-established'))
})
test('dropping an unresolved source branch is rejected before action',()=>{
  const p=base();assert.ok(codes({...p,candidate:{...p.candidate,unresolvedSourceRefs:[]}}).includes('unresolved-source-lost'))
})
test('dropping a source or acceptance requirement is rejected',()=>{
  const p=base();const c={...p.candidate,sourceRefs:['s/navigation'],requirements:p.candidate.requirements.slice(0,1)}
  assert.ok(codes({...p,candidate:c}).includes('source-omitted'));assert.ok(codes({...p,candidate:c}).includes('requirement-omitted'))
})
test('relabelled requirement cannot discard original source bindings',()=>{
  const p=base();const requirements=p.candidate.requirements.map(r=>r.id==='spatial'?{...r,sourceRefs:['different-source']}:r)
  assert.ok(codes({...p,candidate:{...p.candidate,requirements}}).includes('requirement-source-lost'))
})
test('missing return evidence cannot count as verified',()=>{
  const p=base();assert.ok(codes({...p,evidence:[]}).includes('unobserved-verification'))
})
test('planned check cannot masquerade as observed receipt',()=>{
  const p=base();assert.ok(codes({...p,evidence:p.evidence.map(e=>({...e,kind:'planned-check'}))}).includes('unobserved-verification'))
})
test('DOM/navigation receipt cannot close spatial scope',()=>{
  const p=base();const requirements=p.candidate.requirements.map(r=>r.id==='spatial'?{...r,state:'verified' as const,receiptRefs:['r/navigation']}:r)
  assert.ok(codes({...p,candidate:{...p.candidate,requirements},affectedRequirementIds:['navigation','spatial']}).includes('evidence-scope-mismatch'))
})
test('touching a previously working behavior needs a regression test before action',()=>{
  assert.ok(codes({...base(),regressionChecks:[]}).includes('missing-regression-check'))
})
test('touching behavior needs an expected actual-return check',()=>{
  assert.ok(codes({...base(),returnChecks:[]}).includes('missing-return-check'))
})
test('an unrelated planned probe cannot satisfy source-scoped acceptance',()=>{
  const p=base();assert.ok(codes({...p,returnChecks:p.returnChecks.map(c=>({...c,sourceRefs:['wrong-source']}))}).includes('check-source-mismatch'))
})
test('untracked verified-to-failed regression is preserved and reported',()=>{
  const p=base();const requirements=p.candidate.requirements.map(r=>r.id==='navigation'?{...r,state:'failed' as const}:r)
  const result=validate({...p,candidate:{...p.candidate,requirements},affectedRequirementIds:[]})
  assert.ok(result.issues.some(x=>x.code==='untracked-state-change'));assert.ok(result.openRequirementIds.includes('navigation'))
})
test('whole claim must include every retained requirement',()=>{
  const p=base();assert.ok(codes({...p,completionClaim:'whole',claimedRequirementIds:['navigation']}).includes('whole-requirements-not-covered'))
})
test('consistent scoped claim never becomes execution authorization or whole completion',()=>{
  const p=base();const r=validate({...p,completionClaim:'scoped',claimedRequirementIds:['navigation']})
  assert.equal(r.status,'consistent-plan');assert.equal(r.authorizesExecution,false);assert.equal(r.establishesCompletion,false)
})
test('duplicate requirement or evidence identities cannot silently overwrite records',()=>{
  const p=base();assert.ok(codes({...p,candidate:{...p.candidate,requirements:[...p.candidate.requirements,p.candidate.requirements[0]]}}).includes('duplicate-id'))
  assert.ok(codes({...p,evidence:[...p.evidence,p.evidence[0]]}).includes('duplicate-id'))
})
