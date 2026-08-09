export type ProvenanceStatus =
  | "GIVEN"
  | "DERIVED"
  | "SELECTED"
  | "GENERATED"
  | "UNRESOLVED"

export type ProvenanceNode = Readonly<{
  id: string
  label: string
  status: ProvenanceStatus
  parents: readonly string[]
  reason: string
  resolution: ResolutionRecord
}>

export type ResolutionRecord = Readonly<{
  root: string
  input: string
  operation: string
  output: string
  grain: string
  moment: string
  evidence: string
  closure: string
}>

const record = (input: string, operation: string, output: string, moment: string,
  evidence: string, closure: string): ResolutionRecord => Object.freeze({
  root: "FIRST DIFFERENCE",
  input, operation, output,
  grain: "EXECUTABLE MODEL",
  moment, evidence, closure,
})

export const PROVENANCE: readonly ProvenanceNode[] = Object.freeze([
  {
    id: "nothing",
    label: "NOTHING",
    status: "GIVEN",
    parents: [],
    reason: "No represented Difference.",
    resolution: record("NO REPRESENTED STATE", "RETAIN ABSENCE", "NOTHING", "M0", "MODEL DEFINITION", "NO DIFFERENCE REPRESENTED"),
  },
  {
    id: "first-difference",
    label: "FIRST DIFFERENCE",
    status: "GIVEN",
    parents: ["nothing"],
    reason: "The sole nonempty seed supplied to the executable model.",
    resolution: record("NOTHING", "INTRODUCE ONE DISTINCTION", "FIRST DIFFERENCE", "M1", "DECLARED SEED", "ONE NONEMPTY STATE RETAINED"),
  },
  {
    id: "recurrence-required",
    label: "RECURRENCE REQUIRED",
    status: "DERIVED",
    parents: ["first-difference"],
    reason: "An unresolved relation remains available to be resolved.",
    resolution: record("FIRST DIFFERENCE", "TEST FOR REMAINING RELATION", "RECURRENCE REQUIRED", "M1→M2", "RECURSION PREMISE", "NEXT RESOLUTION REMAINS ADDRESSABLE"),
  },
  {
    id: "six-face-grid",
    label: "SIX-FACE GRID",
    status: "SELECTED",
    parents: ["first-difference"],
    reason: "The current coordinate formalization; uniqueness is not derived.",
    resolution: record("FIRST DIFFERENCE", "PROJECT ON SIX ORIENTED FACES", "SIX-FACE GRID", "SELECTED FORMALIZATION", "MODEL SOURCE", "COORDINATE CARRIER DECLARED; UNIQUENESS OPEN"),
  },
  {
    id: "gf2",
    label: "GF(2) SAME / DIFFERENT",
    status: "SELECTED",
    parents: ["first-difference", "six-face-grid"],
    reason: "The current exact parity algebra; uniqueness is not derived.",
    resolution: record("FACE PRESENTATIONS", "RESOLVE PARITY", "GF(2) SAME / DIFFERENT", "EACH UPDATE", "KERNEL TESTS", "PARITY RESULT EXACT; PHYSICAL IDENTITY OPEN"),
  },
  {
    id: "reversible-update",
    label: "REVERSIBLE UPDATE",
    status: "DERIVED",
    parents: ["recurrence-required", "gf2"],
    reason: "The declared recurrence exactly recovers its prior state.",
    resolution: record("WAS + DECLARED DIFFERENCE", "APPLY XOR UPDATE", "IS", "ONE TICK", "FORWARD/REVERSE TEST", "REVERSE RECONSTRUCTS WAS"),
  },
  {
    id: "whole-web",
    label: "WHOLE WEB FAMILY",
    status: "GENERATED",
    parents: ["reversible-update"],
    reason: "Calculated by repeated application of the declared update.",
    resolution: record("RETAINED IS", "REPEAT DECLARED UPDATE", "WHOLE WEB FAMILY", "REQUESTED ACT", "GENERATED SNAPSHOT", "REQUESTED MODEL BOUNDARY RESOLVED"),
  },
  {
    id: "physical-identity",
    label: "EXTERNAL COMPARISON",
    status: "UNRESOLVED",
    parents: ["whole-web"],
    reason: "Generated results are model facts; relationships to currently named observations require an explicit mapping.",
    resolution: record("GENERATED MODEL STATE", "COMPARE THROUGH AN EXPLICIT MAPPING", "EXTERNAL COMPARISON", "OBSERVATION BOUNDARY", "NO MAPPING SUPPLIED", "UNRESOLVED UNTIL NATIVE EVIDENCE CLOSES"),
  },
] satisfies readonly ProvenanceNode[])

const BY_ID = new Map(PROVENANCE.map((node) => [node.id, node]))

export function ancestry(id: string): readonly ProvenanceNode[] {
  const ordered: ProvenanceNode[] = []
  const visited = new Set<string>()
  const visit = (current: string): void => {
    if (visited.has(current)) return
    const node = BY_ID.get(current)
    if (!node) throw new Error(`Unknown provenance node: ${current}`)
    node.parents.forEach(visit)
    visited.add(current)
    ordered.push(node)
  }
  visit(id)
  return ordered
}

export function mayClaimExternalIdentity(id: string): boolean {
  return ancestry(id).every(
    (node) => node.status === "GIVEN" || node.status === "DERIVED",
  )
}
