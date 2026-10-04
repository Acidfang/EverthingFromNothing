/** A finite observer drawing order over retained incidence. Stages are ordering
 * indices, not elapsed time, physical distance, geometry or model transitions. */
export type EIThreadDrawNodeInput = Readonly<{
  address: string; revision: number; sourceId: string;
}>
export type EIThreadDrawEdgeInput = Readonly<{
  id: string; from: string; to: string; label: string;
  sourceId: string; sourceRevision: number; known: boolean;
}>
export type EIThreadTraversal = 'forward' | 'parent-to-child'
export type EIThreadDrawVia = Readonly<{
  edgeId: string; from: string; to: string; traversal: EIThreadTraversal;
}>
export type EIThreadDrawNode = EIThreadDrawNodeInput & Readonly<{
  distance: number | null; stage: number | null; via: EIThreadDrawVia | null;
}>
export type EIThreadDrawEdge = EIThreadDrawEdgeInput & Readonly<{
  distance: number | null; stage: number | null;
  drawFrom: string; drawTo: string; traversal: EIThreadTraversal;
  status: 'reachable' | 'unreachable' | 'unknown-endpoint';
}>
export type EIThreadDrawWave = Readonly<{
  stage: number; distance: number; kind: 'nodes' | 'threads';
  nodeAddresses: readonly string[]; edgeIds: readonly string[];
}>
export type EIThreadDrawPlan = Readonly<{
  kind: 'RETAINED_THREAD_DRAW_PLAN'; scope: 'supplied-field-incidence';
  sourceAddress: string; maxDistance: number; lastStage: number;
  nodes: readonly EIThreadDrawNode[]; edges: readonly EIThreadDrawEdge[];
  waves: readonly EIThreadDrawWave[];
  unreachableAddresses: readonly string[]; unknownEndpoints: readonly string[];
}>

const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0

/** Field projection IDs distinguish explicit parent occurrences from named
 * relations, including a named relation whose label happens to be "parent". */
function isParentOccurrence(edge: EIThreadDrawEdgeInput): boolean {
  if (edge.label !== 'parent') return false
  try {
    const occurrence: unknown = JSON.parse(edge.id)
    return Array.isArray(occurrence) && occurrence.length === 3 &&
      occurrence[0] === edge.from && occurrence[1] === 'parent' &&
      Number.isInteger(occurrence[2]) && occurrence[2] >= 0
  } catch { return false }
}

/** The caller must select an existing SOURCE explicitly. Named relations keep
 * their from→to direction. A retained child→parent occurrence also permits the
 * explicitly identified parent→child observer traversal, without changing the
 * model edge. The first reached endpoint determines that occurrence's drawing
 * traversal; equal-distance endpoints keep its original direction. No other
 * inverse, component root or connecting thread is made.
 *
 * Nodes have stage 2*distance; a thread leaves its reached observer start at
 * stage 2*distance+1. Thus each new node follows a real retained incoming thread
 * and is present before any thread leaves it. Cycles/backlinks remain finite.
 */
export function createEIThreadDrawPlan(
  inputNodes: readonly EIThreadDrawNodeInput[],
  inputEdges: readonly EIThreadDrawEdgeInput[],
  sourceAddress: string,
): EIThreadDrawPlan {
  const nodes: EIThreadDrawNode[] = [...inputNodes].sort((a, b) => compare(a.address, b.address))
    .map(({address, revision, sourceId}) => ({address, revision, sourceId, distance: null, stage: null, via: null}))
  const byAddress = new Map(nodes.map(node => [node.address, node]))
  if (byAddress.size !== nodes.length) throw new Error('Thread drawing requires one canonical node per address')
  if (!byAddress.has(sourceAddress)) throw new Error('Thread drawing SOURCE address is not retained')
  const edgeIds = new Set<string>(), unknownEndpoints = new Set<string>()
  const edges: EIThreadDrawEdge[] = [...inputEdges].sort((a, b) => compare(a.id, b.id)).map(input => {
    if (edgeIds.has(input.id)) throw new Error('Thread drawing requires unique retained edge occurrence IDs')
    edgeIds.add(input.id)
    for (const address of [input.from, input.to]) if (!byAddress.has(address)) unknownEndpoints.add(address)
    return {
      id: input.id, from: input.from, to: input.to, label: input.label,
      sourceId: input.sourceId, sourceRevision: input.sourceRevision, known: input.known,
      drawFrom: input.from, drawTo: input.to,
      traversal: 'forward', distance: null, stage: null,
      status: input.known && byAddress.has(input.from) && byAddress.has(input.to) ? 'unreachable' : 'unknown-endpoint',
    }
  })
  const outgoing = new Map<string, EIThreadDrawVia[]>(nodes.map(node => [node.address, []]))
  for (const edge of edges) if (edge.status !== 'unknown-endpoint') {
    outgoing.get(edge.from)!.push({edgeId: edge.id, from: edge.from, to: edge.to, traversal: 'forward'})
    if (isParentOccurrence(edge) && edge.from !== edge.to)
      outgoing.get(edge.to)!.push({edgeId: edge.id, from: edge.to, to: edge.from, traversal: 'parent-to-child'})
  }

  const distances = new Map<string, number>([[sourceAddress, 0]])
  const via = new Map<string, EIThreadDrawVia>(), queue = [sourceAddress]
  for (let at = 0; at < queue.length; at++) {
    const address = queue[at], distance = distances.get(address)!
    for (const thread of outgoing.get(address)!) {
      if (distances.has(thread.to)) continue
      distances.set(thread.to, distance + 1)
      via.set(thread.to, thread)
      queue.push(thread.to)
    }
  }
  const plannedNodes = nodes.map(node => {
    const distance = distances.get(node.address) ?? null
    return {...node, distance, stage: distance === null ? null : 2 * distance, via: via.get(node.address) ?? null}
  })
  const plannedEdges = edges.map(edge => {
    if (edge.status === 'unknown-endpoint') return edge
    const fromDistance = distances.get(edge.from), toDistance = distances.get(edge.to)
    const reverse = isParentOccurrence(edge) && toDistance !== undefined && (fromDistance === undefined || toDistance < fromDistance)
    const distance = reverse ? toDistance : fromDistance
    return distance === undefined ? edge : {
      ...edge, distance, stage: 2 * distance + 1, status: 'reachable' as const,
      drawFrom: reverse ? edge.to : edge.from, drawTo: reverse ? edge.from : edge.to,
      traversal: reverse ? 'parent-to-child' as const : 'forward' as const,
    }
  })
  const waveMap = new Map<number, {stage: number; distance: number; kind: 'nodes' | 'threads'; nodeAddresses: string[]; edgeIds: string[]}>()
  for (const node of plannedNodes) if (node.stage !== null) {
    const wave = waveMap.get(node.stage) ?? {stage: node.stage, distance: node.distance!, kind: 'nodes', nodeAddresses: [], edgeIds: []}
    wave.nodeAddresses.push(node.address); waveMap.set(node.stage, wave)
  }
  for (const edge of plannedEdges) if (edge.stage !== null) {
    const wave = waveMap.get(edge.stage) ?? {stage: edge.stage, distance: edge.distance!, kind: 'threads', nodeAddresses: [], edgeIds: []}
    wave.edgeIds.push(edge.id); waveMap.set(edge.stage, wave)
  }
  const waves = [...waveMap.values()].sort((a, b) => a.stage - b.stage)
  return {
    kind: 'RETAINED_THREAD_DRAW_PLAN', scope: 'supplied-field-incidence', sourceAddress,
    maxDistance: distances.get(queue.at(-1)!)!, lastStage: waves.at(-1)!.stage,
    nodes: plannedNodes, edges: plannedEdges, waves,
    unreachableAddresses: plannedNodes.filter(node => node.distance === null).map(node => node.address),
    unknownEndpoints: [...unknownEndpoints].sort(compare),
  }
}
