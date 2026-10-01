import assert from 'node:assert/strict'
import test from 'node:test'
import {
  EI_IMPORT_NOTE, EI_LIMITS, advanceEI, chooseEI, commitEI, createEILedger,
  executeEI, exportEILedger, findEIAddress, importEILedger, parseEIInput,
  proposeEI, verifyEI, verifyLocalEI, walkEIRelations,
  type EICandidate, type EIExecution, type EIInput, type EILedger,
  type EIPatch, type EIProposal, type EISource,
} from '../src/model/ei-engine.ts'

const source = (text: string, realm = 'user-captured-text'): EISource => ({ id: `source:${text.slice(0, 80)}`, text, realm })
function initial(): EILedger {
  return createEILedger({ records: [
    { address: 'root', value: 'captured root', source: source('captured root') },
    { address: 'a', value: 'WAS A', source: source('WAS A'), parents: ['root'], relations: [{ relation: 'thread', address: 'b' }] },
    { address: 'b', value: 'WAS B', source: source('WAS B'), parents: ['root'], relations: [{ relation: 'thread', address: 'a' }] },
  ] })
}
function patch(address = 'a', value = 'IS A'): EIPatch { return { address, value, source: source(value) } }
function candidate(overrides: Partial<EICandidate> = {}): EICandidate {
  return { id: 'continue', label: 'Explicit local update', owner: 'engine', source: source('user-defined continuation'), conditions: [{ address: 'a', equals: 'WAS A' }], patches: [patch()], ...overrides }
}
function input(candidates: readonly EICandidate[] = [candidate()], id = 'transaction:1'): EIInput { return { id, producer: 'root', input: source('source input, not automatically a command'), candidates } }
function staged(ledger: EILedger, proposal: EIProposal, select?: string): EIExecution {
  const result = executeEI(ledger, proposal, select ? chooseEI(proposal, select) : undefined)
  assert.equal(result.status, 'staged')
  return result as EIExecution
}
function committed(): EILedger {
  const ledger = initial(), result = advanceEI(ledger, proposeEI(ledger, input()))
  assert.equal(result.status, 'committed')
  return result.ledger
}

test('source text is captured exactly without normalization or asserted truth', () => {
  const raw = '  R means record here\n𝟘\u0000e\u0301  '
  const ledger = createEILedger({ records: [{ address: 'R', value: raw, source: { id: 'verbatim', text: raw, realm: 'earlier-seed', locator: 'user supplied text' } }] })
  const record = findEIAddress(ledger, 'R')!
  assert.equal(record.is.value, raw)
  assert.equal(record.is.source.text, raw)
  assert.equal(record.is.source.realm, 'earlier-seed')
  assert.equal(importEILedger(exportEILedger(ledger)).records[0].is.value, raw)
  assert.match(EI_IMPORT_NOTE, /not source authenticity/)
})

test('sole engine continuation stages, reads actual local records, commits WAS/IS and returns receipt to producer atomically', () => {
  const ledger = initial(), before = exportEILedger(ledger), proposal = proposeEI(ledger, input())
  assert.equal(proposal.status, 'ready')
  const execution = staged(ledger, proposal)
  assert.equal(findEIAddress(ledger, 'a')!.is.value, 'WAS A')
  assert.throws(() => proposeEI(execution.stagedLedger, input()), /validate this ledger/)
  const verification = verifyLocalEI(execution)
  assert.equal(verification.scope, 'local-staged-records')
  assert.equal(verification.committable, true)
  const result = commitEI(ledger, verification)
  assert.equal(result.status, 'committed')
  const a = findEIAddress(result.ledger, 'a')!
  assert.equal(a.is.value, 'IS A')
  assert.equal(a.was[0].value, 'WAS A')
  assert.deepEqual(a.is.source, source('IS A'))
  assert.deepEqual(findEIAddress(result.ledger, 'root')!.receiptIds, [result.receipt.id])
  assert.deepEqual(result.ledger.receipts, [result.receipt])
  assert.equal(result.receipt.producer, 'root')
  assert.equal(result.receipt.selection?.mode, 'sole-engine-continuation')
  assert.equal(exportEILedger(ledger), before)
  assert.ok(Object.isFrozen(result.ledger.records[1].was[0].source))
})

test('a sole user-owned continuation stops until this proposal receives explicit selection', () => {
  const ledger = initial(), proposal = proposeEI(ledger, input([candidate({ owner: 'user' })]))
  assert.equal(proposal.status, 'selection-required')
  assert.equal(executeEI(ledger, proposal).status, 'blocked')
  const selection = chooseEI(proposal, 'continue'), result = advanceEI(ledger, proposal, selection)
  assert.equal(result.status, 'committed')
  assert.equal(result.receipt.selection?.mode, 'explicit-user')
  const second = proposeEI(ledger, input([candidate({ owner: 'user' })], 'transaction:2'))
  assert.equal(executeEI(ledger, second, selection).status, 'blocked')
  assert.equal(executeEI(ledger, proposal, { candidateId: 'continue', mode: 'explicit-user' }).status, 'blocked')
})

test('two admitted alternatives stay open and require explicit choice', () => {
  const ledger = initial(), proposal = proposeEI(ledger, input([candidate(), candidate({ id: 'other', patches: [patch('a', 'other text')] })]))
  assert.equal(proposal.status, 'open')
  assert.equal(executeEI(ledger, proposal).status, 'blocked')
  const result = advanceEI(ledger, proposal, chooseEI(proposal, 'other'))
  assert.equal(findEIAddress(result.ledger, 'a')!.is.value, 'other text')
  assert.equal(result.receipt.candidates.length, 2)
})

test('one admitted and one unbound alternative never imply a unique continuation', () => {
  const ledger = initial(), proposal = proposeEI(ledger, input([candidate(), candidate({ id: 'unknown', conditions: [{ address: 'not-captured', equals: 'yes' }] })]))
  assert.equal(proposal.status, 'open')
  assert.equal(proposal.candidates[1].unresolved, true)
  assert.equal(executeEI(ledger, proposal).status, 'blocked')
  assert.throws(() => chooseEI(proposal, 'unknown'), /admitted/)
  const result = advanceEI(ledger, proposal, chooseEI(proposal, 'continue'))
  assert.equal(result.status, 'committed')
  assert.ok(result.receipt.differences.some(d => d.address === 'not-captured' && d.status === 'unresolved'))
  assert.equal(result.receipt.candidates[1].unresolved, true)
})

test('no allowed continuation remains rest or unresolved without committing any state', () => {
  const ledger = initial()
  for (const [condition, expected] of [[{ address: 'a', equals: 'different' }, 'rest'], [{ address: 'missing', equals: 'WAS A' }, 'unresolved']] as const) {
    const proposal = proposeEI(ledger, input([candidate({ conditions: [condition] })]))
    assert.equal(proposal.status, expected)
    const result = advanceEI(ledger, proposal)
    assert.equal(result.status, 'blocked')
    assert.equal(result.ledger, ledger)
    assert.ok(result.receipt.differences.some(d => d.status === (expected === 'rest' ? 'failed' : 'unresolved')))
    assert.equal(result.ledger.receipts.length, 0)
  }
  assert.equal(proposeEI(ledger, input([])).status, 'rest')
})

test('exact text conditions do not coerce, infer semantics, normalize Unicode or ignore whitespace', () => {
  const ledger = createEILedger({ records: [{ address: 'x', value: 'true ', source: source('true ') }, { address: 'unicode', value: 'e\u0301', source: source('e\u0301') }] })
  for (const [address, equals] of [['x', 'true'], ['unicode', 'é']]) {
    const proposal = proposeEI(ledger, { ...input([candidate({ conditions: [{ address, equals }], patches: [patch('x', 'next')] })]), producer: 'x' })
    assert.equal(proposal.status, 'rest')
  }
  assert.throws(() => parseEIInput(JSON.stringify({ ...input(), candidates: [{ ...candidate(), conditions: [{ address: 'a', equals: true }] }] })), /text/)
})

test('stale source is rejected both before staging and at final commit', () => {
  const ledger = initial(), proposal = proposeEI(ledger, input()), execution = staged(ledger, proposal)
  const other = advanceEI(ledger, proposeEI(ledger, input([candidate({ patches: [patch('b', 'B advanced')] })], 'other')))
  assert.equal(other.status, 'committed')
  const rejected = executeEI(other.ledger, proposal)
  assert.equal(rejected.status, 'blocked')
  assert.equal('receipt' in rejected && rejected.receipt.reasons.some(r => r.includes('Stale')), true)
  const delayed = commitEI(other.ledger, verifyLocalEI(execution))
  assert.equal(delayed.status, 'rejected')
  assert.equal(delayed.ledger, other.ledger)
  assert.equal(findEIAddress(delayed.ledger, 'a')!.is.value, 'WAS A')
})

test('multi-node frame readback must match every addressed value before a single atomic commit', () => {
  const ledger = initial(), proposal = proposeEI(ledger, input([candidate({ patches: [patch('a', 'new A'), patch('b', 'new B')] })]))
  const execution = staged(ledger, proposal)
  const frame = [{ address: 'b', value: 'new B' }, { address: 'a', value: 'new A' }]
  const verification = verifyEI(execution, { kind: 'rendered-address-values', values: frame })
  const result = commitEI(ledger, verification)
  assert.equal(result.status, 'committed')
  assert.equal(result.receipt.scope, 'rendered-address-values')
  assert.deepEqual(result.receipt.checks.map(c => c.matches), [true, true])
  assert.equal(findEIAddress(result.ledger, 'a')!.was[0].value, 'WAS A')
  assert.equal(findEIAddress(result.ledger, 'b')!.was[0].value, 'WAS B')
  assert.equal(result.ledger.revision, 1)
  assert.equal(result.ledger.receipts.length, 1)
})

test('partial failed, missing, tampered, duplicate or unexpected readback rolls back all patches', () => {
  const ledger = initial(), before = exportEILedger(ledger), proposal = proposeEI(ledger, input([candidate({ patches: [patch('a', 'new A'), patch('b', 'new B')] })])), execution = staged(ledger, proposal)
  const cases = [
    [{ address: 'a', value: 'new A' }],
    [{ address: 'a', value: 'new A' }, { address: 'b', value: 'tampered B' }],
    [{ address: 'a', value: 'new A' }, { address: 'b', value: 'new B' }, { address: 'a', value: 'new A' }],
    [{ address: 'a', value: 'new A' }, { address: 'b', value: 'new B' }, { address: 'unrelated', value: 'text' }],
  ]
  for (const values of cases) {
    const verification = verifyEI(execution, { kind: 'rendered-address-values', values })
    assert.equal(verification.committable, false)
    const result = commitEI(ledger, verification)
    assert.equal(result.status, 'rejected')
    assert.equal(result.ledger, ledger)
    assert.equal(exportEILedger(result.ledger), before)
    assert.equal(result.receipt.status, 'rejected')
    assert.ok(result.receipt.reasons.length > 0)
  }
})

test('verification cannot be forged by a true flag or by modifying sealed output', () => {
  const ledger = initial(), execution = staged(ledger, proposeEI(ledger, input())), verification = verifyLocalEI(execution)
  assert.throws(() => commitEI(ledger, { ...verification, committable: true }), /not produced/)
  assert.throws(() => verifyLocalEI({ ...execution }), /not produced/)
  assert.throws(() => verifyEI(execution, { verified: true } as never), /explicit rendered/)
  assert.throws(() => { (verification as { committable: boolean }).committable = false }, TypeError)
  assert.throws(() => { (execution.stagedLedger.records[1].is as { value: string }).value = 'tampered' }, TypeError)
})

test('repeating the exact transaction is idempotent, including after export/import', () => {
  const ledger = initial(), original = input(), proposal = proposeEI(ledger, original)
  const first = advanceEI(ledger, proposal), second = advanceEI(first.ledger, proposal)
  assert.equal(first.status, 'committed')
  assert.equal(second.status, 'replayed')
  assert.equal(second.ledger, first.ledger)
  assert.equal(second.receipt, first.receipt)
  const imported = importEILedger(exportEILedger(first.ledger))
  const repeated = advanceEI(imported, proposeEI(imported, original))
  assert.equal(repeated.status, 'replayed')
  assert.equal(imported.records[1].was.length, 1)
  const collision = advanceEI(imported, proposeEI(imported, input([candidate({ patches: [patch('b', 'unrequested')] })])))
  assert.equal(collision.status, 'blocked')
  assert.match(collision.receipt.reasons[0], /different captured input/)
})

test('explicit creation preserves multi-parent addresses and provenance; unknown or cyclic parents never commit', () => {
  const ledger = initial(), created = patch('child', 'captured child')
  const result = advanceEI(ledger, proposeEI(ledger, input([candidate({ patches: [{ ...created, kind: 'create', parents: ['root', 'a'], relations: [{ relation: 'returns-to', address: 'a' }] }] })])))
  assert.equal(result.status, 'committed')
  assert.deepEqual(findEIAddress(result.ledger, 'child')!.parents, ['root', 'a'])
  assert.deepEqual(findEIAddress(result.ledger, 'child')!.was, [])
  assert.deepEqual(importEILedger(exportEILedger(result.ledger)), result.ledger)
  for (const parents of [['missing'], ['child']]) {
    const proposal = proposeEI(ledger, input([candidate({ patches: [patch('a', 'valid first patch'), { ...created, kind: 'create', parents }] })]))
    assert.equal(advanceEI(ledger, proposal).status, 'blocked')
    assert.equal(findEIAddress(ledger, 'a')!.is.value, 'WAS A')
    assert.equal(findEIAddress(ledger, 'child'), undefined)
  }
})

test('an explicit same-transaction parent and child can be created as one finite patch set', () => {
  const ledger = initial(), result = advanceEI(ledger, proposeEI(ledger, input([candidate({ patches: [
    { ...patch('nested', 'nested value'), kind: 'create', parents: ['new-parent'] },
    { ...patch('new-parent', 'parent value'), kind: 'create', parents: ['root'] },
  ] })])))
  assert.equal(result.status, 'committed')
  assert.deepEqual(findEIAddress(result.ledger, 'nested')!.parents, ['new-parent'])
  assert.deepEqual(importEILedger(exportEILedger(result.ledger)), result.ledger)
})

test('cyclic relation graphs stay finite and do not invent records or recursively execute them', () => {
  const ledger = initial()
  assert.deepEqual(walkEIRelations(ledger, 'a'), ['a', 'b'])
  assert.deepEqual(walkEIRelations(ledger, 'missing'), [])
  assert.equal(ledger.revision, 0)
  assert.equal(ledger.records.length, 3)
  assert.throws(() => createEILedger({ records: [
    { address: 'a', value: '', source: source('a'), parents: ['b'] },
    { address: 'b', value: '', source: source('b'), parents: ['a'] },
  ] }), /parent cycle/)
})

test('invalid sources, duplicate addresses and candidates, oversized inputs and ambiguous patches fail closed', () => {
  assert.throws(() => createEILedger({ records: [initial().records[0] as never] }), /unexpected field/)
  assert.throws(() => createEILedger({ records: [{ address: 'a', value: '', source: source('a') }, { address: 'a', value: '', source: source('a') }] }), /duplicate/)
  assert.throws(() => parseEIInput('{'), /invalid input JSON/)
  assert.throws(() => parseEIInput(' '.repeat(EI_LIMITS.inputBytes + 1)), /too large/)
  assert.throws(() => proposeEI(initial(), input([candidate(), candidate()])), /duplicate/)
  assert.throws(() => proposeEI(initial(), input([candidate({ patches: [patch(), patch()] })])), /duplicate/)
  assert.throws(() => proposeEI(initial(), input([candidate({ patches: [{ ...patch('child'), parents: ['root'] }] })])), /explicit create/)
  assert.throws(() => proposeEI(initial(), input([candidate({ source: { id: 'claimed', text: 'x', guessedTruth: true } as never })])), /unexpected field/)
  assert.throws(() => proposeEI(initial(), { ...input(), producer: 'missing' }), /unknown producing/)
})

test('export/import validates committed history, readback evidence and returned receipt address', () => {
  const ledger = committed(), raw = exportEILedger(ledger)
  assert.equal(exportEILedger(importEILedger(raw)), raw)
  const mutations: ((value: any) => void)[] = [
    l => { l.revision = 2 },
    l => { l.records[1].is.value = 'changed output' },
    l => { l.records[1].was[0].value = 'changed source' },
    l => { l.records[1].parents = ['unbound-parent'] },
    l => { l.records[0].receiptIds = [] },
    l => { l.receipts[0].checks[0].actual = 'different return' },
    l => { l.receipts[0].scope = 'external-world-proof' },
    l => { l.receipts[0].selection.mode = 'explicit-user'; l.receipts[0].selection.candidateId = 'missing' },
    l => { l.receipts[0].resultRevision = 7 },
    l => { l.receipts.push(l.receipts[0]) },
  ]
  for (const mutate of mutations) {
    const value = JSON.parse(raw); mutate(value)
    assert.throws(() => importEILedger(JSON.stringify(value)))
  }
})

test('rendered receipts and user selection survive consistent replay without being authenticated history', () => {
  const ledger = initial(), proposal = proposeEI(ledger, input([candidate({ owner: 'user' })])), execution = staged(ledger, proposal, 'continue')
  const result = commitEI(ledger, verifyEI(execution, { kind: 'rendered-address-values', values: [{ address: 'a', value: 'IS A' }] }))
  const imported = importEILedger(exportEILedger(result.ledger))
  assert.deepEqual(imported, result.ledger)
  assert.equal(imported.receipts[0].scope, 'rendered-address-values')
  assert.match(EI_IMPORT_NOTE, /past rendered frame/)
})

test('JSON imports reject oversize/deep structure and preserve maximum-length transaction IDs', () => {
  assert.throws(() => importEILedger(' '.repeat(EI_LIMITS.jsonBytes + 1)), /too large/)
  const deep = `${'{"a":'.repeat(30)}0${'}'.repeat(30)}`
  assert.throws(() => importEILedger(deep), /bounded depth/)
  const ledger = initial(), result = advanceEI(ledger, proposeEI(ledger, input(undefined, 'x'.repeat(EI_LIMITS.idLength))))
  assert.equal(result.status, 'committed')
  assert.deepEqual(importEILedger(exportEILedger(result.ledger)), result.ledger)
})

test('prototype-shaped literal addresses stay exact data and never alter record lookup behavior', () => {
  const ledger = createEILedger({ records: [{ address: '__proto__', value: 'raw', source: source('raw') }] })
  const proposal = proposeEI(ledger, { ...input([candidate({ conditions: [{ address: '__proto__', equals: 'raw' }], patches: [patch('__proto__', 'next')] })]), producer: '__proto__' })
  const result = advanceEI(ledger, proposal)
  assert.equal(findEIAddress(result.ledger, '__proto__')!.is.value, 'next')
  assert.equal(({} as { polluted?: unknown }).polluted, undefined)
})
