export type ClaimStatus = "GIVEN" | "DERIVED" | "SELECTED" | "UNRESOLVED"

export type Presentation = Readonly<{
  id: "THIS" | "IS_NOT_THIS"
  reference: string
}>

export type FirstActState = Readonly<{
  moment: number
  grain: string
  root: "NOTHING"
  was: readonly string[]
  did: string
  is: readonly string[]
  canBe: readonly string[]
  status: ClaimStatus
  parents: readonly number[]
  evidence: string
}>

export type FirstActResolution = Readonly<{
  presentations: readonly Presentation[]
  moments: readonly FirstActState[]
  admittedRelations: readonly string[]
  selectedProjections: readonly string[]
}>

const freezeState = (state: FirstActState): FirstActState => Object.freeze({
  ...state,
  was: Object.freeze([...state.was]),
  is: Object.freeze([...state.is]),
  canBe: Object.freeze([...state.canBe]),
  parents: Object.freeze([...state.parents]),
})

/**
 * Reconstructs the whitepaper's carrier-independent admission order.
 * Words such as wave, medium, ripple and spiral name relations admitted by
 * retained Difference; they are not coordinates or empirical identities.
 */
export function reconstructFirstAct(grain = "G0"): FirstActResolution {
  const reference = `${grain}:R0`
  const presentations = Object.freeze<Presentation[]>([
    Object.freeze({ id: "THIS", reference }),
    Object.freeze({ id: "IS_NOT_THIS", reference }),
  ])

  const moments = Object.freeze<FirstActState[]>([
    freezeState({
      moment: 0, grain, root: "NOTHING", was: [], did: "NO ACT",
      is: [], canBe: ["FIRST DIFFERENCE"], status: "GIVEN", parents: [],
      evidence: "No represented Difference.",
    }),
    freezeState({
      moment: 1, grain, root: "NOTHING", was: [],
      did: "DISTINGUISH AT ONE REFERENCE",
      is: presentations.map(({ id }) => id),
      canBe: ["ORIENTATION CHANGE"], status: "GIVEN", parents: [0],
      evidence: "Joe's selected First Act presents THIS and IS-NOT-THIS at one reference.",
    }),
    freezeState({
      moment: 2, grain, root: "NOTHING",
      was: presentations.map(({ id }) => id),
      did: "RETAIN ONE NON-ZERO ORIENTATION CHANGE ε(G)",
      is: ["THIS@ε(G)", "IS_NOT_THIS@0", "ORIENTATION_REMAINDER"],
      canBe: ["MINIMUM CLOSURE"], status: "DERIVED", parents: [1],
      evidence: "Changing orientation retains the reference; translation would import a destination and path.",
    }),
    freezeState({
      moment: 3, grain, root: "NOTHING",
      was: ["THIS@ε(G)", "IS_NOT_THIS@0", "ORIENTATION_REMAINDER"],
      did: "RESOLVE THE ALLOWANCE BETWEEN PRESENTATIONS",
      is: ["MINIMUM_CLOSURE", "FIRST_WAVE", "LOCAL_MEDIUM"],
      canBe: ["RECURSIVE RETENTION"], status: "DERIVED", parents: [2],
      evidence: "Wave and medium are two views of the same first closure relation.",
    }),
    freezeState({
      moment: 4, grain, root: "NOTHING",
      was: ["MINIMUM_CLOSURE", "FIRST_WAVE", "LOCAL_MEDIUM"],
      did: "RETAIN CLOSURE AS THE NEXT GRAIN'S WAS",
      is: ["RIPPLE", "INHERITED_ORIENTATION", "GRAIN_AVAILABLE"],
      canBe: ["NESTED_RESOLUTION", "SPIRAL"], status: "DERIVED", parents: [3],
      evidence: "A child Grain inherits its parent's IS; its local ε is a new DID.",
    }),
    freezeState({
      moment: 5, grain, root: "NOTHING",
      was: ["RIPPLE", "INHERITED_ORIENTATION", "GRAIN_AVAILABLE"],
      did: "REPEAT WITHOUT ERASING RETAINED ORIENTATION",
      is: ["RIPPLE", "SPIRAL", "RECURSIVE_MEDIUM"],
      canBe: ["LOCAL_CLOSURES", "OPTIONAL_PROJECTIONS"], status: "DERIVED", parents: [4],
      evidence: "Repetition begins from changed orientation, so it does not retrace the first path.",
    }),
  ])

  const admittedRelations = Object.freeze([
    ...new Set(moments.flatMap(({ is }) => is)),
  ])
  return Object.freeze({
    presentations,
    moments,
    admittedRelations,
    selectedProjections: Object.freeze(["BINARY", "CUBE", "SIX_FACE_GRID", "GF(2)_PARITY"]),
  })
}

export function reconstructChildGrain(
  parent: FirstActState,
  childGrain: string,
): FirstActState {
  if (parent.is.length === 0) throw new Error("A child Grain requires retained parent IS")
  return freezeState({
    moment: parent.moment + 1,
    grain: childGrain,
    root: parent.root,
    was: parent.is,
    did: `RETAIN LOCAL NON-ZERO ORIENTATION CHANGE ε(${childGrain})`,
    is: [...parent.is, `LOCAL_ORIENTATION@${childGrain}`],
    canBe: ["CHILD_CLOSURE", "FURTHER_GRAIN"],
    status: "DERIVED",
    parents: [parent.moment],
    evidence: `Parent ${parent.grain} IS is inherited without replacement.`,
  })
}
