import {
  calculateParticleTransformPath,
  type ParticleTransformStep,
  type ParticleVector,
} from "./particle.ts"

export type TransferBehaviour =
  | "FIRST TRANSFER"
  | "TURNING TRANSFER"

export type TemporalSignature = Readonly<{
  was: TransferBehaviour | "START"
  is: TransferBehaviour
  willBe: TransferBehaviour | "COMPLETE"
  key: string
}>

export type TransferMoment = Readonly<{
  moment: number
  behaviour: TransferBehaviour
  temporal: TemporalSignature
  location: ParticleVector
  axis: ParticleVector
  axisChangeRadians: number
  referenceMoment: number | null
  addsCoverage: boolean
}>

export type BehaviourInterval = Readonly<{
  signature: TemporalSignature
  firstMoment: number
  lastMoment: number
  momentCount: number
  computedMomentCount: number
  referencedMomentCount: number
  newCoverageCount: number
}>

export type ReceiverResolution = Readonly<{
  spatialStep: number
  temporalStep: number
}>

export type ReceiverView = Readonly<{
  capturedMoments: readonly number[]
  unresolvedMoments: readonly number[]
  visibleCoverageCount: number
}>

export type StateTransferEngine = Readonly<{
  address: string
  moments: readonly TransferMoment[]
  intervals: readonly BehaviourInterval[]
  uniqueTemporalBehaviours: number
  referencedComputes: number
  resolvedCoverageCount: number
  emergentGeometry: "OPEN PATH"
  nextShapeAllowance: "INDEPENDENT RECURSIVE AXIS → SWEPT SURFACE"
}>

export type RecursiveSweepResolution = Readonly<{
  phaseCount: number
  pathSampleCount: number
  uniqueSurfacePointCount: number
  startRadius: number
  endRadius: number
  phaseClosureError: number
  boundaryClosed: boolean
  topology: "CLOSED SPHERE-TOPOLOGY SURFACE" | "OPEN SWEPT SURFACE"
  points: readonly ParticleVector[]
}>

function subtract(
  left: ParticleVector,
  right: ParticleVector,
): ParticleVector {
  return { x: left.x - right.x, y: left.y - right.y, z: left.z - right.z }
}

function magnitude(vector: ParticleVector): number {
  return Math.hypot(vector.x, vector.y, vector.z)
}

function normalize(vector: ParticleVector): ParticleVector {
  const length = magnitude(vector)
  return length === 0
    ? { x: 0, y: 0, z: 0 }
    : { x: vector.x / length, y: vector.y / length, z: vector.z / length }
}

function dot(left: ParticleVector, right: ParticleVector): number {
  return left.x * right.x + left.y * right.y + left.z * right.z
}

function crossMagnitude(
  left: ParticleVector,
  right: ParticleVector,
): number {
  return magnitude({
    x: left.y * right.z - left.z * right.y,
    y: left.z * right.x - left.x * right.z,
    z: left.x * right.y - left.y * right.x,
  })
}

function classify(
  path: readonly ParticleTransformStep[],
  index: number,
): TransferBehaviour {
  if (index === 0) return "FIRST TRANSFER"
  return crossMagnitude(path[index - 1].transfer, path[index].transfer) > 1e-12
    ? "TURNING TRANSFER"
    : "FIRST TRANSFER"
}

function locationKey(location: ParticleVector): string {
  return [location.x, location.y, location.z]
    .map((value) => value.toFixed(12))
    .join(",")
}

export function buildStateTransferEngine(
  address = "1,0,0",
): StateTransferEngine {
  const path = calculateParticleTransformPath(address)
  const behaviours = path.map((_, index) => classify(path, index))
  const firstMomentForSignature = new Map<string, number>()
  const coverage = new Set<string>()
  const moments = path.map((step, index): TransferMoment => {
    const was = index === 0 ? "START" as const : behaviours[index - 1]
    const is = behaviours[index]
    const willBe = index === path.length - 1
      ? "COMPLETE" as const
      : behaviours[index + 1]
    const temporal = Object.freeze({
      was,
      is,
      willBe,
      key: `${was}→${is}→${willBe}`,
    })
    const referenceMoment = firstMomentForSignature.get(temporal.key) ?? null
    if (referenceMoment === null) {
      firstMomentForSignature.set(temporal.key, step.moment)
    }
    const coverageKey = locationKey(step.is)
    const addsCoverage = !coverage.has(coverageKey)
    coverage.add(coverageKey)
    const axis = normalize(step.transfer)
    const previousAxis = index === 0
      ? axis
      : normalize(path[index - 1].transfer)
    const cosine = Math.max(-1, Math.min(1, dot(previousAxis, axis)))
    return Object.freeze({
      moment: step.moment,
      behaviour: is,
      temporal,
      location: step.is,
      axis,
      axisChangeRadians: Math.acos(cosine),
      referenceMoment,
      addsCoverage,
    })
  })

  const intervalMap = new Map<string, TransferMoment[]>()
  for (const moment of moments) {
    const existing = intervalMap.get(moment.temporal.key)
    if (existing) existing.push(moment)
    else intervalMap.set(moment.temporal.key, [moment])
  }
  const intervals = Object.freeze([...intervalMap.values()].map((items) =>
    Object.freeze({
      signature: items[0].temporal,
      firstMoment: items[0].moment,
      lastMoment: items.at(-1)!.moment,
      momentCount: items.length,
      computedMomentCount: 1,
      referencedMomentCount: items.length - 1,
      newCoverageCount: items.filter((item) => item.addsCoverage).length,
    })))

  return Object.freeze({
    address,
    moments: Object.freeze(moments),
    intervals,
    uniqueTemporalBehaviours: intervals.length,
    referencedComputes: moments.length - intervals.length,
    resolvedCoverageCount: coverage.size,
    emergentGeometry: "OPEN PATH",
    nextShapeAllowance: "INDEPENDENT RECURSIVE AXIS → SWEPT SURFACE",
  })
}

export function resolveReceiverView(
  engine: StateTransferEngine,
  resolution: ReceiverResolution,
): ReceiverView {
  if (!Number.isFinite(resolution.spatialStep) || resolution.spatialStep <= 0) {
    throw new Error("Receiver spatial step must be positive")
  }
  if (
    !Number.isSafeInteger(resolution.temporalStep)
    || resolution.temporalStep < 1
  ) {
    throw new Error("Receiver temporal step must be a positive safe integer")
  }
  const capturedMoments: number[] = []
  const unresolvedMoments: number[] = []
  const cells = new Set<string>()
  let previousCell: string | null = null
  for (const moment of engine.moments) {
    const temporalCapture = (moment.moment - 1) % resolution.temporalStep === 0
    const cell = [moment.location.x, moment.location.y, moment.location.z]
      .map((value) => Math.round(value / resolution.spatialStep))
      .join(",")
    if (temporalCapture && cell !== previousCell) {
      capturedMoments.push(moment.moment)
      cells.add(cell)
      previousCell = cell
    } else {
      unresolvedMoments.push(moment.moment)
    }
  }
  return Object.freeze({
    capturedMoments: Object.freeze(capturedMoments),
    unresolvedMoments: Object.freeze(unresolvedMoments),
    visibleCoverageCount: cells.size,
  })
}

export function resolveRecursiveSweep(
  engine: StateTransferEngine,
): RecursiveSweepResolution {
  const path = [
    Object.freeze({ x: 0, y: 0, z: 0 }),
    ...engine.moments.map((moment) => moment.location),
  ]
  const endpoint = path.at(-1)!
  const axis = normalize(endpoint)
  const reference = Math.abs(axis.z) < 0.9
    ? { x: 0, y: 0, z: 1 }
    : { x: 0, y: 1, z: 0 }
  const firstRadial = normalize({
    x: axis.y * reference.z - axis.z * reference.y,
    y: axis.z * reference.x - axis.x * reference.z,
    z: axis.x * reference.y - axis.y * reference.x,
  })
  const secondRadial = {
    x: axis.y * firstRadial.z - axis.z * firstRadial.y,
    y: axis.z * firstRadial.x - axis.x * firstRadial.z,
    z: axis.x * firstRadial.y - axis.y * firstRadial.x,
  }
  const phases = engine.moments.map((_, index) =>
    Math.PI * 2 * index / engine.moments.length)
  const points: ParticleVector[] = []
  const unique = new Set<string>()
  const radii = path.map((point) => {
    const axialDistance = dot(point, axis)
    const axialPoint = {
      x: axis.x * axialDistance,
      y: axis.y * axialDistance,
      z: axis.z * axialDistance,
    }
    return magnitude(subtract(point, axialPoint))
  })
  for (let pathIndex = 0; pathIndex < path.length; pathIndex += 1) {
    const axialDistance = dot(path[pathIndex], axis)
    for (const phase of phases) {
      const point = Object.freeze({
        x: axis.x * axialDistance + radii[pathIndex] * (
          firstRadial.x * Math.cos(phase) + secondRadial.x * Math.sin(phase)
        ),
        y: axis.y * axialDistance + radii[pathIndex] * (
          firstRadial.y * Math.cos(phase) + secondRadial.y * Math.sin(phase)
        ),
        z: axis.z * axialDistance + radii[pathIndex] * (
          firstRadial.z * Math.cos(phase) + secondRadial.z * Math.sin(phase)
        ),
      })
      points.push(point)
      unique.add(locationKey(point))
    }
  }
  const phaseClosureError = Math.abs(
    2 * Math.PI
    - (phases.at(-1)! + 2 * Math.PI / phases.length),
  )
  const tolerance = 1e-12
  const boundaryClosed = radii[0] <= tolerance
    && radii.at(-1)! <= tolerance
    && phaseClosureError <= tolerance
  return Object.freeze({
    phaseCount: phases.length,
    pathSampleCount: path.length,
    uniqueSurfacePointCount: unique.size,
    startRadius: radii[0],
    endRadius: radii.at(-1)!,
    phaseClosureError,
    boundaryClosed,
    topology: boundaryClosed
      ? "CLOSED SPHERE-TOPOLOGY SURFACE"
      : "OPEN SWEPT SURFACE",
    points: Object.freeze(points),
  })
}
