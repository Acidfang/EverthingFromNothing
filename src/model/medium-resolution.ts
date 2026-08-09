import {
  CUBE_RESOLUTION_POINTS,
  type CubeResolutionKind,
} from "./cube-resolution.ts"
import { TRIANGULAR_PRISM_RESOLUTION_POINTS } from "./triangular-prism-resolution.ts"

const KINDS = ["FACE", "EDGE", "CORNER"] as const

type MediumMoment = Readonly<{
  kind: CubeResolutionKind
  resolutionPoints: number
  mediumPresentationsPerPoint: 1 | 3 | 7
  mediumPresentations: number
}>

function mediumPerPoint(perspectives: 1 | 2 | 3): 1 | 3 | 7 {
  return (2 ** perspectives - 1) as 1 | 3 | 7
}

function analyseShape(
  shape: "CUBE" | "TRIANGULAR_PRISM",
  points: readonly Readonly<{
    kind: CubeResolutionKind
    perspectiveCount: 1 | 2 | 3
  }>[],
) {
  const moments: readonly MediumMoment[] = Object.freeze(KINDS.map((kind) => {
    const matching = points.filter((point) => point.kind === kind)
    const mediumPresentationsPerPoint = mediumPerPoint(
      matching[0].perspectiveCount,
    )
    return Object.freeze({
      kind,
      resolutionPoints: matching.length,
      mediumPresentationsPerPoint,
      mediumPresentations: matching.length * mediumPresentationsPerPoint,
    })
  }))
  return Object.freeze({
    shape,
    moments,
    totalMediumPresentations: moments.reduce(
      (total, moment) => total + moment.mediumPresentations,
      0,
    ),
    maximumMediumMoment: moments.reduce((maximum, moment) =>
      moment.mediumPresentations > maximum.mediumPresentations ? moment : maximum),
  })
}

export const SHAPE_MEDIUM_ANALYSIS = Object.freeze([
  analyseShape("CUBE", CUBE_RESOLUTION_POINTS),
  analyseShape("TRIANGULAR_PRISM", TRIANGULAR_PRISM_RESOLUTION_POINTS),
])

export const COMPLETE_MEDIUM_ANALYSIS = Object.freeze({
  moments: Object.freeze(KINDS.map((kind) => {
    const contributions = SHAPE_MEDIUM_ANALYSIS.map(
      (shape) => shape.moments.find((moment) => moment.kind === kind)!,
    )
    return Object.freeze({
      kind,
      resolutionPoints: contributions.reduce(
        (total, moment) => total + moment.resolutionPoints,
        0,
      ),
      mediumPresentations: contributions.reduce(
        (total, moment) => total + moment.mediumPresentations,
        0,
      ),
    })
  })),
  totalMediumPresentations: SHAPE_MEDIUM_ANALYSIS.reduce(
    (total, shape) => total + shape.totalMediumPresentations,
    0,
  ),
  maximumShape: SHAPE_MEDIUM_ANALYSIS.reduce((maximum, shape) =>
    shape.totalMediumPresentations > maximum.totalMediumPresentations
      ? shape
      : maximum),
})

