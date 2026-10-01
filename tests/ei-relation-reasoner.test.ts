import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { advanceEI, createEILedger, executeEI, exportEILedger, proposeEI, verifyLocalEI, type EIInput, type EILedger, type EISource } from '../src/model/ei-engine.ts'
import { commitEIConversationTurn, executeEIConversationTurn, prepareEIConversationTurn } from '../src/model/ei-conversation.ts'
import {
  EI_REASONER_LIMITS, evaluateEIQuery, formatEIQueryAnswer, formatEIQueryVerification,
  parseEIQuery, verifyEIQueryAnswer, type EIQuery, type EIQueryAnswer,
} from '../src/model/ei-relation-reasoner.ts'

const source = (text: string): EISource => ({ id: `captured:${text}`, text, realm: 'synthetic-test' })
function graph(): EILedger {
  return createEILedger({ records: [
    { address: 'Ω', value: 'whole', source: source('whole') },
    { address: 'grain:one', value: 'first grain', source: source('first grain'), parents: ['Ω'] },
    { address: 'grain:two', value: 'second grain', source: source('second grain'), parents: ['Ω'] },
    { address: 'A', value: 'question', source: source('question'), parents: ['grain:one'], relations: [{ relation: 'R', address: 'B' }, { relation: 'R', address: 'C' }, { relation: 'opaque', address: 'missing' }] },
    { address: 'B', value: 'left', source: source('left'), parents: ['grain:one'], relations: [{ relation: 'S', address: 'D' }, { relation: 'back', address: 'A' }] },
    { address: 'C', value: 'right', source: source('right'), parents: ['grain:two'], relations: [{ relation: 'S', address: 'E' }, { relation: 'join', address: 'D' }] },
    { address: 'D', value: 'yes', source: source('yes'), parents: ['B', 'grain:two'] },
    { address: 'E', value: 'no', source: source('no'), parents: ['grain:two'] },
  ] })
}
function query(raw: string): EIQuery {
  const parsed = parseEIQuery(raw)
  assert.equal(parsed.status, 'parsed', raw)
  return parsed.status === 'parsed' ? parsed.query : assert.fail(parsed.reason)
}
function update(ledger: EILedger, value = 'changed'): EIInput {
  return { id: `update:${ledger.revision}`, producer: 'Ω', input: source('explicit edit'), candidates: [{ id: 'edit', label: 'captured edit', owner: 'engine', source: source('explicit edit'), conditions: [], patches: [{ address: 'D', value, source: source(value) }] }] }
}
function retainedRootPaths(answer: EIQueryAnswer, address: string): string[][] {
  const graph = answer.parentGraph, node = graph.addresses.indexOf(address)
  function walk(at: number): string[][] {
    const parents = graph.parents[at]
    if (parents === null) return []
    if (!parents.length) return [[graph.addresses[at]]]
    return parents.flatMap(parent => walk(parent).map(path => [...path, graph.addresses[at]]))
  }
  return walk(node)
}

test('declared grammar composes quoted paths and filters, including escaped identifiers and exact Unicode', () => {
  assert.deepEqual(query('from "A" follow "R" then "S" where value is "yes"'), { kind: 'follow', address: 'A', relations: ['R', 'S'], where: { equals: 'yes' } })
  assert.deepEqual(query('read "a\\\"b" was'), { kind: 'read', address: 'a"b', state: 'was' })
  assert.deepEqual(query('filter "A", "B" where value is "e\\u0301"'), { kind: 'filter', addresses: ['A', 'B'], equals: 'e\u0301' })
  for (const raw of ['What does Ω mean?', 'read A', 'READ "A"', 'read "A" and guess why', 'from "A" follow "R" forever', 'compare "A" with "B"; execute', 'read "\\x00"']) assert.equal(parseEIQuery(raw).status, 'unresolved', raw)
})

test('multi-hop derivation filters actual branch values and retains addressed proof/source and cross-grain ancestry', async () => {
  const ledger = graph(), before = exportEILedger(ledger)
  const answer = await evaluateEIQuery(ledger, query('from "A" follow "R" then "S" where value is "yes"'))
  assert.equal(answer.status, 'resolved')
  assert.deepEqual(answer.matches.map(m => m.address), ['D'])
  assert.deepEqual(answer.matches[0].path.edges.map(e => [e.from, e.relation, e.to]), [['A', 'R', 'B'], ['B', 'S', 'D']])
  assert.deepEqual(retainedRootPaths(answer, 'D'), [['Ω', 'grain:one', 'B', 'D'], ['Ω', 'grain:two', 'D']])
  assert.equal(answer.proof.filter(p => p.op === 'FILTER').length, 2)
  assert.ok(answer.proof.some(p => p.op === 'FILTER' && !p.matches && p.actual === 'no'))
  assert.deepEqual(answer.sourceRefs, ['A', 'B', 'C', 'D', 'E'])
  assert.equal(exportEILedger(ledger), before)
  assert.ok(Object.isFrozen(answer.matches[0].path.edges))
})

test('branching preserves conflicting values and duplicate edge paths without choosing a meaning', async () => {
  const answer = await evaluateEIQuery(graph(), query('from "A" follow "R" then "S"'))
  assert.equal(answer.status, 'open')
  assert.deepEqual(answer.matches.map(m => m.value), ['yes', 'no'])
  const duplicate = createEILedger({ records: [
    { address: 'a', value: 'a', source: source('a'), relations: [{ relation: 'R', address: 'b' }, { relation: 'R', address: 'b' }] },
    { address: 'b', value: 'b', source: source('b') },
  ] })
  const two = await evaluateEIQuery(duplicate, query('from "a" follow "R"'))
  assert.equal(two.matches.length, 2)
  assert.deepEqual(two.matches.map(m => m.path.edges[0].relationIndex), [0, 1])
  assert.equal(two.status, 'open')
})

test('local missing edges are graph gaps, while missing records and dangling targets stay unknown', async () => {
  const ledger = graph()
  const gap = await evaluateEIQuery(ledger, query('from "A" follow "S"'))
  assert.equal(gap.status, 'empty')
  assert.equal(gap.gaps[0].kind, 'no-captured-edge')
  assert.equal(gap.unknowns.length, 0)
  assert.match(formatEIQueryAnswer(gap), /does not establish absence outside/)
  const missing = await evaluateEIQuery(ledger, query('read "missing"'))
  assert.equal(missing.status, 'unresolved')
  assert.deepEqual(missing.sourceRefs, [])
  const dangling = await evaluateEIQuery(ledger, query('from "A" follow "opaque"'))
  assert.equal(dangling.status, 'unresolved')
  assert.equal(dangling.unknowns[0].address, 'missing')
  assert.deepEqual(dangling.sourceRefs, ['A'])
})

test('exact comparison does not infer synonymy, normalize values, or elevate conflicting claims', async () => {
  const ledger = createEILedger({ records: [
    { address: 'a', value: 'é', source: source('a') }, { address: 'b', value: 'e\u0301', source: source('b') },
    { address: 'c', value: 'é', source: source('c') },
  ] })
  const difference = await evaluateEIQuery(ledger, query('compare "a" with "b"'))
  assert.equal(difference.comparison!.result, 'different')
  assert.equal(difference.status, 'resolved')
  assert.equal((await evaluateEIQuery(ledger, query('compare "a" with "c"'))).comparison!.result, 'equal')
  const unknown = await evaluateEIQuery(ledger, query('compare "a" with "missing"'))
  assert.equal(unknown.comparison!.result, 'unknown')
  assert.equal(unknown.status, 'open')
})

test('filters apply only to explicitly supplied addresses and retain known rejection versus unknown', async () => {
  const ledger = graph()
  const filtered = await evaluateEIQuery(ledger, query('filter "D", "E" where value is "yes"'))
  assert.deepEqual(filtered.matches.map(m => m.address), ['D'])
  const absent = await evaluateEIQuery(ledger, query('filter "E" where value is "yes"'))
  assert.equal(absent.status, 'empty')
  const partial = await evaluateEIQuery(ledger, query('filter "D", "missing" where value is "yes"'))
  assert.equal(partial.status, 'open')
  assert.equal(partial.unknowns.length, 1)
})

test('cycles consume only requested steps and operator labels have no intrinsic or transitive semantics', async () => {
  const ledger = graph()
  const cycled = await evaluateEIQuery(ledger, query('from "A" follow "R" then "back" then "R"'))
  assert.deepEqual(cycled.matches.map(m => m.address), ['B', 'C'])
  assert.ok(cycled.matches.every(m => m.path.edges.length === 3))
  for (const label of ['parent', 'is-a', '∫', 'ρ', 'Ω']) {
    const answer = await evaluateEIQuery(ledger, { kind: 'follow', address: 'A', relations: [label] })
    assert.equal(answer.status, 'empty', label)
  }
  assert.deepEqual((await evaluateEIQuery(ledger, query('from "A" follow "R"'))).matches.map(m => m.address), ['B', 'C'])
  assert.equal((await evaluateEIQuery(ledger, query('from "B" follow "R"'))).status, 'empty')
})

test('history and trace reconstruct value-source-receipt return and root paths without erasing WAS', async () => {
  const initial = graph(), changed = advanceEI(initial, proposeEI(initial, update(initial))).ledger
  const current = await evaluateEIQuery(changed, query('trace "D"'))
  const p = current.premises[0]
  assert.equal(p.sourceBinding, 'committed-local-receipt')
  const receipt = current.receipts.find(r => r.receiptId === p.valueReceiptIds[0])!
  assert.equal(receipt.producer, 'Ω')
  assert.equal(receipt.returnedToProducer, true)
  assert.equal(p.source.sourceFingerprint, `sha256:${createHash('sha256').update(JSON.stringify(source('changed'))).digest('hex')}`)
  assert.match(formatEIQueryAnswer(current), /Receipt:/)
  const was = await evaluateEIQuery(changed, query('read "D" was'))
  assert.equal(was.matches[0].value, 'yes')
  assert.equal(was.matches[0].revision, 0)
  assert.equal(was.premises[0].sourceBinding, 'captured-seed')
  assert.equal((await evaluateEIQuery(initial, query('read "D" was'))).status, 'unresolved')
})

test('origin SHA-256 binds actual retained snapshot; honest derivation passes only scoped consistency checks', async () => {
  const ledger = graph(), q = query('from "A" follow "R" then "S"')
  const answer = await evaluateEIQuery(ledger, q)
  assert.equal(answer.origin.sourceStateFingerprint, `sha256:${createHash('sha256').update(exportEILedger(ledger)).digest('hex')}`)
  const receipt = await verifyEIQueryAnswer(ledger, q, answer)
  assert.equal(receipt.status, 'passed')
  assert.equal(receipt.scope, 'retained-local-relation-consistency')
  assert.ok(receipt.checks.every(c => c.matches))
  assert.ok(receipt.checks.some(c => c.kind === 'edge'))
  assert.ok(receipt.checks.some(c => c.kind === 'source-revision'))
  assert.match(formatEIQueryVerification(receipt), /Internal consistency only/)
  assert.ok(JSON.stringify(receipt).length < 20000)
})

test('self-check rejects changed context, forged edge/result/source/refs, and version changes with mismatch feedback', async () => {
  const ledger = graph(), q = query('from "A" follow "R" then "S" where value is "yes"')
  const answer = await evaluateEIQuery(ledger, q)
  const changed = advanceEI(ledger, proposeEI(ledger, update(ledger))).ledger
  const stale = await verifyEIQueryAnswer(changed, q, answer)
  assert.equal(stale.status, 'failed')
  assert.ok(stale.checks.some(c => c.kind === 'origin-source-state' && !c.matches))
  for (const tamper of [
    (a: any) => { a.proof.find((p: any) => p.op === 'FOLLOW_RELATION').edge.relation = 'invented' },
    (a: any) => { a.matches[0].value = 'invented' },
    (a: any) => { delete a.premises[0].source },
    (a: any) => { a.sourceRefs.push('missing') },
    (a: any) => { a.format = 'ei-query-answer/v999' },
    (a: any) => { a.parentGraph.parents[0] = [] },
  ]) {
    const forged = structuredClone(answer); tamper(forged)
    const failed = await verifyEIQueryAnswer(ledger, q, forged)
    assert.equal(failed.status, 'failed')
    assert.ok(failed.checks.some(c => !c.matches))
    assert.match(formatEIQueryVerification(failed), /mismatch/)
  }
})

test('unknowns remain unverified even when the recomputation exactly agrees', async () => {
  const ledger = graph(), q = query('from "A" follow "opaque"'), answer = await evaluateEIQuery(ledger, q)
  const receipt = await verifyEIQueryAnswer(ledger, q, answer)
  assert.equal(receipt.status, 'unresolved')
  assert.ok(receipt.checks.every(c => c.matches))
  assert.match(formatEIQueryVerification(receipt), /unknown branches remain unverified/)
})

test('forged ledger, staged uncommitted state, excessive sequence and undeclared typed operations reject', async () => {
  const ledger = graph()
  await assert.rejects(evaluateEIQuery(structuredClone(ledger), query('read "A"')), /validate this ledger/)
  const execution = executeEI(ledger, proposeEI(ledger, update(ledger)))
  assert.equal(execution.status, 'staged')
  if (execution.status === 'staged') await assert.rejects(evaluateEIQuery(execution.stagedLedger, query('read "D"')), /validate this ledger/)
  await assert.rejects(evaluateEIQuery(ledger, { kind: 'follow', address: 'A', relations: Array(33).fill('R') }), /1–32/)
  await assert.rejects(evaluateEIQuery(ledger, { kind: 'solve', address: 'A' } as unknown as EIQuery), /no declared operation/)
})

test('branch explosion is bounded and incomplete search stays explicitly unresolved', async () => {
  const ledger = createEILedger({ records: [
    { address: 'a', value: 'a', source: source('a'), relations: [{ relation: 'R', address: 'a' }, { relation: 'R', address: 'b' }] },
    { address: 'b', value: 'b', source: source('b'), relations: [{ relation: 'R', address: 'a' }, { relation: 'R', address: 'b' }] },
  ] })
  const q: EIQuery = { kind: 'follow', address: 'a', relations: Array(12).fill('R') }
  const answer = await evaluateEIQuery(ledger, q)
  assert.ok(answer.proof.length <= EI_REASONER_LIMITS.proofSteps)
  assert.ok(answer.matches.length <= EI_REASONER_LIMITS.paths)
  assert.ok(answer.unknowns.some(u => u.kind === 'limit'))
  assert.equal((await verifyEIQueryAnswer(ledger, q, answer)).status, 'unresolved')
})

test('context reconstructs all incoming/outgoing incident labels, roles, realms and separate parent links', async () => {
  const ledger = graph(), q = query('context "B"'), answer = await evaluateEIQuery(ledger, q)
  assert.equal(answer.context!.kind, 'retained-incident-relations')
  const addresses = answer.parentGraph.addresses
  assert.deepEqual(answer.context!.incident.map(i => [i.role, addresses[i.edge.from], i.edge.relation, addresses[i.edge.to]]), [
    ['incoming', 'A', 'R', 'B'], ['outgoing', 'B', 'S', 'D'], ['outgoing', 'B', 'back', 'A'],
  ])
  assert.ok(answer.context!.incident.every(i => answer.premises.find(p => p.id === i.sourcePremise)?.source.realm === 'synthetic-test' && answer.premises.find(p => p.id === i.targetPremise)?.source.realm === 'synthetic-test'))
  assert.deepEqual(answer.context!.parentLinks.map(p => [p.role, addresses[p.child], addresses[p.parent]]), [['parent', 'B', 'grain:one'], ['child', 'D', 'B']])
  assert.match(formatEIQueryAnswer(answer), /free-language meaning remains open/)
  assert.equal((await verifyEIQueryAnswer(ledger, q, answer)).status, 'passed')
  const omitted = structuredClone(answer) as any
  omitted.context.incident.shift()
  const check = await verifyEIQueryAnswer(ledger, q, omitted)
  assert.equal(check.status, 'failed')
  assert.ok(check.checks.some(c => c.kind === 'incident-context' && !c.matches))
})

test('context preserves unresolved incident endpoints and can reconstruct a missing address reference without inventing it', async () => {
  const ledger = graph(), answer = await evaluateEIQuery(ledger, query('context "A"'))
  assert.equal(answer.status, 'open')
  assert.equal(answer.context!.incident.find(i => answer.parentGraph.addresses[i.edge.to] === 'missing')!.targetPremise, null)
  assert.ok(!answer.sourceRefs.includes('missing'))
  const missing = await evaluateEIQuery(ledger, query('context "missing"'))
  assert.equal(missing.status, 'unresolved')
  assert.equal(missing.context!.incident[0].role, 'incoming')
  assert.equal(missing.parentGraph.addresses[missing.context!.incident[0].edge.from], 'A')
  assert.equal(missing.parentGraph.parents[missing.parentGraph.addresses.indexOf('missing')], null)
  assert.ok(!missing.parentGraph.roots.includes(missing.parentGraph.addresses.indexOf('missing')))
  assert.deepEqual(missing.sourceRefs, ['A'])
})

test('large explicit parent DAG retains every path alternative once without exponential route enumeration', async () => {
  const records = [{ address: '0', value: '0', source: source('0'), parents: [] as string[] }]
  for (let i = 1; i < 38; i++) records.push({ address: String(i), value: String(i), source: source(String(i)), parents: records.map(r => r.address) })
  const answer = await evaluateEIQuery(createEILedger({ records }), query('trace "37"'))
  assert.equal(answer.status, 'resolved')
  assert.equal(answer.unknowns.length, 0)
  assert.equal(answer.parentGraph.addresses.length, records.length)
  assert.equal(answer.parentGraph.parents.reduce((count, parents) => count + (parents?.length ?? 0), 0), 38 * 37 / 2)
  for (const record of records) {
    const node = answer.parentGraph.addresses.indexOf(record.address)
    assert.deepEqual(answer.parentGraph.parents[node]!.map(parent => answer.parentGraph.addresses[parent]), record.parents)
  }
})

test('oversized full prose is rejected rather than presenting an incomplete resolved answer', async () => {
  const long = 'x'.repeat(9000)
  const ledger = createEILedger({ records: [{ address: 'a', value: long, source: { id: 'long', text: long } }] })
  const answer = await evaluateEIQuery(ledger, query('read "a"'))
  assert.equal(answer.matches[0].value.length, 9000)
  assert.throws(() => formatEIQueryAnswer(answer), /complete answer exceeds/)
})

test('full source bytes remain in the ledger while references hash text and locator exactly', async () => {
  const captured = { id: 'proof-bearing', text: 'FULL_SOURCE_TEXT_ONLY_IN_LEDGER', realm: 'ei-conversation-reply', locator: JSON.stringify({ earlierProof: 'proof'.repeat(5000) }) }
  const ledger = createEILedger({ records: [
    { address: 'root', value: 'root', source: source('root') },
    { address: 'reply', value: 'UNREQUESTED_REPLY_TEXT', source: captured, parents: ['root'], relations: [{ relation: 'source-reference', address: 'root' }] },
  ] })
  const q = query('context "root"'), answer = await evaluateEIQuery(ledger, q)
  const p = answer.premises.find(p => answer.parentGraph.addresses[p.parentNode] === 'reply')!
  assert.equal(p.source.sourceFingerprint, `sha256:${createHash('sha256').update(JSON.stringify(captured)).digest('hex')}`)
  assert.equal(p.source.realm, captured.realm)
  assert.ok(!Object.hasOwn(p.source, 'locator'))
  assert.ok(!Object.hasOwn(p.source, 'text'))
  assert.ok(!JSON.stringify(answer).includes('FULL_SOURCE_TEXT_ONLY_IN_LEDGER'))
  assert.ok(!JSON.stringify(answer).includes('UNREQUESTED_REPLY_TEXT'))
  assert.equal(ledger.records[1].is.source.locator, captured.locator)
  assert.equal((await evaluateEIQuery(ledger, query('read "reply"'))).matches[0].value, 'UNREQUESTED_REPLY_TEXT')
  const corrected = createEILedger({ records: ledger.records.map(record => ({ address: record.address, value: record.is.value, source: record.address === 'reply' ? { ...captured, locator: `${captured.locator} ` } : record.is.source, parents: record.parents, relations: record.relations })) })
  const failed = await verifyEIQueryAnswer(corrected, q, answer)
  assert.equal(failed.status, 'failed')
  assert.ok(failed.checks.some(check => check.kind === 'source-revision' && !check.matches))
})

test('twelve capture-only inputs retain complete directly queried contexts without generating replies or embedded proofs', async () => {
  const root = 'EI/QA-2026-10-01'
  let ledger = createEILedger({ records: [
    { address: root, value: 'root', source: { id: 'root-source', text: 'root' } },
    { address: `${root}/child`, value: 'child', source: { id: 'child-source', text: 'child' }, parents: [root] },
  ] })
  for (let n = 1; n <= 12; n++) {
    const input = n === 1 ? `compare "${root}" with "${root}/child"` : `context "${root}"`
    const turn = await prepareEIConversationTurn({ ledger, root, input, id: `turn:${n}` })
    assert.equal(turn.status, 'proposed')
    if (turn.status !== 'proposed') assert.fail('turn was not proposed')
    assert.equal(turn.mode, 'capture-only')
    assert.equal(turn.reply, null)
    assert.equal(turn.user.text, input)
    assert.equal(turn.user.source.text, input)
    assert.equal(turn.user.evidence, undefined)
    const typedQuery: EIQuery = n === 1 ? { kind: 'compare', left: root, right: `${root}/child` } : { kind: 'context', address: root }
    const beforeQuery = exportEILedger(ledger)
    const answer = await evaluateEIQuery(ledger, typedQuery)
    const verification = await verifyEIQueryAnswer(ledger, typedQuery, answer)
    assert.equal(verification.status, 'passed')
    assert.equal(answer.format, 'ei-query-answer/v2')
    assert.equal(exportEILedger(ledger), beforeQuery)
    if (n > 1) {
      assert.deepEqual(answer.proof, [{ op: 'RECONSTRUCT_CONTEXT' }])
      assert.equal(answer.context!.incident.length, n - 1)
      assert.equal(answer.context!.parentLinks.length, n)
      const expectedEdges = ledger.records.reduce((count, record) => count + record.parents.length, 0)
      assert.equal(answer.parentGraph.parents.reduce((count, parents) => count + (parents?.length ?? 0), 0), expectedEdges)
      for (const premise of answer.premises) {
        const address = answer.parentGraph.addresses[premise.parentNode], record = ledger.records.find(r => r.address === address)!
        assert.equal(premise.source.sourceFingerprint, `sha256:${createHash('sha256').update(JSON.stringify(record.is.source)).digest('hex')}`)
      }
    }
    const execution = executeEIConversationTurn(ledger, turn)
    assert.equal(execution.status, 'staged')
    if (execution.status !== 'staged') assert.fail('turn was not staged')
    assert.deepEqual(execution.expected, [{ address: turn.user.address, value: input }])
    const committed = commitEIConversationTurn(ledger, turn, verifyLocalEI(execution))
    assert.equal(committed.status, 'committed')
    if (committed.status !== 'committed') assert.fail('turn was not committed')
    ledger = committed.ledger
  }
  assert.equal(ledger.revision, 12)
  assert.equal(ledger.records.length, 14)
  assert.ok(ledger.receipts.every(receipt => receipt.patches.length === 1))
  assert.equal(ledger.records.some(record => record.is.source.realm === 'ei-conversation-reply'), false)
  const pending = await prepareEIConversationTurn({ ledger, root, input: `context "${root}"`, id: 'turn:13' })
  assert.equal(pending.status, 'proposed')
  if (pending.status !== 'proposed') assert.fail('pending capture was not proposed')
  assert.equal(pending.reply, null)
  assert.equal(pending.mode, 'capture-only')
  assert.equal(ledger.revision, 12)
})
