/** Local addressed conversation: capture and command returns, with optional explicitly supplied inference. */
import {
  EI_LIMITS, commitEI, executeEI, exportEILedger, proposeEI,
  type EIExecution, type EIInput, type EILedger, type EIProposal, type EIRecord,
  type EIResult, type EISource, type EIValueState, type EIVerification,
} from './ei-engine.ts'
import { parseEIQuery, evaluateEIQuery, verifyEIQueryAnswer, formatEIQueryAnswer, formatEIQueryVerification, type EIQuery, type EIQueryAnswer, type EIQueryVerification } from './ei-relation-reasoner.ts'

export const EI_CONVERSATION_LIMITS = Object.freeze({ inputLength: 8_192, encodedInputBytes: 32_768, outputLength: 8_192, commandReferences: 64 })
const FORMAT = 'ei-conversation-message/v1'
const USER_REALM = 'ei-conversation-user'
const REPLY_REALM = 'ei-conversation-reply'
export type EIConversationStatus = 'captured' | 'command-return' | 'inference-unavailable' | 'generated-unverified'
export type EIInferenceProvenance = Readonly<{ adapterId: string; sourceId: string; model?: string; requestId?: string }>
export type EIProjectionVerification = Readonly<{
  format: 'ei-conversation-projection-check/v1'; scope: 'retained-local-text-projection-consistency';
  status: 'passed' | 'failed' | 'unresolved'; origin: Readonly<{ ledgerRevision: number; sourceStateFingerprint: string }>;
  sourceRefs: readonly string[]; checks: readonly Readonly<{ kind: string; matches: boolean }>[];
  expectedFingerprint: string | null; actualFingerprint: string; note: string;
}>
export type EIUnavailableVerification = Readonly<{ format: 'ei-conversation-unavailable-check/v1'; scope: 'retained-local-consistency-unavailable'; status: 'unresolved'; reason: string }>
export type EIConversationEvidence = Readonly<{ kind: 'self-check-unavailable'; verification: EIUnavailableVerification }> | Readonly<{ kind: 'source-projection'; verification: EIProjectionVerification }> | Readonly<{ kind: 'addressed-relation-query'; query: EIQuery; answer: EIQueryAnswer; verification: EIQueryVerification }>
export type EIConversationMessage = Readonly<{
  address: string; role: 'user' | 'assistant'; text: string; sourceRefs: readonly string[];
  status: EIConversationStatus; turn: number; source: EISource; corrections: readonly EIValueState[]; currentText: string; provenance?: EIInferenceProvenance; evidence?: EIConversationEvidence; selfCheck?: EIProjectionVerification | EIQueryVerification | EIUnavailableVerification; derivation?: EIQueryAnswer;
}>
export type EIConversation = Readonly<{ root: string; turns: readonly EIConversationMessage[] }>
export type EIInferenceContext = Readonly<{
  ledger: EILedger; conversation: EIConversation;
  userInput: Readonly<{ address: string; text: string; source: EISource }>;
}>
export type EIInferenceResult = Readonly<{ text: string; provenance: EIInferenceProvenance }>
export interface EIInferenceAdapter {
  readonly id: string
  infer(context: EIInferenceContext, signal: AbortSignal): Promise<EIInferenceResult>
}
export type EIPreparedConversationTurn = Readonly<{
  status: 'proposed'; proposal: EIProposal; user: EIConversationMessage;
  reply: EIConversationMessage; context: EIInferenceContext;
}>
export type EIConversationStopped = Readonly<{ status: 'cancelled' | 'stale'; reason: string }>
export type EIConversationPreparation = EIPreparedConversationTurn | EIConversationStopped
export type EIConversationExecution = EIExecution | EIResult | EIConversationStopped
export type EIConversationCommit = EIResult | EIConversationStopped
export type EIConversationOptions = Readonly<{
  ledger: EILedger; root: string; input: string; id: string; signal?: AbortSignal; adapter?: EIInferenceAdapter;
  /** Optional live state accessor allows stale detection immediately after inference. */
  currentLedger?: () => EILedger;
}>
type Metadata = Readonly<{
  format: typeof FORMAT; root: string; turn: number; role: 'user' | 'assistant';
  sourceRefs: readonly string[]; status: EIConversationStatus; provenance?: EIInferenceProvenance; evidence?: EIConversationEvidence;
}>
type Guard = { snapshot: string; signal: AbortSignal }
const preparedGuards = new WeakMap<object, Guard>()
const stagedTurns = new WeakMap<object, EIPreparedConversationTurn>()

function fail(reason: string): never { throw new Error(`EI conversation: ${reason}`) }
function freeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.values(value).forEach(freeze); Object.freeze(value) }
  return value
}
function checkedText(value: unknown, label: string, max: number, nonempty = false): string {
  if (typeof value !== 'string' || value.length > max || (nonempty && !value.trim())) fail(`${label} must be ${nonempty ? 'nonempty ' : ''}text of at most ${max} code units`)
  return value as string
}
function plain(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) fail(`${label} must be a plain object`)
  return value as Record<string, unknown>
}
function provenance(value: unknown, adapterId?: string): EIInferenceProvenance {
  const item = plain(value, 'inference provenance')
  for (const key of Object.keys(item)) if (!['adapterId', 'sourceId', 'model', 'requestId'].includes(key)) fail(`unexpected provenance field: ${key}`)
  const captured = { adapterId: checkedText(item.adapterId, 'adapter ID', 256, true), sourceId: checkedText(item.sourceId, 'inference source ID', 256, true), ...(item.model === undefined ? {} : { model: checkedText(item.model, 'model', 256, true) }), ...(item.requestId === undefined ? {} : { requestId: checkedText(item.requestId, 'request ID', 256, true) }) }
  if (adapterId !== undefined && captured.adapterId !== adapterId) fail('returned provenance does not name the selected adapter')
  return freeze(captured)
}
function readMetadata(record: EIRecord, root: string): Metadata | null {
  // Original utterances remain the original captured state. Later explicit
  // edits are retained as corrections and remain visible in the full ledger.
  const captured = record.was[0] ?? record.is
  if (captured.source.realm !== USER_REALM && captured.source.realm !== REPLY_REALM) return null
  let decoded: unknown
  try { decoded = JSON.parse(captured.source.locator ?? '') } catch { fail(`missing or malformed conversation metadata at ${record.address}`) }
  const meta = plain(decoded, 'message metadata')
  if (meta.format !== FORMAT) fail(`unsupported conversation metadata at ${record.address}`)
  if (meta.root !== root) return null
  for (const key of Object.keys(meta)) if (!['format', 'root', 'turn', 'role', 'sourceRefs', 'status', 'provenance', 'evidence'].includes(key)) fail(`unexpected message metadata field: ${key}`)
  if (!Number.isSafeInteger(meta.turn) || (meta.turn as number) < 1) fail('message turn must be a positive safe integer')
  if (meta.role !== 'user' && meta.role !== 'assistant') fail('invalid conversation role')
  const expectedRealm = meta.role === 'user' ? USER_REALM : REPLY_REALM
  if (captured.source.realm !== expectedRealm || captured.value !== captured.source.text) fail('message role or exact source text does not match its captured record')
  if (!Array.isArray(meta.sourceRefs) || meta.sourceRefs.length > EI_CONVERSATION_LIMITS.commandReferences + 2) fail('invalid message source references')
  const sourceRefs = meta.sourceRefs.map(item => checkedText(item, 'source reference', 256, true))
  if (new Set(sourceRefs).size !== sourceRefs.length) fail('duplicate message source references')
  const statuses = ['captured', 'command-return', 'inference-unavailable', 'generated-unverified']
  if (!statuses.includes(meta.status as string) || (meta.role === 'user') !== (meta.status === 'captured')) fail('invalid captured message status')
  if ((meta.status === 'generated-unverified') !== (meta.provenance !== undefined)) fail('generated content must retain adapter provenance without becoming verified authority')
  return freeze({ format: FORMAT, root, turn: meta.turn as number, role: meta.role, sourceRefs, status: meta.status as EIConversationStatus, ...(meta.provenance === undefined ? {} : { provenance: provenance(meta.provenance) }), ...(meta.evidence === undefined ? {} : { evidence: readEvidence(meta.evidence) }) })
}

/** Read full ordered dialogue from actual immutable ledger records, never a separate UI transcript. */
export function readEIConversation(ledger: EILedger, root: string): EIConversation {
  exportEILedger(ledger) // Validate that this is a committed engine ledger.
  if (!ledger.records.some(record => record.address === root)) fail(`unknown conversation root: ${root}`)
  const turns = ledger.records.flatMap(record => {
    const meta = readMetadata(record, root)
    const captured = record.was[0] ?? record.is
    return meta ? [{ address: record.address, role: meta.role, text: captured.value, sourceRefs: meta.sourceRefs, status: meta.status, turn: meta.turn, source: captured.source, corrections: record.was.length ? [...record.was.slice(1), record.is] : [], currentText: record.is.value, ...(meta.provenance ? { provenance: meta.provenance } : {}), ...(meta.evidence ? { evidence: meta.evidence, ...evidenceFields(meta.evidence) } : {}) }] : []
  }).sort((a, b) => a.turn - b.turn || (a.role === b.role ? 0 : a.role === 'user' ? -1 : 1))
  if (turns.length % 2 !== 0) fail('conversation history contains an incomplete turn')
  const byAddress = new Map(ledger.records.map(record => [record.address, record]))
  for (let i = 0; i < turns.length; i += 2) {
    const user = turns[i], reply = turns[i + 1], index = i / 2 + 1
    if (user.turn !== index || reply.turn !== index || user.role !== 'user' || reply.role !== 'assistant') fail('conversation order is incomplete or duplicated')
    const userRecord = byAddress.get(user.address)!, replyRecord = byAddress.get(reply.address)!
    if (!userRecord.parents.includes(root) || !replyRecord.parents.includes(user.address) || !reply.sourceRefs.includes(user.address)) fail('conversation parent/source links are broken')
    if (i > 0 && !userRecord.parents.includes(turns[i - 1].address)) fail('conversation does not link to its previous reply')
    for (const message of [user, reply]) for (const ref of message.sourceRefs) if (!byAddress.has(ref)) fail(`conversation source reference is unbound: ${ref}`)
    const userCapture = userRecord.was[0] ?? userRecord.is, replyCapture = replyRecord.was[0] ?? replyRecord.is
    if (userCapture.revision !== replyCapture.revision || !ledger.receipts.some(receipt => receipt.resultRevision === userCapture.revision && receipt.patches.some(patch => patch.address === user.address) && receipt.patches.some(patch => patch.address === reply.address))) fail('input and response lack one atomic conversation receipt')
  }
  return freeze({ root, turns })
}

type ReturnContent = Readonly<{ text: string; status: Exclude<EIConversationStatus, 'captured'>; sourceRefs: readonly string[]; provenance?: EIInferenceProvenance; evidence?: EIConversationEvidence }>
function unavailable(text: string, sourceRefs: readonly string[] = []): ReturnContent { return { text, status: 'inference-unavailable', sourceRefs } }
function parseCommand(raw: string): { name: string; args: string[] } | null {
  const trimmed = raw.trim()
  if (!trimmed.startsWith('/')) return null
  const tokens = trimmed.match(/"(?:[^"\\]|\\.)*"|\S+/g) ?? []
  const name = tokens.shift() ?? ''
  try { return { name, args: tokens.map(token => token.startsWith('"') ? checkedText(JSON.parse(token), 'command address', 256, true) : token) } } catch { return { name, args: [] } }
}
function commandReturn(ledger: EILedger, raw: string): ReturnContent | null {
  const parsed = parseCommand(raw)
  if (!parsed) return null
  const count = parsed.name === '/compare' ? 2 : 1
  if (!['/look', '/compare', '/trace'].includes(parsed.name)) return unavailable(`Unknown local command ${parsed.name}. Available commands: /look address, /compare address address, /trace address. No inference or execution was performed.`)
  if (parsed.args.length !== count) return unavailable(`Usage: ${parsed.name}${count === 2 ? ' address address' : ' address'}. Put an address containing spaces in JSON double quotes.`)
  const byAddress = new Map(ledger.records.map(record => [record.address, record])), records = parsed.args.map(arg => byAddress.get(arg))
  const missing = parsed.args.filter((_, index) => !records[index])
  if (missing.length) return unavailable(`Unresolved address${missing.length > 1 ? 'es' : ''}: ${missing.join(', ')}. No captured record establishes a value there.`, records.flatMap(record => record ? [record.address] : []))
  const first = records[0]!
  let text: string, sourceRefs: string[]
  if (parsed.name === '/look') {
    text = `Address: ${first.address}\nCaptured IS:\n${first.is.value}\nSource: ${first.is.source.id}\nRetained WAS count: ${first.was.length}`
    sourceRefs = [first.address]
  } else if (parsed.name === '/compare') {
    const second = records[1]!
    text = `Exact text comparison: ${first.is.value === second.is.value ? 'equal' : 'different'}\n${first.address}:\n${first.is.value}\n${second.address}:\n${second.is.value}\nThis compares captured text, not the truth of either statement.`
    sourceRefs = [...new Set([first.address, second.address])]
  } else {
    const queue = [first.address], seen = new Set<string>(), rows: string[] = []
    for (let i = 0; i < queue.length; i++) {
      const address = queue[i]
      if (seen.has(address)) continue
      seen.add(address)
      if (seen.size > EI_CONVERSATION_LIMITS.commandReferences) return unavailable(`The addressed trace exceeds this local command's ${EI_CONVERSATION_LIMITS.commandReferences}-record output limit. The complete records remain in the ledger.`, [first.address])
      const record = byAddress.get(address)!
      rows.push(`${record.address}\nParents: ${record.parents.length ? record.parents.join(', ') : '(captured root)'}\nSource: ${record.is.source.id}\nRetained WAS count: ${record.was.length}`)
      queue.push(...record.parents)
    }
    text = `Retained parent/source trace from ${first.address}:\n${rows.join('\n\n')}`
    sourceRefs = [...seen]
  }
  if (text.length > EI_CONVERSATION_LIMITS.outputLength) return unavailable('The exact addressed command return exceeds the local output limit. The complete values remain addressable in the ledger; no shortened value was substituted.', parsed.args)
  return { text, status: 'command-return', sourceRefs }
}

/** These are declared parser forms, not inferred intent or arbitrary paraphrases. */
export const EI_CONTEXT_QUERY_FORMS = Object.freeze(['what did I say before?', 'what have I said?', 'what changed?'] as const)
function contextualReturn(ledger: EILedger, conversation: EIConversation, input: string): ReturnContent | null {
  const form = input.trim().toLowerCase()
  if (!EI_CONTEXT_QUERY_FORMS.some(known => known.toLowerCase() === form)) return null
  const rootRecord = ledger.records.find(record => record.address === conversation.root)!, rootCapture = rootRecord.was[0] ?? rootRecord.is
  const inputs = conversation.turns.filter(message => message.role === 'user').map(message => ({ address: message.address, text: message.text, source: message.source }))
  // The UI may capture its first input as root and as the first turn. Keep both
  // addressed records, but do not duplicate that same capture in this answer.
  if (!inputs.length || inputs[0].text !== rootCapture.value) inputs.unshift({ address: rootRecord.address, text: rootCapture.value, source: rootCapture.source })
  let text: string, refs: string[]
  if (form === 'what did i say before?') {
    const prior = inputs.at(-1)!
    text = `Your previous retained input at ${prior.address}:\n${prior.text}\nSource: ${prior.source.id}`
    refs = [prior.address]
  } else if (form === 'what have i said?') {
    if (inputs.length > EI_CONVERSATION_LIMITS.commandReferences) return unavailable('The full retained input list exceeds this local answer limit. All original inputs and sources remain in the addressed conversation.', [conversation.root])
    text = `Retained inputs in order:\n${inputs.map((item, index) => `${index + 1}. ${item.address}\n${item.text}\nSource: ${item.source.id}`).join('\n\n')}`
    refs = inputs.map(item => item.address)
  } else {
    if (inputs.length < 2) return unavailable('There are fewer than two retained inputs to compare. No change between two inputs has been established.', inputs.map(item => item.address))
    const previous = inputs.at(-2)!, current = inputs.at(-1)!
    text = `Exact retained-input text Difference: ${previous.text === current.text ? 'equal' : 'different'}\nEarlier (${previous.address}):\n${previous.text}\nSource: ${previous.source.id}\nLater (${current.address}):\n${current.text}\nSource: ${current.source.id}\nThis compares the last two retained inputs as text; it does not establish their truth or infer intent.`
    refs = [previous.address, current.address]
  }
  if (text.length > EI_CONVERSATION_LIMITS.outputLength) return unavailable('The exact contextual answer exceeds the local output limit. Full inputs and their sources remain in the addressed conversation.', [conversation.root])
  return { text, status: 'command-return', sourceRefs: refs }
}

function evidenceFields(evidence: EIConversationEvidence): { selfCheck: EIProjectionVerification | EIQueryVerification | EIUnavailableVerification; derivation?: EIQueryAnswer } {
  return { selfCheck: evidence.verification, ...(evidence.kind === 'addressed-relation-query' ? { derivation: evidence.answer } : {}) }
}
async function relationReturn(ledger: EILedger, input: string): Promise<ReturnContent | null> {
  const parsed = parseEIQuery(input)
  if (parsed.status !== 'parsed') return null
  const answer = await evaluateEIQuery(ledger, parsed.query)
  if (JSON.stringify(answer).length > 24_000 || answer.sourceRefs.length > EI_CONVERSATION_LIMITS.commandReferences) return unavailable('The complete addressed derivation exceeds the local evidence limit. Narrow the supplied query. No partial proof has been presented as a complete answer.')
  const verification = await verifyEIQueryAnswer(ledger, parsed.query, answer)
  const evidence: EIConversationEvidence = { kind: 'addressed-relation-query', query: parsed.query, answer, verification }
  const formatted = formatEIQueryAnswer(answer), text = `${formatted}\n${formatEIQueryVerification(verification)}`
  if (JSON.stringify(evidence).length > 24_000 || text.length > EI_CONVERSATION_LIMITS.outputLength || formatted.includes('complete answer exceeds')) return unavailable('The complete addressed answer and self-check exceed the local evidence limit. Narrow the supplied query. No answer or proof was silently shortened.')
  if (verification.status === 'failed') return { text: 'The addressed answer failed its source consistency self-check. No resolved answer or action was admitted.', status: 'inference-unavailable', sourceRefs: answer.sourceRefs, evidence }
  return { text, status: verification.status === 'passed' ? 'command-return' : 'inference-unavailable', sourceRefs: answer.sourceRefs, evidence }
}

function readEvidence(value: unknown): EIConversationEvidence {
  const evidence = plain(value, 'conversation evidence')
  if (evidence.kind !== 'source-projection' && evidence.kind !== 'addressed-relation-query' && evidence.kind !== 'self-check-unavailable') fail('unknown conversation evidence kind')
  const allowed = evidence.kind === 'addressed-relation-query' ? ['kind', 'query', 'answer', 'verification'] : ['kind', 'verification']
  for (const key of Object.keys(evidence)) if (!allowed.includes(key)) fail(`unexpected evidence field: ${key}`)
  for (const key of allowed) if (!Object.hasOwn(evidence, key)) fail(`missing evidence field: ${key}`)
  const pending = [{ value, depth: 0 }]; let count = 0
  while (pending.length) {
    const item = pending.pop()!
    if (++count > 8_192 || item.depth > 24) fail('conversation evidence exceeds structural bounds')
    if (item.value && typeof item.value === 'object') for (const child of Object.values(item.value)) pending.push({ value: child, depth: item.depth + 1 })
  }
  // Imported evidence remains retained user-supplied data, not a fresh proof.
  return freeze(evidence as EIConversationEvidence)
}
async function fingerprint(value: unknown): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value)))
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}
/** Fresh consistency check against actual source state, not the message-capture receipt. */
export async function verifyEIConversationProjection(ledger: EILedger, root: string, input: string, answer: Pick<EIConversationMessage, 'text' | 'status' | 'sourceRefs'>): Promise<EIProjectionVerification> {
  const conversation = readEIConversation(ledger, root), expected = contextualReturn(ledger, conversation, input) ?? commandReturn(ledger, input)
  const pendingUser = `${root}/turn/${conversation.turns.length / 2 + 1}/user`
  const actual = { text: answer.text, status: answer.status, sourceRefs: answer.sourceRefs.filter(ref => ref !== pendingUser) }
  const expectedFields = expected ? { text: expected.text, status: expected.status, sourceRefs: expected.sourceRefs } : null
  const checks = [
    { kind: 'declared-source-operation', matches: expected !== null },
    { kind: 'returned-exact-text', matches: expected !== null && actual.text === expected.text },
    { kind: 'returned-scope-status', matches: expected !== null && actual.status === expected.status },
    { kind: 'source-addresses', matches: expected !== null && JSON.stringify(actual.sourceRefs) === JSON.stringify(expected.sourceRefs) },
    { kind: 'bound-source-records', matches: actual.sourceRefs.every(ref => ledger.records.some(record => record.address === ref)) },
  ]
  const status = !expected ? 'unresolved' : !checks.every(check => check.matches) ? 'failed' : expected.status === 'command-return' ? 'passed' : 'unresolved'
  const [sourceStateFingerprint, expectedFingerprint, actualFingerprint] = await Promise.all([fingerprint(ledger), expectedFields ? fingerprint(expectedFields) : Promise.resolve(null), fingerprint(actual)])
  return freeze({ format: 'ei-conversation-projection-check/v1', scope: 'retained-local-text-projection-consistency', status, origin: { ledgerRevision: ledger.revision, sourceStateFingerprint }, sourceRefs: actual.sourceRefs, checks, expectedFingerprint, actualFingerprint, note: 'Checks consistency of declared text projection with retained addressed sources. This does not verify world truth, source authenticity, or inferred intent.' })
}

function makeMessage(address: string, text: string, metadata: Metadata, id: string): EIConversationMessage {
  const source: EISource = { id, text, realm: metadata.role === 'user' ? USER_REALM : REPLY_REALM, locator: JSON.stringify(metadata) }
  return freeze({ address, role: metadata.role, text, sourceRefs: metadata.sourceRefs, status: metadata.status, turn: metadata.turn, source, corrections: [], currentText: text, ...(metadata.provenance ? { provenance: metadata.provenance } : {}), ...(metadata.evidence ? { evidence: metadata.evidence, ...evidenceFields(metadata.evidence) } : {}) })
}
function stopped(status: EIConversationStopped['status']): EIConversationStopped {
  return freeze({ status, reason: status === 'cancelled' ? 'This conversation turn was cancelled; no message or response was committed.' : 'The addressed conversation changed while the response was being prepared; prepare again from the current ledger.' })
}
function isAbort(error: unknown, signal: AbortSignal): boolean { return signal.aborted || (error instanceof Error && error.name === 'AbortError') }
function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const cancel = () => { const error = new Error('Conversation inference cancelled'); error.name = 'AbortError'; reject(error) }
    if (signal.aborted) { cancel(); return }
    signal.addEventListener('abort', cancel, { once: true })
    promise.then(value => { signal.removeEventListener('abort', cancel); resolve(value) }, error => { signal.removeEventListener('abort', cancel); reject(error) })
  })
}

/** Prepare an atomic user+reply capture; this function alone commits nothing. */
export async function prepareEIConversationTurn(options: EIConversationOptions): Promise<EIConversationPreparation> {
  const { ledger, root, adapter } = options
  const input = checkedText(options.input, 'input', EI_CONVERSATION_LIMITS.inputLength, true), id = checkedText(options.id, 'transaction ID', 200, true)
  if (new TextEncoder().encode(JSON.stringify(input)).length > EI_CONVERSATION_LIMITS.encodedInputBytes) fail('encoded input exceeds the atomic capture byte limit')
  const signal = options.signal ?? new AbortController().signal
  if (signal.aborted) return stopped('cancelled')
  const conversation = readEIConversation(ledger, root), snapshot = exportEILedger(ledger), turn = conversation.turns.length / 2 + 1
  const userAddress = checkedText(`${root}/turn/${turn}/user`, 'user address', 256, true), replyAddress = checkedText(`${root}/turn/${turn}/assistant`, 'reply address', 256, true)
  if (ledger.records.some(record => record.address === userAddress || record.address === replyAddress)) fail('next conversation address already belongs to another captured record')
  const previous = conversation.turns.at(-1), userRefs = previous ? [root, previous.address] : [root]
  const user = makeMessage(userAddress, input, { format: FORMAT, root, turn, role: 'user', sourceRefs: userRefs, status: 'captured' }, `${id}/user`)
  const context: EIInferenceContext = freeze({ ledger, conversation, userInput: { address: userAddress, text: input, source: user.source } })
  let output = contextualReturn(ledger, conversation, input) ?? commandReturn(ledger, input)
  if (!output) {
    try { output = await relationReturn(ledger, input) }
    catch (error) { output = unavailable(error instanceof Error && /exceed|bound|limit/i.test(error.message) ? 'The complete addressed answer exceeds the local output limit. The input remains context; no answer or proof was silently shortened.' : 'The local source derivation could not complete its self-check. The input remains context; no resolved answer or action was admitted.') }
  }
  if (!output && !adapter) output = unavailable('Your input is retained as context when this turn is committed. No implemented source-bound derivation resolves this message, so its meaning and intent remain open. I have not established an answer or selected an action.')
  if (!output && adapter) {
    try {
      const adapterId = checkedText(adapter.id, 'adapter ID', 256, true)
      const returned = plain(await abortable(Promise.resolve().then(() => adapter.infer(context, signal)), signal), 'adapter result')
      for (const key of Object.keys(returned)) if (!['text', 'provenance'].includes(key)) fail(`unexpected adapter result field: ${key}; generated text cannot authorize actions`)
      output = { text: checkedText(returned.text, 'adapter response', EI_CONVERSATION_LIMITS.outputLength, true), status: 'generated-unverified', sourceRefs: [...new Set([root, ...conversation.turns.map(message => message.address)])], provenance: provenance(returned.provenance, adapterId) }
      // Complete context is always supplied to inference. A source pointer to the
      // conversation root names the whole context when individual links are large.
      if (output.sourceRefs.length > EI_CONVERSATION_LIMITS.commandReferences) output = { ...output, sourceRefs: [root] }
    } catch (error) {
      if (isAbort(error, signal)) return stopped('cancelled')
      output = unavailable(`Inference unavailable: the selected adapter did not return a valid sourced response. ${error instanceof Error ? error.message : 'Adapter failure'}`)
      if (output.text.length > EI_CONVERSATION_LIMITS.outputLength) output = unavailable('Inference unavailable: the selected adapter failed. No generated answer or action was accepted.')
    }
  }
  if (!output!.evidence && output!.status !== 'generated-unverified') {
    try { output = { ...output!, evidence: { kind: 'source-projection', verification: await verifyEIConversationProjection(ledger, root, input, output!) } } }
    catch {
      const verification: EIUnavailableVerification = { format: 'ei-conversation-unavailable-check/v1', scope: 'retained-local-consistency-unavailable', status: 'unresolved', reason: 'The local consistency checker could not run. No fingerprint, passed check, or verified answer was produced.' }
      output = { ...unavailable('The local self-check is unavailable. Your input remains captured context with this feedback; no resolved answer or action was admitted.'), evidence: { kind: 'self-check-unavailable', verification } }
    }
  }
  if (signal.aborted) return stopped('cancelled')
  if (options.currentLedger && exportEILedger(options.currentLedger()) !== snapshot) return stopped('stale')
  if (output!.text.length > EI_CONVERSATION_LIMITS.outputLength) output = unavailable('The complete local response exceeds the output limit. No shortened answer or proof was substituted; the input remains available as context.')
  function replyFor(returned: ReturnContent): EIConversationMessage {
    const sourceRefs = [...new Set([user.address, ...returned.sourceRefs])]
    return makeMessage(replyAddress, returned.text, { format: FORMAT, root, turn, role: 'assistant', sourceRefs, status: returned.status, ...(returned.provenance ? { provenance: returned.provenance } : {}), ...(returned.evidence ? { evidence: returned.evidence } : {}) }, `${id}/reply`)
  }
  let reply = replyFor(output!)
  if ((reply.source.locator?.length ?? 0) > EI_LIMITS.textLength) {
    output = unavailable('The complete response metadata exceeds the local evidence limit. The input is retained; no partial answer or proof was admitted.')
    reply = replyFor(output)
  }
  const definition: EISource = { id: 'ei-conversation-capture/v1', text: 'Capture the exact user input and returned response as two separate source-linked records. Generated content is unverified data and grants no execution authority.', realm: 'local-implementation-definition' }
  function proposalFor(returned: EIConversationMessage): EIInput {
    return {
      id, producer: root, input: { id: `${id}/input`, text: input, realm: USER_REALM },
      // The engine binds the entire immutable ledger snapshot, including root
      // state. Duplicating a large root value as a condition is unnecessary.
      candidates: [{ id: 'capture-conversation-turn', label: 'Capture input and returned response', owner: 'engine', source: definition, conditions: [], patches: [
        { kind: 'create', address: user.address, value: user.text, source: user.source, parents: userRefs, relations: userRefs.map(address => ({ relation: 'conversation-context', address })) },
        { kind: 'create', address: returned.address, value: returned.text, source: returned.source, parents: [user.address], relations: returned.sourceRefs.map(address => ({ relation: address === user.address ? 'reply-to' : 'source-reference', address })) },
      ] }],
    }
  }
  let inputProposal = proposalFor(reply)
  if (new TextEncoder().encode(JSON.stringify(inputProposal)).length > EI_LIMITS.inputBytes) {
    output = unavailable('The complete response exceeds this atomic turn’s byte limit. The exact input is retained; no shortened generated response or proof was accepted.')
    reply = replyFor(output)
    inputProposal = proposalFor(reply)
  }
  const prepared: EIPreparedConversationTurn = freeze({ status: 'proposed', proposal: proposeEI(ledger, inputProposal), user, reply, context })
  preparedGuards.set(prepared, { snapshot, signal })
  return prepared
}

function guardFor(prepared: EIPreparedConversationTurn): Guard { const guard = preparedGuards.get(prepared); if (!guard) fail('turn was not produced by prepareEIConversationTurn'); return guard }
function recorded(ledger: EILedger, prepared: EIPreparedConversationTurn): boolean {
  const receipt = ledger.receipts.find(receipt => receipt.transactionId === prepared.proposal.input.id)
  return !!receipt && receipt.patches.some(patch => patch.address === prepared.user.address && patch.value === prepared.user.text) && receipt.patches.some(patch => patch.address === prepared.reply.address && patch.value === prepared.reply.text)
}
/** A later cancellation never retracts a turn already committed to this ledger. */
export function isEIConversationTurnCurrent(prepared: EIPreparedConversationTurn, ledger: EILedger): boolean {
  const guard = guardFor(prepared)
  return recorded(ledger, prepared) || (!guard.signal.aborted && exportEILedger(ledger) === guard.snapshot)
}
export function executeEIConversationTurn(ledger: EILedger, prepared: EIPreparedConversationTurn): EIConversationExecution {
  const guard = guardFor(prepared)
  if (!recorded(ledger, prepared)) {
    if (guard.signal.aborted) return stopped('cancelled')
    if (exportEILedger(ledger) !== guard.snapshot) return stopped('stale')
  }
  const result = executeEI(ledger, prepared.proposal)
  if (result.status === 'staged') stagedTurns.set(result, prepared)
  return result
}
/** Use this guard immediately before the engine's commit, after actual readback. */
export function commitEIConversationTurn(ledger: EILedger, prepared: EIPreparedConversationTurn, verification: EIVerification): EIConversationCommit {
  const guard = guardFor(prepared)
  if (stagedTurns.get(verification.execution) !== prepared) fail('verification belongs to another conversation turn')
  if (!recorded(ledger, prepared)) {
    if (guard.signal.aborted) return stopped('cancelled')
    if (exportEILedger(ledger) !== guard.snapshot) return stopped('stale')
  }
  const result = commitEI(ledger, verification)
  return result
}
