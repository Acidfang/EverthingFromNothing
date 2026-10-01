import { EI_LIMITS, exportEILedger, importEILedger, proposeEI, type EILedger, type EIProposal } from './ei-engine.ts'

export type EIPageAttempt = Readonly<{ transactionId: string; producer: string; phase: 'engine' | 'render' | 'storage'; message: string; detail: string; committed: false }>
export const EI_SESSION_LIMITS = Object.freeze({ storedBytes: 1_048_576, expandedBytes: EI_LIMITS.jsonBytes + 1_048_576, tableEntries: 65_536, references: 250_000, expandedNodes: 250_000, depth: 32, referenceDepth: 64 })
type JSONValue = null | boolean | number | string | JSONValue[] | { [key: string]: JSONValue }
/** Positional IDs are not cryptographic hashes. Interning uses exact equality. */
type ValueNode = ['z'] | ['b', boolean] | ['n', number] | ['s', string] | ['a', number[]] | ['o', [number, number][]] | ['j', number]
type ValueTable = { document: number; values: ValueNode[] }
type Cost = { bytes: number; nodes: number; depth: number; referenceDepth: number }
const encoder = new TextEncoder(), unsafeKeys = new Set(['__proto__', 'prototype', 'constructor'])
function fail(message: string): never { throw new Error(`EI session: ${message}`) }
function bytes(value: string): number { return encoder.encode(value).length }
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) fail('expected a plain object')
  return value as Record<string, unknown>
}
function fields(value: Record<string, unknown>, names: string[]): void {
  if (Object.keys(value).sort().join(',') !== [...names].sort().join(',')) fail('unsupported envelope fields')
}
function normalizable(value: JSONValue, depth = 0): boolean {
  if (depth > EI_SESSION_LIMITS.depth) return false
  if (!value || typeof value !== 'object') return true
  if (Array.isArray(value)) return value.every(child => normalizable(child, depth + 1))
  return Object.entries(value).every(([key, child]) => !unsafeKeys.has(key) && normalizable(child, depth + 1))
}
/** JSON.parse alone discards duplicate raw keys. Inspect quoted keys first so
 * ambiguous envelopes cannot silently select the last duplicate. */
function parseStrictJSON(raw: string): unknown {
  const stack: { object: boolean; key: boolean; keys: Set<string> }[] = []
  for (let index = 0; index < raw.length; index++) {
    const char = raw[index]
    if (char === '"') {
      const start = index++
      while (index < raw.length && raw[index] !== '"') { if (raw[index] === '\\') index++; index++ }
      const frame = stack.at(-1)
      if (frame?.object && frame.key) {
        const key = JSON.parse(raw.slice(start, index + 1)) as string
        if (frame.keys.has(key)) fail('duplicate raw object key')
        frame.keys.add(key); frame.key = false
      }
    } else if (char === '{' || char === '[') {
      if (stack.length >= EI_SESSION_LIMITS.referenceDepth) fail('wire JSON depth exceeds bounds')
      stack.push({ object: char === '{', key: char === '{', keys: new Set() })
    } else if (char === '}' || char === ']') stack.pop()
    else if (char === ',' && stack.at(-1)?.object) stack.at(-1)!.key = true
  }
  return JSON.parse(raw)
}

/** Long canonical JSON strings share subtrees only when parse/stringify returns
 * their EXACT original text. Other text remains literal. No source is summarized. */
function pack(document: JSONValue, normalizeJSONStrings = true): ValueTable {
  const values: ValueNode[] = [], seen = new Map<string, number>(), strings = [new Map<string, number>(), new Map<string, number>()]
  let references = 0, tableBytes = 2
  function rollback(length: number, referenceCount: number, size: number, stringSizes: number[]): void {
    values.length = length; references = referenceCount; tableBytes = size
    for (const [key, id] of seen) if (id >= length) seen.delete(key)
    strings.forEach((cache, index) => {
      let position = 0
      for (const key of cache.keys()) if (position++ >= stringSizes[index]) cache.delete(key)
    })
  }
  function add(value: JSONValue, depth = 0, normalizeStrings = true): number {
    if (depth > EI_SESSION_LIMITS.referenceDepth) fail('reference depth exceeds bounds')
    let node: ValueNode
    if (value === null) node = ['z']
    else if (typeof value === 'string') {
      const prior = strings[+normalizeStrings].get(value)
      if (prior !== undefined) return prior
      let canonical: JSONValue | undefined
      if (normalizeStrings && value.length >= 256 && (value.startsWith('{') || value.startsWith('['))) {
        try { const parsed = JSON.parse(value) as JSONValue; if (JSON.stringify(parsed) === value && normalizable(parsed)) canonical = parsed } catch { /* Preserve source text literally. */ }
      }
      node = ['s', value]
      if (canonical !== undefined) {
        const length = values.length, referenceCount = references, size = tableBytes, stringSizes = strings.map(cache => cache.size)
        try {
          // Only one decoding layer; nested source strings remain literal.
          const candidate: ValueNode = ['j', add(canonical, depth + 1, false)]
          const encodedCandidate = JSON.stringify(candidate), encodedLiteral = JSON.stringify(node)
          const candidateBytes = tableBytes - size + (seen.has(encodedCandidate) ? 0 : bytes(encodedCandidate) + (values.length ? 1 : 0))
          const literalBytes = seen.has(encodedLiteral) && seen.get(encodedLiteral)! < length ? 0 : bytes(encodedLiteral) + (length ? 1 : 0)
          if (candidateBytes < literalBytes) node = candidate
          else rollback(length, referenceCount, size, stringSizes)
        } catch { rollback(length, referenceCount, size, stringSizes) }
      }
    } else if (typeof value === 'number') {
      if (!Number.isFinite(value)) fail('non-finite JSON number')
      node = ['n', value]
    } else if (typeof value === 'boolean') node = ['b', value]
    else if (Array.isArray(value)) node = ['a', value.map(child => add(child, depth + 1, normalizeStrings))]
    else {
      const record = object(value)
      node = ['o', Object.entries(record).map(([key, child]) => {
        if (unsafeKeys.has(key)) fail('unsafe object key')
        return [add(key, depth + 1, normalizeStrings), add(child as JSONValue, depth + 1, normalizeStrings)] as [number, number]
      })]
    }
    const encoded = JSON.stringify(node), previous = seen.get(encoded)
    if (previous !== undefined) { if (typeof value === 'string') strings[+normalizeStrings].set(value, previous); return previous }
    if (values.length >= EI_SESSION_LIMITS.tableEntries) fail('content table exceeds bounds')
    references += node[0] === 'a' ? node[1].length : node[0] === 'o' ? node[1].length * 2 : node[0] === 'j' ? 1 : 0
    if (references > EI_SESSION_LIMITS.references) fail('reference count exceeds bounds')
    const id = values.length
    tableBytes += bytes(encoded) + (id ? 1 : 0)
    values.push(node); seen.set(encoded, id)
    if (typeof value === 'string') strings[+normalizeStrings].set(value, id)
    return id
  }
  return { document: add(document, 0, normalizeJSONStrings), values }
}

/** Backward references make cycles impossible. Check expansion costs before
 * assembling containers; generated JSON strings have an aggregate allocation cap. */
function unpack(envelope: Record<string, unknown>): JSONValue {
  if (!Array.isArray(envelope.values) || !envelope.values.length || envelope.values.length > EI_SESSION_LIMITS.tableEntries) fail('invalid content table')
  const table = envelope.values, decoded: JSONValue[] = [], costs: Cost[] = []
  let references = 0, materializedStringBytes = 0
  const maximum = EI_SESSION_LIMITS.expandedBytes
  function ref(value: unknown, index: number): number {
    if (!Number.isSafeInteger(value) || (value as number) < 0 || (value as number) >= index) fail('invalid, forward, or cyclic content reference')
    if (++references > EI_SESSION_LIMITS.references) fail('reference count exceeds bounds')
    return value as number
  }
  function bound(cost: Cost): void {
    if (cost.bytes > maximum || cost.nodes > EI_SESSION_LIMITS.expandedNodes || cost.depth > EI_SESSION_LIMITS.depth || cost.referenceDepth > EI_SESSION_LIMITS.referenceDepth) fail('expanded content exceeds byte, node, or depth bounds')
  }
  for (let index = 0; index < table.length; index++) {
    const node = table[index]
    if (!Array.isArray(node) || typeof node[0] !== 'string') fail('invalid content node')
    const tag = node[0]
    if (node.length !== (tag === 'z' ? 1 : 2)) fail('invalid content node arity')
    let value: JSONValue, cost: Cost
    if (tag === 'z' || tag === 'b' || tag === 'n' || tag === 's') {
      value = tag === 'z' ? null : node[1]
      if ((tag === 'b' && typeof value !== 'boolean') || (tag === 'n' && (typeof value !== 'number' || !Number.isFinite(value))) || (tag === 's' && typeof value !== 'string')) fail('invalid primitive content node')
      const size = bytes(JSON.stringify(value))
      cost = { bytes: size, nodes: 1, depth: 0, referenceDepth: 0 }
      if (typeof value === 'string') materializedStringBytes += size
    } else if (tag === 'a' || tag === 'o') {
      if (!Array.isArray(node[1])) fail('invalid container content node')
      const entries = node[1], refs: number[] = [], keys: string[] = [], keySet = new Set<string>()
      if (tag === 'a') for (const item of entries) refs.push(ref(item, index))
      else for (const pair of entries) {
        if (!Array.isArray(pair) || pair.length !== 2) fail('invalid object member')
        const key = decoded[ref(pair[0], index)]
        if (typeof key !== 'string' || unsafeKeys.has(key) || keySet.has(key)) fail('invalid, unsafe, or duplicate object key')
        keySet.add(key); keys.push(key); refs.push(ref(pair[1], index))
      }
      cost = { bytes: 2 + Math.max(0, refs.length - 1), nodes: 1, depth: 1, referenceDepth: 1 }
      refs.forEach((reference, at) => {
        const child = costs[reference]
        cost.bytes += child.bytes + (tag === 'o' ? bytes(JSON.stringify(keys[at])) + 1 : 0)
        cost.nodes += child.nodes
        cost.depth = Math.max(cost.depth, child.depth + 1)
        cost.referenceDepth = Math.max(cost.referenceDepth, child.referenceDepth + 1)
        bound(cost)
      })
      if (tag === 'a') value = refs.map(reference => decoded[reference])
      else {
        const record = Object.create(null) as { [key: string]: JSONValue }
        refs.forEach((reference, at) => { record[keys[at]] = decoded[reference] })
        value = record
      }
    } else if (tag === 'j') {
      const reference = ref(node[1], index), target = decoded[reference]
      if (!target || typeof target !== 'object') fail('JSON-string reference must name an object or array')
      // The child's already checked expansion bounds this temporary string.
      value = JSON.stringify(target)
      if (value.length < 256) fail('noncanonical JSON-string node')
      const size = bytes(JSON.stringify(value))
      materializedStringBytes += size
      cost = { bytes: size, nodes: 1, depth: 0, referenceDepth: costs[reference].referenceDepth + 1 }
    } else fail('unknown content node type')
    bound(cost)
    if (materializedStringBytes > maximum * 2) fail('materialized string allocation exceeds bounds')
    decoded.push(value); costs.push(cost)
  }
  if (envelope.document !== table.length - 1) fail('document must be the final content reference')
  const document = decoded[table.length - 1]
  // Exact canonical equality rejects unused/duplicate nodes and alternate aliases.
  // This checks representation integrity, not authentication of imported data.
  const canonical = pack(document, envelope.stringMode === 'canonical')
  if (canonical.document !== envelope.document || JSON.stringify(canonical.values) !== JSON.stringify(table)) fail('noncanonical or unused content references')
  return document
}

export function saveEISession(root: string, ledger: EILedger, pending: EIProposal | null, attempts: readonly EIPageAttempt[]): string {
  if (!ledger.records.some(record => record.address === root && !record.parents.length)) fail('session root is not a retained root address')
  const document = { root, ledger: JSON.parse(exportEILedger(ledger)), pending: pending?.input ?? null, attempts } as unknown as JSONValue
  let rejected: unknown
  for (const stringMode of ['canonical', 'literal'] as const) {
    try {
      const json = JSON.stringify({ format: 'ei-page-session/v2', root, stringMode, ...pack(document, stringMode === 'canonical') })
      if (bytes(json) > EI_SESSION_LIMITS.storedBytes) fail('stored session exceeds 1 MiB; retained state was not changed')
      restoreEISession(json) // Never create a session whose recovery rejects.
      return json
    } catch (error) { rejected = error }
  }
  // Optional JSON-string normalization may cost more space or graph depth than
  // literal sharing. Retrying that lossless representation preserves old data.
  throw rejected
}

export function restoreEISession(json: string) {
  if (typeof json !== 'string' || bytes(json) > EI_SESSION_LIMITS.storedBytes) fail('stored session exceeds 1 MiB')
  const envelope = object(parseStrictJSON(json))
  let value: Record<string, unknown>, ledgerJSON: string
  if (envelope.format === 'ei-page-session/v1') {
    fields(envelope, ['format', 'root', 'ledger', 'pending', 'attempts'])
    if (typeof envelope.ledger !== 'string') fail('invalid legacy ledger encoding')
    value = envelope; ledgerJSON = envelope.ledger
  } else if (envelope.format === 'ei-page-session/v2') {
    fields(envelope, ['format', 'root', 'stringMode', 'document', 'values'])
    if (envelope.stringMode !== 'canonical' && envelope.stringMode !== 'literal') fail('unsupported string normalization mode')
    value = object(unpack(envelope))
    fields(value, ['root', 'ledger', 'pending', 'attempts'])
    if (value.root !== envelope.root) fail('envelope root differs from the referenced document')
    ledgerJSON = JSON.stringify(value.ledger)
  } else fail('unsupported session format')
  if (typeof value.root !== 'string') fail('invalid session root')
  const ledger = importEILedger(ledgerJSON)
  if (!ledger.records.some(record => record.address === value.root && !record.parents.length)) fail('session root does not match the retained ledger')
  const pending = value.pending === null ? null : proposeEI(ledger, value.pending as Parameters<typeof proposeEI>[1])
  if (!Array.isArray(value.attempts) || value.attempts.length > 512) fail('invalid attempt history')
  const attempts: readonly EIPageAttempt[] = Object.freeze(value.attempts.map((item: unknown) => {
    const a = object(item)
    fields(a, ['transactionId', 'producer', 'phase', 'message', 'detail', 'committed'])
    if (a.committed !== false || !['engine', 'render', 'storage'].includes(String(a.phase)) || ['transactionId', 'producer', 'message', 'detail'].some(key => typeof a[key] !== 'string')) fail('invalid attempt record')
    if ((a.transactionId as string).length > 256 || (a.producer as string).length > 256 || (a.message as string).length > 8192 || (a.detail as string).length > 524288) fail('attempt record exceeds bounds')
    return Object.freeze({ ...a }) as EIPageAttempt
  }))
  const ids = [...ledger.receipts.map(receipt => receipt.transactionId), ...(pending ? [pending.input.id] : []), ...attempts.map(attempt => attempt.transactionId)]
  const numbers = ids.map(id => {
    const n = Number(id.match(/local-proposal\/(\d+)$/)?.[1] ?? 0)
    if (!Number.isSafeInteger(n) || n >= Number.MAX_SAFE_INTEGER - 1) fail('local proposal sequence exceeds safe bounds')
    return n
  })
  return Object.freeze({ root: value.root, ledger, pending, attempts, nextSequence: Math.max(0, ...numbers) + 1 })
}
