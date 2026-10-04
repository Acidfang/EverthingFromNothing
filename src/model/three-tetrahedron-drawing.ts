import { CANONICAL_SEED } from "./canonicalSeed.ts"

export type TemporalRole = (typeof CANONICAL_SEED.temporalRoles)[number]
export type Point3 = Readonly<{ x:number; y:number; z:number }>
export type TetrahedronOrder = readonly [TemporalRole,TemporalRole,TemporalRole]

export const SHARED_ZERO:Point3=Object.freeze({x:0,y:0,z:0})

/**
 * One geometric tetrahedron, addressed from one shared ZERO.
 * The three presentations are coincident: they do not get translated apart.
 * Difference is carried by cyclic temporal order, not by position.
 */
export const SHARED_TETRAHEDRON_VERTICES=Object.freeze([
 Object.freeze({x:1,y:1,z:1}),
 Object.freeze({x:1,y:-1,z:-1}),
 Object.freeze({x:-1,y:1,z:-1}),
 Object.freeze({x:-1,y:-1,z:1}),
] as const)

export const THREE_TETRAHEDRON_ORDERS=Object.freeze([
 Object.freeze(["WAS","IS","NEXT"] as const),
 Object.freeze(["NEXT","WAS","IS"] as const),
 Object.freeze(["IS","NEXT","WAS"] as const),
] as const)

export const THREE_TETRAHEDRON_DRAWING=Object.freeze({
 whole:"ONE_WHOLE",
 centre:SHARED_ZERO,
 count:3,
 coincident:true,
 translatedApart:false,
 vertices:SHARED_TETRAHEDRON_VERTICES,
 presentations:Object.freeze(THREE_TETRAHEDRON_ORDERS.map((order,index)=>Object.freeze({
   index,
   centre:SHARED_ZERO,
   vertices:SHARED_TETRAHEDRON_VERTICES,
   order,
 }))),
 transition:CANONICAL_SEED.transition,
} as const)

export function cycleOrder(order:TetrahedronOrder):TetrahedronOrder{
 return Object.freeze([order[2],order[0],order[1]])
}
