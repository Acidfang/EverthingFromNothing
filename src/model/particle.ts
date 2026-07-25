import { firstDifference, resolveTick, sameField, type Field } from "./kernel.ts"
import { observeFromSixFaces, type ObserverFace } from "./observation.ts"
import { analysePotential } from "./potential.ts"

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
    causalTraces: Object.freeze(
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
    ),
  })
}
