import test from 'node:test'
import assert from 'node:assert/strict'
import inventory from '../docs/FRACTURE-FIELD-INVENTORY.json' with { type: 'json' }
import { createEIPublicFieldRecords, eiPublicFieldAddress, EI_PUBLIC_FIELD_SOURCE } from '../src/model/ei-public-field.ts'
import { createEILedger, exportEILedger, importEILedger, executeEI, verifyEI, commitEI, EI_LIMITS } from '../src/model/ei-engine.ts'
import { EI_SESSION_LIMITS, saveEISession, restoreEISession } from '../src/model/ei-session.ts'
import { prepareEIConversationTurn, readEIConversation } from '../src/model/ei-conversation.ts'
import { evaluateEIQuery, verifyEIQueryAnswer } from '../src/model/ei-relation-reasoner.ts'

const original = JSON.stringify(inventory)
const records = createEIPublicFieldRecords()
const byAddress = new Map(records.map(record => [record.address, record]))
const payload = (id: string) => JSON.parse(byAddress.get(eiPublicFieldAddress(id))!.source.text)

test('every public inventory node maps once into the explicit presentation namespace', () => {
  assert.equal(inventory.entries.length, 127)
  assert.equal(records.length, 137)
  assert.equal(byAddress.size, 137)
  assert.deepEqual(records.map(record => record.address), inventory.binary_relation_order.nodes.map(node => `model/${node.id}`))
  assert.equal(EI_PUBLIC_FIELD_SOURCE.sourceRevision, inventory.source_revision)
  assert.equal(EI_PUBLIC_FIELD_SOURCE.path, 'docs/FRACTURE-FIELD-INVENTORY.json')
  for (const [index, node] of inventory.binary_relation_order.nodes.entries()) {
    const record = records[index], source = payload(node.id), locator = JSON.parse(record.source.locator!)
    assert.deepEqual(source.node, node)
    assert.equal(source.source_revision, inventory.source_revision)
    assert.equal(locator.pointer, `/binary_relation_order/nodes/${index}`)
    assert.equal(locator.source_revision, inventory.source_revision)
    assert.equal(locator.address_scope, 'selected-inventory-presentation')
    assert.match(record.value, /Selected inventory locator \(not canonical or geometric\)/)
  }
})

test('all 367 relation rows retain exact endpoints, labels, statuses and source evidence once', () => {
  const seen = new Map<string, unknown>()
  for (const record of records) {
    const source = JSON.parse(record.source.text)
    assert.equal(record.relations!.length, source.outgoing_relations.length)
    for (const [index, item] of source.outgoing_relations.entries()) {
      assert.equal(seen.has(item.pointer), false)
      seen.set(item.pointer, item.row)
      assert.equal(record.address, `model/${item.row.left}`)
      assert.deepEqual(record.relations![index], { relation: item.row.relation, address: `model/${item.row.right}` })
      assert.ok(byAddress.has(record.relations![index].address))
    }
  }
  assert.equal(seen.size, 367)
  inventory.binary_relation_order.relations.forEach((row, index) => assert.deepEqual(seen.get(`/binary_relation_order/relations/${index}`), row))
})

test('each exact entry, gap, status and WAS/IS/NEXT statement remains source text without promotion', () => {
  for (const [index, entry] of inventory.entries.entries()) {
    const record = byAddress.get(`model/${entry.id}`)!, source = payload(entry.id)
    assert.equal(source.entry_pointer, `/entries/${index}`)
    assert.deepEqual(source.entry, entry)
    assert.equal(source.entry.gap, entry.gap)
    assert.deepEqual(source.entry.state_frame, entry.state_frame)
    assert.ok(record.value.includes(`Claim status: ${entry.status}`))
    assert.ok(record.value.includes(entry.gap))
    assert.ok(record.value.includes(entry.state_frame.IS.established_statement))
    assert.ok(record.value.includes(entry.state_frame.NEXT.open_remainder))
    assert.deepEqual(record.parents, entry.parents.map(parent => `model/${parent}`))
  }
  const ledger = createEILedger({ records })
  assert.equal(ledger.revision, 0)
  assert.equal(ledger.receipts.length, 0)
  assert.ok(ledger.records.every(record => record.was.length === 0 && record.is.revision === 0))
})

test('selected grouping and global symbol/temporal statements retain their scoped source semantics', () => {
  const root = payload('inventory-root').inventory_statements
  assert.equal(root.scope, inventory.scope)
  assert.equal(root.semantic_rule, inventory.semantic_rule)
  assert.deepEqual(root.retained_binary_relations, inventory.retained_binary_relations)
  const { nodes: _nodes, relations: _relations, ...order } = inventory.binary_relation_order
  assert.deepEqual(root.binary_relation_order, order)
  for (const node of inventory.binary_relation_order.nodes.filter(node => node.kind !== 'field-entry')) {
    assert.deepEqual(byAddress.get(`model/${node.id}`)!.parents, [])
    assert.equal(payload(node.id).node.status, 'SELECTED')
  }
})

test('build is deterministic, deeply immutable at the adapter surface, and does not mutate the JSON source', () => {
  assert.deepEqual(createEIPublicFieldRecords(), records)
  assert.equal(JSON.stringify(inventory), original)
  assert.ok(Object.isFrozen(records))
  for (const record of records) {
    assert.ok(Object.isFrozen(record))
    assert.ok(Object.isFrozen(record.source))
    assert.ok(Object.isFrozen(record.parents))
    assert.ok(Object.isFrozen(record.relations))
    assert.ok(record.relations!.every(Object.isFrozen))
  }
})

test('public field plus a conversation root fits engine bounds and survives exact ledger replay', () => {
  const combined = [{ address: 'EI/SOURCE', value: 'My first input', source: { id: 'test:input', text: 'My first input' } }, ...records]
  const ledger = createEILedger({ records: combined }), json = exportEILedger(ledger)
  assert.equal(ledger.records.length, 138)
  assert.ok(ledger.records.length < EI_LIMITS.records)
  assert.ok(new TextEncoder().encode(json).length < EI_LIMITS.jsonBytes)
  assert.deepEqual(importEILedger(json), ledger)
  const session = saveEISession('EI/SOURCE', ledger, null, [])
  assert.ok(new TextEncoder().encode(session).length < EI_SESSION_LIMITS.storedBytes)
  assert.deepEqual(restoreEISession(session).ledger, ledger)
  assert.throws(() => createEILedger({ records: [{ address: 'model/nothing', value: 'collision', source: { id: 'test', text: 'collision' } }, ...records] }), /duplicate/)
})

test('twelve mixed conversation turns with the public field remain within the recoverable session bound', async () => {
  let ledger = createEILedger({ records: [{ address: 'EI/SOURCE', value: 'Hello', source: { id: 'test:input', text: 'Hello' } }, ...records] })
  for (let index = 1; index <= 12; index++) {
    const input = index === 3 ? 'what is NOTHING?' : index === 6 ? 'read "model/zero"' : index === 9 ? 'What did I say before?' : `Synthetic conversation message ${index}`
    const turn = await prepareEIConversationTurn({ ledger, root: 'EI/SOURCE', input, id: `local-proposal/${index}` })
    assert.equal(turn.status, 'proposed')
    if (turn.status !== 'proposed') throw new Error(turn.reason)
    assert.equal(turn.mode, 'capture-only')
    assert.equal(turn.reply, null)
    assert.equal(turn.user.text, input)
    const staged = executeEI(ledger, turn.proposal)
    assert.equal(staged.status, 'staged')
    if (staged.status !== 'staged') throw new Error(staged.receipt.reasons.join('; '))
    // Synthetic complete readback tests model/session capacity, not browser rendering.
    const result = commitEI(ledger, verifyEI(staged, { kind: 'rendered-address-values', values: staged.expected }))
    assert.equal(result.status, 'committed')
    const session = saveEISession('EI/SOURCE', result.ledger, null, [])
    assert.ok(new TextEncoder().encode(session).length < EI_SESSION_LIMITS.storedBytes)
    ledger = result.ledger
  }
  assert.equal(ledger.records.length, 150)
  assert.ok(readEIConversation(ledger, 'EI/SOURCE').turns.every(message => message.role === 'user' && message.status === 'capture-only'))
  assert.equal(restoreEISession(saveEISession('EI/SOURCE', ledger, null, [])).ledger.revision, 12)
})

test('public-label questions remain raw capture; explicit typed address reads retain sourced graph results', async () => {
  const ledger = createEILedger({ records: [{ address: 'EI/SOURCE', value: 'Hello', source: { id: 'test:input', text: 'Hello' } }, ...records] })
  const entry = inventory.entries.find(entry => entry.id === 'nothing')!
  for (const [index, label] of [entry.term, 'nonexistent-test-label', entry.term.toLowerCase()].entries()) {
    const input = `What is ${label}?`
    const captured = await prepareEIConversationTurn({ ledger, root: 'EI/SOURCE', input, id: `test:label-${index}` })
    assert.equal(captured.status, 'proposed')
    if (captured.status !== 'proposed') throw new Error(captured.reason)
    assert.equal(captured.mode, 'capture-only')
    assert.equal(captured.reply, null)
    assert.equal(captured.user.text, input)
    assert.equal(captured.user.source.text, input)
    assert.equal(captured.user.sourceRefs.some(address => address.startsWith('model/')), false)
  }
  const snapshot = exportEILedger(ledger)
  const knownQuery = { kind: 'read' as const, address: 'model/nothing' }
  const found = await evaluateEIQuery(ledger, knownQuery)
  assert.equal(found.status, 'resolved')
  assert.equal(found.matches[0].value, byAddress.get('model/nothing')!.value)
  assert.ok(found.sourceRefs.includes('model/nothing'))
  assert.equal((await verifyEIQueryAnswer(ledger, knownQuery, found)).status, 'passed')
  const missingQuery = { kind: 'read' as const, address: 'model/nonexistent-test-label' }
  const missing = await evaluateEIQuery(ledger, missingQuery)
  assert.equal(missing.status, 'unresolved')
  assert.equal((await verifyEIQueryAnswer(ledger, missingQuery, missing)).status, 'unresolved')
  assert.equal(exportEILedger(ledger), snapshot)
})

test('twelve captured model-like inputs preserve the public payload while direct typed queries remain read-only', async () => {
  let ledger = createEILedger({ records: [{ address: 'EI/SOURCE', value: 'Hello', source: { id: 'local-input/1', text: 'Hello', realm: 'user-supplied-local-input' } }, ...records] })
  for (let index = 1; index <= 12; index++) {
    const input = index === 1 ? 'bind "model definition" to read "model/zero"' : 'model definition'
    const turn = await prepareEIConversationTurn({ ledger, root: 'EI/SOURCE', input, id: `local-proposal/${index + 1}` })
    assert.equal(turn.status, 'proposed')
    if (turn.status !== 'proposed') throw new Error(turn.reason)
    assert.equal(turn.mode, 'capture-only')
    assert.equal(turn.reply, null)
    assert.equal(turn.user.text, input)
    const snapshot = exportEILedger(ledger)
    const query = { kind: 'read' as const, address: 'model/zero' }
    const answer = await evaluateEIQuery(ledger, query)
    assert.equal(answer.matches[0].value, byAddress.get('model/zero')!.value)
    assert.equal((await verifyEIQueryAnswer(ledger, query, answer)).status, 'passed')
    assert.equal(exportEILedger(ledger), snapshot)
    const staged = executeEI(ledger, turn.proposal)
    assert.equal(staged.status, 'staged')
    if (staged.status !== 'staged') throw new Error(staged.receipt.reasons.join('; '))
    const result = commitEI(ledger, verifyEI(staged, { kind: 'rendered-address-values', values: staged.expected }))
    assert.equal(result.status, 'committed')
    assert.ok(new TextEncoder().encode(saveEISession('EI/SOURCE', result.ledger, null, [])).length < EI_SESSION_LIMITS.storedBytes)
    ledger = result.ledger
  }
  const recovered = restoreEISession(saveEISession('EI/SOURCE', ledger, null, [])).ledger
  assert.equal(recovered.revision, 12)
  const messages = readEIConversation(recovered, 'EI/SOURCE').turns
  assert.equal(messages.length, 12)
  assert.ok(messages.every(message => message.role === 'user' && message.status === 'capture-only' && !message.evidence))
  assert.ok(recovered.receipts.every(receipt => receipt.patches.length === 1))
  for (const record of records) assert.equal(recovered.records.find(node => node.address === record.address)!.is.source.text, record.source.text)
})
