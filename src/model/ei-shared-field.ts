/**
 * One user-labelled ledger, with bounded in-process commit notifications.
 * Identity strings and SHA-256 bind scope/content; neither authenticates a user.
 * Only commitEI can change the authoritative ledger. Receiving a notification
 * never executes its input or merges another ledger. Admission advances a local
 * consumer's view of this journal, not a renderer, disk, or remote device.
 * There is deliberately no transport, credential, timer, storage, or implicit I/O.
 */
import {
  EI_LIMITS, commitEI, exportEILedger, importEILedger,
  type EILedger, type EIResult, type EIVerification,
} from './ei-engine.ts'

export const EI_SHARED_FIELD_FORMAT = 'ei-shared-field-event/v1' as const
export const EI_SHARED_FIELD_LIMITS = Object.freeze({ events: 128, endpoints: 32, listeners: 64, conflicts: 128, eventBytes: 131_072, retainedBytes: 16_777_216 })
export const EI_SHARED_FIELD_BOUNDARY = 'In-process user-labelled ledger only. Digests verify content, not owner/source authentication. Received and applied acknowledgments describe local journal retention and local consumer admission; no remote delivery, rendered frame, durable save, or conflict merge is implied.'

export type EISharedIdentity = Readonly<{ fieldId: string; userRoot: string }>
export type EISharedEndpointSpec = Readonly<{ id: string; sourceAddress: string; serviceId?: string; destinationAddress?: string }>
/** A service is a local logical overlay, not an OS process or authenticated user. */
export type EISharedEndpoint = Readonly<{ id: string; serviceId: string; sourceAddress: string; destinationAddress: string }>
export type EISharedEvent = Readonly<{
  format: typeof EI_SHARED_FIELD_FORMAT
  eventId: string
  index: number
  identity: EISharedIdentity
  source: Readonly<{ endpointId: string; serviceId: string; address: string; revision: number; sequence: number }>
  target: Readonly<{ fieldId: string; userRoot: string; addresses: readonly string[] }>
  predecessor: Readonly<{ revision: number; ledgerSha256: string }>
  /** References to existing immutable data, never another serialized ledger copy. */
  payload: Readonly<{ ledgerSha256: string; receiptId: string; receiptSha256: string }>
  sha256: string
}>
/** Addressed causal link. It denotes no OS thread, IPC channel or network route. */
export type EISharedThread = Readonly<{
  threadId: string
  source: Readonly<{ serviceId: string; endpointId: string; address: string; revision: number }>
  destination: Readonly<{ serviceId: string; endpointId: string; address: string; revision: number }>
  cause: Readonly<{ eventId: string; receiptId: string }>
  returnTo: Readonly<{ serviceId: string; endpointId: string; address: string }>
}>
export type EISharedAcknowledgment = Readonly<{
  kind: 'received' | 'applied'
  scope: 'local-journal-retention' | 'local-consumer-admission'
  eventId: string
  eventSha256: string
  endpointId: string
  fieldId: string
  sourceRevision: number
  receiptId: string
  thread: EISharedThread
}>
export type EISharedListener = (event: EISharedEvent, received: EISharedAcknowledgment) => void
export type EISharedConflictCode = 'foreign-field' | 'event-id-conflict' | 'revision-conflict' | 'unverified-source' | 'stale-commit'
export type EISharedConflict = Readonly<{
  code: EISharedConflictCode
  endpointId: string
  reason: string
  event: EISharedEvent | null
  ledger: EILedger | null
  currentRevision: number
  incomingRevision: number
}>
export type EISharedReceiveResult = Readonly<{
  status: 'received' | 'duplicate' | 'conflict'
  acknowledgment: EISharedAcknowledgment | null
  conflict: EISharedConflict | null
}>
export type EISharedAdmission = Readonly<{
  status: 'applied' | 'duplicate' | 'waiting' | 'not-received'
  acknowledgment: EISharedAcknowledgment | null
  ledger: EILedger | null
}>
export type EISharedFieldSnapshot = Readonly<{
  identity: EISharedIdentity
  boundary: typeof EI_SHARED_FIELD_BOUNDARY
  transport: 'local-process-only'
  ledger: EILedger
  ledgerSha256: string
  events: readonly EISharedEvent[]
  conflicts: readonly EISharedConflict[]
  endpoints: readonly Readonly<{
    id: string; serviceId: string; sourceAddress: string; destinationAddress: string; connected: boolean; appliedIndex: number; deliveryFailures: number
    received: readonly EISharedAcknowledgment[]; applied: readonly EISharedAcknowledgment[]
  }>[]
}>
export interface EISharedField {
  inspect(): EISharedFieldSnapshot
  connect(endpoint: EISharedEndpointSpec): EISharedEndpoint
  disconnect(endpoint: EISharedEndpoint): void
  reconnect(endpoint: EISharedEndpoint): readonly EISharedEvent[]
  /** Reads the same authoritative ledger for every endpoint. */
  read(endpoint: EISharedEndpoint): EILedger
  /** A lagging consumer view; it never becomes an independently writable ledger. */
  view(endpoint: EISharedEndpoint): EILedger
  commit(endpoint: EISharedEndpoint, verification: EIVerification): Promise<Readonly<{ result: EIResult; event: EISharedEvent | null }>>
  /** Adopt an existing engine result, preserving an application's render/commit gate. */
  publish(endpoint: EISharedEndpoint, previousLedger: EILedger, result: EIResult): Promise<Readonly<{ result: EIResult; event: EISharedEvent | null }>>
  /** Replays pending events now; future successful publications notify immediately. */
  subscribe(endpoint: EISharedEndpoint, listener: EISharedListener): () => void
  /** Replay is a read, not evidence that any consumer received or applied it. */
  replay(endpoint: EISharedEndpoint): readonly EISharedEvent[]
  receive(endpoint: EISharedEndpoint, event: EISharedEvent): EISharedReceiveResult
  /** Explicitly admits the next already committed snapshot after receipt. */
  admit(endpoint: EISharedEndpoint, eventId: string): EISharedAdmission
}

const validatedEvents = new WeakSet<object>()
const eventProofs = new WeakMap<object, EILedger>()
const encoder = new TextEncoder()
const eventKeys = ['format', 'eventId', 'index', 'identity', 'source', 'target', 'predecessor', 'payload', 'sha256'] as const
function fail(message: string): never { throw new Error(`EI shared field: ${message}`) }
function freeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.values(value).forEach(freeze); Object.freeze(value) }
  return value
}
function object(value: unknown, keys: readonly string[], label: string, optional: readonly string[] = []): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) fail(`${label} must be a plain object`)
  const item = value as Record<string, unknown>
  if (Object.keys(item).some(key => !keys.includes(key) && !optional.includes(key)) || keys.some(key => !Object.hasOwn(item, key))) fail(`${label} has unexpected or missing fields`)
  return item
}
function id(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim() || value.length > EI_LIMITS.idLength || /[\u0000-\u001f\u007f]/.test(value)) fail(`${label} must be bounded nonempty text without controls`)
  return value as string
}
function address(value: unknown, label: string): string {
  // Engine addresses are exact text. JSON escaping preserves controls safely;
  // service/connection identifiers retain their narrower visible-text bound.
  if (typeof value !== 'string' || !value.trim() || value.length > EI_LIMITS.idLength) fail(`${label} must be bounded nonempty address text`)
  return value as string
}
function integer(value: unknown, minimum: number, label: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum) fail(`${label} must be a safe integer at least ${minimum}`)
  return value as number
}
function hash(value: unknown, label: string): string {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) fail(`${label} must be a lowercase SHA-256 digest`)
  return value as string
}
function identity(value: unknown): EISharedIdentity {
  const item = object(value, ['fieldId', 'userRoot'], 'identity')
  return { fieldId: id(item.fieldId, 'fieldId'), userRoot: id(item.userRoot, 'userRoot') }
}
function sameIdentity(a: EISharedIdentity, b: EISharedIdentity): boolean { return a.fieldId === b.fieldId && a.userRoot === b.userRoot }
function rootExists(ledger: EILedger, root: string): boolean { return ledger.records.some(record => record.address === root && record.parents.length === 0) }
async function digest(raw: string): Promise<string> {
  const result = await globalThis.crypto.subtle.digest('SHA-256', encoder.encode(raw))
  return Array.from(new Uint8Array(result), byte => byte.toString(16).padStart(2, '0')).join('')
}
function body(event: Omit<EISharedEvent, 'eventId' | 'sha256'>): Omit<EISharedEvent, 'eventId' | 'sha256'> {
  return { format: event.format, index: event.index, identity: event.identity, source: event.source, target: event.target, predecessor: event.predecessor, payload: event.payload }
}
function bytes(event: EISharedEvent): number { return encoder.encode(JSON.stringify(event)).length }
function requireEvent(event: EISharedEvent): void { if (!validatedEvents.has(event)) fail('event must be locally issued or pass verifyEISharedEvent; an object/string identity is not verification') }

/** Exported bytes are inert. Parsing them later does not restore local authority. */
export function exportEISharedEvent(event: EISharedEvent): string { requireEvent(event); return JSON.stringify(event) }

/** Read the exact separately validated snapshot bound to this notification.
 * This is inspection, not consumer admission or remote authentication. */
export function readEISharedEventState(event: EISharedEvent): EILedger { requireEvent(event); const ledger=eventProofs.get(event); if(!ledger)fail('event state evidence is unavailable'); return ledger }

function normalizeEvent(value: unknown): EISharedEvent {
  const e = object(value, eventKeys, 'event'), i = identity(e.identity)
  if (e.format !== EI_SHARED_FIELD_FORMAT) fail('unsupported event format')
  const s = object(e.source, ['endpointId', 'serviceId', 'address', 'revision', 'sequence'], 'source')
  const t = object(e.target, ['fieldId', 'userRoot', 'addresses'], 'target')
  const p = object(e.predecessor, ['revision', 'ledgerSha256'], 'predecessor')
  const v = object(e.payload, ['ledgerSha256', 'receiptId', 'receiptSha256'], 'payload')
  if (!Array.isArray(t.addresses) || !t.addresses.length || t.addresses.length > EI_LIMITS.patches) fail('target requires bounded addressed patches')
  const addresses = t.addresses.map(value => address(value, 'target address'))
  if (new Set(addresses).size !== addresses.length) fail('duplicate target addresses')
  const event: EISharedEvent = {
    format: EI_SHARED_FIELD_FORMAT, eventId: id(e.eventId, 'eventId'), index: integer(e.index, 1, 'index'), identity: i,
    source: { endpointId: id(s.endpointId, 'source endpoint'), serviceId: id(s.serviceId, 'source service'), address: id(s.address, 'source address'), revision: integer(s.revision, 1, 'source revision'), sequence: integer(s.sequence, 1, 'source sequence') },
    target: { fieldId: id(t.fieldId, 'target field'), userRoot: id(t.userRoot, 'target root'), addresses },
    predecessor: { revision: integer(p.revision, 0, 'predecessor revision'), ledgerSha256: hash(p.ledgerSha256, 'predecessor digest') },
    payload: { ledgerSha256: hash(v.ledgerSha256, 'ledger digest'), receiptId: typeof v.receiptId === 'string' && v.receiptId.length <= EI_LIMITS.idLength + 11 && v.receiptId.trim() ? v.receiptId : fail('invalid receipt ID'), receiptSha256: hash(v.receiptSha256, 'receipt digest') },
    sha256: hash(e.sha256, 'event digest'),
  }
  if (event.target.fieldId !== i.fieldId || event.target.userRoot !== i.userRoot) fail('source/target field identity differs')
  if (event.source.revision !== event.predecessor.revision + 1) fail('source revision is not the next committed revision')
  if (event.eventId !== `ei-shared:${event.sha256}`) fail('event ID does not bind its digest')
  return event
}

/** Reconstruct one prefix solely to validate history; this does not admit it. */
function predecessorLedger(ledger: EILedger): EILedger {
  const revision = ledger.revision - 1, receipts = ledger.receipts.slice(0, -1), receiptIds = new Set(receipts.map(receipt => receipt.id))
  const records = ledger.records.flatMap(record => {
    const states = [...record.was, record.is].filter(state => state.revision <= revision)
    if (!states.length) return []
    return [{ ...record, was: states.slice(0, -1), is: states.at(-1)!, receiptIds: record.receiptIds.filter(receiptId => receiptIds.has(receiptId)) }]
  })
  return importEILedger(JSON.stringify({ ...ledger, revision, records, receipts }))
}

/**
 * Strict canonical wire format, byte digests and existing-engine structural
 * replay against a separately supplied engine-validated ledger. Notifications
 * contain only references, so reconnect never duplicates full ledger payloads.
 * This deliberately returns no source/owner authentication capability.
 * Unknown verified events remain conflicts when offered to a local field.
 */
export async function verifyEISharedEvent(raw: string, ledger: EILedger): Promise<EISharedEvent> {
  if (typeof raw !== 'string' || raw.length > EI_SHARED_FIELD_LIMITS.eventBytes || encoder.encode(raw).length > EI_SHARED_FIELD_LIMITS.eventBytes) fail('event exceeds byte bounds')
  let parsed: unknown
  try { parsed = JSON.parse(raw) } catch { fail('invalid event JSON') }
  const event = normalizeEvent(parsed)
  // Also rejects duplicate raw keys, reordered fields and alternative encodings.
  if (JSON.stringify(event) !== raw) fail('event must use its exact canonical encoding')
  if (await digest(JSON.stringify(body(event))) !== event.sha256) fail('event digest mismatch')
  const ledgerJSON = exportEILedger(ledger), receipt = ledger.receipts.at(-1)
  if (await digest(ledgerJSON) !== event.payload.ledgerSha256) fail('ledger proof digest mismatch')
  if (!rootExists(ledger, event.identity.userRoot) || ledger.revision !== event.source.revision || !receipt || receipt.id !== event.payload.receiptId || receipt.producer !== event.source.address || receipt.resultRevision !== event.source.revision) fail('event does not reference its actual committed ledger/receipt')
  if (JSON.stringify(receipt.patches.map(patch => patch.address)) !== JSON.stringify(event.target.addresses)) fail('target addresses differ from committed patches')
  if (await digest(JSON.stringify(receipt)) !== event.payload.receiptSha256) fail('committed receipt digest mismatch')
  if (await digest(exportEILedger(predecessorLedger(ledger))) !== event.predecessor.ledgerSha256) fail('predecessor digest differs from the committed history')
  freeze(event); validatedEvents.add(event); eventProofs.set(event, ledger)
  return event
}

type EndpointState = {
  endpoint: EISharedEndpoint; connected: boolean; sourceSequence: number; appliedIndex: number; view: EILedger
  deliveryFailures: number; listeners: Set<EISharedListener>
  received: Map<string, EISharedAcknowledgment>; applied: Map<string, EISharedAcknowledgment>
}
type JournalEntry = { event: EISharedEvent; ledger: EILedger; json: string }

/**
 * Construction is an explicit local binding to an engine-validated ledger.
 * The root is a retained address, not an authenticated account. Every endpoint
 * reads/commits this one ledger; endpoint capabilities cannot cross instances.
 */
export async function createEISharedField(options: Readonly<{ identity: EISharedIdentity; ledger: EILedger }>): Promise<EISharedField> {
  const selected = freeze(identity(options.identity)), initial = options.ledger, initialJSON = exportEILedger(initial)
  if (!rootExists(initial, selected.userRoot)) fail('userRoot must name a retained ledger root')
  let ledger = initial, ledgerSha256 = await digest(initialJSON), retainedBytes = 0
  const endpoints = new Map<string, EndpointState>(), capabilities = new WeakMap<object, EndpointState>()
  const journal: JournalEntry[] = [], conflicts: EISharedConflict[] = []
  function endpointState(endpoint: EISharedEndpoint, connected = true): EndpointState {
    const state = capabilities.get(endpoint)
    if (!state) fail('endpoint was not connected to this field; names do not grant authority')
    if (connected && !state.connected) fail('local endpoint is disconnected')
    return state
  }
  function retainConflict(code: EISharedConflictCode, state: EndpointState, event: EISharedEvent | null, incomingRevision: number, reason: string, suppliedProof?: EILedger): EISharedConflict {
    const proof = suppliedProof ?? (event ? eventProofs.get(event)! : null)
    const existing = conflicts.find(conflict => conflict.code === code && conflict.endpointId === state.endpoint.id && conflict.event?.eventId === event?.eventId && conflict.incomingRevision === incomingRevision && (event !== null || conflict.ledger === proof))
    if (existing) return existing
    // Locally retained snapshots share existing engine objects. Independently
    // supplied competing histories are charged once per exact ledger identity.
    const proofRetained = proof === ledger || journal.some(entry => entry.ledger === proof) || conflicts.some(conflict => conflict.ledger === proof)
    const additional = (event ? bytes(event) : 0) + (proof && !proofRetained ? encoder.encode(exportEILedger(proof)).length : 0)
    if (conflicts.length >= EI_SHARED_FIELD_LIMITS.conflicts || retainedBytes + additional > EI_SHARED_FIELD_LIMITS.retainedBytes) fail('conflict retention limit reached; no state or acknowledgment was changed')
    const conflict = freeze({ code, endpointId: state.endpoint.id, reason, event, ledger: proof, currentRevision: ledger.revision, incomingRevision })
    conflicts.push(conflict); retainedBytes += additional
    return conflict
  }
  function acknowledgment(kind: 'received' | 'applied', state: EndpointState, event: EISharedEvent): EISharedAcknowledgment {
    const source = { serviceId: event.source.serviceId, endpointId: event.source.endpointId, address: event.source.address, revision: event.source.revision }
    const destination = { serviceId: state.endpoint.serviceId, endpointId: state.endpoint.id, address: state.endpoint.destinationAddress, revision: state.view.revision }
    const thread: EISharedThread = {
      threadId: `ei-shared-thread:${JSON.stringify([selected.fieldId, source.endpointId, source.address, destination.endpointId, destination.address])}`,
      source, destination, cause: { eventId: event.eventId, receiptId: event.payload.receiptId },
      returnTo: { serviceId: source.serviceId, endpointId: source.endpointId, address: source.address },
    }
    return freeze({ kind, scope: kind === 'received' ? 'local-journal-retention' as const : 'local-consumer-admission' as const, eventId: event.eventId, eventSha256: event.sha256, endpointId: state.endpoint.id, fieldId: selected.fieldId, sourceRevision: event.source.revision, receiptId: event.payload.receiptId, thread })
  }
  function replay(endpoint: EISharedEndpoint): readonly EISharedEvent[] {
    const state = endpointState(endpoint)
    return Object.freeze(journal.slice(state.appliedIndex).map(entry => entry.event))
  }
  function conflictResult(conflict: EISharedConflict): EISharedReceiveResult { return freeze({ status: 'conflict', acknowledgment: null, conflict }) }
  function receive(endpoint: EISharedEndpoint, event: EISharedEvent): EISharedReceiveResult {
    const state = endpointState(endpoint); requireEvent(event)
    if (!sameIdentity(event.identity, selected)) return conflictResult(retainConflict('foreign-field', state, event, event.source.revision, 'Another user-labelled field cannot replace or merge this ledger'))
    const entry = journal.find(item => item.event.eventId === event.eventId)
    if (entry && entry.json !== JSON.stringify(event)) return conflictResult(retainConflict('event-id-conflict', state, event, event.source.revision, 'An event ID was reused for different retained content'))
    if (!entry) {
      const collides = journal.some(item => item.event.index === event.index || item.event.source.revision === event.source.revision || item.event.source.endpointId === event.source.endpointId && item.event.source.sequence === event.source.sequence)
      return conflictResult(retainConflict(collides ? 'revision-conflict' : 'unverified-source', state, event, event.source.revision, collides ? 'A different committed history claims an occupied revision; both histories are retained without merging' : 'Content is structurally verified, but no commit in this local field authorizes its source or history'))
    }
    const previous = state.received.get(event.eventId)
    if (previous) return freeze({ status: 'duplicate', acknowledgment: previous, conflict: null })
    const received = acknowledgment('received', state, entry.event)
    state.received.set(event.eventId, received)
    return freeze({ status: 'received', acknowledgment: received, conflict: null })
  }
  function deliver(state: EndpointState, events: readonly EISharedEvent[], only?: EISharedListener): void {
    for (const event of events) {
      for (const listener of only ? [only] : [...state.listeners]) {
        if (!state.connected || !state.listeners.has(listener)) continue
        const received = receive(state.endpoint, event).acknowledgment!
        const failed = () => { state.deliveryFailures = Math.min(Number.MAX_SAFE_INTEGER, state.deliveryFailures + 1) }
        try {
          const returned: unknown = listener(event, received)
          // An async listener is still just a notification. It cannot roll back
          // the commit, claim admission, or leave an unhandled rejection.
          if (returned && typeof (returned as PromiseLike<unknown>).then === 'function') void Promise.resolve(returned).catch(failed)
        } catch { failed() }
      }
    }
  }
  async function publish(endpoint: EISharedEndpoint, previousLedger: EILedger, result: EIResult): Promise<Readonly<{ result: EIResult; event: EISharedEvent | null }>> {
    const state = endpointState(endpoint), before = ledger, beforeDigest = ledgerSha256
    // Capture caller-owned wrapper fields before any asynchronous hashing.
    result = freeze({ status: result.status, ledger: result.ledger, receipt: result.receipt })
    exportEILedger(previousLedger)
    exportEILedger(result.ledger)
    function publishedRetry(): Readonly<{ result: EIResult; event: EISharedEvent }> | null {
      if (result.status !== 'committed' || result.receipt !== result.ledger.receipts.at(-1)) return null
      const at = journal.findIndex(entry => entry.ledger === result.ledger && entry.event.source.endpointId === endpoint.id)
      if (at < 0 || previousLedger !== (at === 0 ? initial : journal[at - 1].ledger)) return null
      // A lost publication return may be retried after later commits. Return
      // the current ledger with the retained receipt; never rewind any state.
      return freeze({ result: { status: 'replayed' as const, ledger, receipt: result.receipt }, event: journal[at].event })
    }
    const prior = publishedRetry()
    if (prior) return prior
    if (previousLedger !== before) {
      retainConflict('stale-commit', state, null, result.ledger.revision, 'Publication did not capture this field\'s current ledger; re-read before preparing another commit', result.ledger)
      fail('publication previous ledger is stale or belongs to another field instance')
    }
    if (result.status !== 'committed') {
      if (!['blocked', 'rejected', 'replayed'].includes(result.status)) fail('unsupported engine result status')
      if (result.ledger !== before) fail('noncommitted result cannot replace the shared ledger')
      return freeze({ result, event: null })
    }
    const ledgerJSON = exportEILedger(result.ledger), actualReceipt = result.ledger.receipts.at(-1)
    if (!actualReceipt || actualReceipt !== result.receipt || actualReceipt.status !== 'committed' || actualReceipt.producer !== endpoint.sourceAddress || result.ledger.revision !== before.revision + 1 || exportEILedger(predecessorLedger(result.ledger)) !== exportEILedger(before)) fail('publication must reference the actual committed receipt and exact ledger ancestry within the endpoint source scope')
    if (journal.length >= EI_SHARED_FIELD_LIMITS.events) fail('journal limit reached; shared ledger was not changed')
    const payloadDigest = await digest(ledgerJSON), receiptDigest = await digest(JSON.stringify(result.receipt))
    const unsigned = body({ format: EI_SHARED_FIELD_FORMAT, index: journal.length + 1, identity: selected,
      source: { endpointId: endpoint.id, serviceId: endpoint.serviceId, address: endpoint.sourceAddress, revision: result.ledger.revision, sequence: state.sourceSequence + 1 },
      target: { fieldId: selected.fieldId, userRoot: selected.userRoot, addresses: result.receipt.patches.map(patch => patch.address) },
      predecessor: { revision: before.revision, ledgerSha256: beforeDigest },
      payload: { ledgerSha256: payloadDigest, receiptId: result.receipt.id, receiptSha256: receiptDigest },
    })
    const sha256 = await digest(JSON.stringify(unsigned))
    const event = freeze({ format: unsigned.format, eventId: `ei-shared:${sha256}`, index: unsigned.index, identity: unsigned.identity, source: unsigned.source, target: unsigned.target, predecessor: unsigned.predecessor, payload: unsigned.payload, sha256 })
    endpointState(endpoint)
    if (ledger !== before) {
      const concurrentRetry = publishedRetry()
      if (concurrentRetry) return concurrentRetry
      retainConflict('stale-commit', state, null, result.ledger.revision, 'The shared ledger advanced during digest preparation; re-read and propose explicitly', result.ledger)
      fail('shared ledger changed during commit preparation; no event was published')
    }
    const size = bytes(event)
    if (size > EI_SHARED_FIELD_LIMITS.eventBytes || retainedBytes + size > EI_SHARED_FIELD_LIMITS.retainedBytes) fail('journal byte limit reached; shared ledger was not changed')
    validatedEvents.add(event); eventProofs.set(event, result.ledger)
    ledger = result.ledger; ledgerSha256 = payloadDigest; retainedBytes += size; state.sourceSequence++
    journal.push({ event, ledger, json: JSON.stringify(event) })
    // Publish only after canonical state and its actual receipt are retained.
    for (const consumer of [...endpoints.values()]) deliver(consumer, [event])
    return freeze({ result, event })
  }
  return Object.freeze({
    inspect(): EISharedFieldSnapshot {
      return freeze({ identity: selected, boundary: EI_SHARED_FIELD_BOUNDARY, transport: 'local-process-only' as const, ledger, ledgerSha256, events: journal.map(entry => entry.event), conflicts: [...conflicts], endpoints: [...endpoints.values()].map(state => ({ ...state.endpoint, connected: state.connected, appliedIndex: state.appliedIndex, deliveryFailures: state.deliveryFailures, received: [...state.received.values()], applied: [...state.applied.values()] })) })
    },
    connect(value: EISharedEndpointSpec): EISharedEndpoint {
      const e = object(value, ['id', 'sourceAddress'], 'endpoint', ['serviceId', 'destinationAddress'])
      const endpoint = freeze({ id: id(e.id, 'endpoint ID'), serviceId: id(e.serviceId ?? e.id, 'service ID'), sourceAddress: id(e.sourceAddress, 'source address'), destinationAddress: id(e.destinationAddress ?? e.sourceAddress, 'destination address') })
      if (endpoints.has(endpoint.id)) fail('endpoint ID already retained; reconnect with its existing local capability')
      if (endpoints.size >= EI_SHARED_FIELD_LIMITS.endpoints) fail('endpoint limit reached')
      if (!ledger.records.some(record => record.address === endpoint.sourceAddress)) fail('source address is absent from the shared ledger')
      if (!ledger.records.some(record => record.address === endpoint.destinationAddress)) fail('destination address is absent from the shared ledger')
      const state: EndpointState = { endpoint, connected: true, sourceSequence: 0, appliedIndex: 0, view: initial, deliveryFailures: 0, listeners: new Set(), received: new Map(), applied: new Map() }
      endpoints.set(endpoint.id, state); capabilities.set(endpoint, state)
      return endpoint
    },
    disconnect(endpoint: EISharedEndpoint): void { endpointState(endpoint, false).connected = false },
    reconnect(endpoint: EISharedEndpoint): readonly EISharedEvent[] { const state = endpointState(endpoint, false); state.connected = true; const pending = replay(endpoint); deliver(state, pending); return pending },
    read(endpoint: EISharedEndpoint): EILedger { endpointState(endpoint); return ledger },
    view(endpoint: EISharedEndpoint): EILedger { return endpointState(endpoint).view },
    async commit(endpoint: EISharedEndpoint, verification: EIVerification) {
      endpointState(endpoint); const before = ledger
      // commitEI validates the opaque verification before its metadata is used.
      const result = commitEI(before, verification)
      return publish(endpoint, before, result)
    },
    publish,
    subscribe(endpoint: EISharedEndpoint, listener: EISharedListener): () => void {
      const state = endpointState(endpoint)
      if (typeof listener !== 'function') fail('listener must be a function')
      if (state.listeners.has(listener)) fail('listener is already subscribed')
      if ([...endpoints.values()].reduce((total, item) => total + item.listeners.size, 0) >= EI_SHARED_FIELD_LIMITS.listeners) fail('listener limit reached')
      state.listeners.add(listener); deliver(state, replay(endpoint), listener)
      return () => { state.listeners.delete(listener) }
    },
    replay,
    receive,
    admit(endpoint: EISharedEndpoint, eventId: string): EISharedAdmission {
      const state = endpointState(endpoint), existing = state.applied.get(eventId)
      if (existing) return freeze({ status: 'duplicate', acknowledgment: existing, ledger: journal.find(entry => entry.event.eventId === eventId)!.ledger })
      if (!state.received.has(eventId)) return freeze({ status: 'not-received', acknowledgment: null, ledger: null })
      const entry = journal[state.appliedIndex]
      if (!entry || entry.event.eventId !== eventId) return freeze({ status: 'waiting', acknowledgment: null, ledger: null })
      state.view = entry.ledger; state.appliedIndex++
      const applied = acknowledgment('applied', state, entry.event)
      state.applied.set(eventId, applied)
      return freeze({ status: 'applied', acknowledgment: applied, ledger: entry.ledger })
    },
  })
}
