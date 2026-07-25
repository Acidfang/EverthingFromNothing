import { FACES, fromKey, key } from "./address.ts"
import {
  PARTICLE_MOMENTS_PER_ACT,
  calculateParticleTransformPath,
  type ParticleAxisOffset,
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
}>

export type NestedGrainMoment = Readonly<{
  moment: number
  states: readonly NestedGrainState[]
  totalEmittedMagnitude: number
  totalCreatedForce: number
}>

export type NestedGrainResolution = Readonly<{
  parentGrain: number
  childGrain: number
  parentAddress: string
  childScale: number
  spiralStartsAt: Readonly<{ grain: number; moment: 1 }>
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

function canonicalZero(value: number): number {
  return Object.is(value, -0) ? 0 : value
}

export function deriveNestedGrain(
  parentAddress: string,
  parentGrain = 0,
): NestedGrainResolution {
  if (!Number.isSafeInteger(parentGrain)) {
    throw new Error("Parent grain must be a safe integer")
  }
  const parentPosition = fromKey(parentAddress)
  const paths = new Map(FACES.map((face) => {
    const faceAddress = key(face)
    return [faceAddress, calculateParticleTransformPath(faceAddress)] as const
  }))
  const moments = Object.freeze(Array.from(
    { length: PARTICLE_MOMENTS_PER_ACT },
    (_, index): NestedGrainMoment => {
      const moment = index + 1
      const states = Object.freeze([...paths].map(([face, path]) => {
        const step = path[index]
        const emittedTransfer = scale(step.transfer, CHILD_GRAIN_SCALE)
        return Object.freeze({
          face,
          localPosition: step.is,
          parentPosition: add(parentPosition, scale(step.is, CHILD_GRAIN_SCALE)),
          emittedTransfer,
          emittedMagnitude: magnitude(emittedTransfer),
          createdForce: step.resultantForce * CHILD_GRAIN_SCALE,
          axisOffset: step.axisOffset,
        })
      }))
      return Object.freeze({
        moment,
        states,
        totalEmittedMagnitude: states.reduce(
          (total, state) => total + state.emittedMagnitude,
          0,
        ),
        totalCreatedForce: states.reduce(
          (total, state) => total + state.createdForce,
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
    spiralStartsAt: Object.freeze({ grain: parentGrain - 1, moment: 1 as const }),
    moments,
    finalParentPositions: Object.freeze(
      moments.at(-1)!.states.map((state) => state.parentPosition),
    ),
  })
}
