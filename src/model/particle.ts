import { firstDifference, resolveTick, sameField, type Field } from "./kernel.ts"
import { observeFromSixFaces, type ObserverFace } from "./observation.ts"
import { analysePotential } from "./potential.ts"
import { fromKey, type Address } from "./address.ts"

export const PARTICLE_MOMENTS_PER_ACT = 36
export const PARTICLE_ROTATIONS_PER_ACT = 1
export const PARTICLE_MAX_SPIRAL_RADIUS = 1 / 6
export const PARTICLE_AXIS_OFFSET_SYMBOL = "ε = 0…01"

export type ParticleVector = Readonly<{
  x: number
  y: number
  z: number
}>

export type ParticleForceMoment = Readonly<{
  moment: number
  progress: number
  position: ParticleVector
  transfer: ParticleVector
  changeInTransfer: ParticleVector
  outwardTransfer: number
  inwardTurningForce: number
  rotationalForce: number
  axialForce: number
  resultantForce: number
  sixFaceResultant: number
}>

export type ParticleAxisOffset = Readonly<{
  symbol: typeof PARTICLE_AXIS_OFFSET_SYMBOL
  direction: ParticleVector
}>

export type ParticleTransformStep = Readonly<{
  id: string
  parentId: string | null
  nextId: string | null
  faceAddress: string
  moment: number
  phase: "DIRECTION ALLOWED" | "FACE PRESENTED" | "ADDRESS RESOLVED"
  was: ParticleVector
  operator: "ROTATE AND RESOLVE"
  axisOffset: ParticleAxisOffset
  is: ParticleVector
  transfer: ParticleVector
  changeInTransfer: ParticleVector
  outwardTransfer: number
  inwardTurningForce: number
  rotationalForce: number
  axialForce: number
  resultantForce: number
}>

export type FirstActParticle = Readonly<{
  firstDifference: Field
  facePresentations: number
  particleField: Field
  particleAddresses: readonly string[]
  observerViews: ReadonlyMap<ObserverFace, readonly string[]>
  observerSignature: string
  mergedField: Field
  mergedCount: number
  mergeRecoversParticle: boolean
  causalTraces: readonly ParticleCausalTrace[]
  forceMoments: readonly ParticleForceMoment[]
  transformPaths: ReadonlyMap<string, readonly ParticleTransformStep[]>
  transformStepCount: number
}>

export type ParticleCausalTrace = Readonly<{
  from: "0,0,0"
  to: string
  allowance: "FIRST DIFFERENCE → FACE PRESENTATION"
  subcauses: readonly [
    "DIRECTION ALLOWED",
    "FACE PRESENTED",
    "ADDRESS RESOLVED",
  ]
}>

function subtract(left: ParticleVector, right: ParticleVector): ParticleVector {
  return {
    x: left.x - right.x,
    y: left.y - right.y,
    z: left.z - right.z,
  }
}

function dot(left: ParticleVector, right: ParticleVector): number {
  return left.x * right.x + left.y * right.y + left.z * right.z
}

function magnitude(vector: ParticleVector): number {
  return Math.hypot(vector.x, vector.y, vector.z)
}

function scale(vector: ParticleVector, factor: number): ParticleVector {
  return {
    x: vector.x * factor,
    y: vector.y * factor,
    z: vector.z * factor,
  }
}

function add(left: ParticleVector, right: ParticleVector): ParticleVector {
  return {
    x: left.x + right.x,
    y: left.y + right.y,
    z: left.z + right.z,
  }
}

function cross(left: ParticleVector, right: ParticleVector): ParticleVector {
  return {
    x: left.y * right.z - left.z * right.y,
    y: left.z * right.x - left.x * right.z,
    z: left.x * right.y - left.y * right.x,
  }
}

function normalize(vector: ParticleVector): ParticleVector {
  const length = magnitude(vector)
  if (length === 0) return { x: 0, y: 0, z: 0 }
  return scale(vector, 1 / length)
}

function traceBasis(axis: Address): Readonly<{
  axis: ParticleVector
  radial: ParticleVector
  tangent: ParticleVector
}> {
  const unitAxis = normalize(axis)
  const reference = Math.abs(unitAxis.z) < 0.9
    ? { x: 0, y: 0, z: 1 }
    : { x: 0, y: 1, z: 0 }
  const radial = normalize(cross(unitAxis, reference))
  return {
    axis: unitAxis,
    radial,
    tangent: cross(unitAxis, radial),
  }
}

export function particleAxisOffset(address: string): ParticleAxisOffset {
  return Object.freeze({
    symbol: PARTICLE_AXIS_OFFSET_SYMBOL,
    direction: Object.freeze(traceBasis(fromKey(address)).radial),
  })
}

export function sampleParticleHelix(
  address: string,
  moments = PARTICLE_MOMENTS_PER_ACT,
): readonly ParticleVector[] {
  if (!Number.isSafeInteger(moments) || moments < 3) {
    throw new Error("Particle helix requires at least three moments")
  }
  const basis = traceBasis(fromKey(address))
  return Object.freeze(Array.from({ length: moments + 1 }, (_, moment) => {
    const progress = moment / moments
    const radius = PARTICLE_MAX_SPIRAL_RADIUS * Math.sin(Math.PI * progress)
    const angle = Math.PI * 2 * PARTICLE_ROTATIONS_PER_ACT * progress
    const around = add(
      scale(basis.radial, Math.cos(angle)),
      scale(basis.tangent, Math.sin(angle)),
    )
    return Object.freeze(add(
      scale(basis.axis, progress),
      scale(around, radius),
    ))
  }))
}

export function calculateParticleForceMoments(
  address: string,
  moments = PARTICLE_MOMENTS_PER_ACT,
): readonly ParticleForceMoment[] {
  const basis = traceBasis(fromKey(address))
  const positions = sampleParticleHelix(address, moments)
  const transfers = positions.map((position, index) => (
    index === 0
      ? { x: 0, y: 0, z: 0 }
      : subtract(position, positions[index - 1])
  ))
  return Object.freeze(positions.slice(2).map((position, offset) => {
    const moment = offset + 2
    const transfer = transfers[moment]
    const changeInTransfer = subtract(transfer, transfers[moment - 1])
    const axisPosition = scale(basis.axis, moment / moments)
    const radialDirection = normalize(subtract(position, axisPosition))
    const tangentDirection = normalize(cross(basis.axis, radialDirection))
    const resultantForce = magnitude(changeInTransfer)
    return Object.freeze({
      moment,
      progress: moment / moments,
      position,
      transfer,
      changeInTransfer,
      outwardTransfer: dot(transfer, basis.axis),
      inwardTurningForce: -dot(changeInTransfer, radialDirection),
      rotationalForce: dot(changeInTransfer, tangentDirection),
      axialForce: dot(changeInTransfer, basis.axis),
      resultantForce,
      sixFaceResultant: resultantForce * 6,
    })
  }))
}

export function calculateParticleTransformPath(
  address: string,
  moments = PARTICLE_MOMENTS_PER_ACT,
): readonly ParticleTransformStep[] {
  const positions = sampleParticleHelix(address, moments)
  const axisOffset = particleAxisOffset(address)
  const forces = new Map(
    calculateParticleForceMoments(address, moments)
      .map((force) => [force.moment, force] as const),
  )
  return Object.freeze(positions.slice(1).map((position, index) => {
    const moment = index + 1
    const id = `${address}@${moment}`
    const force = forces.get(moment)
    const was = positions[moment - 1]
    const transfer = subtract(position, was)
    return Object.freeze({
      id,
      parentId: moment === 1 ? null : `${address}@${moment - 1}`,
      nextId: moment === moments ? null : `${address}@${moment + 1}`,
      faceAddress: address,
      moment,
      phase: moment <= moments / 3
        ? "DIRECTION ALLOWED" as const
        : moment <= moments * 2 / 3
          ? "FACE PRESENTED" as const
          : "ADDRESS RESOLVED" as const,
      was,
      operator: "ROTATE AND RESOLVE" as const,
      axisOffset,
      is: position,
      transfer,
      changeInTransfer: force?.changeInTransfer ?? { x: 0, y: 0, z: 0 },
      outwardTransfer: force?.outwardTransfer ?? dot(transfer, normalize(fromKey(address))),
      inwardTurningForce: force?.inwardTurningForce ?? 0,
      rotationalForce: force?.rotationalForce ?? 0,
      axialForce: force?.axialForce ?? 0,
      resultantForce: force?.resultantForce ?? 0,
    })
  }))
}

export function deriveFirstActParticle(): FirstActParticle {
  const initial = firstDifference()
  const potential = analysePotential(initial.was, initial.is)
  const resolved = resolveTick(initial).state
  const observation = observeFromSixFaces(resolved.is)
  const observerViews = new Map<ObserverFace, readonly string[]>()
  const mergedField = new Set<string>()
  for (const observer of observation.observers) {
    const addresses = Object.freeze(
      (observation.views.get(observer.id) ?? [])
        .map((sight) => sight.address)
        .sort(),
    )
    observerViews.set(observer.id, addresses)
    addresses.forEach((address) => mergedField.add(address))
  }
  const causalTraces = Object.freeze(
    [...resolved.is].sort().map((address) => Object.freeze({
      from: "0,0,0" as const,
      to: address,
      allowance: "FIRST DIFFERENCE → FACE PRESENTATION" as const,
      subcauses: Object.freeze([
        "DIRECTION ALLOWED",
        "FACE PRESENTED",
        "ADDRESS RESOLVED",
      ]) as ParticleCausalTrace["subcauses"],
    })),
  )
  const transformPaths = new Map(
    causalTraces.map((trace) => [
      trace.to,
      calculateParticleTransformPath(trace.to),
    ] as const),
  )
  return Object.freeze({
    firstDifference: initial.is,
    facePresentations: potential.presentationCount,
    particleField: resolved.is,
    particleAddresses: Object.freeze([...resolved.is].sort()),
    observerViews,
    observerSignature: observation.observers
      .map((observer) => observerViews.get(observer.id)?.length ?? 0)
      .join(":"),
    mergedField,
    mergedCount: mergedField.size,
    mergeRecoversParticle: sameField(mergedField, resolved.is),
    causalTraces,
    forceMoments: calculateParticleForceMoments(causalTraces[0].to),
    transformPaths,
    transformStepCount: [...transformPaths.values()]
      .reduce((total, path) => total + path.length, 0),
  })
}
