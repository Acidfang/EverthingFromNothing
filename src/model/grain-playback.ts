import { PARTICLE_MOMENTS_PER_ACT, sampleParticleHelix, type ParticleVector } from "./particle.ts"

export type GrainPlaybackFrame = Readonly<{
  grain: number
  sourceGrain: number | null
  destinationGrain: number
  hiddenGrainsBefore: number
  scale: number
  startCondition: "PARENT ME RESOLVED"
  stopCondition: "CURRENT ME RESOLVED"
  spiral: readonly ParticleVector[]
}>

export type GrainPlayback = Readonly<{
  startGrain: number
  stopGrain: number
  skip: number
  causalGrainCount: number
  renderedGrainCount: number
  hiddenGrainCount: number
  frames: readonly GrainPlaybackFrame[]
}>

export function buildGrainPlayback(
  startGrain = 0,
  stopGrain = -6,
  skip = 0,
): GrainPlayback {
  if (![startGrain, stopGrain, skip].every(Number.isSafeInteger)) {
    throw new Error("Playback grains and skip must be safe integers")
  }
  if (stopGrain >= startGrain) throw new Error("Stop grain must be inward from start grain")
  if (skip < 0 || skip > 8) throw new Error("Grain skip must be from 0 through 8")
  const step = skip + 1
  const grains: number[] = [startGrain]
  for (let grain = startGrain - step; grain > stopGrain; grain -= step) grains.push(grain)
  if (grains.at(-1) !== stopGrain) grains.push(stopGrain)
  const frames = Object.freeze(grains.map((grain, index) => Object.freeze({
    grain,
    sourceGrain: index === 0 ? null : grain + 1,
    destinationGrain: grain - 1,
    hiddenGrainsBefore: index === 0 ? 0 : Math.abs(grains[index - 1] - grain) - 1,
    scale: 2 ** grain,
    startCondition: "PARENT ME RESOLVED" as const,
    stopCondition: "CURRENT ME RESOLVED" as const,
    spiral: sampleParticleHelix("1,0,0"),
  })))
  const causalGrainCount = Math.abs(startGrain - stopGrain) + 1
  return Object.freeze({
    startGrain,
    stopGrain,
    skip,
    causalGrainCount,
    renderedGrainCount: frames.length,
    hiddenGrainCount: causalGrainCount - frames.length,
    frames,
  })
}

export const GRAIN_PLAYBACK_MOMENTS = PARTICLE_MOMENTS_PER_ACT
