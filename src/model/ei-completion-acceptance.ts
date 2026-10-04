/**
 * Prevents a bounded repair or a passing test suite from becoming a whole-field
 * completion claim. This is an engineering acceptance check, not a source law.
 * References and observations must be supplied by the caller. Their contents,
 * authenticity, physical behavior, and private ownership are not established here.
 */
export const EI_REQUIRED_COMPLETION_IDS = Object.freeze([
  'same-mechanism-across-grains',
  'addressed-selection-and-zoom',
  'source-derived-tetrahedral-placement',
  'centre-out-source-drawing',
  'inherited-tip-centre-orientation',
  'shared-root-thread-intersections',
  'complete-pixel-frame-tick-coverage',
  'whole-field-simultaneous-completion',
  'recursive-gate-execution',
  'source-derived-conversational-meaning',
  'private-source-address-ownership',
  'rejected-baseline-preserved',
  'whole-ledger-binary-act',
  'whole-ledger-source-address',
  'source-logic-before-applicable-operation',
  'continuous-input-output-carrier-bridge',
] as const)

export type EICompletionRequirementId = typeof EI_REQUIRED_COMPLETION_IDS[number]
export type EICompletionSource = Readonly<{ sourceRef: string; sourceRevision: string }>
export type EICompletionEvidence = Readonly<{
  id: string
  requirementId: EICompletionRequirementId
  source: EICompletionSource
  scope: 'whole-ledger' | 'bounded-local-repair'
  status: 'passed' | 'failed' | 'unknown'
  evidenceKind: 'direct-observation' | 'source-review' | 'unit-test' | 'build'
  recordRefs: readonly string[]
  observationRefs: readonly string[]
}>
export type EICompletionInput = Readonly<{
  source: EICompletionSource
  ledger: Readonly<{
    extent: 'whole-ledger' | 'subset' | 'unknown'
    recordRefs: readonly string[]
    unresolvedRecordRefs: readonly string[]
  }>
  evidence: readonly EICompletionEvidence[]
}>
export type EICompletionBlocker = Readonly<{
  code: string
  requirementId?: EICompletionRequirementId
  evidenceId?: string
}>
export type EICompletionRow = Readonly<{
  requirementId: EICompletionRequirementId
  status: 'passed' | 'failed' | 'unknown' | 'missing' | 'invalid'
  evidenceIds: readonly string[]
  blockers: readonly EICompletionBlocker[]
}>
export type EICompletionManifestReport = Readonly<{
  scope: 'supplied-evidence-manifest'
  source: EICompletionSource
  manifestConsistent: boolean
  requiredIds: typeof EI_REQUIRED_COMPLETION_IDS
  rows: readonly EICompletionRow[]
  blockers: readonly EICompletionBlocker[]
}>
export type EICompletionReport = Readonly<{
  scope: 'full-required-field'
  source: EICompletionSource
  wholeComplete: false
  requiredIds: typeof EI_REQUIRED_COMPLETION_IDS
  rows: readonly EICompletionRow[]
  blockers: readonly EICompletionBlocker[]
  manifest: EICompletionManifestReport
}>

const required = new Set<string>(EI_REQUIRED_COMPLETION_IDS)
const evidenceKinds = new Set(['direct-observation', 'source-review', 'unit-test', 'build'])
const statuses = new Set(['passed', 'failed', 'unknown'])
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0
const refs = (value: unknown): value is readonly string[] => Array.isArray(value) && value.length > 0 && Array.from(value).every(text) && new Set(value).size === value.length
const validSource = (source: EICompletionSource): boolean => !!source && text(source.sourceRef) && text(source.sourceRevision)
const sameSource = (left: EICompletionSource, right: EICompletionSource): boolean => validSource(left) && validSource(right) && left.sourceRef === right.sourceRef && left.sourceRevision === right.sourceRevision
const sameRefs = (left: readonly string[], right: readonly string[]): boolean => left.length === right.length && left.every(ref => right.includes(ref))
function freeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze)
    Object.freeze(value)
  }
  return value
}
function inspectEvidence(evidence: EICompletionEvidence, source: EICompletionSource, seen: Set<string>): EICompletionBlocker[] {
  const blockers: EICompletionBlocker[] = []
  const add = (code: string) => blockers.push({ code, ...(required.has(evidence.requirementId) ? { requirementId: evidence.requirementId } : {}), ...(text(evidence.id) ? { evidenceId: evidence.id } : {}) })
  if (!text(evidence.id)) add('missing-evidence-id')
  else if (seen.has(evidence.id)) add('duplicate-evidence-id')
  seen.add(evidence.id)
  if (!required.has(evidence.requirementId)) add('unknown-requirement')
  if (!sameSource(evidence.source, source)) add('source-revision-mismatch')
  if (!statuses.has(evidence.status)) add('invalid-evidence-status')
  if (!evidenceKinds.has(evidence.evidenceKind)) add('invalid-evidence-kind')
  if (!refs(evidence.recordRefs)) add('invalid-evidence-record-refs')
  if (!refs(evidence.observationRefs)) add('missing-observation-refs')
  return blockers
}

/**
 * Always evaluates the immutable full requirement set, never a caller-selected
 * subset. Every supplied receipt must be current and consistent; do not mix
 * historical evidence with the current batch. A direct-observation label is only
 * a caller assertion here. Passing this validator is NOT verified completion.
 * Unit/build/source checks cannot even stand in for observed behavior metadata.
 */
export function validateEICompletionManifest(input: EICompletionInput): EICompletionManifestReport {
  const blockers: EICompletionBlocker[] = []
  if (!validSource(input.source)) blockers.push({ code: 'invalid-current-source' })
  if (input.ledger.extent !== 'whole-ledger') blockers.push({ code: 'whole-ledger-scope-unestablished' })
  if (!refs(input.ledger.recordRefs)) blockers.push({ code: 'invalid-required-record-refs' })
  if (!Array.isArray(input.ledger.unresolvedRecordRefs) || input.ledger.unresolvedRecordRefs.length > 0) blockers.push({ code: 'unresolved-source-records' })

  const seen = new Set<string>()
  const inspected = input.evidence.map(evidence => {
    const issues = inspectEvidence(evidence, input.source, seen)
    const add = (code: string) => issues.push({ code, ...(required.has(evidence.requirementId) ? { requirementId: evidence.requirementId } : {}), evidenceId: evidence.id })
    if (evidence.scope !== 'whole-ledger') add('bounded-evidence-cannot-close-whole')
    if (evidence.evidenceKind !== 'direct-observation') add('direct-observation-required')
    if (!refs(input.ledger.recordRefs) || !refs(evidence.recordRefs) || !sameRefs(evidence.recordRefs, input.ledger.recordRefs)) add('whole-ledger-record-coverage-mismatch')
    blockers.push(...issues)
    return { evidence, issues }
  })

  const rows: EICompletionRow[] = EI_REQUIRED_COMPLETION_IDS.map(requirementId => {
    const entries = inspected.filter(item => item.evidence.requirementId === requirementId)
    const issues = entries.flatMap(item => item.issues)
    let status: EICompletionRow['status'] = 'passed'
    if (!entries.length) { status = 'missing'; issues.push({ code: 'missing-requirement-evidence', requirementId }) }
    else if (issues.length) status = 'invalid'
    else if (entries.some(item => item.evidence.status === 'failed')) { status = 'failed'; issues.push({ code: 'requirement-failed', requirementId }) }
    else if (entries.some(item => item.evidence.status === 'unknown')) { status = 'unknown'; issues.push({ code: 'requirement-unknown', requirementId }) }
    for (const issue of issues) if (!blockers.includes(issue)) blockers.push(issue)
    return { requirementId, status, evidenceIds: entries.map(item => item.evidence.id), blockers: issues }
  })
  return freeze({ scope: 'supplied-evidence-manifest', source: { ...input.source }, manifestConsistent: blockers.length === 0 && rows.every(row => row.status === 'passed'), requiredIds: EI_REQUIRED_COMPLETION_IDS, rows, blockers })
}

/**
 * Actual observation checks for the complete required field are not implemented.
 * Keep the production gate closed until real check producers and receipt binding
 * are wired here. Never promote a caller's expected/status values to observations.
 * This does not implement authentication or confer source ownership.
 */
export function evaluateEICompletion(input: EICompletionInput): EICompletionReport {
  const manifest = validateEICompletionManifest(input)
  const unbound: EICompletionBlocker = { code: 'observation-checks-unbound' }
  const rows = manifest.rows.map(row => row.status === 'passed'
    ? { ...row, status: 'unknown' as const, blockers: [...row.blockers, { code: unbound.code, requirementId: row.requirementId }] }
    : row)
  return freeze({
    scope: 'full-required-field', source: { ...input.source }, wholeComplete: false,
    requiredIds: EI_REQUIRED_COMPLETION_IDS, rows,
    blockers: [...manifest.blockers, unbound], manifest,
  })
}

export class EICompletionBlockedError extends Error {
  readonly report: EICompletionReport
  constructor(report: EICompletionReport) {
    super(`Whole-field completion blocked: ${report.blockers.map(item => item.code).join(', ')}`)
    this.name = 'EICompletionBlockedError'
    this.report = report
  }
}

/** Call immediately before allowing a full completion claim, using current input. */
export function assertEIWholeCompletion(input: EICompletionInput): EICompletionReport {
  const report = evaluateEICompletion(input)
  if (!report.wholeComplete) throw new EICompletionBlockedError(report)
  return report
}

export type EIBoundedRepairReport = Readonly<{
  scope: 'bounded-local-repair'
  source: EICompletionSource
  wholeComplete: false
  status: 'consistent' | 'blocked'
  verification: 'supplied-evidence-only'
  requirementIds: readonly EICompletionRequirementId[]
  recordRefs: readonly string[]
  evidenceIds: readonly string[]
  blockers: readonly EICompletionBlocker[]
}>

/** Records a local repair's supplied checks, without verifying or enlarging its claim. */
export function reportEIBoundedRepair(source: EICompletionSource, evidence: readonly EICompletionEvidence[]): EIBoundedRepairReport {
  const blockers: EICompletionBlocker[] = []
  if (!validSource(source)) blockers.push({ code: 'invalid-current-source' })
  if (!evidence.length) blockers.push({ code: 'missing-local-evidence' })
  const seen = new Set<string>()
  for (const receipt of evidence) {
    blockers.push(...inspectEvidence(receipt, source, seen))
    if (receipt.scope !== 'bounded-local-repair') blockers.push({ code: 'local-repair-scope-required', evidenceId: receipt.id })
    if (receipt.status !== 'passed') blockers.push({ code: 'local-evidence-not-passed', evidenceId: receipt.id })
  }
  return freeze({
    scope: 'bounded-local-repair', source: { ...source }, wholeComplete: false,
    status: blockers.length ? 'blocked' : 'consistent', verification: 'supplied-evidence-only',
    requirementIds: [...new Set(evidence.map(item => item.requirementId).filter(id => required.has(id)))],
    recordRefs: [...new Set(evidence.flatMap(item => refs(item.recordRefs) ? item.recordRefs : []))],
    evidenceIds: evidence.map(item => item.id), blockers,
  })
}
