import test from 'node:test'
import assert from 'node:assert/strict'
import {
  EI_REQUIRED_COMPLETION_IDS, EICompletionBlockedError,
  evaluateEICompletion, validateEICompletionManifest, assertEIWholeCompletion, reportEIBoundedRepair,
  type EICompletionEvidence, type EICompletionInput, type EICompletionRequirementId,
} from '../src/model/ei-completion-acceptance.ts'

// Synthetic receipts exercise the gate's logic. They are not acceptance evidence
// for the application, an animation, source interpretation, or private ownership.
const source = { sourceRef: 'synthetic-ledger', sourceRevision: 'revision-2' }
const recordRefs = ['synthetic-root', 'synthetic-child']
const receipt = (requirementId: EICompletionRequirementId, overrides: Partial<EICompletionEvidence> = {}): EICompletionEvidence => ({
  id: `synthetic-observation:${requirementId}`, requirementId, source,
  scope: 'whole-ledger', status: 'passed', evidenceKind: 'direct-observation',
  recordRefs, observationRefs: [`synthetic-readback:${requirementId}`], ...overrides,
})
const completeInput = (): EICompletionInput => ({
  source, ledger: { extent: 'whole-ledger', recordRefs, unresolvedRecordRefs: [] },
  evidence: EI_REQUIRED_COMPLETION_IDS.map(id => receipt(id)),
})
const blocked = (input: EICompletionInput, code: string) => {
  const report = validateEICompletionManifest(input)
  assert.equal(report.manifestConsistent, false)
  assert.equal(evaluateEICompletion(input).wholeComplete, false)
  assert.equal(report.rows.length, 16)
  assert.ok(report.blockers.some(item => item.code === code), code)
  assert.throws(() => assertEIWholeCompletion(input), EICompletionBlockedError)
  return report
}

test('all 16 obligations are immutable and include whole-ledger ACT and source address', () => {
  assert.equal(EI_REQUIRED_COMPLETION_IDS.length, 16)
  assert.equal(new Set(EI_REQUIRED_COMPLETION_IDS).size, 16)
  assert.ok(EI_REQUIRED_COMPLETION_IDS.includes('whole-ledger-binary-act'))
  assert.ok(EI_REQUIRED_COMPLETION_IDS.includes('whole-ledger-source-address'))
  assert.ok(EI_REQUIRED_COMPLETION_IDS.includes('source-logic-before-applicable-operation'))
  assert.ok(EI_REQUIRED_COMPLETION_IDS.includes('continuous-input-output-carrier-bridge'))
  assert.ok(Object.isFrozen(EI_REQUIRED_COMPLETION_IDS))
  assert.throws(() => (EI_REQUIRED_COMPLETION_IDS as unknown as string[]).pop(), TypeError)
})

test('empty and passing subsets leave all remaining obligations open', () => {
  for (const count of [0, 1, 12, 13, 14, 15]) {
    const input = completeInput()
    const report = blocked({ ...input, evidence: input.evidence.slice(0, count) }, 'missing-requirement-evidence')
    assert.equal(report.rows.filter(row => row.status === 'passed').length, count)
    assert.equal(report.rows.filter(row => row.status === 'missing').length, 16 - count)
  }
})

test('complete synthetic observation metadata only satisfies manifest consistency', () => {
  const report = validateEICompletionManifest(completeInput())
  assert.equal(report.manifestConsistent, true)
  assert.deepEqual(report.requiredIds, EI_REQUIRED_COMPLETION_IDS)
  assert.ok(report.rows.every(row => row.status === 'passed'))
  assert.deepEqual(report.blockers, [])
  assert.ok(Object.isFrozen(report) && Object.isFrozen(report.rows) && Object.isFrozen(report.rows[0].evidenceIds))
})

test('production completion stays blocked even when all supplied assertions say passed', () => {
  const input = completeInput()
  const report = evaluateEICompletion(input)
  assert.equal(report.manifest.manifestConsistent, true)
  assert.equal(report.wholeComplete, false)
  assert.ok(report.rows.every(row => row.status === 'unknown'))
  assert.ok(report.blockers.some(item => item.code === 'observation-checks-unbound'))
  assert.throws(() => assertEIWholeCompletion(input), (error: unknown) => {
    assert.ok(error instanceof EICompletionBlockedError)
    assert.equal(error.report.wholeComplete, false)
    assert.ok(error.report.blockers.some(item => item.code === 'observation-checks-unbound'))
    return true
  })
})

test('each required row is indispensable and a failed or unknown row blocks the full claim', () => {
  for (const id of EI_REQUIRED_COMPLETION_IDS) {
    const input = completeInput()
    blocked({ ...input, evidence: input.evidence.filter(item => item.requirementId !== id) }, 'missing-requirement-evidence')
    for (const status of ['failed', 'unknown'] as const) {
      const report = blocked({ ...input, evidence: input.evidence.map(item => item.requirementId === id ? { ...item, status } : item) }, `requirement-${status}`)
      assert.equal(report.rows.find(row => row.requirementId === id)?.status, status)
    }
  }
})

test('stale source revisions and wrong source identities reject otherwise passing evidence', () => {
  const input = completeInput()
  for (const wrongSource of [{ ...source, sourceRevision: 'revision-1' }, { ...source, sourceRef: 'another-ledger' }]) {
    blocked({ ...input, evidence: input.evidence.map((item, index) => index === 0 ? { ...item, source: wrongSource } : item) }, 'source-revision-mismatch')
  }
  blocked({ ...input, source: { ...source, sourceRevision: 'revision-3' } }, 'source-revision-mismatch')
  // A fresh passing receipt cannot hide conflicting old evidence in the batch.
  blocked({ ...input, evidence: [...input.evidence, receipt(EI_REQUIRED_COMPLETION_IDS[0], { id: 'stale', source: { ...source, sourceRevision: 'revision-1' } })] }, 'source-revision-mismatch')
})

test('partial, unknown, empty, or unresolved source scope cannot establish whole-ledger execution', () => {
  const input = completeInput()
  for (const extent of ['subset', 'unknown'] as const) blocked({ ...input, ledger: { ...input.ledger, extent } }, 'whole-ledger-scope-unestablished')
  blocked({ ...input, ledger: { ...input.ledger, recordRefs: [] } }, 'invalid-required-record-refs')
  blocked({ ...input, ledger: { ...input.ledger, unresolvedRecordRefs: ['unavailable-source'] } }, 'unresolved-source-records')
  for (const coverage of [['synthetic-root'], [...recordRefs, 'unrelated-record'], ['synthetic-root', 'synthetic-root']]) {
    blocked({ ...input, evidence: input.evidence.map((item, index) => index === 0 ? { ...item, recordRefs: coverage } : item) }, 'whole-ledger-record-coverage-mismatch')
  }
})

test('local receipts, build, source review, and unit tests cannot prove full behavioral completion', () => {
  const input = completeInput()
  blocked({ ...input, evidence: input.evidence.map(item => ({ ...item, scope: 'bounded-local-repair' })) }, 'bounded-evidence-cannot-close-whole')
  for (const evidenceKind of ['unit-test', 'build', 'source-review'] as const) {
    blocked({ ...input, evidence: input.evidence.map(item => ({ ...item, evidenceKind })) }, 'direct-observation-required')
  }
})

test('unknown requirements, repeated receipts, missing references and malformed statuses fail closed', () => {
  const input = completeInput()
  blocked({ ...input, evidence: [...input.evidence, receipt('unknown-row' as EICompletionRequirementId)] }, 'unknown-requirement')
  blocked({ ...input, evidence: [...input.evidence, input.evidence[0]] }, 'duplicate-evidence-id')
  for (const observationRefs of [[], [''], ['same', 'same'], new Array<string>(1)]) {
    blocked({ ...input, evidence: input.evidence.map((item, index) => index === 0 ? { ...item, observationRefs } : item) }, 'missing-observation-refs')
  }
  blocked({ ...input, evidence: [receipt(EI_REQUIRED_COMPLETION_IDS[0], { status: 'complete' as 'passed' }), ...input.evidence.slice(1)] }, 'invalid-evidence-status')
  blocked({ ...input, source: { sourceRef: '', sourceRevision: '' } }, 'invalid-current-source')
})

test('bounded repair report remains scoped even if every requirement has a passing local check', () => {
  const evidence = completeInput().evidence.map(item => ({ ...item, scope: 'bounded-local-repair' as const, evidenceKind: 'unit-test' as const, recordRefs: ['synthetic-child'] }))
  for (const checks of [evidence.slice(0, 1), evidence]) {
    const report = reportEIBoundedRepair(source, checks)
    assert.equal(report.status, 'consistent')
    assert.equal(report.verification, 'supplied-evidence-only')
    assert.equal(report.scope, 'bounded-local-repair')
    assert.equal(report.wholeComplete, false)
    assert.deepEqual(report.recordRefs, ['synthetic-child'])
    assert.equal(report.requirementIds.length, checks.length)
    assert.ok(Object.isFrozen(report) && Object.isFrozen(report.recordRefs))
  }
  assert.equal(reportEIBoundedRepair(source, []).status, 'blocked')
  assert.equal(reportEIBoundedRepair(source, [receipt(EI_REQUIRED_COMPLETION_IDS[0])]).status, 'blocked')
  assert.equal(reportEIBoundedRepair(source, [{ ...evidence[0], status: 'failed' }]).status, 'blocked')
  assert.equal(reportEIBoundedRepair({ ...source, sourceRevision: 'changed' }, evidence).status, 'blocked')
})

test('evaluation snapshots its output without freezing or mutating caller evidence', () => {
  const input = completeInput()
  const before = JSON.stringify(input)
  const report = evaluateEICompletion(input)
  assert.equal(JSON.stringify(input), before)
  assert.equal(Object.isFrozen(input.source), false)
  assert.equal(Object.isFrozen(input.evidence), false)
  assert.equal(Object.isFrozen(input.evidence[0]), false)
  assert.notEqual(report.source, input.source)
})
