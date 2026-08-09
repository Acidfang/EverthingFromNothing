export type ClaimStatus = "GIVEN" | "DERIVED" | "SELECTED" | "UNRESOLVED"
export type FrameView = "FIRST_FRAME" | "CLOUD_FRAME" | "STRUCTURE_FRAME"

export type Presentation = Readonly<{
  id: "FACE_A" | "FACE_B"
  reference: string
}>

export type FirstActState = Readonly<{
  phase: number
  outerMoment: 1
  frame: FrameView
  temporalGrain: 0 | -1 | -2
  root: "FIRST_DIFFERENCE"
  was: readonly string[]
  did: string
  is: readonly string[]
  introduced: readonly string[]
  canBe: readonly string[]
  status: ClaimStatus
  parents: readonly number[]
  evidence: string
}>

export type FirstActResolution = Readonly<{
  outerMoment: 1
  presentations: readonly Presentation[]
  phases: readonly FirstActState[]
  moments: readonly FirstActState[]
  selectedProjections: readonly string[]
}>

type PhaseSource = readonly [
  frame: FrameView,
  temporalGrain: 0 | -1 | -2,
  did: string,
  introduced: readonly string[],
  next: string,
  evidence: string,
]

const SOURCES: readonly PhaseSource[] = [
  ["FIRST_FRAME", 0, "SELECT ONE FIRST DIFFERENCE", ["THIS", "IS_NOT_THIS"], "COMPLETE_RECURSIVE_RIPPLE", "The outer First-Act Moment already contains its complete recursively resolvable ripple."],
  ["CLOUD_FRAME", -1, "ZOOM TEMPORAL RESOLUTION; DO NOT CHANGE THE ACT", ["FACE_A", "FACE_B", "CURRENT_REFERENCE"], "ORIENTATION_TEST", "Two faces are relational presentations at one reference; no geometry, axes, distance or volume is imported."],
  ["CLOUD_FRAME", -1, "REJECT THE UNRESOLVED EXTERNAL STEP", ["STEP_REQUIRES_DESTINATION", "STEP_REQUIRES_PATH"], "LOOK_AROUND", "Translation cannot be retained before location, distance, direction, path and destination exist."],
  ["CLOUD_FRAME", -1, "RETAIN THE CURRENT REFERENCE AND LOOK AROUND", ["ORIENTATION_CHANGE"], "EPSILON_ROTATION", "Looking around changes orientation without importing an external destination."],
  ["CLOUD_FRAME", -1, "RETAIN THE SMALLEST DISTINGUISHABLE ORIENTATION CHANGE", ["ROTATION@ε(G)"], "ORIENTED_DIFFERENCE", "ε(G) is the smallest non-zero rotation distinguishable at the selected Grain."],
  ["CLOUD_FRAME", -1, "COMPARE THE TWO ORIENTED PRESENTATIONS", ["ORIENTED_DIFFERENCE", "INHERITED_BIAS"], "CONNECTING_ALLOWANCE", "The changed view cannot remain perfectly coincident with its retained presentation."],
  ["CLOUD_FRAME", -1, "ADDRESS THE ALLOWANCE BETWEEN THE PRESENTATIONS", ["CONNECTING_ALLOWANCE"], "MINIMUM_CLOSURE", "The Difference remains reconstructable only when its connecting allowance is retained."],
  ["CLOUD_FRAME", -1, "CLOSE THE MINIMUM CONNECTING ALLOWANCE", ["FIRST_WAVE", "LOCAL_MEDIUM"], "RECURSIVE_WAVE", "First wave and local medium are two projections of the same minimum closure."],
  ["CLOUD_FRAME", -1, "CARRY THE ORIENTED DIFFERENCE THROUGH THE FORMED MEDIUM", ["CARRIED_DIFFERENCE"], "RIPPLE", "The medium is not pre-existing substance; it is the retained relation that carries the Difference."],
  ["CLOUD_FRAME", -1, "REPEAT THE SAME CLOSURE AT EVERY EXPOSED FACE", ["RECURSIVE_WAVES", "RIPPLE"], "STRUCTURE_ZOOM", "Further recursive waves constitute the ripple inside the same outer Moment."],
  ["STRUCTURE_FRAME", -2, "ZOOM AGAIN; RETAIN THE PARENT RIPPLE", ["INHERITED_RIPPLE", "LOCAL_GRAINS"], "NESTED_ORIENTATION", "The structure frame is contained inside the cloud frame and cannot rewrite its parent."],
  ["STRUCTURE_FRAME", -2, "REPEAT FROM RETAINED ORIENTATION", ["NESTED_SPIRAL"], "LOCAL_CLOSURE", "Retained rotation prevents recursive return from retracing an indistinguishable path."],
  ["STRUCTURE_FRAME", -2, "CLOSE A RECURRING LOCAL PATH", ["RECURRING_LOCAL_CLOSURE"], "PARTICLE_LIKE_RELATION", "Localization is recurring closure in the formed medium, not an inserted lump."],
  ["STRUCTURE_FRAME", -2, "RETAIN EACH CLOSURE AS A PRESENTED FACE", ["FIELD", "MEDIUM", "PATH", "CONTAINER"], "FURTHER_GRAIN", "Stable repetitions expose the structures already causally contained by the First Frame."],
] as const

function freezeState(state: FirstActState): FirstActState {
  return Object.freeze({
    ...state,
    was: Object.freeze([...state.was]),
    is: Object.freeze([...state.is]),
    introduced: Object.freeze([...state.introduced]),
    canBe: Object.freeze([...state.canBe]),
    parents: Object.freeze([...state.parents]),
  })
}

/** Three nested views of one outer Moment. Phase changes resolution, not Act. */
export function reconstructFirstAct(grain = "G0"): FirstActResolution {
  const reference = `${grain}:R0`
  const presentations = Object.freeze<Presentation[]>([
    Object.freeze({ id: "FACE_A", reference }),
    Object.freeze({ id: "FACE_B", reference }),
  ])
  const phases: FirstActState[] = []
  for (const [frame, temporalGrain, did, introduced, next, evidence] of SOURCES) {
    const parent = phases.at(-1)
    const was = parent?.is ?? []
    phases.push(freezeState({
      phase: phases.length,
      outerMoment: 1,
      frame,
      temporalGrain,
      root: "FIRST_DIFFERENCE",
      was,
      did,
      introduced,
      is: [...new Set([...was, ...introduced])],
      canBe: [next],
      status: phases.length === 0 ? "GIVEN" : "DERIVED",
      parents: parent ? [parent.phase] : [],
      evidence,
    }))
  }
  const frozen = Object.freeze(phases)
  return Object.freeze({
    outerMoment: 1,
    presentations,
    phases: frozen,
    moments: frozen,
    selectedProjections: Object.freeze(["CUBE", "REPEATING_GRID", "GF(2)_PARITY"]),
  })
}

export function reconstructChildGrain(
  parent: FirstActState,
  childGrain: string,
): FirstActState {
  return freezeState({
    phase: parent.phase + 1,
    outerMoment: 1,
    frame: "STRUCTURE_FRAME",
    temporalGrain: -2,
    root: parent.root,
    was: parent.is,
    did: `RETAIN ${childGrain} AS A PRESENTED SURFACE`,
    introduced: [`LOCAL_ORIENTATION@${childGrain}`],
    is: [...parent.is, `LOCAL_ORIENTATION@${childGrain}`],
    canBe: ["FURTHER_GRAIN"],
    status: "DERIVED",
    parents: [parent.phase],
    evidence: "The child inherits the complete parent IS before resolving its own presented Difference.",
  })
}
