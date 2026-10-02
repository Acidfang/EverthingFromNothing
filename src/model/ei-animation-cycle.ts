import {createEIThreadDrawPlan, type EIThreadDrawPlan} from './ei-thread-draw.ts'
import {projectEIThreadDrawFrame} from './ei-thread-draw-frame.ts'

/** These are addressed renderer states. They neither advance the retained ledger
 * nor certify that a model/world field is complete. No wall clock enters this API. */
export type EIAnimationSource = Readonly<{
  entityAddress: string; revision: number; sourceId: string; snapshotKey: string;
}>
export type EIAnimationRetained = Readonly<{nodes: readonly string[]; edges: readonly string[]}>
export type EIAnimationTraceContent = Readonly<{
  nodes: readonly Readonly<{address: string; revision: number; sourceId: string; visible: boolean; unreached: boolean}>[];
  edges: readonly Readonly<{
    id: string; from: string; to: string; sourceId: string; sourceRevision: number;
    drawFrom: string; drawTo: string; visible: boolean; fraction: number; retained: boolean;
    status: 'reachable' | 'unreachable' | 'unknown-endpoint';
  }>[];
}>
export type EIAnimationContent = EIAnimationTraceContent | string
export type EIAnimationContentProjector = (phase: number, retained: EIAnimationRetained) => EIAnimationContent
export type EIAnimationFrame = Readonly<{
  kind: 'ADDRESSED_RENDERER_FRAME'; scope: 'renderer-addressed-frame'; modelAdvanced: false;
  source: EIAnimationSource; generation: string; sequence: number; index: number;
  phase: number; frameKey: string; content: EIAnimationContent; contentFingerprint: string;
  traceContent: EIAnimationTraceContent; retained: EIAnimationRetained;
}>
/** Content must be read from the rendered surface, not copied from NEXT. The
 * pure verifier checks equality; obtaining actual renderer evidence is the
 * adapter's boundary. Missing/failed reads must be supplied as null/failure. */
export type EIAnimationReadback = Readonly<{
  frameKey: string; source: EIAnimationSource; generation: string; sequence: number;
  content: EIAnimationContent; failure?: string;
}>
export type EIAnimationReceipt = Readonly<{
  kind: 'RENDERER_FRAME_READBACK_RECEIPT'; scope: 'renderer-addressed-frame';
  receiptId: string; frameKey: string | null; generation: string; sequence: number | null;
  expectedFingerprint: string | null; actualFingerprint: string | null;
  verified: boolean; reasons: readonly string[]; readback: EIAnimationReadback | null;
}>
export type EIAnimationCycle = Readonly<{
  kind: 'ADDRESSED_ANIMATION_CYCLE'; scope: 'renderer-addressed-frame'; modelAdvanced: false;
  source: EIAnimationSource; plan: EIThreadDrawPlan; generation: string;
  sourceSnapshots: readonly Readonly<{source: EIAnimationSource; plan: EIThreadDrawPlan}>[];
  generations: readonly string[]; phases: readonly number[]; cursor: number;
  WAS: EIAnimationFrame | null; IS: EIAnimationFrame | null; NEXT: EIAnimationFrame | null;
  history: readonly EIAnimationFrame[]; receipts: readonly EIAnimationReceipt[]; acceptedReceiptIds: readonly string[];
  retained: EIAnimationRetained; openReasons: readonly string[]; complete: boolean;
}>

function canonical(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value)
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (typeof value === 'object' && value !== null) {
    const record = value as Record<string, unknown>
    return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${canonical(record[key])}`).join(',')}}`
  }
  throw new Error('Renderer frame evidence must contain finite JSON values')
}
function freeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child)
    Object.freeze(value)
  }
  return value
}
function copy<T>(value: T): T {
  if (value === null || typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))) return value
  if (Array.isArray(value)) return freeze(value.map(child => copy(child))) as T
  if (typeof value === 'object') return freeze(Object.fromEntries(Object.entries(value as object).map(([key, child]) => [key, copy(child)]))) as T
  throw new Error('Renderer frame evidence must contain finite JSON values')
}
function exactContent(a: EIAnimationContent, b: EIAnimationContent): boolean {
  return typeof a === 'string' || typeof b === 'string' ? a === b : canonical(a) === canonical(b)
}
/** Compact lookup/checksum only. It is never sufficient evidence to commit. */
export function fingerprintEIAnimationContent(content: EIAnimationContent): string {
  const value = typeof content === 'string' ? `s:${content}` : canonical(content)
  let hash = 2166136261
  for (let at = 0; at < value.length; at++) hash = Math.imul(hash ^ value.charCodeAt(at), 16777619)
  return `ei1:${(hash >>> 0).toString(16)}:${value.length}`
}
function frameIdentity(generation: string, sequence: number, index: number, phase: number): string {
  return canonical(['EI_RENDERER_FRAME', generation, sequence, index, phase])
}
function exactReceipt(a: EIAnimationReceipt, b: EIAnimationReceipt): boolean {
  const metadata = (receipt: EIAnimationReceipt) => ({...receipt, readback: receipt.readback ? {...receipt.readback, content: null} : null})
  return canonical(metadata(a)) === canonical(metadata(b)) && (!a.readback || (!!b.readback && exactContent(a.readback.content, b.readback.content)))
}

/** Expected content remains composable from the retained source. Source metadata
 * is part of the equality check, not merely a label adjacent to an animation. */
export function projectEIAnimationContent(plan: EIThreadDrawPlan, phase: number, retained: EIAnimationRetained): EIAnimationTraceContent {
  const frame = projectEIThreadDrawFrame(plan, phase, {nodes: new Set(retained.nodes), edges: new Set(retained.edges)})
  return copy({
    nodes: frame.nodes.map(({address, revision, sourceId, visible, unreached}) => ({address, revision, sourceId, visible, unreached})),
    // Unknown endpoints have no drawable primitive; they remain in plan/source.
    edges: frame.edges.filter(edge => edge.known && edge.status !== 'unknown-endpoint').map(({id, from, to, sourceId, sourceRevision, drawFrom, drawTo, visible, fraction, retained, status}) =>
      ({id, from, to, sourceId, sourceRevision, drawFrom, drawTo, visible, fraction, retained, status})),
  })
}

export function createEIAnimationCycle(plan: EIThreadDrawPlan, options: {
  generation: string; snapshotKey?: string; initialPhase?: number;
}): EIAnimationCycle {
  if (!options.generation) throw new Error('An animation run needs an explicit generation')
  const sourceNode = plan.nodes.find(node => node.address === plan.sourceAddress)
  if (!sourceNode) throw new Error('Animation SOURCE must be a retained addressed node')
  const boundaries = [...new Set([0, ...plan.nodes.flatMap(node => node.stage === null ? [] : [node.stage]),
    ...plan.edges.flatMap(edge => edge.stage === null ? [] : [edge.stage + 1]), plan.lastStage + 1])].sort((a, b) => a - b)
  // A thread-start boundary at fraction zero changes no rendered primitive.
  // Collapse any remaining equivalent source projections too, retaining the
  // final boundary so disconnected overview content is still represented.
  const phases: number[] = []
  let previousContent: string | null = null
  for (const phase of boundaries) {
    const content = canonical(projectEIAnimationContent(plan, phase, {nodes: [], edges: []}))
    if (content === previousContent) phases[phases.length - 1] = phase
    else { phases.push(phase); previousContent = content }
  }
  // Initial presentation selection is a proposal, never proof of prior drawing.
  const initial = options.initialPhase ?? 0
  if (!Number.isFinite(initial) || initial < 0) throw new Error('Invalid initial animation phase')
  const cursor = phases.findIndex(phase => phase >= Math.min(initial, phases.at(-1)!))
  const source = {entityAddress: sourceNode.address, revision: sourceNode.revision, sourceId: sourceNode.sourceId,
    snapshotKey: options.snapshotKey ?? canonical(plan)}
  return copy({kind: 'ADDRESSED_ANIMATION_CYCLE', scope: 'renderer-addressed-frame', modelAdvanced: false,
    source, sourceSnapshots: [{source, plan}],
    plan, generation: options.generation, generations: [options.generation], phases, cursor,
    WAS: null, IS: null, NEXT: null, history: [], receipts: [], acceptedReceiptIds: [],
    retained: {nodes: [], edges: []}, openReasons: ['No renderer frame has been verified'], complete: false})
}

/** Proposing twice is idempotent. Every proposed frame is a finite boundary
 * derived from retained source waves/edge completion, not an elapsed-time pose. */
export function proposeNextEIAnimationFrame(cycle: EIAnimationCycle, projectContent?: EIAnimationContentProjector): EIAnimationCycle {
  if (cycle.NEXT || cycle.complete) return cycle
  const phase = cycle.phases[cycle.cursor]
  const sequence = cycle.history.length + 1
  const traceContent = projectEIAnimationContent(cycle.plan, phase, cycle.retained)
  const content = projectContent ? copy(projectContent(phase, cycle.retained)) : traceContent
  const frameKey = frameIdentity(cycle.generation, sequence, cycle.cursor, phase)
  const NEXT: EIAnimationFrame = {kind: 'ADDRESSED_RENDERER_FRAME', scope: 'renderer-addressed-frame', modelAdvanced: false,
    source: cycle.source, generation: cycle.generation, sequence, index: cycle.cursor, phase,
    frameKey, content, traceContent, retained: cycle.retained, contentFingerprint: fingerprintEIAnimationContent(content)}
  return freeze({...cycle, NEXT: freeze(NEXT), openReasons: ['Awaiting exact renderer readback']})
}

export function verifyEIAnimationReadback(cycle: EIAnimationCycle, readback: EIAnimationReadback | null): EIAnimationReceipt {
  const next = cycle.NEXT, reasons: string[] = []
  let actualFingerprint: string | null = null, captured: EIAnimationReadback | null = null
  if (!next) reasons.push('No NEXT frame is pending')
  if (!readback) reasons.push('Renderer readback is missing')
  else {
    try {
      captured = copy(readback)
      actualFingerprint = fingerprintEIAnimationContent(readback.content)
      if (readback.failure) reasons.push(`Renderer readback failed: ${readback.failure}`)
      if (next && (readback.frameKey !== next.frameKey || readback.generation !== next.generation ||
        readback.sequence !== next.sequence || canonical(readback.source) !== canonical(next.source))) reasons.push('Renderer readback belongs to a different source, frame, sequence or generation')
      if (next && !exactContent(readback.content, next.content)) reasons.push('Rendered content does not match proposed NEXT')
    } catch { reasons.push('Renderer readback is malformed') }
  }
  const expectedFingerprint = next?.contentFingerprint ?? null
  return freeze({kind: 'RENDERER_FRAME_READBACK_RECEIPT', scope: 'renderer-addressed-frame',
    receiptId: canonical([next?.frameKey ?? null, reasons.length === 0 ? 'verified' : 'rejected']),
    frameKey: next?.frameKey ?? null, generation: cycle.generation, sequence: next?.sequence ?? null,
    expectedFingerprint, actualFingerprint, verified: reasons.length === 0, reasons: freeze(reasons), readback: captured})
}

/** A Boolean pass flag cannot commit. Re-check the captured content and every
 * receipt binding against this exact pending frame. Old receipts are harmless. */
export function commitEIAnimationFrame(cycle: EIAnimationCycle, receipt: EIAnimationReceipt | null): EIAnimationCycle {
  if (receipt && cycle.acceptedReceiptIds.includes(receipt.receiptId)) return cycle
  if (!receipt) return freeze({...cycle, openReasons: freeze(['Renderer receipt is missing'])})
  const checked = verifyEIAnimationReadback(cycle, receipt.readback)
  let matchesReceipt = false
  try { matchesReceipt = exactReceipt(checked, receipt) } catch { /* malformed receipts cannot promote */ }
  if (!checked.verified || !matchesReceipt) return freeze({...cycle,
    openReasons: freeze(checked.reasons.length ? [...checked.reasons] : ['Receipt does not match verified renderer evidence'])})
  const next = cycle.NEXT!
  const nodes = new Set(cycle.retained.nodes), edges = new Set(cycle.retained.edges)
  for (const node of next.traceContent.nodes) if (node.visible) nodes.add(node.address)
  for (const edge of next.traceContent.edges) if (edge.visible && (edge.retained || edge.fraction === 1 || edge.status === 'unreachable')) edges.add(edge.id)
  const cursor = cycle.cursor + 1
  return freeze({...cycle, WAS: cycle.IS, IS: next, NEXT: null, cursor,
    history: freeze([...cycle.history, next]), receipts: freeze([...cycle.receipts, checked]), acceptedReceiptIds: freeze([...cycle.acceptedReceiptIds, receipt.receiptId]),
    retained: freeze({nodes: freeze([...nodes].sort()), edges: freeze([...edges].sort())}),
    openReasons: freeze([]), complete: cursor === cycle.phases.length})
}

/** A replay retains actual IS/WAS/history and visible trace, but obtains a fresh
 * generation. A generation can never be reused in this retained cycle. */
export function replayEIAnimationCycle(cycle: EIAnimationCycle, generation: string): EIAnimationCycle {
  if (!generation || cycle.generations.includes(generation)) throw new Error('Replay requires an unused generation')
  return freeze({...cycle, generation, generations: freeze([...cycle.generations, generation]), cursor: 0,
    NEXT: null, complete: false, openReasons: freeze(['Replay awaits renderer readback'])})
}

/** Rebase schedules a new renderer run over a new retained source snapshot.
 * Historical IS/WAS and receipts keep their original source binding. Only trace
 * whose node/edge occurrence identity is unchanged may seed the new proposal;
 * it does not certify any geometry in the new projection. */
export function rebaseEIAnimationCycle(cycle: EIAnimationCycle, plan: EIThreadDrawPlan, options: {
  generation: string; snapshotKey?: string;
}): EIAnimationCycle {
  if (!options.generation || cycle.generations.includes(options.generation)) throw new Error('Rebase requires an unused generation')
  const fresh = createEIAnimationCycle(plan, options)
  const retainedSnapshot = cycle.sourceSnapshots.find(snapshot => canonical(snapshot.source) === canonical(fresh.source))
  if (retainedSnapshot && canonical(retainedSnapshot.plan) !== canonical(fresh.plan)) throw new Error('A snapshot key cannot bind two different source plans')
  const sourceSnapshots = retainedSnapshot ? cycle.sourceSnapshots : freeze([...cycle.sourceSnapshots, fresh.sourceSnapshots[0]])
  const priorNodes = new Map(cycle.plan.nodes.map(node => [node.address, node]))
  const unchangedNodes = new Set(fresh.plan.nodes.filter(node => {
    const prior = priorNodes.get(node.address)
    return prior && prior.revision === node.revision && prior.sourceId === node.sourceId
  }).map(node => node.address))
  const priorEdges = new Map(cycle.plan.edges.map(edge => [edge.id, edge]))
  const unchangedEdges = new Set(fresh.plan.edges.filter(edge => {
    const prior = priorEdges.get(edge.id)
    return prior && prior.from === edge.from && prior.to === edge.to && prior.label === edge.label &&
      prior.sourceId === edge.sourceId && prior.sourceRevision === edge.sourceRevision && prior.known === edge.known &&
      unchangedNodes.has(edge.from) && unchangedNodes.has(edge.to)
  }).map(edge => edge.id))
  return freeze({...fresh, sourceSnapshots, WAS: cycle.WAS, IS: cycle.IS,
    history: cycle.history, receipts: cycle.receipts, acceptedReceiptIds: cycle.acceptedReceiptIds,
    generations: freeze([...cycle.generations, options.generation]),
    retained: freeze({nodes: freeze(cycle.retained.nodes.filter(address => unchangedNodes.has(address))),
      edges: freeze(cycle.retained.edges.filter(id => unchangedEdges.has(id)))}),
    openReasons: freeze(['New source snapshot awaits renderer readback'])})
}

const SNAPSHOT_LIMIT = 4 * 1024 * 1024
type SnapshotValue = null | boolean | number | string |
  {type: 'array'; items: number[]} | {type: 'object'; entries: [string, number][]}
type AnimationSnapshot = {kind: 'EI_ANIMATION_SNAPSHOT'; version: 1; root: number; values: SnapshotValue[]}
function snapshotLimit(maxBytes = SNAPSHOT_LIMIT): number {
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) throw new Error('Snapshot size limit must be a positive integer')
  return maxBytes
}
function checkSnapshotSize(value: string, maxBytes: number): void {
  if (new TextEncoder().encode(value).length > maxBytes) throw new Error(`Animation snapshot exceeds ${maxBytes} bytes; existing history remains unchanged`)
}

/** Lossless normalized storage: equal strings (including SVG witnesses), source
 * objects and trace records appear once. References point only backwards, so
 * snapshots cannot create recursive/cyclic payloads. The size cap fails closed;
 * callers must preserve an earlier stored value when this function throws. */
export function exportEIAnimationCycle(cycle: EIAnimationCycle, options: {maxBytes?: number} = {}): string {
  const maxBytes = snapshotLimit(options.maxBytes), values: SnapshotValue[] = [], indexed = new Map<string, number>()
  const primitives = new Map<unknown, number>(), objects = new WeakMap<object, number>()
  let storedBytes = 0
  const intern = (value: unknown): number => {
    const object = value !== null && typeof value === 'object'
    const cached = object ? objects.get(value as object) : primitives.get(value)
    if (cached !== undefined) return cached
    let encoded: SnapshotValue
    if (value === null || typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))) encoded = value
    else if (Array.isArray(value)) encoded = {type: 'array', items: value.map(intern)}
    else if (typeof value === 'object' && value !== null) encoded = {type: 'object', entries: Object.keys(value).sort().map(key => [key, intern((value as Record<string, unknown>)[key])])}
    else throw new Error('Animation snapshot contains unsupported data')
    const key = JSON.stringify(encoded), previous = indexed.get(key)
    const index = previous ?? values.length
    if (previous === undefined) {
      storedBytes += new TextEncoder().encode(key).length + 1
      if (storedBytes > maxBytes) throw new Error(`Animation snapshot exceeds ${maxBytes} bytes; existing history remains unchanged`)
      values.push(encoded); indexed.set(key, index)
    }
    if (object) objects.set(value as object, index)
    else primitives.set(value, index)
    return index
  }
  const root = intern(cycle), snapshot: AnimationSnapshot = {kind: 'EI_ANIMATION_SNAPSHOT', version: 1, root, values}
  const serialized = JSON.stringify(snapshot)
  checkSnapshotSize(serialized, maxBytes)
  return serialized
}

function requireSnapshot(condition: unknown, detail: string): asserts condition {
  if (!condition) throw new Error(`Invalid animation snapshot: ${detail}`)
}
function decodeSnapshot(serialized: string, maxBytes: number): EIAnimationCycle {
  checkSnapshotSize(serialized, maxBytes)
  const snapshot = JSON.parse(serialized) as AnimationSnapshot
  requireSnapshot(snapshot?.kind === 'EI_ANIMATION_SNAPSHOT' && snapshot.version === 1 && Array.isArray(snapshot.values), 'unsupported format')
  const values: unknown[] = []
  for (const encoded of snapshot.values) {
    const reference = (index: number): unknown => {
      requireSnapshot(Number.isSafeInteger(index) && index >= 0 && index < values.length, 'invalid or cyclic reference')
      return values[index]
    }
    if (encoded === null || typeof encoded === 'string' || typeof encoded === 'boolean' || (typeof encoded === 'number' && Number.isFinite(encoded))) values.push(encoded)
    else if (encoded && typeof encoded === 'object' && encoded.type === 'array' && Array.isArray(encoded.items)) values.push(freeze(encoded.items.map(reference)))
    else if (encoded && typeof encoded === 'object' && encoded.type === 'object' && Array.isArray(encoded.entries)) {
      const keys = new Set<string>()
      const entries = encoded.entries.map(entry => {
        requireSnapshot(Array.isArray(entry) && entry.length === 2 && typeof entry[0] === 'string' && !keys.has(entry[0]), 'invalid object entry')
        keys.add(entry[0]); return [entry[0], reference(entry[1])] as const
      })
      values.push(freeze(Object.fromEntries(entries)))
    } else throw new Error('Invalid animation snapshot: malformed table entry')
  }
  requireSnapshot(Number.isSafeInteger(snapshot.root) && snapshot.root >= 0 && snapshot.root < values.length, 'missing root')
  return values[snapshot.root] as EIAnimationCycle
}

function validateSnapshot(cycle: EIAnimationCycle): void {
  requireSnapshot(cycle?.kind === 'ADDRESSED_ANIMATION_CYCLE' && cycle.scope === 'renderer-addressed-frame' && cycle.modelAdvanced === false, 'invalid cycle scope')
  requireSnapshot(Array.isArray(cycle.generations) && cycle.generations.every(value => typeof value === 'string' && value.length > 0) && new Set(cycle.generations).size === cycle.generations.length && cycle.generations.at(-1) === cycle.generation, 'invalid generations')
  requireSnapshot(Array.isArray(cycle.sourceSnapshots) && cycle.sourceSnapshots.length > 0, 'missing original source snapshots')
  const snapshots = new Map<string, {source: EIAnimationSource; plan: EIThreadDrawPlan; phases: readonly number[]}>()
  for (const snapshot of cycle.sourceSnapshots) {
    const sourceKey = canonical(snapshot.source)
    requireSnapshot(!snapshots.has(sourceKey), 'duplicate original source binding')
    const original = createEIThreadDrawPlan(snapshot.plan.nodes, snapshot.plan.edges, snapshot.plan.sourceAddress)
    requireSnapshot(canonical(original) === canonical(snapshot.plan), 'original source plan is inconsistent')
    const expected = createEIAnimationCycle(snapshot.plan, {generation: cycle.generation, snapshotKey: snapshot.source.snapshotKey})
    requireSnapshot(canonical(expected.source) === sourceKey, 'original source address differs')
    snapshots.set(sourceKey, {source: snapshot.source, plan: snapshot.plan, phases: expected.phases})
  }
  requireSnapshot(canonical(snapshots.get(canonical(cycle.source))?.plan ?? null) === canonical(cycle.plan), 'active source snapshot is absent')
  const rebuilt = createEIThreadDrawPlan(cycle.plan.nodes, cycle.plan.edges, cycle.plan.sourceAddress)
  requireSnapshot(canonical(rebuilt) === canonical(cycle.plan), 'source plan is inconsistent')
  const fresh = createEIAnimationCycle(cycle.plan, {generation: cycle.generation, snapshotKey: cycle.source.snapshotKey})
  requireSnapshot(canonical(fresh.source) === canonical(cycle.source) && canonical(fresh.phases) === canonical(cycle.phases), 'source or schedule differs')
  requireSnapshot(Number.isSafeInteger(cycle.cursor) && cycle.cursor >= 0 && cycle.cursor <= cycle.phases.length && cycle.complete === (cycle.cursor === cycle.phases.length), 'invalid cursor')
  requireSnapshot(Array.isArray(cycle.history) && Array.isArray(cycle.receipts) && cycle.history.length === cycle.receipts.length && Array.isArray(cycle.acceptedReceiptIds), 'frame and receipt histories differ')
  requireSnapshot(Array.isArray(cycle.openReasons) && cycle.openReasons.every(reason => typeof reason === 'string'), 'invalid open reasons')
  const validateFrame = (frame: EIAnimationFrame, sequence: number) => {
    requireSnapshot(frame?.kind === 'ADDRESSED_RENDERER_FRAME' && frame.scope === 'renderer-addressed-frame' && frame.modelAdvanced === false, 'invalid frame scope')
    requireSnapshot(frame.sequence === sequence && cycle.generations.includes(frame.generation) && Number.isSafeInteger(frame.index) && frame.index >= 0 && Number.isFinite(frame.phase) && frame.phase >= 0, 'invalid frame sequence')
    requireSnapshot(frame.frameKey === frameIdentity(frame.generation, frame.sequence, frame.index, frame.phase), 'frame identity differs')
    requireSnapshot(frame.contentFingerprint === fingerprintEIAnimationContent(frame.content), 'frame content checksum differs')
    requireSnapshot(typeof frame.source?.entityAddress === 'string' && typeof frame.source.sourceId === 'string' && typeof frame.source.snapshotKey === 'string' && Number.isSafeInteger(frame.source.revision), 'invalid frame source')
    const sourceNode = frame.traceContent.nodes.find(node => node.address === frame.source.entityAddress)
    requireSnapshot(sourceNode?.sourceId === frame.source.sourceId && sourceNode.revision === frame.source.revision, 'frame source is absent from trace')
    requireSnapshot(Array.isArray(frame.retained.nodes) && Array.isArray(frame.retained.edges), 'invalid frame retained trace')
    const original = snapshots.get(canonical(frame.source))
    requireSnapshot(original && original.phases[frame.index] === frame.phase, 'frame has no original source schedule')
    requireSnapshot(canonical(projectEIAnimationContent(original.plan, frame.phase, frame.retained)) === canonical(frame.traceContent), 'frame trace differs from its original source')
  }
  cycle.history.forEach((frame, index) => {
    validateFrame(frame, index + 1)
    if (index) requireSnapshot(cycle.generations.indexOf(frame.generation) >= cycle.generations.indexOf(cycle.history[index - 1].generation), 'frame generations go backwards')
    const receipt = cycle.receipts[index]
    const checked = verifyEIAnimationReadback({...cycle, generation: frame.generation, NEXT: frame}, receipt.readback)
    requireSnapshot(checked.verified && exactReceipt(checked, receipt), 'receipt does not verify its historical frame')
  })
  requireSnapshot(canonical(cycle.acceptedReceiptIds) === canonical(cycle.receipts.map(receipt => receipt.receiptId)), 'accepted receipt identities differ')
  requireSnapshot(canonical(cycle.IS) === canonical(cycle.history.at(-1) ?? null) && canonical(cycle.WAS) === canonical(cycle.history.at(-2) ?? null), 'WAS or IS is not actual committed history')
  if (cycle.NEXT) {
    validateFrame(cycle.NEXT, cycle.history.length + 1)
    requireSnapshot(!cycle.complete && cycle.NEXT.generation === cycle.generation && cycle.NEXT.index === cycle.cursor && cycle.NEXT.phase === cycle.phases[cycle.cursor] && canonical(cycle.NEXT.source) === canonical(cycle.source), 'pending frame is not bound to active source')
    requireSnapshot(canonical(cycle.NEXT.traceContent) === canonical(projectEIAnimationContent(cycle.plan, cycle.NEXT.phase, cycle.NEXT.retained)), 'pending source trace differs')
  }
  const nodeByAddress = new Map(cycle.plan.nodes.map(node => [node.address, node]))
  const edgeById = new Map(cycle.plan.edges.map(edge => [edge.id, edge]))
  requireSnapshot(Array.isArray(cycle.retained?.nodes) && Array.isArray(cycle.retained.edges), 'missing retained trace')
  for (const address of cycle.retained.nodes) {
    const node = nodeByAddress.get(address)
    requireSnapshot(node && cycle.history.some(frame => frame.traceContent.nodes.some((prior: EIAnimationTraceContent['nodes'][number]) => prior.visible && prior.address === address && prior.revision === node.revision && prior.sourceId === node.sourceId)), 'retained node lacks historical source evidence')
  }
  for (const id of cycle.retained.edges) {
    const edge = edgeById.get(id)
    requireSnapshot(edge && cycle.history.some(frame => frame.traceContent.edges.some((prior: EIAnimationTraceContent['edges'][number]) => prior.id === id && prior.from === edge.from && prior.to === edge.to && prior.sourceId === edge.sourceId && prior.sourceRevision === edge.sourceRevision && prior.visible && (prior.retained || prior.fraction === 1 || prior.status === 'unreachable'))), 'retained edge lacks historical source evidence')
  }
}

/** Restored readbacks are historical evidence, never proof of the current DOM.
 * A fresh generation clears the old proposal and must obtain its own readback.
 * On malformed/oversize input this throws before any caller state is changed. */
export function restoreEIAnimationCycle(serialized: string, options: {generation: string; maxBytes?: number}): EIAnimationCycle {
  try {
    const cycle = decodeSnapshot(serialized, snapshotLimit(options.maxBytes))
    validateSnapshot(cycle)
    return replayEIAnimationCycle(cycle, options.generation)
  } catch (error) {
    throw new Error(`Could not restore animation history: ${error instanceof Error ? error.message : 'invalid data'}`)
  }
}
