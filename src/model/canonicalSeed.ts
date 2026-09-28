export const CANONICAL_SEED = Object.freeze({
  zero: "ZERO",
  tetrahedrons: 3,
  topology: Object.freeze({
    tipsPerTetrahedron: 4,
    temporalTipsPerTetrahedron: 3,
    proceedTipsPerTetrahedron: 1,
    tipIsNotAutomaticallyChild: true,
    nodeIsCentrePixel: true,
    tipIsConnectionDirection: true,
  }),
  fracture: Object.freeze({
    addressedChildren: 4,
    pairGates: 6,
    triadGates: 4,
    childrenAreIndependentRoots: false,
    childRetainsOriginState: true,
    childOwnsRecursiveChildArray: true,
  }),
  temporalRoles: Object.freeze(["WAS", "IS", "NEXT"] as const),
  proceedIsTemporal: false,
  transition: Object.freeze({
    nextBecomes: "IS",
    isBecomes: "WAS",
    wasBecomes: "NEXT",
    movement: "SEQUENTIAL_FOLLOW_LOCK",
    twist: true,
    rotate: true,
    turn: true,
    spine: Object.freeze({
      inheritIncomingTwist: true,
      inheritIncomingRotation: true,
      matchLikeForLike: true,
      matchKindForKind: true,
      verifyStraightThroughAfterMatchingTwist: true,
      relation: "PREVIOUS_TIP_TO_NEXT_CENTRE_PIXEL",
      doNotChooseDifferentTwistForStraighterGeometry: true,
      noIndependentNodeReorientation: true,
    }),
  }),
  address: Object.freeze({required:true,returnRequired:true}),
  difference: Object.freeze({required:true,unresolvedRemainsOpen:true}),
  recursion: Object.freeze({selfSimilar:true,sameOperationAtEveryAddress:true}),
} as const)

// Deliberately unresolved. Later stages must not invent these.
export const OPEN_DIFFERENCES = Object.freeze([
  "absolute-coordinate-basis",
  "exact-twist-angle-values",
  "projection-geometry",
] as const)

export type CanonicalSeed = typeof CANONICAL_SEED
