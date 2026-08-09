export type EarthObservationId =
  | "CLOSED_SURFACE"
  | "OBLATE_AXES"
  | "AXIAL_ROTATION"
  | "LAYERED_INTERIOR"
  | "LIQUID_OUTER_CORE"
  | "VECTOR_MAGNETIC_FIELD"
  | "LAYERED_ATMOSPHERE"
  | "STELLAR_MASS_RELATION"
  | "SUN_DIFFERENTIAL_ROTATION"
  | "SUN_OUTWARD_TRANSFER"
  | "SUN_EARTH_ORBIT"
  | "SUN_EARTH_IRRADIANCE"
  | "SUN_EARTH_SOLAR_WIND"
  | "GALAXY_STELLAR_MAP"
  | "GALAXY_ROTATION_CURVE"
  | "GALACTIC_CENTRAL_COMPACT_MASS"
  | "BLACK_HOLE_RING_EMISSION"
  | "BLACK_HOLE_GALAXY_OUTFLOW"

export type EarthObservation = Readonly<{
  id: EarthObservationId
  whatMeWitnessed: string
  value: string
  sourceLabel: string
  sourceUrl: string
  qualification: "OBSERVED" | "RECONSTRUCTED FROM OBSERVATIONS"
}>

export type CandidateRelation = "MATCH" | "UNRESOLVED" | "CONFLICT"

export type EarthCandidateDefinition = Readonly<{
  id: string
  label: string
  relations: Readonly<Record<EarthObservationId, CandidateRelation>>
}>

export type EarthCandidateResult = Readonly<{
  id: string
  label: string
  status: "OBSERVATIONALLY COMPLETE" | "CAN BE" | "INCOMPATIBLE"
  matched: readonly EarthObservationId[]
  unresolved: readonly EarthObservationId[]
  conflicts: readonly EarthObservationId[]
}>

export const EARTH_OBSERVATIONS: readonly EarthObservation[] = Object.freeze([
  Object.freeze({
    id: "CLOSED_SURFACE",
    whatMeWitnessed: "Global surface observations resolve one connected closed body.",
    value: "mean radius 6,371.0 km",
    sourceLabel: "NASA planetary facts",
    sourceUrl: "https://nssdc.gsfc.nasa.gov/planetary/factsheet/plutofact.html?level=1",
    qualification: "RECONSTRUCTED FROM OBSERVATIONS",
  }),
  Object.freeze({
    id: "OBLATE_AXES",
    whatMeWitnessed: "The equatorial and polar axes do not resolve to the same radius.",
    value: "6,378.1 km equatorial · 6,356.8 km polar · flattening 0.00335",
    sourceLabel: "NASA planetary facts",
    sourceUrl: "https://nssdc.gsfc.nasa.gov/planetary/factsheet/plutofact.html?level=1",
    qualification: "RECONSTRUCTED FROM OBSERVATIONS",
  }),
  Object.freeze({
    id: "AXIAL_ROTATION",
    whatMeWitnessed: "Surface relationships recur around one rotation axis.",
    value: "sidereal period 23.9345 h",
    sourceLabel: "NASA planetary facts",
    sourceUrl: "https://nssdc.gsfc.nasa.gov/planetary/factsheet/plutofact.html?level=1",
    qualification: "RECONSTRUCTED FROM OBSERVATIONS",
  }),
  Object.freeze({
    id: "LAYERED_INTERIOR",
    whatMeWitnessed: "Seismic paths change speed and direction at internal boundaries.",
    value: "crust · mantle · outer core · inner core",
    sourceLabel: "USGS Earth interior",
    sourceUrl: "https://pubs.usgs.gov/gip/interior/index.html",
    qualification: "RECONSTRUCTED FROM OBSERVATIONS",
  }),
  Object.freeze({
    id: "LIQUID_OUTER_CORE",
    whatMeWitnessed: "P waves traverse the outer core while S waves do not.",
    value: "liquid outer-core behaviour",
    sourceLabel: "USGS seismic paths",
    sourceUrl: "https://www.usgs.gov/media/images/p-wave-and-s-wave-paths-through-earth",
    qualification: "RECONSTRUCTED FROM OBSERVATIONS",
  }),
  Object.freeze({
    id: "VECTOR_MAGNETIC_FIELD",
    whatMeWitnessed: "Vector magnetic measurements vary across location and moment.",
    value: "main + crustal + disturbance fields",
    sourceLabel: "NOAA World Magnetic Model",
    sourceUrl: "https://www.ncei.noaa.gov/products/world-magnetic-model",
    qualification: "OBSERVED",
  }),
  Object.freeze({
    id: "LAYERED_ATMOSPHERE",
    whatMeWitnessed: "Receiving instruments distinguish surrounding gas layers.",
    value: "troposphere · stratosphere · mesosphere · thermosphere · exosphere",
    sourceLabel: "NASA Earth atmosphere",
    sourceUrl: "https://www.nasa.gov/general/what-is-earths-atmosphere/",
    qualification: "OBSERVED",
  }),
  Object.freeze({
    id: "STELLAR_MASS_RELATION",
    whatMeWitnessed: "Repeated stellar positions and velocities constrain relational mass.",
    value: "mass reconstructed from binary astrometry + radial velocity",
    sourceLabel: "ESA Gaia binary stars",
    sourceUrl: "https://sci.esa.int/web/gaia/-/31441-binary-stars",
    qualification: "RECONSTRUCTED FROM OBSERVATIONS",
  }),
  Object.freeze({
    id: "SUN_DIFFERENTIAL_ROTATION",
    whatMeWitnessed: "The Sun's receiving surface does not share one rigid rotation period.",
    value: "25 d equator · 36 d poles",
    sourceLabel: "NASA Sun facts",
    sourceUrl: "https://science.nasa.gov/sun/facts/",
    qualification: "OBSERVED",
  }),
  Object.freeze({
    id: "SUN_OUTWARD_TRANSFER",
    whatMeWitnessed: "Charged transfer and embedded magnetic axes propagate outward from the Sun.",
    value: "solar wind + rotating Parker spiral",
    sourceLabel: "NASA Sun facts",
    sourceUrl: "https://science.nasa.gov/sun/facts/",
    qualification: "OBSERVED",
  }),
  Object.freeze({
    id: "SUN_EARTH_ORBIT",
    whatMeWitnessed: "Earth's location recurs around the Sun at a stable containing scale.",
    value: "149.598 million km · 365.256 d",
    sourceLabel: "NASA planetary facts",
    sourceUrl: "https://nssdc.gsfc.nasa.gov/planetary/factsheet/plutofact.html?level=1",
    qualification: "RECONSTRUCTED FROM OBSERVATIONS",
  }),
  Object.freeze({
    id: "SUN_EARTH_IRRADIANCE",
    whatMeWitnessed: "Earth receivers repeatedly capture outward solar energy.",
    value: "1,361 W/m² at Earth",
    sourceLabel: "NASA planetary facts",
    sourceUrl: "https://nssdc.gsfc.nasa.gov/planetary/factsheet/plutofact.html?level=1",
    qualification: "OBSERVED",
  }),
  Object.freeze({
    id: "SUN_EARTH_SOLAR_WIND",
    whatMeWitnessed: "Solar charged transfers reach and interact with Earth's magnetic receiver.",
    value: "solar wind reaches Earth inside the heliosphere",
    sourceLabel: "NASA Sun facts",
    sourceUrl: "https://science.nasa.gov/sun/facts/",
    qualification: "OBSERVED",
  }),
  Object.freeze({
    id: "GALAXY_STELLAR_MAP",
    whatMeWitnessed: "Stellar locations and motions reconstruct a barred, multi-arm containing galaxy.",
    value: "Milky Way mapped from within using nearly 2 billion stellar receivers",
    sourceLabel: "ESA Gaia Milky Way map",
    sourceUrl: "https://www.cosmos.esa.int/web/gaia/milky-way",
    qualification: "RECONSTRUCTED FROM OBSERVATIONS",
  }),
  Object.freeze({
    id: "GALAXY_ROTATION_CURVE",
    whatMeWitnessed: "Stellar orbital speed changes with distance from the Galactic centre.",
    value: "Gaia DR3 rotation curve · outer Keplerian decline reported",
    sourceLabel: "ESA Gaia rotation curve",
    sourceUrl: "https://www.cosmos.esa.int/web/gaia/iow_20230927",
    qualification: "RECONSTRUCTED FROM OBSERVATIONS",
  }),
  Object.freeze({
    id: "GALACTIC_CENTRAL_COMPACT_MASS",
    whatMeWitnessed: "Multiple stellar paths resolve around the same compact, unseen Galactic-centre relation.",
    value: "Sgr A* · 4.30 million solar masses · 27,000 light-years",
    sourceLabel: "ESO GRAVITY stellar orbits",
    sourceUrl: "https://www.hq.eso.org/public/news/eso2119/",
    qualification: "RECONSTRUCTED FROM OBSERVATIONS",
  }),
  Object.freeze({
    id: "BLACK_HOLE_RING_EMISSION",
    whatMeWitnessed: "Earth-spanning radio baselines reconstruct compact ring emission at the Galactic centre.",
    value: "Sgr A* bright thick ring · 51.8 ± 2.3 μas",
    sourceLabel: "Event Horizon Telescope Sgr A*",
    sourceUrl: "https://eventhorizontelescope.org/publications/first-sagittarius-event-horizon-telescope-results-i-shadow-supermassive-black-hole",
    qualification: "RECONSTRUCTED FROM OBSERVATIONS",
  }),
  Object.freeze({
    id: "BLACK_HOLE_GALAXY_OUTFLOW",
    whatMeWitnessed: "Some galactic centres transfer collimated emission across scales far beyond the compact centre.",
    value: "M87* ring region connected observationally to an extended jet",
    sourceLabel: "Event Horizon Telescope M87*",
    sourceUrl: "https://eventhorizontelescope.org/new-eht-images-reveal-unexpected-polarization-flips-at-m87",
    qualification: "OBSERVED",
  }),
])

const relation = (
  values: Partial<Record<EarthObservationId, CandidateRelation>>,
): Readonly<Record<EarthObservationId, CandidateRelation>> => Object.freeze(
  Object.fromEntries(EARTH_OBSERVATIONS.map((observation) => [
    observation.id,
    values[observation.id] ?? "UNRESOLVED",
  ])) as Record<EarthObservationId, CandidateRelation>,
)

export const EARTH_CANDIDATES: readonly EarthCandidateDefinition[] = Object.freeze([
  Object.freeze({
    id: "observed-earth-state",
    label: "OBSERVATION-DERIVED EARTH STATE",
    relations: relation(Object.fromEntries(
      EARTH_OBSERVATIONS.map((observation) => [observation.id, "MATCH"]),
    )),
  }),
  Object.freeze({
    id: "first-act-recursive-surface",
    label: "FIRST-ACT RECURSIVE CLOSED SURFACE",
    relations: relation({
      CLOSED_SURFACE: "MATCH",
    }),
  }),
  Object.freeze({
    id: "sun-bound-rotating-oblate-shell",
    label: "SUN-BOUND ROTATING OBLATE SHELL",
    relations: relation({
      CLOSED_SURFACE: "MATCH",
      OBLATE_AXES: "MATCH",
      AXIAL_ROTATION: "MATCH",
      STELLAR_MASS_RELATION: "MATCH",
      SUN_EARTH_ORBIT: "MATCH",
      SUN_EARTH_IRRADIANCE: "MATCH",
      SUN_EARTH_SOLAR_WIND: "MATCH",
    }),
  }),
  Object.freeze({
    id: "galaxy-bound-sun-earth-state",
    label: "GALAXY-BOUND SUN–EARTH STATE",
    relations: relation({
      CLOSED_SURFACE: "MATCH",
      OBLATE_AXES: "MATCH",
      AXIAL_ROTATION: "MATCH",
      STELLAR_MASS_RELATION: "MATCH",
      SUN_EARTH_ORBIT: "MATCH",
      SUN_EARTH_IRRADIANCE: "MATCH",
      SUN_EARTH_SOLAR_WIND: "MATCH",
      GALAXY_STELLAR_MAP: "MATCH",
      GALAXY_ROTATION_CURVE: "MATCH",
      GALACTIC_CENTRAL_COMPACT_MASS: "MATCH",
      BLACK_HOLE_RING_EMISSION: "MATCH",
      BLACK_HOLE_GALAXY_OUTFLOW: "MATCH",
    }),
  }),
  Object.freeze({
    id: "isolated-rotating-oblate-shell",
    label: "ISOLATED ROTATING OBLATE SHELL",
    relations: relation({
      CLOSED_SURFACE: "MATCH",
      OBLATE_AXES: "MATCH",
      AXIAL_ROTATION: "MATCH",
      SUN_EARTH_ORBIT: "CONFLICT",
      SUN_EARTH_IRRADIANCE: "CONFLICT",
      SUN_EARTH_SOLAR_WIND: "CONFLICT",
    }),
  }),
  Object.freeze({
    id: "uniform-sphere",
    label: "UNIFORM SPHERE",
    relations: relation({
      CLOSED_SURFACE: "MATCH",
      OBLATE_AXES: "CONFLICT",
      LAYERED_INTERIOR: "CONFLICT",
      LIQUID_OUTER_CORE: "CONFLICT",
    }),
  }),
  Object.freeze({
    id: "material-toroid",
    label: "TOROIDAL MATERIAL BODY",
    relations: relation({
      CLOSED_SURFACE: "CONFLICT",
      OBLATE_AXES: "CONFLICT",
    }),
  }),
])

export function resolveEarthCandidates(
  observations = EARTH_OBSERVATIONS,
  candidates = EARTH_CANDIDATES,
): readonly EarthCandidateResult[] {
  const observed = new Set(observations.map((observation) => observation.id))
  return Object.freeze(candidates.map((candidate) => {
    const matched: EarthObservationId[] = []
    const unresolved: EarthObservationId[] = []
    const conflicts: EarthObservationId[] = []
    for (const id of observed) {
      const relation = candidate.relations[id]
      if (relation === "MATCH") matched.push(id)
      else if (relation === "CONFLICT") conflicts.push(id)
      else unresolved.push(id)
    }
    const status = conflicts.length > 0
      ? "INCOMPATIBLE" as const
      : unresolved.length === 0
        ? "OBSERVATIONALLY COMPLETE" as const
        : "CAN BE" as const
    return Object.freeze({
      id: candidate.id,
      label: candidate.label,
      status,
      matched: Object.freeze(matched),
      unresolved: Object.freeze(unresolved),
      conflicts: Object.freeze(conflicts),
    })
  }).sort((left, right) =>
    left.conflicts.length - right.conflicts.length
    || right.matched.length - left.matched.length
    || left.unresolved.length - right.unresolved.length))
}
