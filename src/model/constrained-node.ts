import {fromKey} from "./address.ts"
import type {Field,TickLedger} from "./kernel.ts"
export type NodeConstraint=Readonly<{address:string;anchor:Readonly<{x:number;y:number;z:number}>;next:readonly Readonly<{address:string;delta:Readonly<{x:number;y:number;z:number}>}>[];status:"ONE ADMISSIBLE"|"ALTERNATIVES"|"NO ADMISSIBLE NEXT"}>
/** Candidate edges must be returned by the selected model and survive its constraint. */
export function constrainedNodes(field:Field,successor:TickLedger):readonly NodeConstraint[]{
 const admitted=new Map<string,Set<string>>()
 for(const entry of successor.entries){if(!entry.remainsDifferent)continue;for(const arrival of entry.arrivals){if(!field.has(arrival.source))continue;const targets=admitted.get(arrival.source)??new Set<string>();targets.add(entry.address);admitted.set(arrival.source,targets)}}
 return [...field].map(address=>{const anchor=fromKey(address),targets=admitted.get(address)??new Set<string>(),next=[...targets].flatMap(target=>{const p=fromKey(target),delta={x:p.x-anchor.x,y:p.y-anchor.y,z:p.z-anchor.z};return Math.hypot(delta.x,delta.y,delta.z)>0?[{address:target,delta}]:[]});return Object.freeze({address,anchor,next,status:next.length===0?"NO ADMISSIBLE NEXT":next.length===1?"ONE ADMISSIBLE":"ALTERNATIVES"})})
}
/** Selected small tetra drawing: tip follows admitted displacement; axial roll is not a claimed law. */
export function directedTetra(delta:Readonly<{x:number;y:number;z:number}>,size=.38){
 const length=Math.hypot(delta.x,delta.y,delta.z);if(!length)return null
 const f={x:delta.x/length,y:delta.y/length,z:delta.z/length},h=Math.abs(f.y)<.9?{x:0,y:1,z:0}:{x:1,y:0,z:0}
 const c={x:h.y*f.z-h.z*f.y,y:h.z*f.x-h.x*f.z,z:h.x*f.y-h.y*f.x},n=Math.hypot(c.x,c.y,c.z),r={x:c.x/n,y:c.y/n,z:c.z/n},u={x:f.y*r.z-f.z*r.y,y:f.z*r.x-f.x*r.z,z:f.x*r.y-f.y*r.x}
 return [{x:f.x*size,y:f.y*size,z:f.z*size},...[0,1,2].map(i=>{const a=i*2*Math.PI/3;return{x:-f.x*size/3+size*.4*(r.x*Math.cos(a)+u.x*Math.sin(a)),y:-f.y*size/3+size*.4*(r.y*Math.cos(a)+u.y*Math.sin(a)),z:-f.z*size/3+size*.4*(r.z*Math.cos(a)+u.z*Math.sin(a))}})]
}
