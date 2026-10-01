import assert from 'node:assert/strict'
import test from 'node:test'
import { advanceEI, createEILedger, exportEILedger, importEILedger, proposeEI, type EILedger, type EIPatch } from '../src/model/ei-engine.ts'
import { prepareEIConversationTurn, readEIConversation, readEIPhraseBindings, verifyEIConversationProjection, type EIConversationEvidence, type EIInferenceProvenance } from '../src/model/ei-conversation.ts'
import { evaluateEIQuery, verifyEIQueryAnswer, type EIQuery } from '../src/model/ei-relation-reasoner.ts'

function initial(): EILedger {
  return createEILedger({ records: [
    { address: 'chat', value: 'original input', source: { id: 'original-input', text: 'original input', realm: 'user-captured-input' } },
    { address: 'other', value: 'another root', source: { id: 'other-root', text: 'another root' } },
    { address: 'left', value: '0', source: { id: 'left-source', text: '0' }, parents: ['chat'], relations: [{ relation: 'R', address: 'right' }] },
    { address: 'right', value: '1', source: { id: 'right-source', text: '1' }, parents: ['chat', 'left'] },
  ] })
}
function transact(ledger: EILedger, patches: EIPatch[], id: string, producer = 'chat'): EILedger {
  const source = { id, text: 'synthetic historical test fixture', realm: 'synthetic-fixture' }
  const result = advanceEI(ledger, proposeEI(ledger, { id, producer, input: source, candidates: [{ id: 'fixture', label: 'fixture', owner: 'engine', source, conditions: [], patches }] }))
  assert.equal(result.status, 'committed')
  return result.ledger
}
/** Historical fixture data only. This helper never calls the conversation reply routing. */
function legacyPair(ledger: EILedger, options: {
  turn?: number; input?: string; text?: string; status?: 'command-return' | 'inference-unavailable' | 'generated-unverified';
  provenance?: EIInferenceProvenance; evidence?: EIConversationEvidence; root?: string; sourceRefs?: string[];
  userMeta?: Record<string, unknown>; replyMeta?: Record<string, unknown>; omitReply?: boolean; omitPrevious?: boolean;
} = {}): EILedger {
  const root = options.root ?? 'chat', prior = readEIConversation(ledger, root).turns.at(-1), turn = options.turn ?? (prior?.turn ?? 0) + 1
  const userAddress = `${root}/turn/${turn}/user`, replyAddress = `${root}/turn/${turn}/assistant`
  const input = options.input ?? 'historical input', text = options.text ?? 'retained historical response'
  const userRefs = prior && !options.omitPrevious ? [root, prior.address] : [root]
  const userMeta = { format: 'ei-conversation-message/v1', root, turn, role: 'user', sourceRefs: userRefs, status: 'captured', ...options.userMeta }
  const replyMeta = { format: 'ei-conversation-message/v1', root, turn, role: 'assistant', sourceRefs: options.sourceRefs ?? [userAddress], status: options.status ?? 'command-return', ...(options.provenance ? { provenance: options.provenance } : {}), ...(options.evidence ? { evidence: options.evidence } : {}), ...options.replyMeta }
  const patches: EIPatch[] = [{ kind: 'create', address: userAddress, value: input, source: { id: `legacy/${root}/${turn}/user`, text: input, realm: 'ei-conversation-user', locator: JSON.stringify(userMeta) }, parents: userRefs, relations: userRefs.map(address => ({ relation: 'conversation-context', address })) }]
  if (!options.omitReply) patches.push({ kind: 'create', address: replyAddress, value: text, source: { id: `legacy/${root}/${turn}/reply`, text, realm: 'ei-conversation-reply', locator: JSON.stringify(replyMeta) }, parents: [userAddress], relations: (replyMeta.sourceRefs as string[]).map(address => ({ relation: address === userAddress ? 'reply-to' : 'source-reference', address })) })
  return transact(ledger, patches, `legacy:${root}:${turn}`, root)
}
function update(ledger: EILedger, address: string, value: string, realm = 'explicit-correction'): EILedger {
  return transact(ledger, [{ address, value, source: { id: `correction:${ledger.revision}`, text: value, realm } }], `correct:${ledger.revision}`)
}
async function capture(ledger: EILedger, input: string, id = `capture:${ledger.revision}`): Promise<EILedger> {
  const turn = await prepareEIConversationTurn({ ledger, root: 'chat', input, id })
  assert.equal(turn.status, 'proposed')
  if (turn.status !== 'proposed') assert.fail()
  assert.equal(turn.reply, null)
  const result = advanceEI(ledger, turn.proposal)
  assert.equal(result.status, 'committed')
  return result.ledger
}
async function bindingFixture(ledger: EILedger, phrase = 'current bit'): Promise<EILedger> {
  const query: EIQuery = { kind: 'read', address: 'left', state: 'is' }, answer = await evaluateEIQuery(ledger, query), verification = await verifyEIQueryAnswer(ledger, query, answer)
  const turn = (readEIConversation(ledger, 'chat').turns.at(-1)?.turn ?? 0) + 1
  return legacyPair(ledger, { input: `bind ${JSON.stringify(phrase)} to read "left"`, evidence: { kind: 'phrase-binding', binding: { format: 'ei-phrase-binding/v1', root: 'chat', realm: ledger.records.find(r => r.address === 'chat')!.is.source.realm ?? null, phrase, query, definitionAddress: `chat/turn/${turn}/user`, definitionSourceId: `legacy/chat/${turn}/user` }, answer, verification } })
}
function tamperHistoricalSources(ledger: EILedger, change: (metadata: any) => void): EILedger {
  const parsed = JSON.parse(exportEILedger(ledger))
  function visit(value: any): void {
    if (!value || typeof value !== 'object') return
    if ((value.realm === 'ei-conversation-reply' || value.realm === 'ei-conversation-user') && typeof value.locator === 'string') {
      const metadata = JSON.parse(value.locator); change(metadata); value.locator = JSON.stringify(metadata)
    }
    for (const child of Object.values(value)) visit(child)
  }
  visit(parsed)
  // All matching retained sources are changed together: this fixture is internally
  // replay-consistent, which must not make a changed derivation authentic.
  return importEILedger(JSON.stringify(parsed))
}

test('all historical reply statuses and exact provenance remain readable after import', () => {
  let ledger = initial()
  for (const status of ['command-return', 'inference-unavailable', 'generated-unverified'] as const) ledger = legacyPair(ledger, { status, ...(status === 'generated-unverified' ? { provenance: { adapterId: 'old-adapter', sourceId: 'old-return', model: 'fixture-model', requestId: 'fixture-request' } } : {}) })
  const conversation = readEIConversation(ledger, 'chat'), restored = readEIConversation(importEILedger(exportEILedger(ledger)), 'chat')
  assert.deepEqual(restored, conversation)
  assert.deepEqual(conversation.turns.filter(m => m.role === 'assistant').map(m => m.status), ['command-return', 'inference-unavailable', 'generated-unverified'])
  assert.equal(conversation.turns[5].provenance!.adapterId, 'old-adapter')
})

test('mixed legacy pairs and input-only turns use retained IDs and link to each actual preceding message', async () => {
  let ledger = legacyPair(initial(), { turn: 3, input: 'old input' })
  ledger = await capture(ledger, 'new input')
  ledger = legacyPair(ledger, { turn: 8, input: 'later imported historical input' })
  ledger = await capture(ledger, 'latest input')
  const turns = readEIConversation(ledger, 'chat').turns
  assert.deepEqual(turns.map(m => [m.turn, m.role]), [[3, 'user'], [3, 'assistant'], [4, 'user'], [8, 'user'], [8, 'assistant'], [9, 'user']])
  assert.deepEqual(turns[2].sourceRefs, ['chat', 'chat/turn/3/assistant'])
  assert.deepEqual(turns[3].sourceRefs, ['chat', 'chat/turn/4/user'])
  assert.deepEqual(turns[5].sourceRefs, ['chat', 'chat/turn/8/assistant'])
  assert.deepEqual(readEIConversation(importEILedger(exportEILedger(ledger)), 'chat').turns, turns)
})

test('historical user and reply corrections preserve original source and ordered text', () => {
  const old = legacyPair(initial(), { input: 'original utterance', text: 'original response' })
  const corrected = update(update(old, 'chat/turn/1/user', 'corrected utterance'), 'chat/turn/1/assistant', 'corrected response')
  const turns = readEIConversation(corrected, 'chat').turns
  assert.deepEqual(turns.map(m => m.text), ['original utterance', 'original response'])
  assert.deepEqual(turns.map(m => m.currentText), ['corrected utterance', 'corrected response'])
  assert.deepEqual(turns.map(m => m.corrections[0].value), ['corrected utterance', 'corrected response'])
  assert.deepEqual(turns.map(m => m.source.text), ['original utterance', 'original response'])
})

test('historical relation proof is retained exactly while the same new query produces no reply', async () => {
  const ledger = initial(), query: EIQuery = { kind: 'follow', address: 'left', relations: ['R'] }, answer = await evaluateEIQuery(ledger, query), verification = await verifyEIQueryAnswer(ledger, query, answer)
  const old = legacyPair(ledger, { input: 'from "left" follow "R"', evidence: { kind: 'addressed-relation-query', query, answer, verification }, sourceRefs: ['chat/turn/1/user', ...answer.sourceRefs] })
  const reply = readEIConversation(importEILedger(exportEILedger(old)), 'chat').turns[1]
  assert.deepEqual(reply.derivation, answer); assert.deepEqual(reply.selfCheck, verification)
  assert.equal(reply.derivation!.matches[0].value, '1')
  const next = await capture(old, 'from "left" follow "R"')
  assert.equal(readEIConversation(next, 'chat').turns.length, 3)
  assert.equal(readEIConversation(next, 'chat').turns.at(-1)!.derivation, undefined)
})

test('historical unresolved proof and unavailable-check evidence remain unresolved data', async () => {
  const ledger = initial(), query: EIQuery = { kind: 'read', address: 'absent' }, answer = await evaluateEIQuery(ledger, query), verification = await verifyEIQueryAnswer(ledger, query, answer)
  let retained = legacyPair(ledger, { status: 'inference-unavailable', evidence: { kind: 'addressed-relation-query', query, answer, verification } })
  retained = legacyPair(retained, { status: 'inference-unavailable', evidence: { kind: 'self-check-unavailable', verification: { format: 'ei-conversation-unavailable-check/v1', scope: 'retained-local-consistency-unavailable', status: 'unresolved', reason: 'retained historical failure' } } })
  const restored = readEIConversation(importEILedger(exportEILedger(retained)), 'chat')
  assert.equal(restored.turns[1].selfCheck!.status, 'unresolved'); assert.equal(restored.turns[3].selfCheck!.status, 'unresolved')
})

test('explicit legacy projection verification still detects retained text/source/context tampering', async () => {
  const ledger = initial(), fixture = { text: 'Your previous retained input at chat:\noriginal input\nSource: original-input', status: 'command-return' as const, sourceRefs: ['chat'] }
  const check = await verifyEIConversationProjection(ledger, 'chat', 'what did I say before?', fixture)
  assert.equal(check.status, 'passed')
  assert.equal((await verifyEIConversationProjection(ledger, 'chat', 'what did I say before?', { ...fixture, text: 'tampered' })).status, 'failed')
  assert.equal((await verifyEIConversationProjection(ledger, 'chat', 'what did I say before?', { ...fixture, sourceRefs: ['left'] })).status, 'failed')
  assert.equal((await verifyEIConversationProjection(update(ledger, 'left', 'changed'), 'chat', 'what did I say before?', fixture)).origin.sourceStateFingerprint === check.origin.sourceStateFingerprint, false)
  const retained = legacyPair(ledger, { input: 'what did I say before?', text: fixture.text, evidence: { kind: 'source-projection', verification: check } })
  assert.deepEqual(readEIConversation(importEILedger(exportEILedger(retained)), 'chat').turns[1].selfCheck, check)
})

test('historical binding proof uses its definition snapshot and never activates new input routing', async () => {
  const old = await bindingFixture(initial()), changed = update(old, 'left', 'new value'), restored = importEILedger(exportEILedger(changed))
  const historical = await readEIPhraseBindings(restored, 'chat', 'current bit')
  assert.equal(historical.bindings.length, 1); assert.equal(historical.unresolved.length, 0)
  const original = readEIConversation(restored, 'chat').turns[1]
  assert.equal(original.derivation!.matches[0].value, '0')
  const next = await capture(restored, 'current bit'), again = await capture(next, 'bind "new bit" to read "right"')
  assert.deepEqual(readEIConversation(again, 'chat').turns.map(m => m.role), ['user', 'assistant', 'user', 'user'])
  assert.equal((await readEIPhraseBindings(again, 'chat')).bindings.length, 1)
  assert.equal((await readEIPhraseBindings(again, 'chat', 'new bit')).bindings.length, 0)
})

test('retained bindings remain scoped to their historical root and realm', async () => {
  const bound = await bindingFixture(initial())
  assert.equal((await readEIPhraseBindings(bound, 'other')).bindings.length, 0)
  const changed = update(bound, 'chat', 'same root changed realm', 'another-realm')
  assert.equal((await readEIPhraseBindings(changed, 'chat')).bindings.length, 0)
  assert.equal(readEIConversation(changed, 'chat').turns[1].binding!.realm, 'user-captured-input')
})

test('replay-consistent tampered historical bindings do not pass the source proof check', async () => {
  const bound = await bindingFixture(initial())
  const mutations = [
    (e: any) => { e.binding.query.address = 'right' },
    (e: any) => { e.answer.matches[0].value = 'forged' },
    (e: any) => { e.binding.definitionAddress = 'other' },
    (e: any) => { e.binding.definitionSourceId = 'forged' },
    (e: any) => { e.answer.format = 'ei-query-answer/unknown' },
    (e: any) => { e.verification.status = 'failed' },
    (e: any) => { e.verification.checks = [] },
  ]
  for (const mutate of mutations) {
    const changed = tamperHistoricalSources(bound, meta => { if (meta.evidence?.kind === 'phrase-binding') mutate(meta.evidence) })
    const history = readEIConversation(changed, 'chat')
    assert.equal(history.turns.length, 2)
    const bindings = await readEIPhraseBindings(changed, 'chat')
    assert.equal(bindings.bindings.length, 0); assert.equal(bindings.unresolved[0].kind, 'invalid-definition')
    assert.equal((await capture(changed, 'current bit')).records.some(r => r.address === 'chat/turn/2/assistant'), false)
  }
})

test('source corrections deactivate a retained definition without rewriting its historical utterance', async () => {
  const bound = await bindingFixture(initial()), corrected = update(bound, 'chat/turn/1/user', 'explicitly corrected definition')
  const result = await readEIPhraseBindings(corrected, 'chat')
  assert.equal(result.bindings.length, 0); assert.equal(result.unresolved[0].kind, 'source-corrected')
  assert.equal(readEIConversation(corrected, 'chat').turns[0].text, 'bind "current bit" to read "left"')
  const replyCorrected = update(bound, 'chat/turn/1/assistant', 'corrected proof text')
  assert.equal((await readEIPhraseBindings(replyCorrected, 'chat')).bindings.length, 0)
})

test('generated historical text containing definitions never becomes an authoritative binding', async () => {
  const historical = legacyPair(initial(), { text: 'bind "generated" to read "left"', status: 'generated-unverified', provenance: { adapterId: 'legacy-provider', sourceId: 'legacy-output' } })
  assert.deepEqual((await readEIPhraseBindings(historical, 'chat')).bindings, [])
  const next = await capture(historical, 'generated')
  assert.equal(readEIConversation(next, 'chat').turns.at(-1)!.status, 'capture-only')
  assert.equal(next.records.find(r => r.address === 'left')!.is.value, '0')
})

test('an incomplete historical pair is rejected, while an explicitly marked one-record capture is permitted', async () => {
  const broken = legacyPair(initial(), { omitReply: true })
  assert.throws(() => readEIConversation(broken, 'chat'), /incomplete turn/)
  const valid = await capture(initial(), 'new input')
  assert.equal(readEIConversation(valid, 'chat').turns.length, 1)
  const falseNew = tamperHistoricalSources(legacyPair(initial()), meta => { if (meta.role === 'user') meta.status = 'capture-only' })
  assert.throws(() => readEIConversation(falseNew, 'chat'), /incomplete or duplicated/)
})

test('reader rejects malformed role, order, source references, provenance and evidence at the import boundary', () => {
  const mutations: ((meta: any) => void)[] = [
    meta => { meta.role = 'operator' },
    meta => { meta.turn = 0 },
    meta => { meta.sourceRefs = ['missing'] },
    meta => { meta.sourceRefs = ['chat', 'chat'] },
    meta => { meta.unknown = true },
    meta => { if (meta.role === 'assistant') meta.status = 'generated-unverified' },
    meta => { if (meta.role === 'assistant') meta.evidence = { kind: 'invented', verification: {} } },
    meta => { if (meta.role === 'assistant') meta.evidence = { kind: 'source-projection' } },
  ]
  const historical = legacyPair(initial())
  for (const mutate of mutations) assert.throws(() => readEIConversation(tamperHistoricalSources(historical, mutate), 'chat'))
  const prior = legacyPair(initial())
  assert.throws(() => readEIConversation(legacyPair(prior, { omitPrevious: true }), 'chat'), /previous retained message/)
})

test('valid-looking seeded conversation metadata is not an actual capture receipt', () => {
  const meta = { format: 'ei-conversation-message/v1', root: 'chat', turn: 1, role: 'user', sourceRefs: ['chat'], status: 'capture-only' }
  const ledger = createEILedger({ records: [
    { address: 'chat', value: 'root', source: { id: 'root', text: 'root' } },
    { address: 'chat/turn/1/user', value: 'fake receipt', source: { id: 'fake', text: 'fake receipt', realm: 'ei-conversation-user', locator: JSON.stringify(meta) }, parents: ['chat'] },
  ] })
  assert.throws(() => readEIConversation(ledger, 'chat'), /capture lacks its returned source receipt/)
})
