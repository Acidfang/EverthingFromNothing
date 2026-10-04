/** Explicit retained relation operations through the same issued grain identity.
 * This adapter does not interpret source text or select an operation from it. */
import type { EILedger } from './ei-engine.ts'
import { resolveEIGrainTarget, referenceEIGrain, type EIGrainHandle } from './ei-grain-identity.ts'
import { evaluateEIQuery, verifyEIQueryAnswer, type EIQuery } from './ei-relation-reasoner.ts'

export type EIGrainResolution = Readonly<
  | { kind: 'read' | 'context' | 'trace'; target: EIGrainHandle }
  | { kind: 'compare'; target: EIGrainHandle; other: EIGrainHandle }
  | { kind: 'follow'; target: EIGrainHandle; relations: readonly string[] }
>

/** Each operand must name current IS in this exact retained snapshot. Historical
 * inspection stays available through readEIGrain; it is never silently rebound
 * to current IS by an operation that does not support a revision parameter. */
export async function resolveEIGrainRelations(ledger: EILedger, operation: EIGrainResolution) {
  const address = resolveEIGrainTarget(ledger, operation.target)
  let query: EIQuery
  switch (operation.kind) {
    case 'read': query = { kind: 'read', address, state: 'is' }; break
    case 'context': case 'trace': query = { kind: operation.kind, address }; break
    case 'compare': query = { kind: 'compare', left: address, right: resolveEIGrainTarget(ledger, operation.other) }; break
    case 'follow': query = { kind: 'follow', address, relations: [...operation.relations] }; break
    default: throw new Error('EI grain resolution: unbound operation')
  }
  const answer = await evaluateEIQuery(ledger, query)
  const verification = await verifyEIQueryAnswer(ledger, query, answer)
  return Object.freeze({
    origin: referenceEIGrain(operation.target),
    other: operation.kind === 'compare' ? referenceEIGrain(operation.other) : null,
    status: verification.status === 'failed' ? 'unresolved' as const : answer.status,
    query: answer.query, answer, verification,
  })
}
