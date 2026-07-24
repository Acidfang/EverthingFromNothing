import { FACES, key } from "./address.ts"
import {
  firstDifference,
  resolveTick,
  reverseTick,
  sameField,
  type ResolverState,
  type TickLedger,
} from "./kernel.ts"
import { projectWhole, type ProjectionEntry } from "./projection.ts"
import {
  PROVENANCE,
  type ProvenanceNode,
  type ProvenanceStatus,
} from "./provenance.ts"
import {
  queryField,
  type EventAddress,
  type RecursiveQuery,
} from "./query.ts"
import { buildWholeScene, type WholeScene } from "./scene.ts"

export type SelectedRelation = Readonly<{
  source: "TICK_LEDGER" | "WHOLE_PROJECTION"
  address: string
}>

export type CausalExplanation = Readonly<{
  title: string
  status: "GENERATED"
  ancestryStatuses: readonly ProvenanceStatus[]
  externalComparisonAllowed: boolean
  because: readonly string[]
  result: string
  provenanceIds: readonly string[]
}>

export type ExplorerFrame = Readonly<{
  kernelVersion: "first-act-gf2-v1"
  observer: Readonly<{
    act: number
    relativeGrain: number
    relativeWholePath: readonly string[]
    spatialAddress: string
    queryDepth: number
  }>
  chronology: Readonly<{
    was: readonly string[]
    is: readonly string[]
    next: readonly string[] | null
  }>
  currentLedger: TickLedger | null
  wholeProjection: Readonly<{
    presentations: number
    addressedRelations: number
    resolvedSame: number
    outwardDifference: number
    entries: readonly ProjectionEntry[]
  }>
  scene: WholeScene
  recursiveQuery: Readonly<{
    eventCount: number
    relationCount: number
    frontierCount: number
    frontierIsExpandable: true
    query: Readonly<{
      centre: string
      radius: number
      events: readonly string[]
      edges: RecursiveQuery["edges"]
      frontier: readonly string[]
    }>
  }>
  provenance: readonly ProvenanceNode[]
  selected: SelectedRelation | null
  explanation: CausalExplanation | null
}>

function sorted(field: ReadonlySet<string>): readonly string[] {
  return Object.freeze([...field].sort())
}

function ancestryStatuses(ids: readonly string[]): readonly ProvenanceStatus[] {
  const nodes = new Map(PROVENANCE.map((node) => [node.id, node]))
  return Object.freeze(ids.map((id) => {
    const node = nodes.get(id)
    if (!node) throw new Error(`Unknown provenance node: ${id}`)
    return node.status
  }))
}

function externalComparisonAllowed(statuses: readonly ProvenanceStatus[]): boolean {
  return statuses.every((status) => status === "GIVEN" || status === "DERIVED")
}

function explainTick(
  ledger: TickLedger,
  address: string,
): CausalExplanation {
  const entry = ledger.entries.find((item) => item.address === address)
  if (!entry) throw new Error(`Address ${address} is not in the current tick ledger`)
  const provenanceIds = ["first-difference", "six-face-grid", "gf2", "reversible-update"]
  const statuses = ancestryStatuses(provenanceIds)
  return Object.freeze({
    title: `Tick relation at ${address}`,
    status: "GENERATED",
    ancestryStatuses: statuses,
    externalComparisonAllowed: externalComparisonAllowed(statuses),
    because: Object.freeze([
      `${entry.arrivalCount} Face presentation${entry.arrivalCount === 1 ? "" : "s"} addressed this relation.`,
      entry.wasDifferent
        ? "WAS already retained Difference at this address."
        : "WAS retained no Difference at this address.",
      entry.arrivalCount % 2 === 1
        ? "The selected parity algebra leaves an odd Face residual."
        : "The selected parity algebra resolves an even Face count to Same.",
    ]),
    result: entry.result,
    provenanceIds: Object.freeze(provenanceIds),
  })
}

function explainProjection(entry: ProjectionEntry): CausalExplanation {
  const provenanceIds = ["whole-web", "six-face-grid", "gf2"]
  const statuses = ancestryStatuses(provenanceIds)
  return Object.freeze({
    title: `Containing-grain relation at ${entry.normalizedAddress}`,
    status: "GENERATED",
    ancestryStatuses: statuses,
    externalComparisonAllowed: externalComparisonAllowed(statuses),
    because: Object.freeze([
      `${entry.contributors.length} complete child-whole presentation${entry.contributors.length === 1 ? "" : "s"} meet here.`,
      `Contributors: ${entry.contributors.join(" · ")}.`,
      entry.arrivalCount % 2 === 1
        ? "The selected parity algebra retains an outward Difference."
        : "The selected parity algebra resolves the coincident presentations to Same.",
    ]),
    result: entry.result,
    provenanceIds: Object.freeze(provenanceIds),
  })
}

export class FirstActExplorer {
  readonly #history: ResolverState[] = [firstDifference()]
  readonly #ledgers: TickLedger[] = []
  #cursor = 0
  #relativeGrain = 0
  #relativeWholePath: string[] = []
  #spatialAddress = "0,0,0"
  #queryDepth = 1
  #selection: SelectedRelation | null = null

  get state(): ResolverState {
    return this.#history[this.#cursor]
  }

  resolveOneTick(): ExplorerFrame {
    if (this.#cursor < this.#history.length - 1) {
      this.#cursor += 1
      this.#selection = null
      return this.frame()
    }
    const resolved = resolveTick(this.state)
    this.#history.push(resolved.state)
    this.#ledgers.push(resolved.ledger)
    this.#cursor += 1
    this.#selection = null
    return this.frame()
  }

  returnToWas(): ExplorerFrame {
    if (this.#cursor === 0) return this.frame()
    const recovered = reverseTick(this.state)
    const expected = this.#history[this.#cursor - 1]
    if (
      recovered.act !== expected.act
      || !sameField(recovered.was, expected.was)
      || !sameField(recovered.is, expected.is)
    ) {
      throw new Error("Reverse audit did not recover the recorded prior frame")
    }
    this.#cursor -= 1
    this.#selection = null
    return this.frame()
  }

  enterWhole(faceIndex = 0): ExplorerFrame {
    const face = FACES.at(faceIndex)
    if (!face) throw new Error("Face index must select one of the six Faces")
    this.#relativeWholePath.push(key(face))
    this.#relativeGrain -= 1
    this.#spatialAddress = "0,0,0"
    this.#selection = null
    return this.frame()
  }

  returnOutward(): ExplorerFrame {
    if (this.#relativeWholePath.length === 0) return this.frame()
    this.#relativeWholePath.pop()
    this.#relativeGrain += 1
    this.#spatialAddress = "0,0,0"
    this.#selection = null
    return this.frame()
  }

  moveSpatially(faceIndex: number): ExplorerFrame {
    const face = FACES.at(faceIndex)
    if (!face) throw new Error("Face index must select one of the six Faces")
    const [x, y, z] = this.#spatialAddress.split(",").map(Number)
    this.#spatialAddress = `${x + face.x},${y + face.y},${z + face.z}`
    this.#selection = null
    return this.frame()
  }

  setQueryDepth(depth: number): ExplorerFrame {
    if (!Number.isSafeInteger(depth) || depth < 0 || depth > 4) {
      throw new Error("Interactive query depth must be an integer from 0 through 4")
    }
    this.#queryDepth = depth
    return this.frame()
  }

  selectTickRelation(address: string): ExplorerFrame {
    const ledger = this.#cursor > 0 ? this.#ledgers[this.#cursor - 1] : null
    if (!ledger?.entries.some((entry) => entry.address === address)) {
      throw new Error(`Address ${address} is not selectable in the current tick`)
    }
    this.#selection = { source: "TICK_LEDGER", address }
    return this.frame()
  }

  selectProjectionRelation(normalizedAddress: string): ExplorerFrame {
    const projection = projectWhole(Math.max(1, -this.#relativeGrain + 1))
    if (!projection.entries.some((entry) => entry.normalizedAddress === normalizedAddress)) {
      throw new Error(
        `Address ${normalizedAddress} is not selectable in the whole projection`,
      )
    }
    this.#selection = {
      source: "WHOLE_PROJECTION",
      address: normalizedAddress,
    }
    return this.frame()
  }

  frame(): ExplorerFrame {
    const state = this.state
    const next = this.#history.at(this.#cursor + 1) ?? null
    const currentLedger = this.#cursor > 0 ? this.#ledgers[this.#cursor - 1] : null
    const projection = projectWhole(Math.max(1, -this.#relativeGrain + 1))
    const [x, y, z] = this.#spatialAddress.split(",").map(Number)
    const centre: EventAddress = {
      grain: this.#relativeGrain,
      act: state.act,
      x,
      y,
      z,
    }
    const query = queryField(centre, this.#queryDepth)
    let explanation: CausalExplanation | null = null
    if (this.#selection?.source === "TICK_LEDGER" && currentLedger) {
      explanation = explainTick(currentLedger, this.#selection.address)
    }
    if (this.#selection?.source === "WHOLE_PROJECTION") {
      const entry = projection.entries.find(
        (item) => item.normalizedAddress === this.#selection?.address,
      )
      if (entry) explanation = explainProjection(entry)
    }

    return Object.freeze({
      kernelVersion: "first-act-gf2-v1",
      observer: Object.freeze({
        act: state.act,
        relativeGrain: this.#relativeGrain,
        relativeWholePath: Object.freeze([...this.#relativeWholePath]),
        spatialAddress: this.#spatialAddress,
        queryDepth: this.#queryDepth,
      }),
      chronology: Object.freeze({
        was: sorted(state.was),
        is: sorted(state.is),
        next: next ? sorted(next.is) : null,
      }),
      currentLedger,
      wholeProjection: Object.freeze({
        presentations: projection.presentations,
        addressedRelations: projection.entries.length,
        resolvedSame: projection.entries.filter((entry) => entry.result === "SAME").length,
        outwardDifference: projection.entries.filter(
          (entry) => entry.result === "DIFFERENT",
        ).length,
        entries: projection.entries,
      }),
      scene: buildWholeScene(
        Math.max(1, -this.#relativeGrain + 1),
        this.#selection?.source === "WHOLE_PROJECTION"
          ? this.#selection.address
          : null,
      ),
      recursiveQuery: Object.freeze({
        eventCount: query.events.size,
        relationCount: query.edges.length,
        frontierCount: query.frontier.size,
        frontierIsExpandable: true,
        query: Object.freeze({
          centre: query.centre,
          radius: query.radius,
          events: Object.freeze([...query.events].sort()),
          edges: query.edges,
          frontier: Object.freeze([...query.frontier].sort()),
        }),
      }),
      provenance: PROVENANCE,
      selected: this.#selection,
      explanation,
    })
  }
}
