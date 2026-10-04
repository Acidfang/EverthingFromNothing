import {restoreEISession} from './ei-session.ts'
import {restoreEIAnimationCycle, fingerprintEIAnimationContent, type EIAnimationCycle} from './ei-animation-cycle.ts'
import {restoreEIFitImprovement, type EIFitObject} from './ei-fit-improvement.ts'
import {EI_GRAINS, type EIGrain} from './ei-grain-identity.ts'
import type {EIIdleState, EIIdleObservation} from './ei-idle-observation.ts'
import type {EILedger, EIRecord} from './ei-engine.ts'

/** Presentation is retained context, not a receipt for the current renderer.
 * Restore animation with a fresh generation and obtain new renderer readback. */
export type EIFieldPresentationSnapshot = Readonly<{
  schema: 'ei.field-presentation.v1'; canonicalRoot: string; observerZero: string;
  zeroHistory: readonly string[]; selectedAddress: string; selectedRevision: number; grain: EIGrain;
  view: Readonly<{x: number; y: number; zoom: number}>;
  orientation: Readonly<{yaw: number; pitch: number; roll?:number}>;
  presentationMode?:'nature'|'solar'; animation: string; idle?: EIIdleState; improvement: string;
}>
export type EIFieldSave = Readonly<{sessionString: string; presentation: EIFieldPresentationSnapshot | null}>
export const EI_FIELD_SAVE_LIMITS = Object.freeze({storedBytes: 16 * 1024 * 1024, animationBytes: 4 * 1024 * 1024})

const FORMAT = 'ei-field-save/v1', encoder = new TextEncoder()
const fail = (detail: string): never => { throw new Error(`EI field save: ${detail}`) }
function requireValue(condition: unknown, detail: string): asserts condition { if (!condition) fail(detail) }
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const count = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0
function object(value: unknown): Record<string, unknown> {
  requireValue(value !== null && typeof value === 'object' && !Array.isArray(value), 'expected an object')
  return value as Record<string, unknown>
}
function fields(value: Record<string, unknown>, required: readonly string[], optional: readonly string[] = []): void {
  requireValue(required.every(key => Object.hasOwn(value, key)) && Object.keys(value).every(key => required.includes(key) || optional.includes(key)), 'unsupported or missing fields')
}
function size(value: unknown, maximum: number, name: string): asserts value is string {
  requireValue(typeof value === 'string', `${name} must be serialized text`)
  requireValue(value.length <= maximum && encoder.encode(value).length <= maximum, `${name} exceeds ${maximum} bytes; existing state remains unchanged`)
}
/** Reject ambiguous duplicate keys and excessive nesting before interpretation.
 * Source JSON inside session/animation strings stays literal and unchanged. */
function parse(raw: string): unknown {
  const stack: {object: boolean; key: boolean; keys: Set<string>}[] = []
  for (let index = 0; index < raw.length; index++) {
    const character = raw[index]
    if (character === '"') {
      const start = index++
      while (index < raw.length && raw[index] !== '"') { if (raw[index] === '\\') index++; index++ }
      const frame = stack.at(-1)
      if (frame?.object && frame.key) {
        const key = JSON.parse(raw.slice(start, index + 1)) as string
        requireValue(!frame.keys.has(key), 'duplicate object key')
        frame.keys.add(key); frame.key = false
      }
    } else if (character === '{' || character === '[') {
      requireValue(stack.length < 64, 'JSON nesting exceeds bounds')
      stack.push({object: character === '{', key: character === '{', keys: new Set()})
    } else if (character === '}' || character === ']') stack.pop()
    else if (character === ',' && stack.at(-1)?.object) stack.at(-1)!.key = true
  }
  return JSON.parse(raw)
}
function freeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child)
    Object.freeze(value)
  }
  return value
}
function canonical(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean' || finite(value)) return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  const record = object(value)
  return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${canonical(record[key])}`).join(',')}}`
}
function retainedSource(records: ReadonlyMap<string, EIRecord>, address: string, revision: number, sourceId?: string): void {
  const record = records.get(address)
  requireValue(record && [...record.was, record.is].some(state => state.revision === revision && (sourceId === undefined || state.source.id === sourceId)), `source does not match retained IS/WAS at ${address}`)
}

/** Inspect only the normalized wire table to pick a deterministic unused
 * validation generation. No imported receipt is promoted into a live return. */
function animation(serialized: string, records: ReadonlyMap<string, EIRecord>, observerZero: string): EIAnimationCycle {
  size(serialized, EI_FIELD_SAVE_LIMITS.animationBytes, 'animation snapshot')
  const wire = object(parse(serialized))
  fields(wire, ['kind', 'version', 'root', 'values'])
  requireValue(wire.kind === 'EI_ANIMATION_SNAPSHOT' && wire.version === 1 && Array.isArray(wire.values), 'invalid normalized animation snapshot')
  // A compact graph can otherwise expand exponentially during the animation
  // verifier's equality checks. Bound expanded work without dropping history.
  const costs: {nodes: number; bytes: number; depth: number}[] = []
  const strings = new Set<string>()
  for (const encoded of wire.values) {
    const cost = {nodes: 1, bytes: 2, depth: 0}
    if (typeof encoded === 'string') { strings.add(encoded); cost.bytes = encoder.encode(JSON.stringify(encoded)).length }
    else if (encoded !== null && typeof encoded === 'object') {
      const item = object(encoded)
      fields(item, item.type === 'array' ? ['type', 'items'] : ['type', 'entries'])
      requireValue(item.type === 'array' || item.type === 'object', 'invalid animation content node')
      const references: number[] = []
      if (item.type === 'array') {
        requireValue(Array.isArray(item.items), 'invalid animation array')
        for (const reference of item.items) references.push(reference)
      } else {
        requireValue(Array.isArray(item.entries), 'invalid animation object')
        const keys = new Set<string>()
        for (const pair of item.entries) {
          requireValue(Array.isArray(pair) && pair.length === 2 && typeof pair[0] === 'string' && !keys.has(pair[0]), 'invalid animation object entry')
          keys.add(pair[0]); references.push(pair[1]); cost.bytes += encoder.encode(JSON.stringify(pair[0])).length + 1
        }
      }
      for (const reference of references) {
        requireValue(count(reference) && reference < costs.length, 'invalid or cyclic animation reference')
        const child = costs[reference]
        cost.nodes += child.nodes; cost.bytes += child.bytes + 1; cost.depth = Math.max(cost.depth, child.depth + 1)
      }
    } else requireValue(encoded === null || typeof encoded === 'boolean' || finite(encoded), 'invalid animation value')
    requireValue(cost.nodes <= 1_000_000 && cost.bytes <= 64 * 1024 * 1024 && cost.depth <= 64, 'expanded animation exceeds bounds')
    costs.push(cost)
  }
  let suffix = 0, generation = 'ei-field-save:validation:0'
  while (strings.has(generation)) generation = `ei-field-save:validation:${++suffix}`
  const cycle = restoreEIAnimationCycle(serialized, {generation, maxBytes: EI_FIELD_SAVE_LIMITS.animationBytes})
  requireValue(cycle.source.entityAddress === observerZero, 'animation source differs from observer ZERO')
  for (const snapshot of cycle.sourceSnapshots) {
    retainedSource(records, snapshot.source.entityAddress, snapshot.source.revision, snapshot.source.sourceId)
    for (const node of snapshot.plan.nodes) retainedSource(records, node.address, node.revision, node.sourceId)
    for (const edge of snapshot.plan.edges) {
      retainedSource(records, edge.from, edge.sourceRevision, edge.sourceId)
      const owner = records.get(edge.from)!
      let occurrence: unknown
      try { occurrence = JSON.parse(edge.id) } catch { fail('animation edge occurrence is invalid') }
      requireValue(Array.isArray(occurrence) && occurrence.length === 3 && occurrence[0] === edge.from &&
        (occurrence[1] === 'parent' || occurrence[1] === 'relation') && count(occurrence[2]) &&
        edge.id === JSON.stringify(occurrence), 'animation edge occurrence is invalid')
      const index = occurrence[2] as number, origin = owner.was[0] ?? owner.is
      const retained = occurrence[1] === 'parent'
        ? edge.label === 'parent' && owner.parents[index] === edge.to
        : owner.relations[index]?.address === edge.to && owner.relations[index]?.relation === edge.label
      requireValue(retained && edge.known === records.has(edge.to) && edge.sourceRevision === origin.revision &&
        edge.sourceId === origin.source.id, 'animation edge differs from retained incidence occurrence')
    }
  }
  return cycle
}

function idle(value: unknown, cycle: EIAnimationCycle, records: ReadonlyMap<string, EIRecord>): void {
  const state = object(value)
  fields(state, ['WAS', 'IS', 'NEXT', 'observations', 'unchanged', 'differences', 'status'])
  requireValue(count(state.observations) && count(state.unchanged) && count(state.differences) && state.unchanged + state.differences === state.observations, 'invalid idle observation counts')
  requireValue(['unobserved', 'unchanged', 'difference', 'unavailable', 'stale'].includes(String(state.status)), 'invalid idle observation status')
  requireValue((state.IS === null) === (state.observations === 0) && (state.WAS === null) === (state.observations < 2) && (state.NEXT === null) === (state.observations === 0), 'idle observation history differs from counts')
  requireValue(state.status !== 'unobserved' || state.observations === 0, 'observed idle state cannot be unobserved')
  const observation = (raw: unknown): EIIdleObservation | null => {
    if (raw === null) return null
    const item = object(raw)
    fields(item, ['frameKey', 'entityAddress', 'revision', 'generation', 'observedAt', 'content'])
    requireValue(typeof item.frameKey === 'string' && typeof item.entityAddress === 'string' && typeof item.generation === 'string' && count(item.revision) && finite(item.observedAt) && item.observedAt >= 0, 'invalid idle observation')
    retainedSource(records, item.entityAddress, item.revision)
    requireValue(cycle.history.some(frame => frame.frameKey === item.frameKey && frame.generation === item.generation && frame.source.entityAddress === item.entityAddress && frame.source.revision === item.revision), 'idle observation has no historical animation frame')
    requireValue(typeof item.content === 'string' || (item.content !== null && typeof item.content === 'object' && !Array.isArray(item.content) && Array.isArray((item.content as Record<string, unknown>).nodes) && Array.isArray((item.content as Record<string, unknown>).edges)), 'invalid idle captured content')
    fingerprintEIAnimationContent(item.content as EIIdleObservation['content'])
    return item as EIIdleObservation
  }
  observation(state.WAS)
  const current = observation(state.IS)
  if (current) {
    const next = object(state.NEXT)
    fields(next, ['frameKey', 'expectedFingerprint'])
    const frame = cycle.history.find(frame => frame.frameKey === current.frameKey)!
    requireValue(next.frameKey === current.frameKey && next.expectedFingerprint === frame.contentFingerprint, 'idle expectation differs from its historical frame')
    if (state.status === 'unchanged' || state.status === 'difference') {
      // Normalized cycle storage sorts object keys. The idle observer's original
      // JSON-string comparison could report a key-order-only difference, which
      // must remain historical evidence rather than being silently rewritten.
      const changed = canonical(current.content) !== canonical(frame.content)
      requireValue(state.status === 'difference' ? state.differences > 0 && (typeof current.content !== 'string' || changed) : state.unchanged > 0 && !changed, 'idle status differs from captured evidence')
    }
  } else requireValue(state.status !== 'unchanged' && state.status !== 'difference', 'idle status lacks observation evidence')
}

function presentation(value: unknown, root: string, ledger: EILedger): EIFieldPresentationSnapshot {
  const result = object(value)
  fields(result, ['schema', 'canonicalRoot', 'observerZero', 'zeroHistory', 'selectedAddress', 'selectedRevision', 'grain', 'view', 'orientation', 'animation', 'improvement'], ['idle','presentationMode'])
  requireValue(result.schema === 'ei.field-presentation.v1' && result.canonicalRoot === root, 'presentation canonical root differs from session source')
  const records = new Map(ledger.records.map(record => [record.address, record]))
  for (const key of ['observerZero', 'selectedAddress'] as const) requireValue(typeof result[key] === 'string' && records.has(result[key]), `${key} is not a retained address`)
  requireValue(count(result.selectedRevision), 'invalid selected revision')
  retainedSource(records, result.selectedAddress as string, result.selectedRevision)
  requireValue(Array.isArray(result.zeroHistory) && result.zeroHistory.every(address => typeof address === 'string' && records.has(address)), 'ZERO history contains an unretained address')
  requireValue(EI_GRAINS.includes(result.grain as EIGrain), 'invalid presentation grain')
  requireValue(result.presentationMode===undefined||result.presentationMode==='solar'||result.presentationMode==='nature','invalid field presentation')
  const view = object(result.view), orientation = object(result.orientation)
  fields(view, ['x', 'y', 'zoom']); fields(orientation, ['yaw', 'pitch'], ['roll'])
  requireValue(finite(view.x) && finite(view.y) && finite(view.zoom) && view.zoom > 0 && finite(1 / view.zoom), 'invalid presentation view')
  requireValue(finite(orientation.yaw) && finite(orientation.pitch) && (orientation.roll===undefined||finite(orientation.roll)), 'invalid presentation orientation')
  requireValue(typeof result.animation === 'string' && typeof result.improvement === 'string', 'renderer history must be serialized text')
  const cycle = animation(result.animation, records, result.observerZero as string)
  if (Object.hasOwn(result, 'idle')) idle(result.idle, cycle, records)
  parse(result.improvement)
  const fit = restoreEIFitImprovement(result.improvement, null)
  requireValue(fit.status !== 'invalid', 'invalid fit improvement history')
  const bindObjects = (objects: readonly EIFitObject[]) => {
    for (const item of objects) retainedSource(records, item.address, item.revision, item.sourceId)
  }
  for (const receipt of fit.state.receipts) {
    bindObjects(receipt.proposal.before.objects)
    // Conflicts and failed returns may contain foreign/malformed geometry. They
    // remain failures; only an accepted return claims retained source identity.
    if (receipt.status === 'committed') {
      if (receipt.currentEvidence) bindObjects(receipt.currentEvidence.objects)
      if (receipt.readback) bindObjects(receipt.readback.objects)
    }
  }
  return freeze(result) as EIFieldPresentationSnapshot
}

/** Missing presentation preserves the exact old session format and bytes. The
 * combined envelope is validated completely before callers replace any state. */
export function packEIFieldSave(sessionString: string, snapshot?: EIFieldPresentationSnapshot | null): string {
  if (snapshot == null) { restoreEISession(sessionString); return sessionString }
  const serialized = JSON.stringify({format: FORMAT, sessionString, presentation: snapshot})
  unpackEIFieldSave(serialized)
  return serialized
}

/** Imported renderer returns are historical evidence only. This pure decoder
 * neither changes the ledger nor issues a receipt for any current surface. */
export function unpackEIFieldSave(text: string): EIFieldSave {
  size(text, EI_FIELD_SAVE_LIMITS.storedBytes, 'field save')
  const envelope = object(parse(text))
  if (envelope.format !== FORMAT) {
    restoreEISession(text)
    return freeze({sessionString: text, presentation: null})
  }
  fields(envelope, ['format', 'sessionString'], ['presentation'])
  requireValue(typeof envelope.sessionString === 'string', 'session must be serialized text')
  const sessionString = envelope.sessionString, restored = restoreEISession(sessionString)
  return freeze({sessionString, presentation: envelope.presentation == null ? null : presentation(envelope.presentation, restored.root, restored.ledger)})
}
