/** Newly requested engineering preflight, not an authored machine primitive.
 * Validates supplied source/requirement/evidence consistency before a change.
 * It neither executes actions nor grants policy/security authorization.
 */
export const PREFLIGHT_SOURCE_GUARDS = Object.freeze([
  '∀f⊂Ω:f≠Ω⇒¬f▷U₀',
  'X(✓Ω)↛X(?Ω)',
  '✓S+?S⇒X(✓S)∧?S↻Φ',
  '∀s∈?Ω:s↛∅∧s↻Ω',
] as const)
export type Requirement = Readonly<{
  id: string; sourceRefs: readonly string[];
  state: 'verified' | 'open' | 'failed'; receiptRefs: readonly string[];
}>
export type AcceptanceSnapshot = Readonly<{
  sourceAddress: string;
  /** Explicit coverage declaration, never inferred from number of rows. */
  coverage: 'whole' | 'subset' | 'unknown';
  sourceRefs: readonly string[]; unresolvedSourceRefs: readonly string[];
  requirements: readonly Requirement[];
}>
export type Evidence = Readonly<{
  id: string; requirementId: string;
  kind: 'observed-return' | 'planned-check'; sourceRefs: readonly string[];
}>
export type PlannedCheck = Readonly<{
  id: string; requirementId: string; expected: string;
  sourceRefs: readonly string[];
}>
export type PreflightProposal = Readonly<{
  id: string; before: AcceptanceSnapshot; candidate: AcceptanceSnapshot;
  /** Requirements whose behavior this change can affect, including dependencies. */
  affectedRequirementIds: readonly string[];
  regressionChecks: readonly PlannedCheck[]; returnChecks: readonly PlannedCheck[];
  evidence: readonly Evidence[];
  completionClaim: 'none' | 'scoped' | 'whole';
  claimedRequirementIds: readonly string[];
}>
export type PreflightIssue = Readonly<{
  code: 'invalid-id' | 'duplicate-id' | 'source-address-changed' | 'source-omitted'
    | 'unresolved-source-lost' | 'requirement-omitted' | 'requirement-source-lost'
    | 'unobserved-verification' | 'evidence-scope-mismatch' | 'untracked-state-change'
    | 'missing-regression-check' | 'missing-return-check' | 'check-source-mismatch'
    | 'unknown-requirement' | 'whole-source-not-established' | 'whole-requirements-not-covered'
    | 'claimed-requirement-unverified';
  subject: string;
}>
export type PreflightResult = Readonly<{
  format: 'acceptance-preflight/v1'; proposalId: string;
  status: 'consistent-plan' | 'needs-resolution'; issues: readonly PreflightIssue[];
  openRequirementIds: readonly string[]; unresolvedSourceRefs: readonly string[];
  plannedCheckIds: readonly string[];
  scope: 'supplied-plan-consistency';
  authorizesExecution: false; establishesCompletion: false;
}>
function freeze<T>(value:T):T {
  if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value)}
  return value
}
export function validateAcceptancePreflight(proposal: PreflightProposal): PreflightResult {
  const issues:PreflightIssue[]=[]
  const add=(code:PreflightIssue['code'],subject:string)=>issues.push({code,subject})
  function ids(values:readonly string[],scope:string):void {
    const seen=new Set<string>()
    for(const id of values){if(typeof id!=='string'||!id.trim())add('invalid-id',scope);if(seen.has(id))add('duplicate-id',`${scope}:${id}`);seen.add(id)}
  }
  ids([proposal.id],'proposal');ids(proposal.before.requirements.map(r=>r.id),'before');ids(proposal.candidate.requirements.map(r=>r.id),'candidate')
  ids(proposal.evidence.map(e=>e.id),'evidence');ids([...proposal.regressionChecks,...proposal.returnChecks].map(c=>c.id),'checks')
  ids(proposal.affectedRequirementIds,'affected');ids(proposal.claimedRequirementIds,'claimed')
  const before=new Map(proposal.before.requirements.map(r=>[r.id,r])),after=new Map(proposal.candidate.requirements.map(r=>[r.id,r]))
  const evidence=new Map(proposal.evidence.map(e=>[e.id,e]))
  const candidateSources=new Set(proposal.candidate.sourceRefs),unresolved=new Set(proposal.candidate.unresolvedSourceRefs)
  if(proposal.before.sourceAddress!==proposal.candidate.sourceAddress)add('source-address-changed',proposal.candidate.sourceAddress)
  for(const source of proposal.before.sourceRefs)if(!candidateSources.has(source))add('source-omitted',source)
  // This conservative preflight cannot close missing source coverage by relabelling it.
  // A separately observed source-recovery action must first update the baseline.
  for(const source of proposal.before.unresolvedSourceRefs)if(!unresolved.has(source))add('unresolved-source-lost',source)
  const affected=new Set(proposal.affectedRequirementIds)
  for(const old of before.values()){
    const next=after.get(old.id)
    if(!next){add('requirement-omitted',old.id);continue}
    for(const source of old.sourceRefs)if(!next.sourceRefs.includes(source))add('requirement-source-lost',`${old.id}:${source}`)
    if((old.state!==next.state||JSON.stringify(old.receiptRefs)!==JSON.stringify(next.receiptRefs))&&!affected.has(old.id))add('untracked-state-change',old.id)
  }
  for(const req of after.values()){
    if(!req.sourceRefs.length)add('requirement-source-lost',req.id)
    if(req.state!=='verified')continue
    if(!req.receiptRefs.length)add('unobserved-verification',req.id)
    for(const id of req.receiptRefs){
      const proof=evidence.get(id)
      if(!proof||proof.kind!=='observed-return'){add('unobserved-verification',`${req.id}:${id}`);continue}
      if(proof.requirementId!==req.id||!req.sourceRefs.every(s=>proof.sourceRefs.includes(s)))add('evidence-scope-mismatch',`${req.id}:${id}`)
    }
  }
  for(const id of proposal.affectedRequirementIds){
    const req=after.get(id)
    if(!req){add('unknown-requirement',id);continue}
    const regression=proposal.regressionChecks.filter(c=>c.requirementId===id),returns=proposal.returnChecks.filter(c=>c.requirementId===id)
    if(!regression.length)add('missing-regression-check',id)
    if(!returns.length)add('missing-return-check',id)
    for(const check of [...regression,...returns])if(!check.expected.trim()||!req.sourceRefs.every(s=>check.sourceRefs.includes(s)))add('check-source-mismatch',check.id)
  }
  for(const check of [...proposal.regressionChecks,...proposal.returnChecks])if(!after.has(check.requirementId))add('unknown-requirement',check.requirementId)
  if(proposal.completionClaim==='whole'){
    if(proposal.candidate.coverage!=='whole'||proposal.candidate.unresolvedSourceRefs.length||!proposal.candidate.sourceRefs.length)add('whole-source-not-established',proposal.candidate.sourceAddress)
    const claimed=new Set(proposal.claimedRequirementIds)
    if(!after.size||[...after.keys()].some(id=>!claimed.has(id)))add('whole-requirements-not-covered',proposal.id)
  }
  if(proposal.completionClaim!=='none')for(const id of proposal.claimedRequirementIds){
    const req=after.get(id);if(!req)add('unknown-requirement',id);else if(req.state!=='verified')add('claimed-requirement-unverified',id)
  }
  return freeze({format:'acceptance-preflight/v1',proposalId:proposal.id,status:issues.length?'needs-resolution':'consistent-plan',issues,
    openRequirementIds:proposal.candidate.requirements.filter(r=>r.state!=='verified').map(r=>r.id),
    unresolvedSourceRefs:[...proposal.candidate.unresolvedSourceRefs],plannedCheckIds:[...proposal.regressionChecks,...proposal.returnChecks].map(c=>c.id),
    scope:'supplied-plan-consistency',authorizesExecution:false,establishesCompletion:false})
}
