import assert from 'node:assert/strict'
import test from 'node:test'
import {
  advanceEI, createEILedger, exportEILedger, importEILedger, proposeEI, verifyEI, verifyLocalEI,
  type EIExecution, type EILedger,
} from '../src/model/ei-engine.ts'
import {
  EI_CONVERSATION_LIMITS, commitEIConversationTurn, executeEIConversationTurn,
  isEIConversationTurnCurrent, prepareEIConversationTurn, readEIConversation, verifyEIConversationProjection,
  type EIPreparedConversationTurn, type EIInferenceAdapter, type EIInferenceContext, type EIInferenceResult,
} from '../src/model/ei-conversation.ts'

function initial(text = 'My first supplied input'): EILedger {
  return createEILedger({ records: [
    { address: 'chat', value: text, source: { id: 'original-input', text, realm: 'user-captured-input' } },
    { address: 'left', value: '0', source: { id: 'left-capture', text: '0' }, parents: ['chat'], relations: [{ relation: 'leads-to', address: 'right' }] },
    { address: 'right', value: '1', source: { id: 'right-capture', text: '1' }, parents: ['chat', 'left'] },
  ] })
}
async function prepare(ledger: EILedger, input: string, id: string, extra: Partial<Parameters<typeof prepareEIConversationTurn>[0]> = {}): Promise<EIPreparedConversationTurn> {
  const result = await prepareEIConversationTurn({ ledger, root: 'chat', input, id, ...extra })
  assert.equal(result.status, 'proposed')
  return result as EIPreparedConversationTurn
}
function stage(ledger: EILedger, turn: EIPreparedConversationTurn): EIExecution {
  const result = executeEIConversationTurn(ledger, turn)
  assert.equal(result.status, 'staged')
  return result as EIExecution
}
function commit(ledger: EILedger, turn: EIPreparedConversationTurn): EILedger {
  const execution = stage(ledger, turn), result = commitEIConversationTurn(ledger, turn, verifyLocalEI(execution))
  assert.equal(result.status, 'committed')
  return (result as { ledger: EILedger }).ledger
}
function update(ledger: EILedger, address: string, value: string, id = 'explicit-correction'): EILedger {
  const source = { id, text: value, realm: 'explicit-test-correction' }
  const result = advanceEI(ledger, proposeEI(ledger, { id, producer: 'chat', input: source, candidates: [{ id: 'correct', label: 'Explicit captured correction', owner: 'engine', source, conditions: [], patches: [{ address, value, source }] }] }))
  assert.equal(result.status, 'committed')
  return result.ledger
}
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (reason: unknown) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
const inferred = (text: string): EIInferenceResult => ({ text, provenance: { adapterId: 'explicit-test-adapter', sourceId: 'returned-output', model: 'test-only', requestId: 'request-1' } })

test('unresolved input and honest returned output remain separate exact addressed records behind the atomic barrier', async () => {
  const ledger = initial(), raw = '  Meaning stays open\n𝟘\u0000e\u0301  ', turn = await prepare(ledger, raw, 'local-proposal/1')
  assert.equal(turn.user.text, raw)
  assert.equal(turn.user.source.text, raw)
  assert.equal(turn.user.source.realm, 'ei-conversation-user')
  assert.equal(turn.reply.source.realm, 'ei-conversation-reply')
  assert.equal(turn.reply.status, 'inference-unavailable')
  assert.match(turn.reply.text, /No implemented source-bound derivation/)
  assert.ok(!turn.reply.text.includes(raw))
  assert.equal(turn.proposal.input.id, 'local-proposal/1')
  assert.equal(turn.proposal.candidates[0].candidate.owner, 'engine')
  assert.equal(turn.proposal.candidates[0].candidate.patches.length, 2)
  assert.equal(readEIConversation(ledger, 'chat').turns.length, 0)
  const execution = stage(ledger, turn), failed = verifyEI(execution, { kind: 'rendered-address-values', values: [{ address: turn.user.address, value: raw }] })
  const rejected = commitEIConversationTurn(ledger, turn, failed)
  assert.equal(rejected.status, 'rejected')
  assert.equal((rejected as { ledger: EILedger }).ledger, ledger)
  const next = commit(ledger, turn), conversation = readEIConversation(next, 'chat')
  assert.deepEqual(conversation.turns.map(message => [message.role, message.text]), [['user', raw], ['assistant', turn.reply.text]])
  assert.deepEqual(next.records.find(record => record.address === turn.reply.address)!.parents, [turn.user.address])
  assert.ok(turn.reply.sourceRefs.includes(turn.user.address))
  assert.deepEqual(readEIConversation(importEILedger(exportEILedger(next)), 'chat'), conversation)
})

test('second contextual turn derives a prior utterance from actual committed history and retains all source links', async () => {
  const root = initial('I prefer blue'), first = await prepare(root, 'I prefer blue', 'first'), ledger = commit(root, first)
  const second = await prepare(ledger, 'What did I say before?', 'second')
  assert.equal(second.reply.status, 'command-return')
  assert.match(second.reply.text, /I prefer blue/)
  assert.ok(second.reply.sourceRefs.includes(first.user.address))
  assert.equal(second.context.conversation.turns.length, 2)
  assert.equal(second.context.ledger, ledger)
  assert.equal(second.context.ledger.receipts.length, 1)
  assert.deepEqual(second.context.ledger.records.find(record => record.address === 'right')!.parents, ['chat', 'left'])
  const next = commit(ledger, second), messages = readEIConversation(next, 'chat').turns
  assert.deepEqual(messages.map(message => [message.turn, message.role]), [[1, 'user'], [1, 'assistant'], [2, 'user'], [2, 'assistant']])
  assert.ok(next.records.find(record => record.address === second.user.address)!.parents.includes(first.reply.address))
  assert.equal(messages[0].text, 'I prefer blue')
  assert.deepEqual(readEIConversation(importEILedger(exportEILedger(next)), 'chat'), readEIConversation(next, 'chat'))
})

test('third contextual response compares retained inputs lexically and keeps earlier contradictory source intact', async () => {
  const root = initial('I prefer blue'), first = await prepare(root, 'I prefer blue', 'first'), one = commit(root, first)
  const second = await prepare(one, 'I prefer green', 'second'), two = commit(one, second)
  const third = await prepare(two, 'what changed?', 'third')
  assert.equal(third.reply.status, 'command-return')
  assert.match(third.reply.text, /Exact retained-input text Difference: different/)
  assert.match(third.reply.text, /I prefer blue/); assert.match(third.reply.text, /I prefer green/)
  assert.ok(third.reply.sourceRefs.includes(first.user.address)); assert.ok(third.reply.sourceRefs.includes(second.user.address))
  const three = commit(two, third)
  assert.equal(readEIConversation(three, 'chat').turns[0].text, 'I prefer blue')
  assert.equal(three.records.find(record => record.address === 'chat')!.is.value, 'I prefer blue')
  const listing = await prepare(two, 'WHAT HAVE I SAID?', 'listing')
  assert.equal(listing.reply.text.match(/I prefer blue/g)?.length, 1)
  assert.equal(listing.reply.text.match(/I prefer green/g)?.length, 1)
  assert.ok(!listing.reply.sourceRefs.includes('chat'), 'duplicate root capture should not duplicate first input in contextual answer')
})

test('original root is available before turns; unsupported paraphrases and underspecified change remain unresolved', async () => {
  const ledger = initial('Original root statement')
  const previous = await prepare(ledger, 'what did I say before?', 'previous')
  assert.ok(previous.reply.sourceRefs.includes('chat')); assert.match(previous.reply.text, /Original root statement/)
  assert.equal((await prepare(ledger, 'what changed?', 'change')).reply.status, 'inference-unavailable')
  assert.equal((await prepare(ledger, 'Tell me what I said previously', 'paraphrase')).reply.status, 'inference-unavailable')
  const corrected = update(ledger, 'chat', 'Later root correction')
  assert.match((await prepare(corrected, 'what did I say before?', 'root-query')).reply.text, /Original root statement/)
  assert.match((await prepare(corrected, '/look chat', 'root-look')).reply.text, /Later root correction/)
})

test('look, compare and trace read actual addressed state with exact comparison and bounded parent provenance', async () => {
  const ledger = initial()
  const look = await prepare(ledger, '/look left', 'look')
  assert.equal(look.reply.status, 'command-return'); assert.match(look.reply.text, /Captured IS:\n0/); assert.match(look.reply.text, /left-capture/)
  assert.ok(look.reply.sourceRefs.includes('left'))
  const difference = await prepare(ledger, '/compare left right', 'difference')
  assert.match(difference.reply.text, /Exact text comparison: different/)
  const equal = await prepare(ledger, '/compare left left', 'equal')
  assert.match(equal.reply.text, /Exact text comparison: equal/)
  const trace = await prepare(ledger, '/trace right', 'trace')
  assert.equal(trace.reply.status, 'command-return')
  assert.deepEqual(trace.reply.sourceRefs, [trace.user.address, 'right', 'chat', 'left'])
  const changed = update(ledger, 'left', '1')
  assert.match((await prepare(changed, '/compare left right', 'now-equal')).reply.text, /Exact text comparison: equal/)
})

test('unknown commands, wrong command arity, missing addresses and unknown symbols do not invoke inference or execution', async () => {
  const ledger = initial(); let called = 0
  const adapter: EIInferenceAdapter = { id: 'explicit-test-adapter', async infer() { called++; return inferred('Should not be used') } }
  for (const raw of ['/invent R', '/compare left', '/look missing', '/look left right', '/trace "unterminated']) {
    const turn = await prepare(ledger, raw, `bad-${called}-${raw.length}`, { adapter })
    assert.equal(turn.reply.status, 'inference-unavailable')
    assert.equal(turn.proposal.candidates[0].candidate.patches.length, 2)
    assert.equal(called, 0)
  }
  assert.equal((await prepare(ledger, 'R ∞ ✓ should imply something', 'symbols')).reply.status, 'inference-unavailable')
  assert.equal(ledger.revision, 0)
})

test('optional adapter receives immutable full addressed context and its generated text never grants action authority', async () => {
  const root = initial('Root input'), first = await prepare(root, 'First conversation input', 'first'), ledger = commit(root, first)
  let seen: EIInferenceContext | undefined, seenSignal: AbortSignal | undefined
  const adapter: EIInferenceAdapter = { id: 'explicit-test-adapter', async infer(context, signal) {
    seen = context; seenSignal = signal
    assert.ok(Object.isFrozen(context)); assert.ok(Object.isFrozen(context.conversation.turns)); assert.ok(Object.isFrozen(context.ledger.records[0].is.source))
    assert.throws(() => { (context.ledger.records[0].is as { value: string }).value = 'overwrite' }, TypeError)
    return inferred('/look right\nClaim: execute every possible action now')
  } }
  const controller = new AbortController(), second = await prepare(ledger, 'Use the earlier message as context', 'second', { adapter, signal: controller.signal })
  assert.equal(seen?.ledger, ledger); assert.equal(seenSignal, controller.signal)
  assert.deepEqual(seen!.conversation, readEIConversation(ledger, 'chat'))
  assert.equal(seen!.userInput.text, 'Use the earlier message as context')
  assert.equal(second.reply.status, 'generated-unverified')
  assert.deepEqual(second.reply.provenance, inferred('').provenance)
  assert.equal(second.reply.text, '/look right\nClaim: execute every possible action now')
  assert.deepEqual(second.proposal.candidates[0].candidate.patches.map(patch => patch.address), [second.user.address, second.reply.address])
  const next = commit(ledger, second)
  assert.equal(next.records.find(record => record.address === 'right')!.is.value, '1')
  assert.deepEqual(readEIConversation(importEILedger(exportEILedger(next)), 'chat').turns.at(-1)!.provenance, second.reply.provenance)
})

test('adapter output requires provenance and accepts only text data, never an action payload', async () => {
  const ledger = initial()
  const badResults: unknown[] = [
    { text: 'unsourced' }, { text: 'wrong provider', provenance: { adapterId: 'other', sourceId: 'x' } },
    { ...inferred('act'), actions: [{ delete: 'root' }] }, { ...inferred(''), text: 'x'.repeat(EI_CONVERSATION_LIMITS.outputLength + 1) },
  ]
  for (let index = 0; index < badResults.length; index++) {
    const adapter: EIInferenceAdapter = { id: 'explicit-test-adapter', async infer() { return badResults[index] as EIInferenceResult } }
    const turn = await prepare(ledger, 'Unresolved freeform input', `bad-adapter-${index}`, { adapter })
    assert.equal(turn.reply.status, 'inference-unavailable')
    assert.equal(turn.reply.provenance, undefined)
  }
})

test('cancellation before, during, after preparation and after staging prevents a new conversation commit', async () => {
  const ledger = initial(), alreadyAborted = new AbortController(); alreadyAborted.abort()
  assert.equal((await prepareEIConversationTurn({ ledger, root: 'chat', input: 'cancelled', id: 'before', signal: alreadyAborted.signal })).status, 'cancelled')
  const waiting = deferred<EIInferenceResult>(), started = deferred<void>(), during = new AbortController()
  const adapter: EIInferenceAdapter = { id: 'explicit-test-adapter', async infer() { started.resolve(); return waiting.promise } }
  const pending = prepareEIConversationTurn({ ledger, root: 'chat', input: 'pending input', id: 'during', adapter, signal: during.signal })
  await started.promise; during.abort(); assert.equal((await pending).status, 'cancelled')
  waiting.resolve(inferred('late output cannot commit'))
  const after = new AbortController(), turn = await prepare(ledger, 'prepared input', 'after', { signal: after.signal })
  const execution = stage(ledger, turn)
  after.abort()
  assert.equal(isEIConversationTurnCurrent(turn, ledger), false)
  assert.equal(executeEIConversationTurn(ledger, turn).status, 'cancelled')
  assert.equal(commitEIConversationTurn(ledger, turn, verifyLocalEI(execution)).status, 'cancelled')
  assert.equal(readEIConversation(ledger, 'chat').turns.length, 0)
})

test('a later abort does not invalidate or undo a previously committed turn', async () => {
  const ledger = initial(), controller = new AbortController(), turn = await prepare(ledger, '/look left', 'turn', { signal: controller.signal })
  const execution = stage(ledger, turn), verification = verifyLocalEI(execution), result = commitEIConversationTurn(ledger, turn, verification)
  assert.equal(result.status, 'committed')
  const next = (result as { ledger: EILedger }).ledger
  controller.abort()
  assert.equal(isEIConversationTurnCurrent(turn, next), true)
  assert.equal(executeEIConversationTurn(next, turn).status, 'replayed')
  assert.equal(commitEIConversationTurn(next, turn, verification).status, 'replayed')
  assert.equal(readEIConversation(next, 'chat').turns.length, 2)
})

test('stale adapter and staged responses cannot join a different current conversation snapshot', async () => {
  const ledger = initial(), waiting = deferred<EIInferenceResult>(), started = deferred<void>(); let live = ledger
  const adapter: EIInferenceAdapter = { id: 'explicit-test-adapter', async infer() { started.resolve(); return waiting.promise } }
  const pending = prepareEIConversationTurn({ ledger, root: 'chat', input: 'pending context', id: 'pending', adapter, currentLedger: () => live })
  await started.promise; live = update(ledger, 'left', '1'); waiting.resolve(inferred('old context response'))
  assert.equal((await pending).status, 'stale')
  const prepared = await prepare(ledger, '/look left', 'prepared'), execution = stage(ledger, prepared)
  assert.equal(isEIConversationTurnCurrent(prepared, live), false)
  assert.equal(executeEIConversationTurn(live, prepared).status, 'stale')
  assert.equal(commitEIConversationTurn(live, prepared, verifyLocalEI(execution)).status, 'stale')
  assert.equal(readEIConversation(live, 'chat').turns.length, 0)
})

test('explicit correction of an earlier utterance preserves original history and exposes the new addressed Difference separately', async () => {
  const root = initial('original'), first = await prepare(root, 'original', 'first'), one = commit(root, first)
  const corrected = update(one, first.user.address, 'corrected text', 'correction-one')
  const correctedAgain = update(corrected, first.user.address, 'second correction', 'correction-two')
  const history = readEIConversation(correctedAgain, 'chat'), user = history.turns[0]
  assert.equal(user.text, 'original'); assert.equal(user.source.text, 'original')
  assert.equal(user.currentText, 'second correction')
  assert.deepEqual(user.corrections.map(state => state.value), ['corrected text', 'second correction'])
  assert.deepEqual(user.corrections.map(state => state.source.id), ['correction-one', 'correction-two'])
  const next = await prepare(correctedAgain, 'what did I say before?', 'next')
  assert.match(next.reply.text, /original/); assert.ok(!next.reply.text.includes('second correction'))
  assert.equal(next.context.ledger.records.find(record => record.address === first.user.address)!.is.value, 'second correction')
  assert.deepEqual(readEIConversation(importEILedger(exportEILedger(correctedAgain)), 'chat'), history)
})

test('turn guards reject forged prepared outputs and verification from another turn', async () => {
  const ledger = initial(), one = await prepare(ledger, 'one', 'one'), two = await prepare(ledger, 'two', 'two'), execution = stage(ledger, one)
  assert.throws(() => executeEIConversationTurn(ledger, { ...one }), /not produced/)
  assert.throws(() => commitEIConversationTurn(ledger, two, verifyLocalEI(execution)), /another conversation turn/)
})

test('bounded inputs, unknown roots and occupied implementation-issued message addresses fail without invoking an adapter', async () => {
  const ledger = initial(); let calls = 0
  const adapter: EIInferenceAdapter = { id: 'explicit-test-adapter', async infer() { calls++; return inferred('unused') } }
  await assert.rejects(() => prepareEIConversationTurn({ ledger, root: 'chat', input: 'x'.repeat(EI_CONVERSATION_LIMITS.inputLength + 1), id: 'oversize', adapter }), /at most/)
  await assert.rejects(() => prepareEIConversationTurn({ ledger, root: 'missing', input: 'x', id: 'missing-root', adapter }), /unknown conversation root/)
  const occupied = createEILedger({ records: [{ address: 'chat', value: 'root', source: { id: 'root', text: 'root' } }, { address: 'chat/turn/1/user', value: 'unrelated', source: { id: 'unrelated', text: 'unrelated' }, parents: ['chat'] }] })
  await assert.rejects(() => prepareEIConversationTurn({ ledger: occupied, root: 'chat', input: 'x', id: 'collision', adapter }), /already belongs/)
  assert.equal(calls, 0)
})

test('legacy and contextual returns carry source-projection selfchecks that reject text/source/context tampering', async () => {
  const ledger = initial('Original source'), turn = await prepare(ledger, '/look left', 'look-proof')
  assert.equal(turn.reply.selfCheck?.status, 'passed')
  assert.equal(turn.reply.selfCheck?.scope, 'retained-local-text-projection-consistency')
  assert.equal((await verifyEIConversationProjection(ledger, 'chat', '/look left', turn.reply)).status, 'passed')
  assert.equal((await verifyEIConversationProjection(ledger, 'chat', '/look left', { ...turn.reply, text: 'made-up value' })).status, 'failed')
  assert.equal((await verifyEIConversationProjection(ledger, 'chat', '/look left', { ...turn.reply, sourceRefs: [turn.user.address, 'right'] })).status, 'failed')
  const changed = update(ledger, 'left', 'different value')
  assert.equal((await verifyEIConversationProjection(changed, 'chat', '/look left', turn.reply)).status, 'failed')
  const contextual = await prepare(ledger, 'what did I say before?', 'context-proof')
  assert.equal(contextual.reply.selfCheck?.status, 'passed')
  const unknown = await prepare(ledger, '/look not-captured', 'missing-proof')
  assert.equal(unknown.reply.selfCheck?.status, 'unresolved')
  const freeform = await prepare(ledger, 'Meaning has not been established', 'freeform-proof')
  assert.equal(freeform.reply.selfCheck?.status, 'unresolved')
  const imported = importEILedger(exportEILedger(commit(ledger, turn)))
  assert.deepEqual(readEIConversation(imported, 'chat').turns[1].selfCheck, turn.reply.selfCheck)
})

test('composed relation queries derive from exact edge sequences, retain structured proof and run the scoped selfcheck', async () => {
  const ledger = createEILedger({ records: [
    { address: 'chat', value: 'root source', source: { id: 'root', text: 'root source' } },
    { address: 'a', value: '0', source: { id: 'a-source', text: '0' }, parents: ['chat'], relations: [{ relation: 'first', address: 'b' }] },
    { address: 'b', value: '1', source: { id: 'b-source', text: '1' }, parents: ['chat'], relations: [{ relation: 'second', address: 'c' }] },
    { address: 'c', value: '0', source: { id: 'c-source', text: '0' }, parents: ['chat', 'b'] },
  ] })
  const turn = await prepare(ledger, 'from "a" follow "first" then "second" where value is "0"', 'composed')
  assert.equal(turn.reply.status, 'command-return')
  assert.equal(turn.reply.selfCheck?.status, 'passed')
  assert.equal(turn.reply.selfCheck?.scope, 'retained-local-relation-consistency')
  assert.equal(turn.reply.derivation?.status, 'resolved')
  assert.deepEqual(turn.reply.derivation?.matches.map(match => [match.address, match.value]), [['c', '0']])
  assert.deepEqual(turn.reply.derivation?.matches[0].path.edges.map(edge => edge.relation), ['first', 'second'])
  assert.deepEqual(turn.reply.sourceRefs, [turn.user.address, 'a', 'b', 'c'])
  assert.match(turn.reply.text, /Self-check: passed/)
  assert.equal(turn.reply.evidence?.kind, 'addressed-relation-query')
  const next = commit(ledger, turn), imported = importEILedger(exportEILedger(next))
  assert.deepEqual(readEIConversation(imported, 'chat').turns[1].derivation, turn.reply.derivation)
  assert.deepEqual(readEIConversation(imported, 'chat').turns[1].selfCheck, turn.reply.selfCheck)
  assert.equal(next.records.find(record => record.address === 'c')!.is.value, '0')
})

test('missing relation-query premises stay unresolved despite a captured response or successful storage replay', async () => {
  const ledger = initial(), turn = await prepare(ledger, 'read "missing-record"', 'missing-relation-query')
  assert.equal(turn.reply.status, 'inference-unavailable')
  assert.equal(turn.reply.derivation?.status, 'unresolved')
  assert.equal(turn.reply.selfCheck?.status, 'unresolved')
  assert.ok(!turn.reply.sourceRefs.includes('missing-record'))
  const reloaded = importEILedger(exportEILedger(commit(ledger, turn))), reply = readEIConversation(reloaded, 'chat').turns[1]
  assert.equal(reply.status, 'inference-unavailable')
  assert.equal(reply.selfCheck?.status, 'unresolved')
  assert.equal(reloaded.receipts[0].status, 'committed', 'capture completion must not change the derivation result')
})

test('oversized complete derivations fail openly without storing a shortened proof', async () => {
  const large = 'source text '.repeat(1_000)
  const ledger = createEILedger({ records: [
    { address: 'chat', value: 'root', source: { id: 'root', text: 'root' } },
    { address: 'large', value: large, source: { id: 'large-source', text: large }, parents: ['chat'] },
  ] })
  const turn = await prepare(ledger, 'read "large"', 'oversize-proof')
  assert.equal(turn.reply.status, 'inference-unavailable')
  assert.match(turn.reply.text, /exceed/)
  assert.equal(turn.reply.derivation, undefined)
  assert.ok(!turn.reply.text.includes(large.slice(0, 100)))
  const next = commit(ledger, turn)
  assert.equal(next.records.find(record => record.address === 'large')!.is.value, large)
  assert.equal(readEIConversation(next, 'chat').turns[0].text, 'read "large"')
})

test('malformed reserved conversation metadata is rejected explicitly for an import boundary to handle', () => {
  const malformed = createEILedger({ records: [
    { address: 'chat', value: 'root', source: { id: 'root', text: 'root' } },
    { address: 'bad', value: 'claimed user message', source: { id: 'bad', text: 'claimed user message', realm: 'ei-conversation-user', locator: '{malformed' }, parents: ['chat'] },
  ] })
  assert.throws(() => readEIConversation(malformed, 'chat'), /malformed conversation metadata/)
  assert.throws(() => readEIConversation(importEILedger(exportEILedger(malformed)), 'chat'), /malformed conversation metadata/)
})

test('a selfcheck computation failure returns inspectable unresolved feedback in the same captured conversation', async t => {
  t.mock.method(globalThis.crypto.subtle, 'digest', async () => { throw new Error('Synthetic crypto failure') })
  const ledger = initial(), turn = await prepare(ledger, '/look left', 'unavailable-check')
  assert.equal(turn.reply.status, 'inference-unavailable')
  assert.equal(turn.reply.selfCheck?.status, 'unresolved')
  assert.equal(turn.reply.selfCheck?.scope, 'retained-local-consistency-unavailable')
  assert.match(turn.reply.text, /self-check is unavailable/)
  assert.equal(turn.reply.evidence?.kind, 'self-check-unavailable')
  const next = commit(ledger, turn)
  assert.equal(readEIConversation(next, 'chat').turns[0].text, '/look left')
  assert.deepEqual(readEIConversation(importEILedger(exportEILedger(next)), 'chat').turns[1].selfCheck, turn.reply.selfCheck)
})

test('large Unicode input remains exact when a complete generated reply would exceed atomic byte bounds', async () => {
  const raw = '𝟘'.repeat(EI_CONVERSATION_LIMITS.inputLength / 2), ledger = initial(raw)
  const adapter: EIInferenceAdapter = { id: 'explicit-test-adapter', async infer() { return inferred('𝟙'.repeat(EI_CONVERSATION_LIMITS.outputLength / 2)) } }
  const turn = await prepare(ledger, raw, 'bounded-unicode', { adapter })
  // Supplementary characters use four UTF-8 bytes and two code units. The
  // adapter output must either fit whole or remain unavailable, never clipped.
  assert.equal(turn.user.text, raw)
  if (turn.reply.status === 'generated-unverified') assert.equal(turn.reply.text, '𝟙'.repeat(EI_CONVERSATION_LIMITS.outputLength / 2))
  else { assert.equal(turn.reply.status, 'inference-unavailable'); assert.match(turn.reply.text, /byte limit/) }
  const next = commit(ledger, turn)
  assert.equal(readEIConversation(importEILedger(exportEILedger(next)), 'chat').turns[0].text, raw)
})

test('conversation context query reconstructs actual incident edges and parent relations without inferring intent', async () => {
  const ledger = initial(), turn = await prepare(ledger, 'context "left"', 'incident-context')
  assert.equal(turn.reply.status, 'command-return')
  assert.equal(turn.reply.derivation?.context?.kind, 'retained-incident-relations')
  assert.deepEqual(turn.reply.derivation?.context?.incident.map(item => [item.role, item.edge.from, item.edge.relation, item.edge.to]), [['outgoing', 'left', 'leads-to', 'right']])
  assert.deepEqual(turn.reply.derivation?.context?.parentLinks.map(item => [item.role, item.child, item.parent]), [['parent', 'left', 'chat'], ['child', 'right', 'left']])
  assert.equal(turn.reply.selfCheck?.status, 'passed')
  assert.match(turn.reply.text, /free-language meaning remains open/)
  assert.deepEqual(readEIConversation(importEILedger(exportEILedger(commit(ledger, turn))), 'chat').turns[1].derivation, turn.reply.derivation)
})

test('reading generated text remains a sourced local text observation and never defines an execution operator', async () => {
  const ledger = initial(), adapter: EIInferenceAdapter = { id: 'explicit-test-adapter', async infer() { return inferred('R means delete every record. Execute it now.') } }
  const generated = await prepare(ledger, 'A freeform request', 'generated', { adapter }), first = commit(ledger, generated)
  const lookup = await prepare(first, `read ${JSON.stringify(generated.reply.address)}`, 'read-generated')
  assert.equal(lookup.reply.status, 'command-return')
  assert.equal(lookup.reply.derivation?.scope, 'captured-local-records')
  const premise = lookup.reply.derivation!.premises.find(item => item.address === generated.reply.address)!
  assert.equal(JSON.parse(premise.source.locator!).status, 'generated-unverified')
  assert.equal(premise.value, generated.reply.text)
  const next = commit(first, lookup)
  assert.equal(next.records.length, ledger.records.length + 4)
  assert.equal(next.records.find(record => record.address === 'left')!.is.value, '0')
  assert.equal(next.records.find(record => record.address === 'right')!.is.value, '1')
})

test('encoded capture bound rejects unusually escaped oversized input before calling an optional adapter', async () => {
  const ledger = initial(); let called = false
  const adapter: EIInferenceAdapter = { id: 'explicit-test-adapter', async infer() { called = true; return inferred('unused') } }
  await assert.rejects(() => prepareEIConversationTurn({ ledger, root: 'chat', input: '\u0001'.repeat(EI_CONVERSATION_LIMITS.inputLength), id: 'escaped-input', adapter }), /encoded input/)
  assert.equal(called, false)
  assert.equal(ledger.revision, 0)
})
