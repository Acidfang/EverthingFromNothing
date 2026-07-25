import type { ParticleVector } from "./particle.ts"

export type SphericalClosure = Readonly<{
  occupiedBins: number
  totalBins: number
  directionalCoverage: number
  radialUniformity: number
  radialVariation: number
  closed: boolean
}>

const LATITUDE_BINS = 6
const LONGITUDE_BINS = 12
const MIN_RADIAL_UNIFORMITY = 0.85
const MAX_RADIAL_VARIATION = 0.15

export function verifySphericalClosure(
  points: readonly ParticleVector[],
): SphericalClosure {
  const totalBins = LATITUDE_BINS * LONGITUDE_BINS
  if (points.length === 0) {
    return Object.freeze({
      occupiedBins: 0,
      totalBins,
      directionalCoverage: 0,
      radialUniformity: 0,
      radialVariation: Number.POSITIVE_INFINITY,
      closed: false,
    })
  }

  const centre = points.reduce(
    (sum, point) => ({
      x: sum.x + point.x / points.length,
      y: sum.y + point.y / points.length,
      z: sum.z + point.z / points.length,
    }),
    { x: 0, y: 0, z: 0 },
  )
  const radii = Array.from({ length: totalBins }, () => 0)

  for (const point of points) {
    const x = point.x - centre.x
    const y = point.y - centre.y
    const z = point.z - centre.z
    const radius = Math.hypot(x, y, z)
    if (radius <= 1e-12) continue
    const longitude = Math.floor(
      ((Math.atan2(y, x) + Math.PI) / (Math.PI * 2)) * LONGITUDE_BINS,
    ) % LONGITUDE_BINS
    const latitude = Math.min(
      LATITUDE_BINS - 1,
      Math.floor(
        ((Math.asin(z / radius) + Math.PI / 2) / Math.PI) * LATITUDE_BINS,
      ),
    )
    const bin = latitude * LONGITUDE_BINS + longitude
    radii[bin] = Math.max(radii[bin], radius)
  }

  const occupiedRadii = radii.filter((radius) => radius > 0)
  const occupiedBins = occupiedRadii.length
  const directionalCoverage = occupiedBins / totalBins
  const largestRadius = Math.max(0, ...occupiedRadii)
  const smallestRadius = occupiedBins === 0 ? 0 : Math.min(...occupiedRadii)
  const radialUniformity = largestRadius === 0 ? 0 : smallestRadius / largestRadius
  const meanRadius = occupiedBins === 0
    ? 0
    : occupiedRadii.reduce((total, radius) => total + radius, 0) / occupiedBins
  const radialVariation = meanRadius === 0
    ? Number.POSITIVE_INFINITY
    : Math.sqrt(
      occupiedRadii.reduce(
        (total, radius) => total + (radius - meanRadius) ** 2,
        0,
      ) / occupiedBins,
    ) / meanRadius

  return Object.freeze({
    occupiedBins,
    totalBins,
    directionalCoverage,
    radialUniformity,
    radialVariation,
    closed: directionalCoverage === 1
      && radialUniformity >= MIN_RADIAL_UNIFORMITY
      && radialVariation <= MAX_RADIAL_VARIATION,
  })
}
