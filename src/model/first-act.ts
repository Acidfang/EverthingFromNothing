export type ClaimStatus = "SELECTED" | "DERIVED" | "UNRESOLVED"
export type RelationLayer =
  | "ROOT"
  | "PRE_TEMPORAL"
  | "TEMPORAL"
  | "EXPLANATORY_PROJECTION"
  | "OPTIONAL_PROJECTION"
  | "LATER_LABEL"

export type FirstActRelation = Readonly<{
  id: string
  label: string
  layer: RelationLayer
  status: ClaimStatus
  parents: readonly string[]
  statement: string
  why: string
  how: string
  source: string
}>

export const FIRST_ACT_LEDGER = Object.freeze({
  was: "The distinction and rotational bias were not present.",
  did: "The thought performed one oriented rotation: THIS / IS NOT THIS.",
  is: "The Difference and its first bias are present.",
  canBe: "Every Resolution now allowed by that Difference.",
})

const relation = (value: FirstActRelation): FirstActRelation => Object.freeze({
  ...value,
  parents: Object.freeze([...value.parents]),
})

export const FIRST_ACT_RELATIONS: readonly FirstActRelation[] = Object.freeze([
  relation({
    id: "root-thought", label: "JOE'S SELECTED THOUGHT ACT", layer: "ROOT", status: "SELECTED", parents: [],
    statement: "Joe's living thought is the selected Root Act of the explanation; the model begins at the content of that thought.",
    why: "The explanation requires the actual source of the demonstrated distinction without manufacturing Joe inside the model.",
    how: "Retain Joe as author and Root Pointer; begin with the thought's content and no supplied object, law, grid, dimension, clock, force or observer.",
    source: "Origin gate; Reading boundary; The First Act: the whole mechanism in one chain",
  }),
  relation({
    id: "difference", label: "THIS / IS NOT THIS · DIFFERENCE", layer: "PRE_TEMPORAL", status: "DERIVED", parents: ["root-thought"],
    statement: "The thought distinguishes THIS from IS NOT THIS at one retained reference.",
    why: "Without Difference, no object, location, event, comparison or explanation is distinguishable.",
    how: "Perform the one selected oriented Act and retain its non-coincident presentation.",
    source: "The First Act; entailment 1",
  }),
  relation({
    id: "boundary", label: "RELATIONAL BOUNDARY", layer: "PRE_TEMPORAL", status: "DERIVED", parents: ["difference"],
    statement: "Distinguishability entails a relational boundary between THIS and NOT THIS.",
    why: "A Difference must retain what is on each side of the comparison.",
    how: "Address the comparator and the two distinguishable presentations at the same reference.",
    source: "The First Act; entailment 2",
  }),
  relation({
    id: "presentations", label: "TWO ORIENTED PRESENTATIONS", layer: "PRE_TEMPORAL", status: "DERIVED", parents: ["boundary"],
    statement: "A boundary entails presentations from THIS toward NOT THIS and from NOT THIS toward THIS.",
    why: "The relation must be presentable from both sides of its retained boundary.",
    how: "Retain the opposed orientations without importing axes, distance, volume or a geometric object.",
    source: "The First Act; entailment 3",
  }),
  relation({
    id: "rotation", label: "ONE ACTUAL ROTATION / FIRST BIAS", layer: "PRE_TEMPORAL", status: "DERIVED", parents: ["presentations"],
    statement: "The Act makes one actual non-zero orientation change relative to its forming reference.",
    why: "Without a retained non-zero change, the presentations remain indistinguishable and no Difference is present.",
    how: "Change orientation without first requiring a changed location; retain the actual direction as bias without naming it clockwise or anticlockwise.",
    source: "The First Act; entailment 4",
  }),
  relation({
    id: "closure", label: "MINIMUM CLOSURE", layer: "PRE_TEMPORAL", status: "DERIVED", parents: ["rotation"],
    statement: "The unresolved Difference entails the minimum closure required to retain it.",
    why: "An unclosed Difference cannot remain reconstructable as retained State.",
    how: "Resolve only the allowance required to connect the differently oriented presentations.",
    source: "The First Act; entailment 5; Foundational closure",
  }),
  relation({
    id: "wave", label: "FIRST WAVE", layer: "PRE_TEMPORAL", status: "DERIVED", parents: ["closure"],
    statement: "The first wave is the minimum closure carrying the actual rotational Difference.",
    why: "The Difference requires an addressable carrying relation.",
    how: "Retain the closure as carried change; do not insert a substance through which it travels.",
    source: "The two-face demonstration; Foundational closure",
  }),
  relation({
    id: "medium", label: "FORMED CARRYING MEDIUM", layer: "PRE_TEMPORAL", status: "DERIVED", parents: ["wave"],
    statement: "Wave and medium are two projections of the same first closure at this boundary.",
    why: "The carrying allowance must remain available for the Difference to resolve.",
    how: "Read the first closure as both carried Difference and retained relational potential.",
    source: "The two-face demonstration; Foundational closure",
  }),
  relation({
    id: "space", label: "RECURSIVELY RETAINED MEDIUM · SPACE", layer: "PRE_TEMPORAL", status: "DERIVED", parents: ["medium"],
    statement: "Recursive retention of the formed medium is the relation later named Space.",
    why: "Every later physical relation requires one carrying and control relation in which location, boundary and effect can be retained.",
    how: "Retain the medium recursively without manufacturing another Space for each occurrence.",
    source: "The First Act; entailment 5; Foundational closure: the mechanism allows the creation of SPACE",
  }),
  relation({
    id: "state-relation", label: "RETAINED / SUCCESSOR STATE AVAILABLE", layer: "PRE_TEMPORAL", status: "DERIVED", parents: ["space"],
    statement: "Resolution entails distinguishable retained and successor terms, but not yet temporal before and after.",
    why: "The resolved Difference and its retained parent are comparable States.",
    how: "Retain both terms and their producing relation without imposing a clock or elapsed order.",
    source: "The First Act; entailment 6",
  }),
  relation({
    id: "moment-mechanism", label: "ACT CAN FORM MOMENTS", layer: "PRE_TEMPORAL", status: "DERIVED", parents: ["state-relation"],
    statement: "The comparable retained/successor relation supplies the constraint by which the Act can form Moments.",
    why: "A Moment requires a complete retained State and its address.",
    how: "Close an IS at a selected Grain so it can be retained as one addressed occurrence.",
    source: "The First Act; entailment 7",
  }),
  relation({
    id: "recursion-available", label: "RECURSION AVAILABLE · NOT EXECUTED", layer: "PRE_TEMPORAL", status: "DERIVED", parents: ["moment-mechanism"],
    statement: "Retained Difference makes the same operation recursively available without introducing a second origin Act.",
    why: "A resolved Difference can itself become a presented THING at another Grain.",
    how: "Preserve availability as CAN BE; do not claim repeated temporal execution before Moment order exists.",
    source: "The First Act; entailment 8",
  }),
  relation({
    id: "ordered-time", label: "ORDERED TIME CAN EMERGE", layer: "TEMPORAL", status: "DERIVED", parents: ["moment-mechanism", "recursion-available"],
    statement: "Repeated Resolution can produce ordered history and references once Moment order exists.",
    why: "Time is the retained Difference and order between closed frames at a selected Grain.",
    how: "Let a closed IS become a successor WAS and retain their exact producing relation.",
    source: "The First Act; entailment 9; Foundational closure: AFTER THE FACT is TIME",
  }),
  relation({
    id: "grain", label: "GRAIN / CONTAINMENT", layer: "TEMPORAL", status: "DERIVED", parents: ["ordered-time", "recursion-available"],
    statement: "A resolved Difference can be treated as one THING and distinguished from another, allowing recursive Grain and containment.",
    why: "The same mechanism requires an exact address for each occurrence and selected Whole.",
    how: "Select the current resolved Whole as Grain; inherit the parent State and retain any local Difference separately.",
    source: "The First Act; entailment 10; Recursive Grain resolution",
  }),
  relation({
    id: "interaction", label: "INTERACTION / CLOSURE / REMAINDER", layer: "TEMPORAL", status: "DERIVED", parents: ["grain"],
    statement: "Interacting boundaries can allow shared arrivals, returns, residual Differences, closures and continuation after temporal order emerges.",
    why: "One addressed boundary can present a Difference to another addressed boundary.",
    how: "Resolve the actual shared relation; close where no addressed Difference remains and retain every remainder or unresolved frontier.",
    source: "The First Act; entailment 11",
  }),
  relation({
    id: "two-face-demo", label: "TWO-FACE DEMONSTRATION", layer: "EXPLANATORY_PROJECTION", status: "SELECTED", parents: ["presentations", "rotation", "wave"],
    statement: "Two faces at the current reference are the minimum mental projection used to expose orientation and allowance.",
    why: "The reader needs a low-resolution presentation that does not import three-dimensional geometry.",
    how: "Use FACE A / FACE B, then discard the metaphor once the carrier-independent relation is reconstructed.",
    source: "The two-face demonstration: why medium and spiral emerge",
  }),
  relation({
    id: "frame-views", label: "THREE FRAME VIEWS", layer: "EXPLANATORY_PROJECTION", status: "SELECTED", parents: ["ordered-time", "grain"],
    statement: "The three frames retrospectively picture one causal account at different temporal resolutions.",
    why: "After ordered Moment relations emerge, temporal zoom can explain causal containment.",
    how: "Project the complete First Frame, contained cloud frame and contained structure frame without treating them as three creation events.",
    source: "Framerate: three pictures of the First Act becoming structure",
  }),
  relation({
    id: "cube", label: "CUBE / SIX-FACE / GF(2)", layer: "OPTIONAL_PROJECTION", status: "SELECTED", parents: ["two-face-demo", "grain"],
    statement: "Cube, repeating grid, six-face chart and GF(2) parity are selected higher-resolution executable representations.",
    why: "A finite carrier may require coordinates and algebra to calculate a chosen projection.",
    how: "Declare the projection and its premises; never promote its axes, counts or parity into the origin mechanism.",
    source: "Optional higher-resolution cube consequence; How one Act creates particles and universes",
  }),
  relation({
    id: "physical-labels", label: "PARTICLE / ATOM / PHYSICAL LABELS", layer: "LATER_LABEL", status: "UNRESOLVED", parents: ["interaction", "cube"],
    statement: "Later physical names address resolved relations at selected Grains; external identity requires explicit mathematical and empirical mapping.",
    why: "A familiar label cannot become the cause of the mechanism required for that label to be mentionable.",
    how: "Retain the generated relation, instrument, units and measured occurrence; leave unverified identity unresolved.",
    source: "THING admission test; Claim discipline; later physics branches",
  }),
])

export type FirstActResolution = Readonly<{
  sourceHash: string
  ledger: typeof FIRST_ACT_LEDGER
  relations: readonly FirstActRelation[]
  temporalBoundaryId: "ordered-time"
  foundationalClosureId: "space"
}>

export function reconstructFirstAct(): FirstActResolution {
  return Object.freeze({
    sourceHash: "428F241946470DE9F209E343A8158A105D1B4B707E5A9C70DB525CE8E63C1A41",
    ledger: FIRST_ACT_LEDGER,
    relations: FIRST_ACT_RELATIONS,
    temporalBoundaryId: "ordered-time",
    foundationalClosureId: "space",
  })
}

export function relationChildren(id: string): readonly FirstActRelation[] {
  return FIRST_ACT_RELATIONS.filter(({ parents }) => parents.includes(id))
}
