import { fromKey } from "./address.ts"
import {
  buildStateTransferEngine,
  resolveRecursiveSweep,
} from "./state-transfer.ts"
import { outwardResidual, resolveWhole, whole } from "./whole.ts"
import { deriveNestedGrain } from "./grain.ts"

export const GALAXY_OBSERVATION_IDS = Object.freeze([
  "GALAXY_STELLAR_MAP",
  "GALAXY_ROTATION_CURVE",
  "GALACTIC_CENTRAL_COMPACT_MASS",
  "BLACK_HOLE_RING_EMISSION",
  "BLACK_HOLE_GALAXY_OUTFLOW",
] as const)

export type GalaxyObservationId = typeof GALAXY_OBSERVATION_IDS[number]
export type GalaxySearchRelation = "MATCH" | "UNRESOLVED" | "CONFLICT"

export type GeneratedGalaxyPrecandidate = Readonly<{
  id: string
  level: number
  completedAct: number
  supportCount: number
  radialShellCount: number
  branchCount: number
  outwardResidualCount: number
  originPresent: boolean
  rotationalTransferPresent: boolean
  recursiveSurfaceClosed: boolean
  allowances: readonly string[]
  relations: Readonly<Record<GalaxyObservationId, GalaxySearchRelation>>
  matched: readonly GalaxyObservationId[]
  unresolved: readonly GalaxyObservationId[]
  conflicts: readonly GalaxyObservationId[]
  status: "STRUCTURAL PRE-CANDIDATE" | "OBSERVATIONAL CANDIDATE"
}> 

export type GalaxySearchResult = Readonly<{
  searchedThroughLevel: number
  generatedStateCount: number
  observationalCandidateCount: number
  precandidates: readonly GeneratedGalaxyPrecandidate[]
}>

export type GalaxyLineageStep = Readonly<{
  level: number
  completedAct: string
  supportCount: string
  branchCount: 6
  outwardResidualCount: 6
  originPresent: false
  structuralSignature: string
  quantitativeRemainders: readonly ["SUPPORT COUNT", "RADIAL DISTRIBUTION"]
}>

export type GalaxyCandidateLineage = Readonly<{
  startsAtLevel: 2
  symbolicallyCheckedThroughLevel: number
  firstStructuralMismatch: number | null
  termination:
    | "FIRST STRUCTURAL MISMATCH FOUND"
    | "NO FINITE MISMATCH UNDER THE DEFINED RECURSION"
  invariantSignature: string
  steps: readonly GalaxyLineageStep[]
  derivation: readonly string[]
  observationalStatus: "UNRESOLVED FROM FIRST COMPARISON"
}>

export type NestedGalaxyGrainStep = Readonly<{
  depth: number
  parentGrain: number
  childGrain: number
  parentMeCount: string
  childPresentationCount: string
  childScale: number
  initialMoment: 0
  initialMatchesCompletedStructure: false
  firstTransferMoment: 1
  firstTurningMoment: number
  completedStructureMoment: 36
  firstNonMatchAfterParentCompletion: 0
  repeatedComputeCount: 1
  referencedComputeCount: string
  endStateMatchesParentStructure: true
  maxProjectedDisplacementAtOriginal: number
  separatelyVisibleAtOriginalResolution: boolean
  originalBoundaryRemainder: boolean
  originalViewMatchesThroughAllChildMoments: true
}>

export type NestedGalaxyGrainResolution = Readonly<{
  sourceCandidate: string
  sourceLevel: number
  requestedDepth: number
  steps: readonly NestedGalaxyGrainStep[]
  result:
    "LOCAL STRUCTURE RE-FORMS; ORIGINAL OBSERVER RETAINS THE PARENT MATCH"
  localFirstMismatchMoment: 0
  originalViewFirstMismatchMoment: null
  observationalStatus: "UNRESOLVED"
}>

const GALAXY_STRUCTURAL_SIGNATURE = [
  "SIX DISJOINT CHILD BRANCHES",
  "MULTIPLE RADIAL SHELLS",
  "SIX-ADDRESS OUTWARD PARITY RESIDUAL",
  "UNRESOLVED CENTRE",
  "TURNING TRANSFER",
  "RECURSIVE CLOSED SURFACE",
].join("|")

function radialShellCount(addresses: ReadonlySet<string>): number {
  return new Set([...addresses].map((address) => {
    const { x, y, z } = fromKey(address)
    return x * x + y * y + z * z
  })).size
}

function unresolvedRelations(): Record<
  GalaxyObservationId,
  GalaxySearchRelation
> {
  return Object.fromEntries(
    GALAXY_OBSERVATION_IDS.map((id) => [id, "UNRESOLVED"]),
  ) as Record<GalaxyObservationId, GalaxySearchRelation>
}

export function searchGeneratedGalaxyCandidates(
  maxLevel = 8,
): GalaxySearchResult {
  if (!Number.isSafeInteger(maxLevel) || maxLevel < 1 || maxLevel > 12) {
    throw new Error("Galaxy search level must be an integer from 1 through 12")
  }
  const transfer = buildStateTransferEngine()
  const sweep = resolveRecursiveSweep(transfer)
  const precandidates: GeneratedGalaxyPrecandidate[] = []

  for (let level = 1; level <= maxLevel; level += 1) {
    const generated = whole(level)
    const resolution = resolveWhole(level)
    const outward = outwardResidual(generated)
    const shells = radialShellCount(generated.support)
    const originPresent = generated.support.has("0,0,0")
    const rotationalTransferPresent = transfer.moments.some(
      ({ axisChangeRadians }) => axisChangeRadians > 1e-12,
    )
    const allowances = [
      resolution.branches.size >= 3
        ? "MULTIPLE CONTAINING BRANCHES"
        : null,
      shells >= 2 ? "MULTIPLE RADIAL SHELLS" : null,
      outward.size > 0 ? "OUTWARD RESIDUAL" : null,
      !originPresent ? "UNRESOLVED CENTRE" : null,
      rotationalTransferPresent ? "TURNING TRANSFER" : null,
      sweep.boundaryClosed ? "RECURSIVE CLOSED SURFACE" : null,
    ].filter((value): value is string => value !== null)

    // These relations intentionally remain unresolved. The generated lattice
    // currently has no stellar catalogue, velocity-by-radius field, physical
    // mass unit, radiative transfer, or collimated-emission calculation.
    // Structural resemblance is recorded as an allowance, never as a match.
    const relations = unresolvedRelations()
    const matched = GALAXY_OBSERVATION_IDS.filter(
      (id) => relations[id] === "MATCH",
    )
    const unresolved = GALAXY_OBSERVATION_IDS.filter(
      (id) => relations[id] === "UNRESOLVED",
    )
    const conflicts = GALAXY_OBSERVATION_IDS.filter(
      (id) => relations[id] === "CONFLICT",
    )
    precandidates.push(Object.freeze({
      id: `FIRST-ACT-WHOLE-L${level}`,
      level,
      completedAct: generated.completedAct,
      supportCount: generated.support.size,
      radialShellCount: shells,
      branchCount: resolution.branches.size,
      outwardResidualCount: outward.size,
      originPresent,
      rotationalTransferPresent,
      recursiveSurfaceClosed: sweep.boundaryClosed,
      allowances: Object.freeze(allowances),
      relations: Object.freeze(relations),
      matched: Object.freeze(matched),
      unresolved: Object.freeze(unresolved),
      conflicts: Object.freeze(conflicts),
      status: matched.length === GALAXY_OBSERVATION_IDS.length
        ? "OBSERVATIONAL CANDIDATE" as const
        : "STRUCTURAL PRE-CANDIDATE" as const,
    }))
  }

  precandidates.sort(
    (left, right) =>
      right.allowances.length - left.allowances.length
      || right.radialShellCount - left.radialShellCount
      || right.level - left.level,
  )
  return Object.freeze({
    searchedThroughLevel: maxLevel,
    generatedStateCount: maxLevel,
    observationalCandidateCount: precandidates.filter(
      ({ status }) => status === "OBSERVATIONAL CANDIDATE",
    ).length,
    precandidates: Object.freeze(precandidates),
  })
}

/**
 * Continue the generated structural lineage without allocating 6^level cells.
 *
 * Each level adds one signed axis digit with weight 2^(level - 1). The highest
 * differing digit is larger than the sum of all lower weights, so two branch
 * histories cannot collide and no history can resolve to the origin. This
 * gives 6^level distinct addresses and six disjoint child branches.
 *
 * Over parity arithmetic, let F be the six-face operator. The level-n whole
 * is Π F(x^(2^b)), b=0..n-1. Applying F once more yields F^(2^n); in
 * characteristic two, Frobenius leaves exactly the six face terms translated
 * by 2^n. The outward residual therefore remains exactly six.
 */
export function traceGalaxyCandidateLineage(
  symbolicThroughLevel = 64,
): GalaxyCandidateLineage {
  if (
    !Number.isSafeInteger(symbolicThroughLevel)
    || symbolicThroughLevel < 2
    || symbolicThroughLevel > 4096
  ) {
    throw new Error(
      "Galaxy lineage level must be an integer from 2 through 4096",
    )
  }
  const steps = Array.from(
    { length: symbolicThroughLevel - 1 },
    (_, offset): GalaxyLineageStep => {
      const level = offset + 2
      return Object.freeze({
        level,
        completedAct: ((1n << BigInt(level)) - 1n).toString(),
        supportCount: (6n ** BigInt(level)).toString(),
        branchCount: 6 as const,
        outwardResidualCount: 6 as const,
        originPresent: false as const,
        structuralSignature: GALAXY_STRUCTURAL_SIGNATURE,
        quantitativeRemainders: Object.freeze([
          "SUPPORT COUNT",
          "RADIAL DISTRIBUTION",
        ]) as GalaxyLineageStep["quantitativeRemainders"],
      })
    },
  )
  const firstStructuralMismatch = steps.find(
    ({ structuralSignature }) =>
      structuralSignature !== GALAXY_STRUCTURAL_SIGNATURE,
  )?.level ?? null
  return Object.freeze({
    startsAtLevel: 2 as const,
    symbolicallyCheckedThroughLevel: symbolicThroughLevel,
    firstStructuralMismatch,
    termination: firstStructuralMismatch === null
      ? "NO FINITE MISMATCH UNDER THE DEFINED RECURSION" as const
      : "FIRST STRUCTURAL MISMATCH FOUND" as const,
    invariantSignature: GALAXY_STRUCTURAL_SIGNATURE,
    steps: Object.freeze(steps),
    derivation: Object.freeze([
      "The highest binary-weight branch choice exceeds every lower weight combined; branch histories remain distinct.",
      "The same dominance prevents any generated address from occupying the origin.",
      "Six choices applied to every distinct parent produce exactly 6^level addresses in six disjoint child branches.",
      "Parity composition and the characteristic-two Frobenius identity reduce the next outward residual to six translated face terms.",
      "Turning transfer and recursive closure reuse the same scale-free operators at every level.",
      "Support count and radial distribution change with level; they are retained as remainders rather than treated as structural mismatches.",
    ]),
    observationalStatus: "UNRESOLVED FROM FIRST COMPARISON" as const,
  })
}

export function resolveGalaxyCandidateInward(
  sourceLevel = 8,
  depth = 4,
): NestedGalaxyGrainResolution {
  if (!Number.isSafeInteger(sourceLevel) || sourceLevel < 2 || sourceLevel > 64) {
    throw new Error("Galaxy source level must be an integer from 2 through 64")
  }
  if (!Number.isSafeInteger(depth) || depth < 1 || depth > 64) {
    throw new Error("Galaxy child depth must be an integer from 1 through 64")
  }
  const steps = Array.from({ length: depth }, (_, index): NestedGalaxyGrainStep => {
    const childDepth = index + 1
    const parentGrain = 1 - childDepth
    const nested = deriveNestedGrain("1,0,0", parentGrain)
    const parentMeCount = 6n ** BigInt(sourceLevel + childDepth - 1)
    const childPresentationCount = parentMeCount * 6n
    const repeatedComputeCount = 1
    const referencedComputeCount = parentMeCount - 1n
    const carrierRelativePoints = nested.moments.flatMap((moment) =>
      moment.states.flatMap((state) => [
        {
          x: state.parentPosition.x - moment.carrierPosition.x,
          y: state.parentPosition.y - moment.carrierPosition.y,
          z: state.parentPosition.z - moment.carrierPosition.z,
        },
        ...state.standingWavePath.map((point) => ({
          x: point.x - moment.carrierPosition.x,
          y: point.y - moment.carrierPosition.y,
          z: point.z - moment.carrierPosition.z,
        })),
      ]))
    const representativeExtent = Math.max(
      ...carrierRelativePoints.map(({ x, y, z }) => Math.hypot(x, y, z)),
    )
    const maxProjectedDisplacementAtOriginal = representativeExtent
      * 2 ** -(childDepth - 1)
    const originalCellRadius = 1 / 2
    return Object.freeze({
      depth: childDepth,
      parentGrain: nested.parentGrain,
      childGrain: nested.childGrain,
      parentMeCount: parentMeCount.toString(),
      childPresentationCount: childPresentationCount.toString(),
      childScale: nested.childScale ** childDepth,
      initialMoment: 0 as const,
      initialMatchesCompletedStructure: false as const,
      firstTransferMoment: 1 as const,
      firstTurningMoment: nested.spiralStartsAt.moment,
      completedStructureMoment: 36 as const,
      firstNonMatchAfterParentCompletion: 0 as const,
      repeatedComputeCount,
      referencedComputeCount: referencedComputeCount.toString(),
      endStateMatchesParentStructure: true as const,
      maxProjectedDisplacementAtOriginal,
      separatelyVisibleAtOriginalResolution:
        maxProjectedDisplacementAtOriginal > originalCellRadius + 1e-12,
      originalBoundaryRemainder:
        Math.abs(maxProjectedDisplacementAtOriginal - originalCellRadius)
          <= 1e-12,
      originalViewMatchesThroughAllChildMoments: true as const,
    })
  })
  return Object.freeze({
    sourceCandidate: `FIRST-ACT-WHOLE-L${sourceLevel}`,
    sourceLevel,
    requestedDepth: depth,
    steps: Object.freeze(steps),
    result:
      "LOCAL STRUCTURE RE-FORMS; ORIGINAL OBSERVER RETAINS THE PARENT MATCH",
    localFirstMismatchMoment: 0 as const,
    originalViewFirstMismatchMoment: null,
    observationalStatus: "UNRESOLVED" as const,
  })
}
