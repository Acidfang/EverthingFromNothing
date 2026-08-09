export const NORMALIZED_CUBE_VOLUME = 8

// The prism uses an equilateral triangle of circumradius 1. Its side is √3,
// its area is 3√3/4, and its z extent is 2.
export const NORMALIZED_TRIANGULAR_PRISM_VOLUME = 3 * Math.sqrt(3) / 2

export const CHILD_LINEAR_SCALE = 1 / 2
export const CHILD_VOLUME_SCALE = CHILD_LINEAR_SCALE ** 3
export const CUBE_CHILD_BRANCH_COUNT = 6
export const PRISM_CHILD_BRANCH_COUNT = 5
export const CUBE_RECURSIVE_VOLUME_RATIO =
  CUBE_CHILD_BRANCH_COUNT * CHILD_VOLUME_SCALE
export const PRISM_RECURSIVE_VOLUME_RATIO =
  PRISM_CHILD_BRANCH_COUNT * CHILD_VOLUME_SCALE
export const CUBE_PRISM_GAP =
  NORMALIZED_CUBE_VOLUME - NORMALIZED_TRIANGULAR_PRISM_VOLUME

export function recursiveGapAtGrain(grainDepth: number): number {
  if (!Number.isSafeInteger(grainDepth) || grainDepth < 0) {
    throw new Error("Grain depth must be a non-negative safe integer")
  }
  const cubeResolutionVolume =
    NORMALIZED_CUBE_VOLUME * CUBE_RECURSIVE_VOLUME_RATIO ** grainDepth
  const prismResolutionVolume =
    NORMALIZED_TRIANGULAR_PRISM_VOLUME
    * PRISM_RECURSIVE_VOLUME_RATIO ** grainDepth
  return cubeResolutionVolume - prismResolutionVolume
}

export function cumulativeRecursiveGap(lastGrainDepth: number): number {
  if (!Number.isSafeInteger(lastGrainDepth) || lastGrainDepth < 0) {
    throw new Error("Last grain depth must be a non-negative safe integer")
  }
  const cube = NORMALIZED_CUBE_VOLUME
    * (1 - CUBE_RECURSIVE_VOLUME_RATIO ** (lastGrainDepth + 1))
    / (1 - CUBE_RECURSIVE_VOLUME_RATIO)
  const prism = NORMALIZED_TRIANGULAR_PRISM_VOLUME
    * (1 - PRISM_RECURSIVE_VOLUME_RATIO ** (lastGrainDepth + 1))
    / (1 - PRISM_RECURSIVE_VOLUME_RATIO)
  return cube - prism
}

export const SIMULTANEOUS_RECURSIVE_VOLUME = Object.freeze({
  cubeVolume: NORMALIZED_CUBE_VOLUME,
  prismVolume: NORMALIZED_TRIANGULAR_PRISM_VOLUME,
  oneGrainRelationalGap: CUBE_PRISM_GAP,
  cubeChildBranchCount: CUBE_CHILD_BRANCH_COUNT,
  prismChildBranchCount: PRISM_CHILD_BRANCH_COUNT,
  childLinearScale: CHILD_LINEAR_SCALE,
  childVolumeScale: CHILD_VOLUME_SCALE,
  cubeRecursiveVolumeRatio: CUBE_RECURSIVE_VOLUME_RATIO,
  prismRecursiveVolumeRatio: PRISM_RECURSIVE_VOLUME_RATIO,
  infiniteRecursiveGapContribution:
    NORMALIZED_CUBE_VOLUME / (1 - CUBE_RECURSIVE_VOLUME_RATIO)
    - NORMALIZED_TRIANGULAR_PRISM_VOLUME
      / (1 - PRISM_RECURSIVE_VOLUME_RATIO),
  resolution: "SIMULTANEOUS AT EVERY GRAIN" as const,
})
