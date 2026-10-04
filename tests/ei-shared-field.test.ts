import assert from 'node:assert/strict'
import test from 'node:test'
import {
  chooseEI, commitEI, createEILedger, executeEI, exportEILedger, importEILedger,
  proposeEI, verifyEI, verifyLocalEI,
  type EIExecution, type EILedger, type EIVerification,
} from '../src/model/ei-engine.ts'
import {
  EI_SHARED_FIELD_BOUNDARY, EI_SHARED_FIELD_LIMITS, createEISharedField,
  exportEISharedEvent, verifyEISharedEvent,
  type EISharedEndpoint, type EISharedEvent, type EISharedField,
} from '../src/model/ei-shared-field.ts'

const source = (text: string) => ({ id: `captured:${text}`, text })
function seed(value = 'initial'): EILedger {
  return createEILedger({ records: [
    { address: 'user/root', value: 'user captured field', source: source('field') },
    { address: 'user/value', value, source: source(value), parents: ['user/root'] },
  ] })
}
function execution(ledger: EILedger, id: string, value: string, producer = 'user/root'): EIExecution {
  const proposal = proposeEI(ledger, {
    id, producer, input: source(`input:${id}`), candidates: [{
      id: 'selected', label: 'Explicit captured update', owner: 'user', source: source(`candidate:${id}`),
      conditions: [{ address: 'user/value', equals: ledger.records.find(record => record.address === 'user/value')!.is.value }],
      patches: [{ address: 'user/value', value, source: source(value) }],
    }],
  })
  const staged = executeEI(ledger, proposal, chooseEI(proposal, 'selected'))
  assert.equal(staged.status, 'staged')
  return staged as EIExecution
}
async function setup(fieldId = 'user-field', initial = seed()) {
  const field = await createEISharedField({ identity: { fieldId, userRoot: 'user/root' }, ledger: initial })
  const writer = field.connect({ id: 'source-view', sourceAddress: 'user/root' })
  const reader = field.connect({ id: 'target-view', sourceAddress: 'user/root' })
  return { field, writer, reader, initial }
}
async function commit(field: EISharedField, writer: EISharedEndpoint, id = 'tx:1', value = 'next'): Promise<EISharedEvent> {
  const result = await field.commit(writer, verifyLocalEI(execution(field.read(writer), id, value)))
  assert.equal(result.result.status, 'committed'); assert.ok(result.event)
  return result.event
}
function endpoint(field: EISharedField, handle: EISharedEndpoint) { return field.inspect().endpoints.find(item => item.id === handle.id)! }
async function redigest(event: EISharedEvent): Promise<string> {
  const { format, index, identity, source, target, predecessor, payload } = event
  const bytes = new TextEncoder().encode(JSON.stringify({ format, index, identity, source, target, predecessor, payload }))
  const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('')
  return JSON.stringify({ ...event, eventId: `ei-shared:${sha256}`, sha256 })
}

test('one ledger identity is shared by all endpoint reads; events bind actual committed receipts and immutable scope', async () => {
  const { field, writer, reader, initial } = await setup()
  assert.equal(field.read(writer), initial); assert.equal(field.read(reader), initial)
  const event = await commit(field, writer)
  const snapshot = field.inspect()
  assert.equal(field.read(reader), field.read(writer)); assert.equal(snapshot.ledger.revision, 1)
  assert.equal(event.source.revision, 1); assert.equal(event.source.sequence, 1)
  assert.equal(event.predecessor.revision, 0); assert.equal(event.source.address, 'user/root')
  assert.deepEqual(event.target, { fieldId: 'user-field', userRoot: 'user/root', addresses: ['user/value'] })
  assert.equal(event.payload.receiptId, snapshot.ledger.receipts[0].id)
  assert.equal(Object.hasOwn(event.payload, 'ledgerJSON'), false)
  assert.equal(event.payload.ledgerSha256, snapshot.ledgerSha256)
  assert.ok(Object.isFrozen(snapshot)); assert.ok(Object.isFrozen(event.target.addresses))
  assert.throws(() => { (event.source as { revision: number }).revision = 900 }, TypeError)
  assert.equal(snapshot.transport, 'local-process-only')
  assert.match(EI_SHARED_FIELD_BOUNDARY, /not owner\/source authentication/)
  assert.deepEqual(await verifyEISharedEvent(exportEISharedEvent(event), snapshot.ledger), event)
})

test('publish adopts a completed rendered engine result without recommitting or bypassing the existing gate', async () => {
  const { field, writer, reader, initial } = await setup()
  const staged = execution(initial, 'rendered:1', 'rendered value')
  const verified = verifyEI(staged, { kind: 'rendered-address-values', values: staged.expected })
  const completed = commitEI(initial, verified)
  assert.equal(completed.status, 'committed')
  let notified = 0
  field.subscribe(reader, event => {
    notified++
    assert.equal(field.read(reader), completed.ledger)
    assert.equal(event.payload.receiptId, completed.receipt.id)
  })
  const publication = await field.publish(writer, initial, completed)
  assert.equal(publication.result.ledger, completed.ledger)
  assert.equal(publication.result.receipt, completed.receipt)
  assert.equal(field.read(reader).receipts.length, 1)
  assert.equal(field.read(reader).receipts[0].scope, 'rendered-address-values')
  assert.equal(notified, 1)
  const retry = await field.publish(writer, initial, completed)
  assert.equal(retry.result.status, 'replayed'); assert.equal(retry.event, publication.event)
  assert.equal(notified, 1); assert.equal(field.inspect().conflicts.length, 0)
})

test('failed engine verification emits no notification, receipt acknowledgment or shared mutation', async () => {
  const { field, writer, reader, initial } = await setup()
  let calls = 0; field.subscribe(reader, () => { calls++ })
  await assert.rejects(field.commit(writer, {} as EIVerification), /verification was not produced/)
  const result = await field.commit(writer, verifyEI(execution(initial, 'bad-render', 'expected'), { kind: 'rendered-address-values', values: [{ address: 'user/value', value: 'different' }] }))
  assert.equal(result.result.status, 'rejected'); assert.equal(result.event, null)
  assert.equal(field.read(writer), initial); assert.equal(calls, 0)
  assert.equal(endpoint(field, reader).received.length, 0)
})

test('replay and receipt cannot fabricate an applied acknowledgment before explicit ordered admission', async () => {
  const { field, writer, reader, initial } = await setup()
  const event = await commit(field, writer)
  assert.deepEqual(field.replay(reader), [event])
  assert.equal(endpoint(field, reader).received.length, 0)
  assert.deepEqual(field.admit(reader, event.eventId), { status: 'not-received', acknowledgment: null, ledger: null })
  const received = field.receive(reader, event)
  assert.equal(received.status, 'received'); assert.equal(received.acknowledgment?.kind, 'received')
  assert.equal(received.acknowledgment?.scope, 'local-journal-retention')
  assert.equal(field.view(reader), initial); assert.equal(endpoint(field, reader).applied.length, 0)
  const admitted = field.admit(reader, event.eventId)
  assert.equal(admitted.status, 'applied'); assert.equal(admitted.acknowledgment?.kind, 'applied')
  assert.equal(admitted.acknowledgment?.scope, 'local-consumer-admission')
  assert.equal(admitted.ledger, field.read(reader)); assert.equal(field.view(reader), admitted.ledger)
  assert.deepEqual(field.replay(reader), [])
})

test('out-of-order receipt is retained but waits for the missing predecessor admission', async () => {
  const { field, writer, reader } = await setup()
  const first = await commit(field, writer, 'first', 'one')
  const second = await commit(field, writer, 'second', 'two')
  assert.equal(second.source.sequence, 2)
  field.receive(reader, second)
  assert.equal(field.admit(reader, second.eventId).status, 'waiting')
  assert.equal(field.view(reader).revision, 0)
  field.receive(reader, first)
  assert.equal(field.admit(reader, first.eventId).ledger?.revision, 1)
  assert.equal(field.admit(reader, second.eventId).ledger?.revision, 2)
  assert.deepEqual(endpoint(field, reader).applied.map(ack => ack.sourceRevision), [1, 2])
})

test('exact local or verified wire duplicates reuse acknowledgment identity and never apply twice', async () => {
  const { field, writer, reader } = await setup()
  const event = await commit(field, writer), wire = await verifyEISharedEvent(exportEISharedEvent(event), field.read(writer))
  const received = field.receive(reader, event)
  assert.equal(field.receive(reader, wire).acknowledgment, received.acknowledgment)
  assert.equal(field.receive(reader, event).status, 'duplicate')
  const applied = field.admit(reader, event.eventId)
  assert.equal(field.admit(reader, event.eventId).acknowledgment, applied.acknowledgment)
  assert.equal(field.admit(reader, event.eventId).status, 'duplicate')
  assert.equal(endpoint(field, reader).received.length, 1); assert.equal(endpoint(field, reader).applied.length, 1)
  assert.equal(field.inspect().ledger.revision, 1)
})

test('wire validation rejects tampered bytes, digest replacement, source/target edits and ambiguous JSON', async () => {
  const { field, writer } = await setup(), event = await commit(field, writer), raw = exportEISharedEvent(event)
  const proof = field.read(writer), payloadChange = { ...event, payload: { ...event.payload, ledgerSha256: '0'.repeat(64) } }
  await assert.rejects(verifyEISharedEvent(JSON.stringify(payloadChange), proof), /event digest mismatch/)
  await assert.rejects(verifyEISharedEvent(await redigest(payloadChange), proof), /ledger proof digest mismatch/)
  await assert.rejects(verifyEISharedEvent(await redigest({ ...event, predecessor: { ...event.predecessor, ledgerSha256: '0'.repeat(64) } }), proof), /predecessor digest/)
  await assert.rejects(verifyEISharedEvent(await redigest({ ...event, source: { ...event.source, address: 'user/value' } }), proof), /actual committed ledger\/receipt/)
  await assert.rejects(verifyEISharedEvent(await redigest({ ...event, target: { ...event.target, addresses: ['user/root'] } }), proof), /target addresses/)
  await assert.rejects(verifyEISharedEvent(await redigest({ ...event, payload: { ...event.payload, receiptSha256: '0'.repeat(64) } }), proof), /receipt digest/)
  await assert.rejects(verifyEISharedEvent(raw.replace('"index":1', '"index":1,"index":1'), proof), /canonical encoding/)
  await assert.rejects(verifyEISharedEvent(JSON.stringify({ ...event, extra: true }), proof), /unexpected or missing/)
  await assert.rejects(verifyEISharedEvent('x'.repeat(EI_SHARED_FIELD_LIMITS.eventBytes + 1), proof), /byte bounds/)
  await assert.rejects(verifyEISharedEvent(raw, seed()), /ledger proof digest/)
})

test('unknown structurally valid history stays inert even when field and endpoint names match', async () => {
  const local = await setup(), remote = await setup()
  const foreign = await commit(remote.field, remote.writer, 'remote:1', 'remote data')
  const verified = await verifyEISharedEvent(exportEISharedEvent(foreign), remote.field.read(remote.writer))
  assert.throws(() => local.field.receive(local.reader, JSON.parse(exportEISharedEvent(foreign))), /must be locally issued or pass/)
  const result = local.field.receive(local.reader, verified)
  assert.equal(result.status, 'conflict'); assert.equal(result.conflict?.code, 'unverified-source')
  assert.equal(result.acknowledgment, null)
  assert.equal(local.field.read(local.reader), local.initial)
  assert.equal(local.field.admit(local.reader, foreign.eventId).status, 'not-received')
  assert.equal(endpoint(local.field, local.reader).received.length, 0)
  local.field.receive(local.reader, verified)
  assert.equal(local.field.inspect().conflicts.length, 1)
  assert.equal(local.field.inspect().conflicts[0].event, verified)
})

test('same-revision ledger conflicts and other field identities are retained without merging', async () => {
  const local = await setup(), branch = await setup(), other = await setup('other-user-field')
  const own = await commit(local.field, local.writer, 'own', 'kept')
  const competing = await commit(branch.field, branch.writer, 'fork', 'fork value')
  const foreign = await commit(other.field, other.writer, 'other', 'other value')
  assert.equal(local.field.receive(local.reader, competing).conflict?.code, 'revision-conflict')
  assert.equal(local.field.receive(local.reader, foreign).conflict?.code, 'foreign-field')
  assert.equal(local.field.inspect().conflicts.length, 2)
  assert.equal(local.field.read(local.reader).records[1].is.value, 'kept')
  assert.deepEqual(local.field.inspect().events, [own])
  local.field.receive(local.reader, own)
  assert.equal(local.field.admit(local.reader, own.eventId).status, 'applied')
  assert.equal(local.field.inspect().conflicts.length, 2)
})

test('endpoint names are not authority and source scope cannot publish another producer', async () => {
  const local = await setup(), other = await setup()
  assert.throws(() => local.field.read({ ...local.reader }), /names do not grant authority/)
  assert.throws(() => local.field.reconnect(other.reader), /names do not grant authority/)
  assert.throws(() => local.field.connect({ ...local.reader }), /already retained/)
  const scoped = local.field.connect({ id: 'value-producer', sourceAddress: 'user/value' })
  await assert.rejects(local.field.commit(scoped, verifyLocalEI(execution(local.initial, 'wrong-scope', 'not published'))), /endpoint source scope/)
  assert.equal(local.field.read(local.reader), local.initial)
})

test('subscribers get committed immutable events immediately; receive and application remain distinct', async () => {
  const { field, writer, reader } = await setup()
  const seen: number[] = []
  const unsubscribe = field.subscribe(reader, (event, received) => {
    seen.push(event.source.revision)
    assert.equal(received.kind, 'received')
    assert.equal(field.read(reader).revision, event.source.revision)
    assert.equal(endpoint(field, reader).applied.length, 0)
    assert.ok(Object.isFrozen(event.payload))
  })
  await commit(field, writer)
  assert.deepEqual(seen, [1]); assert.equal(field.view(reader).revision, 0)
  unsubscribe(); unsubscribe()
  await commit(field, writer, 'after-unsubscribe', 'two')
  assert.deepEqual(seen, [1]); assert.equal(endpoint(field, reader).received.length, 1)
  assert.equal(field.replay(reader).length, 2)
})

test('disconnect stops local delivery; reconnect replays every unadmitted event in order', async () => {
  const { field, writer, reader } = await setup()
  const seen: number[] = []
  field.subscribe(reader, event => { seen.push(event.source.revision); field.admit(reader, event.eventId) })
  await commit(field, writer, 'one', 'one')
  field.disconnect(reader)
  await commit(field, writer, 'two', 'two'); await commit(field, writer, 'three', 'three')
  assert.deepEqual(seen, [1]); assert.equal(endpoint(field, reader).received.length, 1)
  assert.throws(() => field.replay(reader), /disconnected/)
  assert.throws(() => field.receive(reader, field.inspect().events[1]), /disconnected/)
  assert.deepEqual(field.reconnect(reader).map(event => event.source.revision), [2, 3])
  assert.deepEqual(seen, [1, 2, 3]); assert.equal(field.view(reader), field.read(reader))
  assert.deepEqual(field.reconnect(reader), [])
  assert.deepEqual(seen, [1, 2, 3])
})

test('received but unadmitted events replay after reconnect with the original received receipt', async () => {
  const { field, writer, reader } = await setup()
  const received: unknown[] = []
  field.subscribe(reader, (_event, receipt) => { received.push(receipt) })
  await commit(field, writer)
  field.disconnect(reader); field.reconnect(reader)
  assert.equal(received.length, 2); assert.equal(received[0], received[1])
  assert.equal(endpoint(field, reader).applied.length, 0)
})

test('listener exceptions and async rejection cannot undo commits or stop other subscribers', async () => {
  const { field, writer, reader } = await setup()
  const independent = field.connect({ id: 'independent-view', sourceAddress: 'user/root' })
  field.subscribe(reader, () => { throw new Error('view failed') })
  field.subscribe(reader, async () => { throw new Error('async view failed') })
  let success = 0
  field.subscribe(independent, event => { success++; field.admit(independent, event.eventId) })
  await commit(field, writer)
  await Promise.resolve()
  assert.equal(field.read(writer).revision, 1); assert.equal(success, 1)
  assert.equal(endpoint(field, reader).deliveryFailures, 2)
  assert.equal(endpoint(field, reader).applied.length, 0)
  assert.equal(endpoint(field, independent).applied.length, 1)
})

test('concurrent publications use compare-and-swap; only one branch becomes canonical and notified', async () => {
  const { field, writer, reader, initial } = await setup()
  const first = verifyLocalEI(execution(initial, 'race-a', 'a')), second = verifyLocalEI(execution(initial, 'race-b', 'b'))
  let calls = 0; field.subscribe(reader, () => { calls++ })
  const results = await Promise.allSettled([field.commit(writer, first), field.commit(writer, second)])
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1)
  assert.equal(results.filter(result => result.status === 'rejected').length, 1)
  assert.equal(field.inspect().events.length, 1); assert.equal(field.inspect().ledger.revision, 1)
  assert.equal(calls, 1); assert.equal(field.inspect().conflicts[0].code, 'stale-commit')
  assert.ok(field.inspect().conflicts[0].ledger)
  assert.notEqual(field.inspect().conflicts[0].ledger, field.read(writer))
})

test('concurrent exact publication retries reuse one event, including retries after a later revision', async () => {
  const { field, writer, reader, initial } = await setup()
  const result = commitEI(initial, verifyLocalEI(execution(initial, 'retry', 'one')))
  let calls = 0; field.subscribe(reader, () => { calls++ })
  const publications = await Promise.all([field.publish(writer, initial, result), field.publish(writer, initial, result)])
  assert.equal(publications[0].event, publications[1].event)
  assert.equal(calls, 1); assert.equal(field.inspect().events.length, 1)
  await commit(field, writer, 'after-retry', 'two')
  const late = await field.publish(writer, initial, result)
  assert.equal(late.result.status, 'replayed'); assert.equal(late.result.ledger, field.read(writer))
  assert.equal(late.result.ledger.revision, 2); assert.equal(late.event, publications[0].event)
  assert.equal(calls, 2); assert.equal(field.inspect().conflicts.length, 0)
})

test('disconnect during digest preparation cancels publication with no delivery or mutation', async () => {
  const { field, writer, reader, initial } = await setup()
  let calls = 0; field.subscribe(reader, () => { calls++ })
  const publishing = field.commit(writer, verifyLocalEI(execution(initial, 'disconnect', 'unpublished')))
  field.disconnect(writer)
  await assert.rejects(publishing, /disconnected/)
  assert.equal(field.inspect().ledger, initial); assert.equal(field.inspect().events.length, 0); assert.equal(calls, 0)
})

test('publication validates ancestry and actual receipt references, and captures mutable result wrappers', async () => {
  const { field, writer, initial } = await setup()
  const other = seed('different ancestor'), otherResult = commitEI(other, verifyLocalEI(execution(other, 'forked-base', 'next')))
  await assert.rejects(field.publish(writer, initial, otherResult), /exact ledger ancestry/)
  const result = commitEI(initial, verifyLocalEI(execution(initial, 'real-result', 'next')))
  await assert.rejects(field.publish(writer, initial, { ...result, receipt: { ...result.receipt } }), /actual committed receipt/)
  await assert.rejects(field.publish(writer, importEILedger(exportEILedger(initial)), result), /stale or belongs/)
  const mutable = { ...result }, publishing = field.publish(writer, initial, mutable)
  mutable.ledger = otherResult.ledger
  await publishing
  assert.equal(field.read(writer), result.ledger)
})

test('local endpoint/listener limits reject additions without dropping prior retained state', async () => {
  const { field, writer, reader } = await setup()
  for (let i = 2; i < EI_SHARED_FIELD_LIMITS.endpoints; i++) field.connect({ id: `view:${i}`, sourceAddress: 'user/root' })
  assert.throws(() => field.connect({ id: 'too-many', sourceAddress: 'user/root' }), /endpoint limit/)
  const removes: (() => void)[] = []
  for (let i = 0; i < EI_SHARED_FIELD_LIMITS.listeners; i++) removes.push(field.subscribe(reader, () => undefined))
  assert.throws(() => field.subscribe(reader, () => undefined), /listener limit/)
  removes[0]()
  field.subscribe(reader, () => undefined)
  await commit(field, writer)
  assert.equal(field.inspect().endpoints.length, EI_SHARED_FIELD_LIMITS.endpoints)
  assert.equal(endpoint(field, reader).received.length, 1)
})

test('independent overlay services receive addressed causal threads and return receipts without sharing admission cursors', async () => {
  const { field, writer } = await setup()
  const overlayA = field.connect({ id: 'overlay-A-instance', serviceId: 'media-overlay', sourceAddress: 'user/value', destinationAddress: 'user/value' })
  const overlayB = field.connect({ id: 'overlay-B-instance', serviceId: 'address-overlay', sourceAddress: 'user/root', destinationAddress: 'user/root' })
  let eventId = ''
  field.subscribe(overlayA, (event, received) => {
    eventId = event.eventId
    assert.equal(received.thread.source.address, 'user/root')
    assert.equal(received.thread.destination.serviceId, 'media-overlay')
    assert.equal(received.thread.destination.address, 'user/value')
    assert.equal(received.thread.destination.revision, 0)
    assert.deepEqual(received.thread.returnTo, { serviceId: writer.serviceId, endpointId: writer.id, address: writer.sourceAddress })
    assert.equal(received.thread.cause.receiptId, event.payload.receiptId)
    const applied = field.admit(overlayA, event.eventId).acknowledgment!
    assert.equal(applied.thread.threadId, received.thread.threadId)
    assert.equal(applied.thread.destination.revision, 1)
  })
  field.subscribe(overlayB, (_event, received) => {
    assert.equal(received.thread.destination.serviceId, 'address-overlay')
    assert.equal(received.thread.destination.address, 'user/root')
  })
  await commit(field, writer)
  assert.equal(field.view(overlayA).revision, 1); assert.equal(field.view(overlayB).revision, 0)
  assert.equal(endpoint(field, overlayA).applied.length, 1); assert.equal(endpoint(field, overlayB).applied.length, 0)
  assert.equal(endpoint(field, overlayA).deliveryFailures, 0)
  assert.equal(endpoint(field, overlayB).received[0].eventId, eventId)
  assert.throws(() => field.connect({ id: 'unaddressed-service', serviceId: 'unknown', sourceAddress: 'user/root', destinationAddress: 'missing/address' }), /destination address/)
})

test('a restarted coordinator cannot restore old capabilities or claim delivery from recovered ledger history', async () => {
  const first = await setup(), event = await commit(first.field, first.writer)
  first.field.receive(first.reader, event); first.field.admit(first.reader, event.eventId)
  const recovered = importEILedger(exportEILedger(first.field.read(first.writer))), restarted = await setup('user-field', recovered)
  assert.equal(restarted.field.read(restarted.reader).revision, 1)
  assert.deepEqual(restarted.field.inspect().events, [])
  assert.deepEqual(endpoint(restarted.field, restarted.reader).received, [])
  assert.deepEqual(endpoint(restarted.field, restarted.reader).applied, [])
  assert.throws(() => restarted.field.read(first.reader), /names do not grant authority/)
  assert.equal(restarted.field.receive(restarted.reader, event).conflict?.code, 'unverified-source')
  assert.equal(restarted.field.admit(restarted.reader, event.eventId).status, 'not-received')
  const next = await commit(restarted.field, restarted.writer, 'post-restart', 'second')
  assert.equal(next.index, 1); assert.equal(next.source.revision, 2); assert.equal(next.source.sequence, 1)
  assert.equal(next.predecessor.ledgerSha256, event.payload.ledgerSha256)
})

test('large shared roots do not multiply full-ledger wire payloads across notifications or replay', async () => {
  const records = seed().records.map(record => ({ address: record.address, value: record.is.value, source: record.is.source, parents: record.parents }))
  for (let i = 0; i < 135; i++) records.push({ address: `captured/${i}`, value: 'retained text '.repeat(400), source: source(`node:${i}`), parents: ['user/root'] })
  const { field, writer, reader } = await setup('large-user-field', createEILedger({ records }))
  const events: EISharedEvent[] = []
  for (let i = 0; i < 20; i++) events.push(await commit(field, writer, `large:${i}`, `value:${i}`))
  const ledgerBytes = new TextEncoder().encode(exportEILedger(field.read(writer))).length
  const eventBytes = events.reduce((total, event) => total + new TextEncoder().encode(exportEISharedEvent(event)).length, 0)
  assert.equal(field.read(writer).records.length, 137)
  assert.ok(ledgerBytes > 700_000)
  assert.ok(eventBytes < 40_000, `${eventBytes} notification bytes must remain independent of large root content`)
  assert.ok(eventBytes < ledgerBytes / 10)
  const seen: number[] = []
  field.subscribe(reader, event => { seen.push(event.source.revision); field.admit(reader, event.eventId) })
  assert.deepEqual(seen, Array.from({ length: 20 }, (_, i) => i + 1))
  assert.equal(field.view(reader), field.read(reader))
})

test('an explicit no-value-change commit round-trips its real receipt without invented target addresses', async () => {
  const { field, writer, initial } = await setup()
  const event = await commit(field, writer, 'same-value', 'initial')
  assert.equal(field.read(writer).records[1].is.value, initial.records[1].is.value)
  assert.equal(field.read(writer).revision, 1)
  assert.deepEqual(event.target.addresses, field.read(writer).receipts[0].patches.map(patch => patch.address))
  assert.deepEqual(await verifyEISharedEvent(exportEISharedEvent(event), field.read(writer)), event)
  // This engine explicitly requires patches. Idle observation alone must not
  // be invented as a committed transaction or falsely acknowledged as one.
  assert.throws(() => proposeEI(field.read(writer), {
    id: 'no-patches', producer: 'user/root', input: source('idle'),
    candidates: [{ id: 'idle', label: 'Idle', owner: 'user', source: source('idle'), conditions: [], patches: [] }],
  }), /at least one explicit patch/)
  const emptyTargets = { ...event, target: { ...event.target, addresses: [] } }
  await assert.rejects(verifyEISharedEvent(await redigest(emptyTargets), field.read(writer)), /target requires bounded addressed patches/)
})

test('exact engine target addresses retain JSON-escaped text through event proof validation', async () => {
  const unusual = 'captured/line\nbreak'
  const initial = createEILedger({ records: [
    { address: 'user/root', value: 'root', source: source('root') },
    { address: unusual, value: 'one', source: source('one'), parents: ['user/root'] },
  ] })
  const { field, writer } = await setup('exact-address', initial)
  const proposal = proposeEI(initial, { id: 'escaped', producer: 'user/root', input: source('escaped'), candidates: [{ id: 'apply', label: 'Apply', owner: 'user', source: source('escaped'), conditions: [], patches: [{ address: unusual, value: 'two', source: source('two') }] }] })
  const staged = executeEI(initial, proposal, chooseEI(proposal, 'apply')) as EIExecution
  const result = await field.commit(writer, verifyLocalEI(staged))
  assert.deepEqual(result.event!.target.addresses, [unusual])
  assert.deepEqual(await verifyEISharedEvent(exportEISharedEvent(result.event!), field.read(writer)), result.event)
})
