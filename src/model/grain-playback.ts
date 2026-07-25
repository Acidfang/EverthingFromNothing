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
