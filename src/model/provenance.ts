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
}>

export const PROVENANCE: readonly ProvenanceNode[] = Object.freeze([
  {
    id: "nothing",
    label: "NOTHING",
    status: "GIVEN",
    parents: [],
    reason: "No represented Difference.",
  },
  {
    id: "first-difference",
    label: "FIRST DIFFERENCE",
    status: "GIVEN",
    parents: ["nothing"],
    reason: "The sole nonempty seed supplied to the executable model.",
  },
  {
    id: "recurrence-required",
    label: "RECURRENCE REQUIRED",
    status: "DERIVED",
    parents: ["first-difference"],
    reason: "An unresolved relation remains available to be resolved.",
  },
  {
    id: "six-face-grid",
    label: "SIX-FACE GRID",
    status: "SELECTED",
    parents: ["first-difference"],
    reason: "The current coordinate formalization; uniqueness is not derived.",
  },
  {
    id: "gf2",
    label: "GF(2) SAME / DIFFERENT",
    status: "SELECTED",
    parents: ["first-difference", "six-face-grid"],
    reason: "The current exact parity algebra; uniqueness is not derived.",
  },
  {
    id: "reversible-update",
    label: "REVERSIBLE UPDATE",
    status: "DERIVED",
    parents: ["recurrence-required", "gf2"],
    reason: "The declared recurrence exactly recovers its prior state.",
  },
  {
    id: "whole-web",
    label: "WHOLE WEB FAMILY",
    status: "GENERATED",
    parents: ["reversible-update"],
    reason: "Calculated by repeated application of the declared update.",
  },
  {
    id: "physical-identity",
    label: "PHYSICAL IDENTITY",
    status: "UNRESOLVED",
    parents: ["whole-web"],
    reason: "No physical object identity has yet been derived.",
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
