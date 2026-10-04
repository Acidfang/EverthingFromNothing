import assert from 'node:assert/strict'
import test from 'node:test'
import {
  advanceEI, chooseEI, commitEI, createEILedger, executeEI, exportEILedger, importEILedger, proposeEI, verifyLocalEI,
  type EIExecution, type EILedger,
} from '../src/model/ei-engine.ts'
import {
  EI_GRAINS, EIGrainIdentityError, createEIGrainRegistry, projectEIGrain, readEIGrain,
  resolveEIGrainTarget, referenceEIGrain, filterEIGrainAddresses,
  type EIGrainHandle, type EIGrainFilter, type EIGrainIdentityErrorCode,
} from '../src/model/ei-grain-identity.ts'
import { evaluateEIQuery, verifyEIQueryAnswer } from '../src/model/ei-relation-reasoner.ts'

function initial(values = ['0', '1', '0'], prefix = ''): EILedger {
  return createEILedger({ records: [
    { address: `${prefix}root`, value: 'root', source: { id: `${prefix}source:root`, text: 'root', realm: 'test-domain' } },
    ...values.map((value, i) => ({ address: `${prefix}${String.fromCharCode(97 + i)}`, value, source: { id: `${prefix}source:${i}`, text: value, realm: 'test-domain' }, parents: [`${prefix}root`], relations: [{ relation: 'opaque-edge', address: `${prefix}${String.fromCharCode(97 + (i + 1) % values.length)}` }] })),
  ] })
}
function stage(ledger: EILedger, address = 'a', value = 'new', options: { id?: string; create?: boolean; user?: boolean } = {}): EIExecution {
  const id = options.id ?? `change:${ledger.revision}`, source = { id, text: value, realm: 'explicit-operation' }
  const proposal = proposeEI(ledger, { id, producer: 'root', input: source, candidates: [{ id: 'change', label: 'explicit operation', owner: options.user ? 'user' : 'engine', source, conditions: [], patches: [{ address, value, source, ...(options.create ? { kind: 'create' as const, parents: ['a', 'root'] } : {}) }] }] })
  if (options.user) assert.equal(executeEI(ledger, proposal).status, 'blocked')
  const result = executeEI(ledger, proposal, options.user ? chooseEI(proposal, 'change') : undefined)
  assert.equal(result.status, 'staged')
  return result as EIExecution
}
function updated(ledger: EILedger, address = 'a', value = 'changed'): EILedger {
  const execution = stage(ledger, address, value), result = commitEI(ledger, verifyLocalEI(execution))
  assert.equal(result.status, 'committed')
  return result.ledger
}
function fails(code: EIGrainIdentityErrorCode, action: () => unknown): void {
  assert.throws(action, (error: unknown) => error instanceof EIGrainIdentityError && error.code === code)
}
function derived(result: Awaited<ReturnType<typeof filterEIGrainAddresses>>): EIGrainFilter {
  assert.notEqual(result.status, 'unbound')
  if (result.status === 'unbound') assert.fail(result.code)
  return result
}

test('all five grain handles reuse one canonical entity and exact state/source object', () => {
  const ledger = initial(), registry = createEIGrainRegistry(ledger), before = exportEILedger(ledger)
  const handles = EI_GRAINS.map(grain => projectEIGrain(registry, 'a', grain))
  for (const handle of handles) {
    assert.equal(handle.entity, handles[0].entity); assert.equal(handle.state, handles[0].state)
    assert.equal(handle.state.entity, handle.entity); assert.equal(handle.state.source, ledger.records[1].is.source)
    assert.equal(readEIGrain(ledger, handle), handles[0].state)
    assert.equal(resolveEIGrainTarget(ledger, handle), 'a')
    assert.equal(handle.observedMapping, null)
    assert.deepEqual(referenceEIGrain(handle), referenceEIGrain(handles[0]))
    assert.equal(projectEIGrain(registry, 'a', handle.grain), handle)
  }
  assert.equal(createEIGrainRegistry(ledger), registry)
  assert.equal(registry.entities.length, ledger.records.length)
  assert.equal(exportEILedger(ledger), before); assert.equal(ledger.revision, 0); assert.equal(ledger.receipts.length, 0)
  assert.ok(Object.isFrozen(handles[0])); assert.ok(Object.isFrozen(handles[0].entity)); assert.ok(Object.isFrozen(handles[0].state))
  assert.throws(() => { (handles[0].entity as { address: string }).address = 'b' }, TypeError)
})

test('retained WAS and current IS have one address entity and distinct immutable state references', () => {
  const first = initial(), ledger = updated(updated(first, 'a', 'middle'), 'a', 'latest'), registry = createEIGrainRegistry(ledger)
  const old = projectEIGrain(registry, 'a', 'state', 0), middle = projectEIGrain(registry, 'a', 'coordinate', 1), current = projectEIGrain(registry, 'a', 'pixel', 2)
  assert.equal(old.entity, current.entity); assert.equal(middle.entity, current.entity)
  assert.notEqual(old.state, current.state); assert.notEqual(middle.state, current.state)
  assert.deepEqual([old, middle, current].map(h => [h.state.role, h.state.value]), [['WAS', '0'], ['WAS', 'middle'], ['IS', 'latest']])
  for (const grain of EI_GRAINS) {
    const historical = projectEIGrain(registry, 'a', grain, 0), now = projectEIGrain(registry, 'a', grain, 2)
    assert.equal(readEIGrain(ledger, historical).value, '0')
    fails('historical-operation-target', () => resolveEIGrainTarget(ledger, historical))
    assert.equal(resolveEIGrainTarget(ledger, now), 'a')
  }
  fails('unknown-revision', () => projectEIGrain(registry, 'a', 'state', 3))
})

test('issued staged views preserve retained IS and proposed NEXT at one entity without admission', () => {
  const ledger = updated(initial(), 'a', 'current'), execution = stage(ledger, 'a', 'next'), before = exportEILedger(ledger), registry = createEIGrainRegistry(ledger, execution)
  const was = projectEIGrain(registry, 'a', 'address', 0), is = projectEIGrain(registry, 'a', 'node', 1), next = projectEIGrain(registry, 'a', 'pixel')
  assert.equal(was.entity, is.entity); assert.equal(is.entity, next.entity)
  assert.deepEqual([was, is, next].map(h => [h.state.role, h.state.phase, h.state.value]), [['WAS', 'retained', '0'], ['IS', 'retained', 'current'], ['NEXT', 'proposed', 'next']])
  assert.deepEqual(registry.context.execution, { transactionId: execution.proposal.input.id, candidateId: execution.selection.candidateId })
  for (const grain of EI_GRAINS) {
    const handle = projectEIGrain(registry, 'a', grain)
    assert.equal(readEIGrain(ledger, handle).value, 'next')
    fails('proposed-operation-target', () => resolveEIGrainTarget(ledger, handle))
    assert.equal(resolveEIGrainTarget(ledger, projectEIGrain(registry, 'a', grain, 1)), 'a')
  }
  assert.equal(exportEILedger(ledger), before); assert.equal(ledger.revision, 1)
  assert.equal(createEIGrainRegistry(ledger, execution), registry)
})

test('explicit staged creation adds only a projected entity until the original engine transaction commits', () => {
  const ledger = initial(), execution = stage(ledger, 'child', 'captured proposed child', { create: true }), registry = createEIGrainRegistry(ledger, execution)
  for (const grain of EI_GRAINS) {
    const handle = projectEIGrain(registry, 'child', grain)
    assert.equal(handle.state.role, 'NEXT'); assert.equal(handle.state.phase, 'proposed'); assert.equal(handle.entity.address, 'child')
    fails('proposed-operation-target', () => resolveEIGrainTarget(ledger, handle))
  }
  assert.equal(ledger.records.some(r => r.address === 'child'), false)
  const committed = commitEI(ledger, verifyLocalEI(execution))
  assert.equal(committed.status, 'committed')
  const current = projectEIGrain(createEIGrainRegistry(committed.ledger), 'child', 'coordinate')
  assert.equal(current.state.role, 'IS'); assert.equal(resolveEIGrainTarget(committed.ledger, current), 'child')
  assert.deepEqual(committed.ledger.records.find(r => r.address === 'child')!.parents, ['a', 'root'])
})

test('entity identity is address-scoped and never collapses equal values or coincident display placement', () => {
  const ledger = initial(['same', 'same', 'same']), registry = createEIGrainRegistry(ledger)
  const a = projectEIGrain(registry, 'a', 'pixel'), b = projectEIGrain(registry, 'b', 'coordinate')
  const observerLayout = [{ handle: a, x: 10, y: 10 }, { handle: b, x: 10, y: 10 }]
  assert.equal(observerLayout[0].x, observerLayout[1].x)
  assert.notEqual(a.entity, b.entity); assert.notEqual(a.state, b.state)
  assert.equal(a.observedMapping, null); assert.equal(b.observedMapping, null)
  assert.notEqual(referenceEIGrain(a).address, referenceEIGrain(b).address)
  const otherLedger = initial(['other', 'same', 'same']), other = projectEIGrain(createEIGrainRegistry(otherLedger), 'a', 'pixel')
  assert.notEqual(a.entity, other.entity); assert.notEqual(a.state.context, other.state.context)
  fails('stale-snapshot', () => readEIGrain(otherLedger, a))
})

test('stale source snapshots reject every grain, including equal-revision ledgers and changed unrelated records', () => {
  const ledger = initial(), registry = createEIGrainRegistry(ledger), changed = updated(ledger, 'b', 'changed elsewhere'), sameRevision = initial(['0', 'different', '0'])
  for (const grain of EI_GRAINS) {
    const handle = projectEIGrain(registry, 'a', grain)
    for (const live of [changed, sameRevision]) {
      fails('stale-snapshot', () => readEIGrain(live, handle))
      fails('stale-snapshot', () => resolveEIGrainTarget(live, handle))
    }
  }
  fails('execution-snapshot-mismatch', () => createEIGrainRegistry(changed, stage(ledger)))
  fails('execution-snapshot-mismatch', () => createEIGrainRegistry(sameRevision, stage(ledger)))
})

test('plain objects, serialized references and tampered grain/state copies cannot acquire handle authority', () => {
  const ledger = initial(), registry = createEIGrainRegistry(ledger), handle = projectEIGrain(registry, 'a', 'state'), execution = stage(ledger)
  fails('unissued-ledger', () => createEIGrainRegistry({ ...ledger }))
  fails('unissued-ledger', () => createEIGrainRegistry(execution.stagedLedger))
  fails('unissued-registry', () => projectEIGrain({ ...registry }, 'a', 'state'))
  fails('unissued-execution', () => createEIGrainRegistry(ledger, { ...execution }))
  for (const copy of [{ ...handle }, { ...handle, grain: 'pixel', entity: { address: 'b' } }, { ...handle, state: { ...handle.state, value: 'forged' } }, referenceEIGrain(handle), JSON.parse(JSON.stringify(handle))]) fails('unissued-handle', () => readEIGrain(ledger, copy as EIGrainHandle))
  fails('unknown-grain', () => projectEIGrain(registry, 'a', 'meaning' as any))
  fails('unknown-address', () => projectEIGrain(registry, 'missing', 'address'))
  fails('unknown-revision', () => projectEIGrain(registry, 'a', 'address', NaN))
})

test('user-owned admission remains an explicit engine selection before staged grain projection', () => {
  const ledger = initial(), execution = stage(ledger, 'a', 'selected value', { user: true }), registry = createEIGrainRegistry(ledger, execution)
  assert.equal(execution.selection.mode, 'explicit-user')
  assert.equal(projectEIGrain(registry, 'a', 'node').state.value, 'selected value')
  assert.equal(ledger.receipts.length, 0)
  fails('proposed-operation-target', () => resolveEIGrainTarget(ledger, projectEIGrain(registry, 'a', 'coordinate')))
})

test('the same explicit engine operation commutes through all five grain targets', () => {
  const ledger = initial(), registry = createEIGrainRegistry(ledger), results: string[] = []
  for (const grain of EI_GRAINS) {
    const address = resolveEIGrainTarget(ledger, projectEIGrain(registry, 'a', grain))
    const source = { id: 'explicit-return', text: '1' }
    const result = advanceEI(ledger, proposeEI(ledger, { id: 'same-operation', producer: 'root', input: source, candidates: [{ id: 'update', label: 'explicit', owner: 'engine', source, conditions: [{ address, equals: '0' }], patches: [{ address, value: '1', source }] }] }))
    assert.equal(result.status, 'committed'); results.push(exportEILedger(result.ledger))
  }
  assert.equal(new Set(results).size, 1); assert.equal(ledger.revision, 0); assert.equal(ledger.receipts.length, 0)
})

test('equivalent imported snapshot can validate a handle while serialized references never become authority', () => {
  const ledger = updated(initial()), imported = importEILedger(exportEILedger(ledger)), original = projectEIGrain(createEIGrainRegistry(ledger), 'a', 'address')
  assert.equal(readEIGrain(imported, original), original.state)
  const reissued = projectEIGrain(createEIGrainRegistry(imported), 'a', 'coordinate')
  assert.deepEqual(referenceEIGrain(reissued), referenceEIGrain(original))
  assert.notEqual(reissued, original)
  fails('unissued-handle', () => resolveEIGrainTarget(imported, JSON.parse(JSON.stringify(referenceEIGrain(original)))))
})

test('all 80 three-address binary filters commute across five grains and preserve actual evaluator proof', async t => {
  let cases = 0
  for (let bits = 0; bits < 8; bits++) for (const equals of ['0', '1']) {
    const values = [0, 1, 2].map(bit => String((bits >> bit) & 1)), ledger = initial(values), registry = createEIGrainRegistry(ledger)
    const expected = await evaluateEIQuery(ledger, { kind: 'filter', addresses: ['a', 'b', 'c'], equals })
    for (const grain of EI_GRAINS) {
      const result = derived(await filterEIGrainAddresses(ledger, ['c', 'a', 'b'].map(a => projectEIGrain(registry, a, grain)), { kind: 'exact-text-equality', equals }))
      assert.deepEqual(result.addresses, ['a', 'b', 'c']); assert.deepEqual(result.answer, expected)
      assert.deepEqual(result.answer.matches.map(m => m.address), ['a', 'b', 'c'].filter((_, i) => values[i] === equals))
      assert.equal(result.verification.status, 'passed'); assert.ok(result.verification.checks.every(c => c.matches)); cases++
    }
  }
  assert.equal(cases, 80); t.diagnostic('Exhaustive bounded domain: 8 assignments × 2 exact binary predicates × 5 grain representations = 80 evaluated/self-checked cases')
})

test('mixed duplicate grain handles resolve one canonical address set without multiplying matches', async () => {
  const ledger = initial(), registry = createEIGrainRegistry(ledger)
  const mixed = ['c', 'b', 'a'].flatMap(address => EI_GRAINS.map(grain => projectEIGrain(registry, address, grain)))
  const result = derived(await filterEIGrainAddresses(ledger, mixed, { kind: 'exact-text-equality', equals: '0' }))
  const plain = derived(await filterEIGrainAddresses(ledger, ['a', 'b', 'c'], { kind: 'exact-text-equality', equals: '0' }))
  assert.deepEqual(result, plain); assert.deepEqual(result.answer.matches.map(m => m.address), ['a', 'c'])
  assert.equal(result.status, 'open'); assert.equal(result.verification.status, 'passed')
})

test('unrelated domains and arbitrary source values use exact predicates without guessed equivalence', async () => {
  const domains = [
    { prefix: 'chemistry/', values: ['H2O', 'water', 'H2O'], equals: 'H2O', matches: ['a', 'c'] },
    { prefix: 'task/', values: ['done', 'DONE', 'pending'], equals: 'done', matches: ['a'] },
    { prefix: 'unicode/', values: ['é', 'e\u0301', 'é '], equals: 'é', matches: ['a'] },
  ]
  for (const domain of domains) {
    const ledger = initial(domain.values, domain.prefix), registry = createEIGrainRegistry(ledger)
    for (const grain of EI_GRAINS) {
      const result = derived(await filterEIGrainAddresses(ledger, ['a', 'b', 'c'].map(a => projectEIGrain(registry, domain.prefix + a, grain)), { kind: 'exact-text-equality', equals: domain.equals }))
      assert.deepEqual(result.answer.matches.map(m => m.address), domain.matches.map(a => domain.prefix + a))
      assert.equal(result.verification.status, 'passed')
      assert.ok(result.answer.proof.filter(p => p.op === 'FILTER').every(p => p.op === 'FILTER' && p.matches === (p.actual === domain.equals)))
    }
  }
})

test('missing addresses remain unknown, multiple alternatives remain open and an empty local match is scoped', async () => {
  const ledger = initial()
  const partial = derived(await filterEIGrainAddresses(ledger, ['a', 'unbound'], { kind: 'exact-text-equality', equals: '0' }))
  assert.equal(partial.status, 'open'); assert.equal(partial.verification.status, 'unresolved')
  assert.deepEqual(partial.answer.matches.map(m => m.address), ['a']); assert.equal(partial.answer.unknowns[0].address, 'unbound')
  const missing = derived(await filterEIGrainAddresses(ledger, ['unbound'], { kind: 'exact-text-equality', equals: '0' }))
  assert.equal(missing.status, 'unresolved'); assert.deepEqual(missing.answer.sourceRefs, [])
  const empty = derived(await filterEIGrainAddresses(ledger, ['b'], { kind: 'exact-text-equality', equals: '0' }))
  assert.equal(empty.status, 'empty'); assert.equal(empty.answer.scope, 'captured-local-records'); assert.equal(empty.verification.status, 'passed')
})

test('unknown predicates never become false answers or invoke evaluation', async t => {
  let digestCalls = 0
  t.mock.method(globalThis.crypto.subtle, 'digest', async () => { digestCalls++; throw new Error('unavailable') })
  const ledger = initial(), predicates = [null, undefined, 'meaning', { kind: 'synonym', equals: '0' }, { kind: 'exact-text-equality', equals: 0 }, { kind: 'exact-text-equality', equals: '0', inferred: true }]
  for (const predicate of predicates) {
    const result = await filterEIGrainAddresses(ledger, ['a'], predicate)
    assert.equal(result.status, 'unbound'); assert.equal(result.answer, null); assert.equal(result.verification, null)
    assert.deepEqual(result.addresses, ['a'])
  }
  assert.equal(digestCalls, 0)
  const unavailable = await filterEIGrainAddresses(ledger, ['a'], { kind: 'exact-text-equality', equals: '0' })
  assert.equal(unavailable.status, 'unbound')
  if (unavailable.status === 'unbound') assert.equal(unavailable.code, 'evaluation-unavailable')
})

test('field filter rejects stale, forged, historical and proposed handles and never consumes view IDs', async () => {
  const original = initial(), ledger = updated(original), registry = createEIGrainRegistry(ledger), proposed = createEIGrainRegistry(ledger, stage(ledger))
  for (const grain of EI_GRAINS) {
    const cases: [EIGrainHandle, EIGrainIdentityErrorCode][] = [
      [projectEIGrain(createEIGrainRegistry(original), 'a', grain), 'stale-snapshot'],
      [projectEIGrain(registry, 'a', grain, 0), 'historical-operation-target'],
      [projectEIGrain(proposed, 'a', grain), 'proposed-operation-target'],
      [{ ...projectEIGrain(registry, 'a', grain) }, 'unissued-handle'],
    ]
    for (const [handle, code] of cases) await assert.rejects(() => filterEIGrainAddresses(ledger, [handle], { kind: 'exact-text-equality', equals: '0' }), (error: unknown) => error instanceof EIGrainIdentityError && error.code === code)
  }
  const viewKey = derived(await filterEIGrainAddresses(ledger, ['gate:0'], { kind: 'exact-text-equality', equals: '0' }))
  assert.equal(viewKey.status, 'unresolved'); assert.equal(viewKey.answer.unknowns[0].address, 'gate:0')
})

test('actual filter proof binds complete source state and rejects tampered values or a later ledger', async () => {
  const ledger = initial(), result = derived(await filterEIGrainAddresses(ledger, ['a', 'b'], { kind: 'exact-text-equality', equals: '0' }))
  assert.equal(result.answer.premises.length, 2)
  assert.ok(result.answer.premises.every(p => p.source.sourceFingerprint.startsWith('sha256:')))
  assert.deepEqual(result.answer.sourceRefs, ['a', 'b'])
  const tampered = structuredClone(result.answer); (tampered.matches[0] as { value: string }).value = 'forged'
  assert.equal((await verifyEIQueryAnswer(ledger, result.query, tampered)).status, 'failed')
  assert.equal((await verifyEIQueryAnswer(updated(ledger, 'c', 'unrelated correction'), result.query, result.answer)).status, 'failed')
  assert.ok(Object.isFrozen(result)); assert.ok(Object.isFrozen(result.answer)); assert.ok(Object.isFrozen(result.verification))
})

test('bounded filter addresses and empty selections remain unbound without changing ledger state', async () => {
  const ledger = initial(), before = exportEILedger(ledger), predicate = { kind: 'exact-text-equality', equals: '0' }
  for (const [targets, code] of [[[], 'empty-address-set'], [[' '], 'invalid-address'], [['a'.repeat(257)], 'invalid-address'], [Array.from({ length: 257 }, (_, i) => `target:${i}`), 'address-limit']] as const) {
    const result = await filterEIGrainAddresses(ledger, targets, predicate)
    assert.equal(result.status, 'unbound'); if (result.status === 'unbound') assert.equal(result.code, code)
  }
  assert.equal(exportEILedger(ledger), before)
})
