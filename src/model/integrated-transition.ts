/** Validates supplied relation results; derives no pose law. */
export const INTEGRATED_MODEL_BOUNDARY = Object.freeze({
  status: 'UNRESOLVED' as const,
  requirements: Object.freeze([
    'Relation-derived placement: previous tip becomes next centre; only SOURCE fixed',
    'Inherited twist and turn through 0 → 1',
    'All threads retain root paths; witnessed model intersections stitch those paths',
    'Centre-out successor drawing and selection index complete in the same snapshot',
  ]),
  blockers: Object.freeze(['Relation-to-pose and inherited twist law', 'Complete root-thread intersection derivation', 'Thread-derived centre-out pixel producer']),
})
export type Vec3 = readonly [number, number, number]
export type Pose = Readonly<{ centre: Vec3; tip: Vec3; orientation: readonly [number, number, number, number]; evidence: string }>
export type AddressedNode = Readonly<{
  id: string; root: string; path: readonly string[]; predecessor: string | null
  pose: Pose | null; unresolved: readonly string[]
}>
export type Thread = Readonly<{ id: string; root: string; from: string; to: string; evidence: string }>
/** The resolver supplies actual model intersection witnesses, never screen overlap. */
export type Intersection = Readonly<{ id: string; root: string; nodes: readonly string[]; evidence: string }>
export type TransitionInput = Readonly<{
  id: string; source: string; from: number; to: number
  nodes: readonly AddressedNode[]; threads: readonly Thread[]
  intersections: readonly Intersection[]; unresolved: readonly string[]
  derivation: Readonly<{ poseLaw: string | null; threadClosure: string | null; drawOrder: string | null }>
}>
export type ModelSnapshot = Readonly<{ act: number; source: string; nodes: readonly AddressedNode[]; threads: readonly Thread[] }>
export type SelectionTarget = Readonly<{ address: string; x: number; y: number }>
const samePoint = (a: Vec3, b: Vec3) => a.every((value, index) => value === b[index])
const finitePose = (pose: Pose) => [...pose.centre, ...pose.tip, ...pose.orientation].every(Number.isFinite)
function freezeNode(node: AddressedNode): AddressedNode {
  return Object.freeze({ ...node, path: Object.freeze([...node.path]), unresolved: Object.freeze([...node.unresolved]),
    pose: node.pose && Object.freeze({ ...node.pose, centre: Object.freeze([...node.pose.centre]) as Vec3,
      tip: Object.freeze([...node.pose.tip]) as Vec3, orientation: Object.freeze([...node.pose.orientation]) as Pose['orientation'] }) })
}
export function prepareIntegratedTransition(previous: ModelSnapshot, input: TransitionInput) {
  const { id, from, to } = input
  // Copy all caller-owned arrays before validation or asynchronous work begins.
  const nodes = Object.freeze(input.nodes.map(freezeNode))
  const threads = Object.freeze(input.threads.map(thread => Object.freeze({ ...thread })))
  const intersections = Object.freeze(input.intersections.map(item => Object.freeze({ ...item, nodes: Object.freeze([...item.nodes]) })))
  const issues = [...input.unresolved]
  for (const [name, evidence] of Object.entries(input.derivation)) if (!evidence) issues.push(`${name}:DERIVATION_UNRESOLVED`)
  const byId = new Map(nodes.map(node => [node.id, node]))
  const old = new Map(previous.nodes.map(node => [node.id, node]))
  if (!input.id || input.from !== previous.act || input.to !== input.from + 1 || !Number.isSafeInteger(input.to)) issues.push('INVALID_TRANSITION_IDENTITY')
  if (input.source !== previous.source) issues.push('SOURCE_CHANGED')
  if (byId.size !== nodes.length) issues.push('DUPLICATE_NODE_ADDRESS')
  if (new Set(threads.map(thread => thread.id)).size !== threads.length) issues.push('DUPLICATE_THREAD_ADDRESS')
  const source = byId.get(input.source), oldSource = old.get(previous.source)
  if (!source?.pose || !oldSource?.pose || !samePoint(source.pose.centre, oldSource.pose.centre)) issues.push('SOURCE_NOT_FIXED')
  for (const node of nodes) {
    issues.push(...node.unresolved.map(issue => `${node.id}:${issue}`))
    if (!node.pose || !finitePose(node.pose) || !node.pose.evidence) issues.push(`${node.id}:POSE_UNRESOLVED`)
    if (node.root !== input.source || node.path[0] !== input.source || node.path.at(-1) !== node.id) issues.push(`${node.id}:ROOT_PATH_UNRESOLVED`)
    for (let i = 1; i < node.path.length; i++) if (!threads.some(thread => thread.root === node.root && thread.from === node.path[i - 1] && thread.to === node.path[i])) issues.push(`${node.id}:ROOT_PATH_LINK_MISSING`)
    if (node.id === input.source) continue
    const predecessor = node.predecessor ? (byId.get(node.predecessor) ?? old.get(node.predecessor)) : undefined
    if (!predecessor?.pose || !node.pose || !samePoint(predecessor.pose.tip, node.pose.centre)) issues.push(`${node.id}:PREVIOUS_TIP_NOT_CENTRE`)
    if (!threads.some(thread => thread.from === node.predecessor && thread.to === node.id)) issues.push(`${node.id}:INHERITED_THREAD_MISSING`)
  }
  for (const thread of threads) {
    if (!thread.evidence || thread.root !== input.source || !byId.has(thread.to) || !(byId.has(thread.from) || old.has(thread.from))) issues.push(`${thread.id}:THREAD_UNRESOLVED`)
  }
  // An intersection creates a shared root-path junction while retaining every
  // branch identity and witness. It never collapses distinct node addresses.
  const junctions = intersections.map(item => {
    const members = item.nodes.map(id => byId.get(id))
    const centre = members[0]?.pose?.centre
    if (!item.evidence || item.root !== input.source || item.nodes.length < 2 || new Set(item.nodes).size !== item.nodes.length || !centre || members.some(node => !node?.pose || node.root !== item.root || !samePoint(node.pose.centre, centre))) issues.push(`${item.id}:INTERSECTION_UNRESOLVED`)
    return Object.freeze({ ...item, paths: Object.freeze(members.map(node => node?.path ?? Object.freeze([]))) })
  })
  if (new Set(intersections.map(item => item.id)).size !== intersections.length) issues.push('DUPLICATE_INTERSECTION_ADDRESS')
  const blockers = Object.freeze([...new Set(issues)])
  const snapshot = Object.freeze({ act: input.to, source: input.source, nodes, threads, junctions: Object.freeze(junctions) })
  let cancelled = false, committed = false
  let expectedPixels = 0, assigned = 0
  let pixels: Uint8ClampedArray | null = null
  const visited = new Set<number>()
  let presented = false
  let presenting = false
  let presentation: Readonly<{ state: typeof snapshot; selection: readonly SelectionTarget[]; width: number; height: number }> | null = null
  return Object.freeze({
    id, blockers, snapshot,
    beginFrame(width: number, height: number, selection: readonly SelectionTarget[]) {
      if (blockers.length || cancelled || committed || pixels) throw new Error('Transition is not ready to frame')
      if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1 || !Number.isSafeInteger(width * height)) throw new Error('Invalid frame')
      if (selection.length !== nodes.length || new Set(selection.map(item => item.address)).size !== nodes.length || selection.some(item => !byId.has(item.address) || !Number.isFinite(item.x) || !Number.isFinite(item.y))) throw new Error('Incomplete selection index')
      presentation = Object.freeze({ state: snapshot, selection: Object.freeze(selection.map(item => Object.freeze({ ...item }))), width, height })
      expectedPixels = width * height
      pixels = new Uint8ClampedArray(expectedPixels * 4)
    },
    /** A producer supplies the centre-out/thread-derived order. No order is invented here. */
    writePixel(index: number, rgba: readonly [number, number, number, number]) {
      if (!pixels || cancelled || committed || presented || !Number.isSafeInteger(index) || index < 0 || index >= expectedPixels || visited.has(index)) throw new Error('Invalid pixel assignment')
      pixels.set(rgba, index * 4); visited.add(index); assigned++
    },
    async present(presentFrame: (pixels: Uint8ClampedArray, completedFrame: NonNullable<typeof presentation>) => void | Promise<void>) {
      if (!pixels || !presentation || cancelled || committed || presented || presenting || assigned !== expectedPixels) throw new Error('Incomplete successor frame')
      presenting = true
      try {
        await presentFrame(pixels.slice(), presentation)
        if (cancelled) throw new Error('Presentation cancelled')
        presented = true
      } finally { presenting = false }
    },
    commit(current: ModelSnapshot) {
      if (cancelled || committed || !presented || current !== previous || blockers.length) throw new Error('Cannot commit integrated transition')
      committed = true
      return presentation!
    },
    cancel() { if (committed) throw new Error('Committed state cannot be cancelled'); cancelled = true; pixels = null },
    receipt() { return Object.freeze({ id, from, to, assigned, expectedPixels, presented, committed, cancelled, blockers }) },
  })
}
