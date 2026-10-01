import assert from 'node:assert/strict'
import test from 'node:test'
import {
  advanceEI, createEILedger, exportEILedger, importEILedger, proposeEI, verifyEI, verifyLocalEI,
  type EIExecution, type EILedger,
} from '../src/model/ei-engine.ts'
import {
  EI_CONVERSATION_LIMITS, commitEIConversationTurn, executeEIConversationTurn,
  isEIConversationTurnCurrent, prepareEIConversationTurn, readEIConversation, readEIPhraseBindings,
  type EIPreparedConversationTurn,
} from '../src/model/ei-conversation.ts'
import { saveEISession, restoreEISession } from '../src/model/ei-session.ts'

function initial(): EILedger {
  return createEILedger({ records: [
    { address: 'chat', value: 'original root', source: { id: 'root-source', text: 'original root', realm: 'source' } },
    { address: 'left', value: '0', source: { id: 'left-source', text: '0' }, parents: ['chat'], relations: [{ relation: 'R', address: 'right' }, { relation: 'open', address: 'missing' }] },
    { address: 'right', value: '1', source: { id: 'right-source', text: '1' }, parents: ['chat', 'left'] },
  ] })
}
async function prepare(ledger: EILedger, input = 'raw input', id = `capture:${ledger.revision}`, options: Partial<Parameters<typeof prepareEIConversationTurn>[0]> = {}): Promise<EIPreparedConversationTurn> {
  const result = await prepareEIConversationTurn({ ledger, root: 'chat', input, id, ...options })
  assert.equal(result.status, 'proposed')
  return result as EIPreparedConversationTurn
}
function stage(ledger: EILedger, turn: EIPreparedConversationTurn): EIExecution {
  const result = executeEIConversationTurn(ledger, turn)
  assert.equal(result.status, 'staged')
  return result as EIExecution
}
function commit(ledger: EILedger, turn: EIPreparedConversationTurn): EILedger {
  const execution = stage(ledger, turn)
  const result = commitEIConversationTurn(ledger, turn, verifyEI(execution, { kind: 'rendered-address-values', values: [{ address: turn.user.address, value: turn.user.text }] }))
  assert.equal(result.status, 'committed')
  return (result as { ledger: EILedger }).ledger
}
function update(ledger: EILedger, address: string, value: string): EILedger {
  const source = { id: `correction:${ledger.revision}`, text: value, realm: 'explicit-correction' }
  const result = advanceEI(ledger, proposeEI(ledger, { id: source.id, producer: 'chat', input: source, candidates: [{ id: 'correct', label: 'correct', owner: 'engine', source, conditions: [], patches: [{ address, value, source }] }] }))
  assert.equal(result.status, 'committed')
  return result.ledger
}

test('raw source input creates one immutable addressed proposal and no response or intent', async () => {
  const ledger = initial(), before = exportEILedger(ledger), raw = '  𝟘\u0000e\u0301\nwhat changed?  ', turn = await prepare(ledger, raw)
  assert.equal(turn.mode, 'capture-only'); assert.equal(turn.reply, null); assert.equal(turn.user.status, 'capture-only')
  assert.equal(turn.user.text, raw); assert.equal(turn.user.source.text, raw); assert.equal(turn.user.source.realm, 'ei-conversation-user')
  assert.equal(JSON.parse(turn.user.source.locator!).status, 'capture-only')
  assert.equal(turn.user.evidence, undefined); assert.equal(turn.user.derivation, undefined); assert.equal(turn.user.selfCheck, undefined)
  assert.equal(turn.proposal.input.input.text, raw)
  assert.deepEqual(turn.proposal.input.candidates[0].patches.map(p => [p.kind, p.address, p.value]), [['create', 'chat/turn/1/user', raw]])
  assert.equal(turn.proposal.input.candidates[0].owner, 'engine')
  assert.equal(exportEILedger(ledger), before); assert.equal(readEIConversation(ledger, 'chat').turns.length, 0)
  assert.ok(Object.isFrozen(turn)); assert.ok(Object.isFrozen(turn.context)); assert.ok(Object.isFrozen(turn.user.source))
  assert.throws(() => { (turn.user as { text: string }).text = 'changed' }, TypeError)
})

test('exact returned input text is required and its actual receipt returns to the producing root', async () => {
  const ledger = initial(), turn = await prepare(ledger), execution = stage(ledger, turn)
  for (const values of [[], [{ address: turn.user.address, value: 'altered' }], [{ address: turn.user.address, value: turn.user.text }, { address: 'invented-assistant', value: '' }]]) {
    const check = verifyEI(execution, { kind: 'rendered-address-values', values })
    assert.equal(check.committable, false)
    const failed = commitEIConversationTurn(ledger, turn, check)
    assert.equal(failed.status, 'rejected'); assert.equal((failed as { ledger: EILedger }).ledger, ledger)
  }
  const next = commit(ledger, turn), receipt = next.receipts[0], record = next.records.find(r => r.address === turn.user.address)!
  assert.equal(receipt.status, 'committed'); assert.equal(receipt.scope, 'rendered-address-values'); assert.equal(receipt.patches.length, 1)
  assert.deepEqual(receipt.patches[0].source, turn.user.source); assert.equal(receipt.source.text, turn.user.text)
  assert.ok(next.records.find(r => r.address === 'chat')!.receiptIds.includes(receipt.id))
  assert.deepEqual(record.parents, ['chat']); assert.deepEqual(record.relations, [{ relation: 'conversation-context', address: 'chat' }])
  assert.equal(next.records.some(r => r.is.source.realm === 'ei-conversation-reply'), false)
})

test('successive captures retain full context, exact source links and increasing turn IDs', async () => {
  let ledger = initial()
  for (let n = 1; n <= 4; n++) {
    const turn = await prepare(ledger, `source ${n}`)
    assert.equal(turn.user.turn, n); assert.equal(turn.user.address, `chat/turn/${n}/user`)
    assert.equal(turn.context.ledger, ledger)
    assert.deepEqual(turn.context.conversation, readEIConversation(ledger, 'chat'))
    assert.deepEqual(turn.context.ledger.records.find(r => r.address === 'left')!.relations, initial().records[1].relations)
    assert.equal(turn.context.ledger.receipts.length, n - 1)
    assert.deepEqual(turn.user.sourceRefs, n === 1 ? ['chat'] : ['chat', `chat/turn/${n - 1}/user`])
    ledger = commit(ledger, turn)
  }
  const history = readEIConversation(ledger, 'chat')
  assert.deepEqual(history.turns.map(m => [m.turn, m.role, m.text]), [1, 2, 3, 4].map(n => [n, 'user', `source ${n}`]))
  assert.deepEqual(readEIConversation(importEILedger(exportEILedger(ledger)), 'chat'), history)
})

test('all former reply routes are raw input only, without fallback text, query execution or a provider call', async () => {
  const rawInputs = ['hello', '?', 'Ω Iᵁ ρ', 'what did I say before?', 'what have I said?', 'what changed?', '/look left', '/compare left right', '/trace left', '/unknown', 'read "left"', 'compare "left" with "right"', 'from "left" follow "R"', 'context "left"', 'bind "state" to read "left"', 'state', 'what is NOTHING?']
  let ledger = initial(), calls = 0
  for (const input of rawInputs) {
    const options = { ledger, root: 'chat', input, id: `capture:${ledger.revision}`, get adapter() { calls++; throw new Error('must never read optional provider') } }
    const result = await prepareEIConversationTurn(options)
    assert.equal(result.status, 'proposed')
    if (result.status !== 'proposed') assert.fail()
    assert.equal(result.reply, null, input); assert.equal(result.user.text, input)
    assert.equal(result.proposal.input.candidates[0].patches.length, 1, input)
    ledger = commit(ledger, result)
  }
  assert.equal(calls, 0); assert.deepEqual((await readEIPhraseBindings(ledger, 'chat')).bindings, [])
  assert.equal(ledger.records.find(r => r.address === 'left')!.is.value, '0')
  assert.equal(readEIConversation(ledger, 'chat').turns.filter(m => m.role === 'assistant').length, 0)
})

test('capture does not depend on the crypto-based old reply selfcheck', async t => {
  t.mock.method(globalThis.crypto.subtle, 'digest', async () => { throw new Error('crypto unavailable') })
  const ledger = initial(), turn = await prepare(ledger, 'read "left"')
  assert.equal(turn.reply, null)
  assert.equal(readEIConversation(commit(ledger, turn), 'chat').turns[0].text, 'read "left"')
})

test('original captured input survives an explicit correction and remains in the next full context', async () => {
  const first = initial(), turn = await prepare(first, 'first claim'), captured = commit(first, turn), corrected = update(captured, turn.user.address, 'source correction')
  const message = readEIConversation(corrected, 'chat').turns[0]
  assert.equal(message.text, 'first claim'); assert.equal(message.source.text, 'first claim'); assert.equal(message.currentText, 'source correction')
  assert.deepEqual(message.corrections.map(v => v.value), ['source correction'])
  const next = await prepare(corrected, 'second claim')
  assert.equal(next.context.conversation.turns[0].text, 'first claim')
  assert.equal(next.context.ledger.records.find(r => r.address === turn.user.address)!.is.value, 'source correction')
})

test('abort before preparation, after preparation and after staging prevents capture', async () => {
  const ledger = initial(), first = new AbortController(); first.abort()
  assert.equal((await prepareEIConversationTurn({ ledger, root: 'chat', input: 'raw', id: 'before', signal: first.signal })).status, 'cancelled')
  const second = new AbortController(), pending = await prepare(ledger, 'raw', 'prepared', { signal: second.signal }); second.abort()
  assert.equal(isEIConversationTurnCurrent(pending, ledger), false); assert.equal(executeEIConversationTurn(ledger, pending).status, 'cancelled')
  const third = new AbortController(), turn = await prepare(ledger, 'raw', 'staged', { signal: third.signal }), execution = stage(ledger, turn); third.abort()
  assert.equal(commitEIConversationTurn(ledger, turn, verifyLocalEI(execution)).status, 'cancelled')
  assert.equal(ledger.receipts.length, 0)
})

test('later abort preserves an admitted capture and exact replay is idempotent', async () => {
  const ledger = initial(), controller = new AbortController(), turn = await prepare(ledger, 'one', 'same-id', { signal: controller.signal }), execution = stage(ledger, turn)
  const check = verifyLocalEI(execution), admitted = commitEIConversationTurn(ledger, turn, check)
  assert.equal(admitted.status, 'committed')
  if (!('ledger' in admitted)) assert.fail()
  controller.abort()
  assert.equal(isEIConversationTurnCurrent(turn, admitted.ledger), true)
  assert.equal(executeEIConversationTurn(admitted.ledger, turn).status, 'replayed')
  assert.equal(commitEIConversationTurn(admitted.ledger, turn, check).status, 'replayed')
  assert.equal(admitted.ledger.receipts.length, 1); assert.equal(readEIConversation(admitted.ledger, 'chat').turns.length, 1)
})

test('stale captures and verifications cannot overwrite a changed source or another input', async () => {
  const ledger = initial(), turn = await prepare(ledger), execution = stage(ledger, turn), changed = update(ledger, 'left', 'corrected')
  assert.equal(isEIConversationTurnCurrent(turn, changed), false)
  assert.equal(executeEIConversationTurn(changed, turn).status, 'stale')
  assert.equal(commitEIConversationTurn(changed, turn, verifyLocalEI(execution)).status, 'stale')
  assert.equal((await prepareEIConversationTurn({ ledger, root: 'chat', input: 'raw', id: 'live-check', currentLedger: () => changed })).status, 'stale')
  const competing = await prepare(ledger, 'competing input', 'competing'), next = commit(ledger, competing)
  assert.equal(executeEIConversationTurn(next, turn).status, 'stale')
})

test('guards reject forged preparation and a readback token from a different capture', async () => {
  const ledger = initial(), one = await prepare(ledger, 'one', 'one'), two = await prepare(ledger, 'two', 'two')
  assert.throws(() => executeEIConversationTurn(ledger, { ...one }), /not produced/)
  assert.throws(() => commitEIConversationTurn(ledger, one, verifyLocalEI(stage(ledger, two))), /another conversation turn/)
  const sameRevision = createEILedger({ records: [{ address: 'chat', value: 'different snapshot', source: { id: 'different', text: 'different snapshot' } }] })
  assert.equal(executeEIConversationTurn(sameRevision, one).status, 'stale')
})

test('input and address bounds reject without creating any reply or mutating context', async () => {
  const ledger = initial(), before = exportEILedger(ledger)
  for (const input of ['', ' ', 'x'.repeat(EI_CONVERSATION_LIMITS.inputLength + 1), '\u0001'.repeat(EI_CONVERSATION_LIMITS.inputLength)]) await assert.rejects(() => prepareEIConversationTurn({ ledger, root: 'chat', input, id: 'invalid' }))
  await assert.rejects(() => prepareEIConversationTurn({ ledger, root: 'missing', input: 'raw', id: 'invalid' }), /unknown conversation root/)
  const occupied = createEILedger({ records: [...initial().records.map(r => ({ address: r.address, value: r.is.value, source: r.is.source, parents: r.parents, relations: r.relations })), { address: 'chat/turn/1/user', value: 'occupied', source: { id: 'occupied', text: 'occupied' } }] })
  await assert.rejects(() => prepare(occupied), /already belongs/)
  assert.equal(exportEILedger(ledger), before)
  const raw = '𝟙'.repeat(EI_CONVERSATION_LIMITS.inputLength / 2), turn = await prepare(ledger, raw)
  assert.equal(readEIConversation(commit(ledger, turn), 'chat').turns[0].text, raw)
})

test('save/restore retains consecutive input-only turns, exact sources, receipts and open relation endpoints', async () => {
  let ledger = initial()
  for (const input of ['first', 'what changed?', 'read "left"']) ledger = commit(ledger, await prepare(ledger, input))
  const restored = restoreEISession(saveEISession('chat', ledger, null, []))
  assert.equal(exportEILedger(restored.ledger), exportEILedger(ledger))
  assert.deepEqual(readEIConversation(restored.ledger, 'chat'), readEIConversation(ledger, 'chat'))
  assert.equal(readEIConversation(restored.ledger, 'chat').turns.length, 3)
  assert.deepEqual(restored.ledger.records.find(r => r.address === 'left')!.relations, ledger.records[1].relations)
})
