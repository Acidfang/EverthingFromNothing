/** Local addressed input capture. Retained historical replies remain readable; new input does not imply intent or a response. */
import {
  commitEI, executeEI, exportEILedger, importEILedger, proposeEI,
  type EIExecution, type EIInput, type EILedger, type EIProposal, type EIRecord,
  type EIResult, type EISource, type EIValueState, type EIVerification,
} from './ei-engine.ts'
import { parseEIQuery, verifyEIQueryAnswer, type EIQuery, type EIQueryAnswer, type EIQueryVerification } from './ei-relation-reasoner.ts'

export const EI_CONVERSATION_LIMITS = Object.freeze({ inputLength: 8_192, encodedInputBytes: 32_768, outputLength: 8_192, commandReferences: 64, phraseLength: 512 })
const FORMAT = 'ei-conversation-message/v1'
const USER_REALM = 'ei-conversation-user'
const REPLY_REALM = 'ei-conversation-reply'
export type EIConversationStatus = 'capture-only' | 'captured' | 'command-return' | 'inference-unavailable' | 'generated-unverified'
export type EIInferenceProvenance = Readonly<{ adapterId: string; sourceId: string; model?: string; requestId?: string }>
export type EIProjectionVerification = Readonly<{
  format: 'ei-conversation-projection-check/v1'; scope: 'retained-local-text-projection-consistency';
  status: 'passed' | 'failed' | 'unresolved'; origin: Readonly<{ ledgerRevision: number; sourceStateFingerprint: string }>;
  sourceRefs: readonly string[]; checks: readonly Readonly<{ kind: string; matches: boolean }>[];
  expectedFingerprint: string | null; actualFingerprint: string; note: string;
}>
export type EIUnavailableVerification = Readonly<{ format: 'ei-conversation-unavailable-check/v1'; scope: 'retained-local-consistency-unavailable'; status: 'unresolved'; reason: string }>
/** Interface-selected syntax, not a recovered historical symbol spelling. */
export const EI_PHRASE_BINDING_GRAMMAR = 'bind "exact phrase" to <declared relation query>'
export type EIPhraseBinding = Readonly<{
  format: 'ei-phrase-binding/v1'; root: string; realm: string | null; phrase: string;
  query: EIQuery; definitionAddress: string; definitionSourceId: string;
}>
export type EISourcedPhraseBinding = EIPhraseBinding & Readonly<{ replyAddress: string }>
export type EIPhraseBindings = Readonly<{ bindings: readonly EISourcedPhraseBinding[]; unresolved: readonly Readonly<{ address: string; reason: string; kind: 'source-corrected' | 'invalid-definition' }>[] }>
export type EIConversationEvidence = Readonly<{ kind: 'phrase-binding'; binding: EIPhraseBinding; answer: EIQueryAnswer; verification: EIQueryVerification }> | Readonly<{ kind: 'bound-query'; bindings: readonly EISourcedPhraseBinding[]; query: EIQuery; answer: EIQueryAnswer; verification: EIQueryVerification }> | Readonly<{ kind: 'self-check-unavailable'; verification: EIUnavailableVerification }> | Readonly<{ kind: 'source-projection'; verification: EIProjectionVerification }> | Readonly<{ kind: 'addressed-relation-query'; query: EIQuery; answer: EIQueryAnswer; verification: EIQueryVerification }>
export type EIConversationMessage = Readonly<{
  address: string; role: 'user' | 'assistant'; text: string; sourceRefs: readonly string[];
  status: EIConversationStatus; turn: number; source: EISource; corrections: readonly EIValueState[]; currentText: string; provenance?: EIInferenceProvenance; evidence?: EIConversationEvidence; selfCheck?: EIProjectionVerification | EIQueryVerification | EIUnavailableVerification; derivation?: EIQueryAnswer; binding?: EIPhraseBinding; bindingSources?: readonly EISourcedPhraseBinding[];
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
  status: 'proposed'; mode: 'capture-only'; proposal: EIProposal; user: EIConversationMessage;
  reply: null; context: EIInferenceContext;
}>
export type EIConversationStopped = Readonly<{ status: 'cancelled' | 'stale'; reason: string }>
export type EIConversationPreparation = EIPreparedConversationTurn | EIConversationStopped
export type EIConversationExecution = EIExecution | EIResult | EIConversationStopped
export type EIConversationCommit = EIResult | EIConversationStopped
export type EIConversationOptions = Readonly<{
  ledger: EILedger; root: string; input: string; id: string; signal?: AbortSignal;
  /** Optional live state accessor rejects capture prepared from an obsolete snapshot. */
  currentLedger?: () => EILedger;
  inputOrigin?: Readonly<{id:string;locator:string;text:string}>;
}>
type Metadata = Readonly<{
  format: typeof FORMAT; root: string; turn: number; role: 'user' | 'assistant';
  inputOrigin?: Readonly<{id:string;locator:string}>; sourceRefs: readonly string[]; status: EIConversationStatus; provenance?: EIInferenceProvenance; evidence?: EIConversationEvidence;
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
  if(meta.inputOrigin!==undefined){const origin=plain(meta.inputOrigin,'input origin');checkedText(origin.id,'origin id',256,true);checkedText(origin.locator,'origin locator',100000,true)}
  if (meta.format !== FORMAT) fail(`unsupported conversation metadata at ${record.address}`)
  if (meta.root !== root) return null
  for (const key of Object.keys(meta)) if (!['format', 'root', 'turn', 'role', 'sourceRefs', 'status', 'provenance', 'evidence', 'inputOrigin'].includes(key)) fail(`unexpected message metadata field: ${key}`)
  if (!Number.isSafeInteger(meta.turn) || (meta.turn as number) < 1) fail('message turn must be a positive safe integer')
  if (meta.role !== 'user' && meta.role !== 'assistant') fail('invalid conversation role')
  const expectedRealm = meta.role === 'user' ? USER_REALM : REPLY_REALM
  if (captured.source.realm !== expectedRealm || captured.value !== captured.source.text) fail('message role or exact source text does not match its captured record')
  if (!Array.isArray(meta.sourceRefs) || meta.sourceRefs.length > EI_CONVERSATION_LIMITS.commandReferences + 2) fail('invalid message source references')
  const sourceRefs = meta.sourceRefs.map(item => checkedText(item, 'source reference', 256, true))
  if (new Set(sourceRefs).size !== sourceRefs.length) fail('duplicate message source references')
  const statuses = ['capture-only', 'captured', 'command-return', 'inference-unavailable', 'generated-unverified']
  if (!statuses.includes(meta.status as string) || (meta.role === 'user') !== (meta.status === 'captured' || meta.status === 'capture-only')) fail('invalid captured message status')
  if ((meta.status === 'generated-unverified') !== (meta.provenance !== undefined)) fail('generated content must retain adapter provenance without becoming verified authority')
  return freeze({ format: FORMAT, root, turn: meta.turn as number, role: meta.role, sourceRefs, status: meta.status as EIConversationStatus, ...(meta.inputOrigin===undefined?{}:{inputOrigin:meta.inputOrigin as {id:string;locator:string}}), ...(meta.provenance === undefined ? {} : { provenance: provenance(meta.provenance) }), ...(meta.evidence === undefined ? {} : { evidence: readEvidence(meta.evidence) }) })
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
  const byAddress = new Map(ledger.records.map(record => [record.address, record]))
  let previous: EIConversationMessage | undefined, previousRevision = -1
  for (let i = 0; i < turns.length;) {
    const user = turns[i++]
    if (user.role !== 'user' || (previous && user.turn <= previous.turn)) fail('conversation order is incomplete or duplicated')
    const next = turns[i], reply = next?.turn === user.turn ? next : undefined
    if (reply) {
      if (reply.role !== 'assistant' || user.status !== 'captured') fail('conversation order is incomplete or duplicated')
      i++
    } else if (user.status !== 'capture-only') fail('conversation history contains an incomplete turn')
    if (turns[i]?.turn === user.turn) fail('conversation order is incomplete or duplicated')
    const userRecord = byAddress.get(user.address)!, userCapture = userRecord.was[0] ?? userRecord.is
    if (!userRecord.parents.includes(root) || !user.sourceRefs.includes(root)) fail('conversation parent/source links are broken')
    if (previous && (!userRecord.parents.includes(previous.address) || !user.sourceRefs.includes(previous.address))) fail('conversation does not link to its previous retained message')
    if (userCapture.revision <= previousRevision) fail('conversation turn order does not match capture receipts')
    const messages = reply ? [user, reply] : [user]
    for (const message of messages) for (const ref of message.sourceRefs) if (!byAddress.has(ref)) fail(`conversation source reference is unbound: ${ref}`)
    if (reply) {
      const replyRecord = byAddress.get(reply.address)!, replyCapture = replyRecord.was[0] ?? replyRecord.is
      if (!replyRecord.parents.includes(user.address) || !reply.sourceRefs.includes(user.address)) fail('conversation parent/source links are broken')
      if (userCapture.revision !== replyCapture.revision) fail('input and response lack one atomic conversation receipt')
    }
    const receipt = ledger.receipts.find(receipt => receipt.status === 'committed' && receipt.producer === root && receipt.resultRevision === userCapture.revision && messages.every(message => receipt.patches.some(patch => patch.kind === 'create' && patch.address === message.address && patch.value === message.text && JSON.stringify(patch.source) === JSON.stringify(message.source))))
    if (!receipt || !byAddress.get(root)!.receiptIds.includes(receipt.id)) fail('conversation capture lacks its returned source receipt')
    if(!reply){
      const origin=readMetadata(userRecord,root)?.inputOrigin
      if(!origin&&receipt.patches.length!==1)fail('capture-only turn must retain one addressed input patch')
      if(origin){const address=`${user.address}/source`,sourceRecord=byAddress.get(address),sourceState=sourceRecord&&(sourceRecord.was[0]??sourceRecord.is);if(receipt.patches.length!==2||!user.sourceRefs.includes(address)||!sourceState||sourceState.source.realm!=='android-explicit-intent'||sourceState.source.id!==origin.id||sourceState.source.locator!==origin.locator||sourceState.value!==sourceState.source.text||!receipt.patches.some(patch=>patch.address===address&&patch.kind==='create'&&patch.value===sourceState.value&&JSON.stringify(patch.source)===JSON.stringify(sourceState.source)))fail('native input origin lacks its exact atomic source receipt')}
    }
    previous = reply ?? user
    previousRevision = userCapture.revision
  }
  return freeze({ root, turns })
}

// Historical projection helpers below are used only by the explicit legacy verifier.
// prepareEIConversationTurn never dispatches input to them.
type ReturnContent = Readonly<{ text: string; status: Exclude<EIConversationStatus, 'captured' | 'capture-only'>; sourceRefs: readonly string[]; provenance?: EIInferenceProvenance; evidence?: EIConversationEvidence }>
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

function evidenceFields(evidence: EIConversationEvidence): { selfCheck: EIProjectionVerification | EIQueryVerification | EIUnavailableVerification; derivation?: EIQueryAnswer; binding?: EIPhraseBinding; bindingSources?: readonly EISourcedPhraseBinding[] } {
  return { selfCheck: evidence.verification, ...('answer' in evidence ? { derivation: evidence.answer } : {}), ...(evidence.kind === 'phrase-binding' ? { binding: evidence.binding } : {}), ...(evidence.kind === 'bound-query' ? { bindingSources: evidence.bindings } : {}) }
}
function readEvidence(value: unknown): EIConversationEvidence {
  const evidence = plain(value, 'conversation evidence')
  if (evidence.kind !== 'source-projection' && evidence.kind !== 'addressed-relation-query' && evidence.kind !== 'self-check-unavailable' && evidence.kind !== 'phrase-binding' && evidence.kind !== 'bound-query') fail('unknown conversation evidence kind')
  const allowed = evidence.kind === 'phrase-binding' ? ['kind', 'binding', 'answer', 'verification'] : evidence.kind === 'bound-query' ? ['kind', 'bindings', 'query', 'answer', 'verification'] : evidence.kind === 'addressed-relation-query' ? ['kind', 'query', 'answer', 'verification'] : ['kind', 'verification']
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
  const pendingUser = `${root}/turn/${nextTurn(conversation)}/user`
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
function nextTurn(conversation: EIConversation): number {
  const turn = Math.max(0, ...conversation.turns.map(message => message.turn)) + 1
  if (!Number.isSafeInteger(turn)) fail('conversation turn ID exceeds the safe integer bound')
  return turn
}

/** Prepare one raw input capture. No source-defined intent/reply reducer is bound. */
export async function prepareEIConversationTurn(options: EIConversationOptions): Promise<EIConversationPreparation> {
  const { ledger, root } = options
  const input = checkedText(options.input, 'input', EI_CONVERSATION_LIMITS.inputLength, true), id = checkedText(options.id, 'transaction ID', 200, true)
  if (new TextEncoder().encode(JSON.stringify(input)).length > EI_CONVERSATION_LIMITS.encodedInputBytes) fail('encoded input exceeds the atomic capture byte limit')
  const signal = options.signal ?? new AbortController().signal
  if (signal.aborted) return stopped('cancelled')
  const conversation = readEIConversation(ledger, root), snapshot = exportEILedger(ledger), turn = nextTurn(conversation)
  const userAddress = checkedText(`${root}/turn/${turn}/user`, 'user address', 256, true)
  if (ledger.records.some(record => record.address === userAddress)) fail('next conversation address already belongs to another captured record')
  const originAddress=options.inputOrigin?checkedText(`${userAddress}/source`,'input source address',256,true):null
  if(options.inputOrigin&&ledger.records.some(record=>{const state=record.was[0]??record.is;return state.source.realm==='android-explicit-intent'&&state.source.id===options.inputOrigin!.id}))fail('phone input occurrence is already retained')
  const previous = conversation.turns.at(-1), userRefs = [...(previous ? [root, previous.address] : [root]),...(originAddress?[originAddress]:[])]
  const user = makeMessage(userAddress, input, { format: FORMAT, root, turn, role: 'user', sourceRefs: userRefs, status: 'capture-only', ...(options.inputOrigin?{inputOrigin:{id:checkedText(options.inputOrigin.id,'origin id',256,true),locator:checkedText(options.inputOrigin.locator,'origin locator',100000,true)}}:{}) }, `${id}/user`)
  const context: EIInferenceContext = freeze({ ledger, conversation, userInput: { address: userAddress, text: input, source: user.source } })
  if (signal.aborted) return stopped('cancelled')
  if (options.currentLedger && exportEILedger(options.currentLedger()) !== snapshot) return stopped('stale')
  const definition: EISource = { id: 'ei-conversation-input-capture/v1', text: JSON.stringify({ operation: 'capture-input', intent: 'unbound', reply: 'absent' }), realm: 'local-implementation-definition' }
  const inputProposal: EIInput = {
    id, producer: root, input: { id: `${id}/input`, text: input, realm: USER_REALM },
    // The issued proposal binds the entire ledger snapshot, including history,
    // relations and receipts. The patch records raw input without interpreting it.
    candidates: [{ id: 'capture-conversation-input', label: 'capture-only', owner: 'engine', source: definition, conditions: [], patches: [
      ...(options.inputOrigin&&originAddress?[{kind:'create' as const,address:originAddress,value:checkedText(options.inputOrigin.text,'original input',EI_CONVERSATION_LIMITS.inputLength,true),source:{id:options.inputOrigin.id,text:options.inputOrigin.text,realm:'android-explicit-intent',locator:options.inputOrigin.locator},parents:[root],relations:[]}]:[]),
      { kind: 'create', address: user.address, value: user.text, source: user.source, parents: userRefs, relations: userRefs.map(address => ({ relation: 'conversation-context', address })) },
    ] }],
  }
  const prepared: EIPreparedConversationTurn = freeze({ status: 'proposed', mode: 'capture-only', proposal: proposeEI(ledger, inputProposal), user, reply: null, context })
  preparedGuards.set(prepared, { snapshot, signal })
  return prepared
}

function guardFor(prepared: EIPreparedConversationTurn): Guard { const guard = preparedGuards.get(prepared); if (!guard) fail('turn was not produced by prepareEIConversationTurn'); return guard }
function recorded(ledger: EILedger, prepared: EIPreparedConversationTurn): boolean {
  exportEILedger(ledger)
  const receipt = ledger.receipts.find(receipt => receipt.status === 'committed' && receipt.transactionId === prepared.proposal.input.id)
  return !!receipt && receipt.producer === prepared.proposal.input.producer && JSON.stringify(receipt.source) === JSON.stringify(prepared.proposal.input.input) && JSON.stringify(receipt.patches) === JSON.stringify(prepared.proposal.input.candidates[0].patches)
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

function parseBindingDefinition(input: string): { phrase: string; query: EIQuery } | null {
  const match = /^bind\s+("(?:[^"\\\u0000-\u001f]|\\(?:["\\/bfnrt]|u[0-9a-fA-F]{4}))*")\s+to\s+([\s\S]+)$/.exec(input.trim())
  if (!match) return null
  const phrase = checkedText(JSON.parse(match[1]), 'bound phrase', EI_CONVERSATION_LIMITS.phraseLength, true)
  const parsed = parseEIQuery(match[2])
  return parsed.status === 'parsed' ? { phrase, query: parsed.query } : null
}
function reservedPhrase(phrase: string): boolean {
  const trimmed = phrase.trim()
  return /^what is [\s\S]+\?$/i.test(trimmed) || trimmed.startsWith('/') || /^bind(?:\s|$)/.test(trimmed) || EI_CONTEXT_QUERY_FORMS.some(form => form.toLowerCase() === trimmed.toLowerCase()) || parseEIQuery(phrase).status === 'parsed'
}
function bindingRealm(ledger: EILedger, root: string): string | null { return ledger.records.find(record => record.address === root)!.is.source.realm ?? null }

/** Reconstruct a retained historical snapshot; this does not apply an inverse edit. */
function ledgerAt(ledger: EILedger, revision: number): EILedger {
  if (!Number.isSafeInteger(revision) || revision < 0 || revision > ledger.revision) fail('invalid binding definition revision')
  const receipts = ledger.receipts.filter(receipt => receipt.resultRevision <= revision), receiptIds = new Set(receipts.map(receipt => receipt.id))
  const records = ledger.records.flatMap(record => {
    const states = [...record.was, record.is].filter(state => state.revision <= revision)
    if (!states.length) return []
    return [{ ...record, was: states.slice(0, -1), is: states.at(-1)!, receiptIds: record.receiptIds.filter(id => receiptIds.has(id)) }]
  })
  return importEILedger(JSON.stringify({ ...ledger, revision, receipts, records }))
}

/** Inspect historical definitions only. New conversation input never activates or invokes these bindings. */
export async function readEIPhraseBindings(ledger: EILedger, root: string, phrase?: string): Promise<EIPhraseBindings> {
  const conversation = readEIConversation(ledger, root), realm = bindingRealm(ledger, root)
  const bindings: EISourcedPhraseBinding[] = [], unresolved: { address: string; reason: string; kind: 'source-corrected' | 'invalid-definition' }[] = []
  for (const message of conversation.turns) {
    if (message.role !== 'assistant' || message.evidence?.kind !== 'phrase-binding') continue
    const evidence = message.evidence, definition = conversation.turns.find(turn => turn.turn === message.turn && turn.role === 'user')!
    try {
      const parsed = parseBindingDefinition(definition.text)
      if (phrase !== undefined && parsed?.phrase !== phrase) continue
      if (!parsed || reservedPhrase(parsed.phrase)) fail('definition is not a permitted explicit phrase binding')
      if (definition.currentText !== definition.text || message.currentText !== message.text) { unresolved.push({ address: definition.address, kind: 'source-corrected', reason: 'The addressed definition or returned proof was explicitly corrected. Its original binding is inactive; retain the correction and define a new sourced binding if wanted.' }); continue }
      const binding = plain(evidence.binding, 'phrase binding')
      for (const key of Object.keys(binding)) if (!['format', 'root', 'realm', 'phrase', 'query', 'definitionAddress', 'definitionSourceId'].includes(key)) fail(`unexpected binding field: ${key}`)
      if (binding.format !== 'ei-phrase-binding/v1' || binding.root !== root || binding.phrase !== parsed.phrase || binding.definitionAddress !== definition.address || binding.definitionSourceId !== definition.source.id || JSON.stringify(binding.query) !== JSON.stringify(parsed.query)) fail('binding does not match its addressed user definition')
      if (binding.realm !== null && typeof binding.realm !== 'string') fail('invalid binding source realm')
      if (message.status !== 'command-return' || message.provenance !== undefined || evidence.answer.status !== 'resolved' || evidence.verification.status !== 'passed') fail('binding has no successful source-derived definition')
      const record = ledger.records.find(record => record.address === definition.address)!, captured = record.was[0] ?? record.is
      const original = ledgerAt(ledger, captured.revision - 1)
      if (bindingRealm(original, root) !== binding.realm) fail('binding realm does not match its historical definition source')
      // Another realm's valid definition is not imported into the current realm.
      if (binding.realm !== realm) continue
      const verification = await verifyEIQueryAnswer(original, parsed.query, evidence.answer)
      if (verification.status !== 'passed' || JSON.stringify(verification) !== JSON.stringify(evidence.verification)) fail('retained binding proof failed historical source consistency checks')
      bindings.push({ ...(binding as EIPhraseBinding), replyAddress: message.address })
    } catch (error) { unresolved.push({ address: definition.address, kind: 'invalid-definition', reason: error instanceof Error ? error.message : 'Binding source verification is unavailable' }) }
  }
  return freeze({ bindings, unresolved })
}

