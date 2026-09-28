export const CANONICAL_SEED = Object.freeze({
  zero: "ZERO",
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
    matchLikeForLike: true,
    matchKindForKind: true,
  }),
  address: Object.freeze({required:true,returnRequired:true}),
  difference: Object.freeze({required:true,unresolvedRemainsOpen:true}),
  recursion: Object.freeze({selfSimilar:true,sameOperationAtEveryAddress:true}),
} as const)

export const OPEN_DIFFERENCES = Object.freeze([
  "fracture-cardinality",
  "absolute-coordinate-basis",
  "exact-twist-transform",
  "projection-geometry",
] as const)

export type CanonicalSeed = typeof CANONICAL_SEED
