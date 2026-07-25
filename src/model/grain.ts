import { FACES, fromKey, key } from "./address.ts"
import {
  PARTICLE_MOMENTS_PER_ACT,
  calculateParticleTransformPath,
  sampleParticleHelix,
  type ParticleAxisOffset,
  type ParticleTransformStep,
  type ParticleVector,
} from "./particle.ts"

export const CHILD_GRAIN_SCALE = 1 / 2

export type NestedGrainState = Readonly<{
  face: string
  localPosition: ParticleVector
  parentPosition: ParticleVector
  emittedTransfer: ParticleVector
  emittedMagnitude: number
  createdForce: number
  axisOffset: ParticleAxisOffset
  standingWavePath: readonly ParticleVector[]
  standingAmplitude: number
}>

export type NestedGrainMoment = Readonly<{
  moment: number
  states: readonly NestedGrainState[]
  totalEmittedMagnitude: number
  totalCreatedForce: number
  carrierPosition: ParticleVector
  carrierPath: readonly ParticleVector[]
  totalStandingAmplitude: number
}>

export type NestedGrainResolution = Readonly<{
  parentGrain: number
  childGrain: number
  parentAddress: string
  childScale: number
  initialState: Readonly<{
    grain: number
    moment: 0
    origin: "FIRST DIFFERENCE"
    nothingHasDuration: false
    carrier: "NO SPIRAL"
    child: "NO SPIRAL"
  }>
  spiralStartsAt: Readonly<{ grain: number; moment: number }>
  spiralingSpiralStartsAt: Readonly<{ grain: number; moment: number }>
  moments: readonly NestedGrainMoment[]
  finalParentPositions: readonly ParticleVector[]
}>

function add(left: ParticleVector, right: ParticleVector): ParticleVector {
  return {
    x: canonicalZero(left.x + right.x),
    y: canonicalZero(left.y + right.y),
    z: canonicalZero(left.z + right.z),
  }
}

function scale(vector: ParticleVector, factor: number): ParticleVector {
  return {
    x: canonicalZero(vector.x * factor),
    y: canonicalZero(vector.y * factor),
    z: canonicalZero(vector.z * factor),
  }
}

function magnitude(vector: ParticleVector): number {
  return Math.hypot(vector.x, vector.y, vector.z)
}

function subtract(left: ParticleVector, right: ParticleVector): ParticleVector {
  return { x: left.x - right.x, y: left.y - right.y, z: left.z - right.z }
}

function canonicalZero(value: number): number {
  return Object.is(value, -0) ? 0 : value
}

function crossMagnitude(left: ParticleVector, right: ParticleVector): number {
  return Math.hypot(
    left.y * right.z - left.z * right.y,
    left.z * right.x - left.x * right.z,
    left.x * right.y - left.y * right.x,
  )
}

function firstDetectedTurn(path: readonly ParticleTransformStep[]): number {
  for (let index = 1; index < path.length; index += 1) {
    if (crossMagnitude(path[index - 1].transfer, path[index].transfer) > 1e-12) {
      return path[index].moment
    }
  }
  throw new Error("No spiral turn was detected in the transform path")
}

export function deriveNestedGrain(
  parentAddress: string,
  parentGrain = 0,
): NestedGrainResolution {
  if (!Number.isSafeInteger(parentGrain)) {
    throw new Error("Parent grain must be a safe integer")
  }
  const parentPosition = fromKey(parentAddress)
  const parentPath = calculateParticleTransformPath(parentAddress)
  const paths = new Map(FACES.map((face) => {
    const faceAddress = key(face)
    return [faceAddress, calculateParticleTransformPath(faceAddress)] as const
  }))
  const spiralMoment = firstDetectedTurn(parentPath)
  const spiralingSpiralMoment = Math.max(
    spiralMoment,
    ...[...paths.values()].map(firstDetectedTurn),
  )
  const moments = Object.freeze(Array.from(
    { length: PARTICLE_MOMENTS_PER_ACT },
    (_, index): NestedGrainMoment => {
      const moment = index + 1
      const carrierPosition = parentPath[index].is
      const timePhase = Math.PI * 2 * moment / PARTICLE_MOMENTS_PER_ACT
      const states = Object.freeze([...paths].map(([face, path]) => {
        const step = path[index]
        const emittedTransfer = scale(step.transfer, CHILD_GRAIN_SCALE)
        const axis = fromKey(face)
        const childSamples = sampleParticleHelix(face)
        const standingWavePath = Object.freeze(childSamples.map((sample, sampleIndex) => {
          const progress = sampleIndex / PARTICLE_MOMENTS_PER_ACT
          const axisPoint = scale(axis, progress)
          const radial = subtract(sample, axisPoint)
          const standingMultiplier = 2
            * Math.cos(Math.PI * 2 * progress)
            * Math.cos(timePhase)
          const standingLocal = add(axisPoint, scale(radial, standingMultiplier))
          return Object.freeze(add(
            carrierPosition,
            scale(standingLocal, CHILD_GRAIN_SCALE),
          ))
        }))
        const standingAmplitude = 2 * Math.abs(Math.cos(timePhase))
        return Object.freeze({
          face,
          localPosition: step.is,
          parentPosition: add(carrierPosition, scale(step.is, CHILD_GRAIN_SCALE)),
          emittedTransfer,
          emittedMagnitude: magnitude(emittedTransfer),
          createdForce: step.resultantForce * CHILD_GRAIN_SCALE,
          axisOffset: step.axisOffset,
          standingWavePath,
          standingAmplitude,
        })
      }))
      return Object.freeze({
        moment,
        states,
        carrierPosition,
        carrierPath: Object.freeze(parentPath.slice(0, moment).map((step) => step.is)),
        totalEmittedMagnitude: states.reduce(
          (total, state) => total + state.emittedMagnitude,
          0,
        ),
        totalCreatedForce: states.reduce(
          (total, state) => total + state.createdForce,
          0,
        ),
        totalStandingAmplitude: states.reduce(
          (total, state) => total + state.standingAmplitude,
          0,
        ),
      })
    },
  ))
  return Object.freeze({
    parentGrain,
    childGrain: parentGrain - 1,
    parentAddress,
    childScale: CHILD_GRAIN_SCALE,
    initialState: Object.freeze({
      grain: parentGrain,
      moment: 0 as const,
      origin: "FIRST DIFFERENCE" as const,
      nothingHasDuration: false as const,
      carrier: "NO SPIRAL" as const,
      child: "NO SPIRAL" as const,
    }),
    spiralStartsAt: Object.freeze({ grain: parentGrain, moment: spiralMoment }),
    spiralingSpiralStartsAt: Object.freeze({
      grain: parentGrain - 1,
      moment: spiralingSpiralMoment,
    }),
    moments,
    finalParentPositions: Object.freeze(
      moments.at(-1)!.states.map((state) => add(
        parentPosition,
        scale(state.localPosition, CHILD_GRAIN_SCALE),
      )),
    ),
  })
}
