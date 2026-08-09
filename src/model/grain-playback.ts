import { PARTICLE_MOMENTS_PER_ACT, sampleParticleHelix, type ParticleVector } from "./particle.ts"

export type GrainPlaybackFrame = Readonly<{
  grain: number
  sourceGrain: number | null
  destinationGrain: number
  hiddenGrainsBefore: number
  projectedChangePixels: number
  scale: number
  startCondition: "PARENT ME RESOLVED"
  stopCondition: "CURRENT ME RESOLVED"
  spiral: readonly ParticleVector[]
}>

export type GrainPlayback = Readonly<{
  startGrain: number
  stopGrain: number
  pixelSpan: number
  pixelThreshold: number
  causalGrainCount: number
  renderedGrainCount: number
  hiddenGrainCount: number
  frames: readonly GrainPlaybackFrame[]
}>

export type GrainResolutionNeed = Readonly<{
  grain: number
  mode: "RESOLVE HERE" | "REFERENCE OTHER GRAIN"
  referenceGrain: number | null
  shapeSignature: string
  orientationSignature: string
  size: number
  localValuesRetained: readonly [
    "grain",
    "scale",
    "orientation",
    "size",
    "causal route",
  ]
}>

export type CrossGrainResolutionPlan = Readonly<{
  needs: readonly GrainResolutionNeed[]
  uniquePatternCount: number
  referencedPatternCount: number
  expandedPointCount: number
  evaluatedPointCount: number
  savedPointEvaluations: number
}>

function subtractVector(
  left: ParticleVector,
  right: ParticleVector,
): ParticleVector {
  return { x: left.x - right.x, y: left.y - right.y, z: left.z - right.z }
}

function vectorLength(vector: ParticleVector): number {
  return Math.hypot(vector.x, vector.y, vector.z)
}

function dotVectors(left: ParticleVector, right: ParticleVector): number {
  return left.x * right.x + left.y * right.y + left.z * right.z
}

function spiralDescriptors(
  spiral: readonly ParticleVector[],
): Readonly<{
  shapeSignature: string
  orientationSignature: string
  size: number
}> {
  if (spiral.length === 0) {
    return Object.freeze({
      shapeSignature: "EMPTY",
      orientationSignature: "NONE",
      size: 0,
    })
  }
  const first = spiral[0]
  const translated = spiral.map((point) => ({
    x: point.x - first.x,
    y: point.y - first.y,
    z: point.z - first.z,
  }))
  const extent = Math.max(
    1,
    ...translated.flatMap((point) => [
      Math.abs(point.x),
      Math.abs(point.y),
      Math.abs(point.z),
    ]),
  )
  const segments = spiral.slice(1).map((point, index) =>
    subtractVector(point, spiral[index]))
  const lengths = segments.map(vectorLength)
  const totalLength = lengths.reduce((total, length) => total + length, 0) || 1
  const normalizedLengths = lengths.map((length) => length / totalLength)
  const turns = segments.slice(1).map((segment, index) => {
    const prior = segments[index]
    const denominator = vectorLength(prior) * vectorLength(segment) || 1
    return dotVectors(prior, segment) / denominator
  })
  const endpoint = translated.at(-1)!
  const endpointLength = vectorLength(endpoint) || 1
  return Object.freeze({
    // Ordered segment proportions and turns preserve path shape while removing
    // translation, uniform size, and global orientation.
    shapeSignature: [
      normalizedLengths.map((value) => value.toFixed(9)).join(","),
      turns.map((value) => value.toFixed(9)).join(","),
    ].join("|"),
    orientationSignature: [endpoint.x, endpoint.y, endpoint.z]
      .map((value) => (value / endpointLength).toFixed(9))
      .join(","),
    size: extent,
  })
}

export function planCrossGrainResolution(
  playback: GrainPlayback,
): CrossGrainResolutionPlan {
  const resolvedAt = new Map<string, number>()
  let evaluatedPointCount = 0
  const needs = playback.frames.map((frame) => {
    const descriptors = spiralDescriptors(frame.spiral)
    const referenceGrain = resolvedAt.get(descriptors.shapeSignature) ?? null
    if (referenceGrain === null) {
      resolvedAt.set(descriptors.shapeSignature, frame.grain)
      evaluatedPointCount += frame.spiral.length
    }
    return Object.freeze({
      grain: frame.grain,
      mode: referenceGrain === null
        ? "RESOLVE HERE" as const
        : "REFERENCE OTHER GRAIN" as const,
      referenceGrain,
      ...descriptors,
      localValuesRetained: Object.freeze([
        "grain",
        "scale",
        "orientation",
        "size",
        "causal route",
      ] as const),
    })
  })
  const expandedPointCount = playback.frames.reduce(
    (total, frame) => total + frame.spiral.length,
    0,
  )
  return Object.freeze({
    needs: Object.freeze(needs),
    uniquePatternCount: resolvedAt.size,
    referencedPatternCount: needs.length - resolvedAt.size,
    expandedPointCount,
    evaluatedPointCount,
    savedPointEvaluations: expandedPointCount - evaluatedPointCount,
  })
}

export function buildGrainPlayback(
  startGrain = 0,
  stopGrain = -6,
  pixelSpan = 180,
): GrainPlayback {
  if (![startGrain, stopGrain].every(Number.isSafeInteger)) {
    throw new Error("Playback grains must be safe integers")
  }
  if (stopGrain >= startGrain) throw new Error("Stop grain must be inward from start grain")
  if (!Number.isFinite(pixelSpan) || pixelSpan <= 0) {
    throw new Error("Pixel span must be a positive finite number")
  }
  const pixelThreshold = 1
  const grains: number[] = [startGrain]
  let lastRenderedGrain = startGrain
  for (let grain = startGrain - 1; grain >= stopGrain; grain -= 1) {
    const projectedChangePixels = Math.abs(
      2 ** lastRenderedGrain - 2 ** grain,
    ) * pixelSpan
    if (projectedChangePixels < pixelThreshold) continue
    grains.push(grain)
    lastRenderedGrain = grain
  }
  const frames = Object.freeze(grains.map((grain, index) => Object.freeze({
    grain,
    sourceGrain: index === 0 ? null : grain + 1,
    destinationGrain: grain - 1,
    hiddenGrainsBefore: index === 0 ? 0 : Math.abs(grains[index - 1] - grain) - 1,
    projectedChangePixels: index === 0
      ? 0
      : Math.abs(2 ** grains[index - 1] - 2 ** grain) * pixelSpan,
    scale: 2 ** grain,
    startCondition: "PARENT ME RESOLVED" as const,
    stopCondition: "CURRENT ME RESOLVED" as const,
    spiral: sampleParticleHelix("1,0,0"),
  })))
  const causalGrainCount = Math.abs(startGrain - stopGrain) + 1
  return Object.freeze({
    startGrain,
    stopGrain,
    pixelSpan,
    pixelThreshold,
    causalGrainCount,
    renderedGrainCount: frames.length,
    hiddenGrainCount: causalGrainCount - frames.length,
    frames,
  })
}

export const GRAIN_PLAYBACK_MOMENTS = PARTICLE_MOMENTS_PER_ACT
