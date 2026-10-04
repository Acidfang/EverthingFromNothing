import {THREE_TETRAHEDRON_DRAWING,type Point3} from "./three-tetrahedron-drawing.ts"
/** SELECTED observer basis from retained source directions; not a new transition law. */
export const MODEL_DIRECTIONS=THREE_TETRAHEDRON_DRAWING.vertices
const dot=(a:Point3,b:Point3)=>a.x*b.x+a.y*b.y+a.z*b.z
const cross=(a:Point3,b:Point3):Point3=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x})
const unit=(a:Point3):Point3=>{const n=Math.hypot(a.x,a.y,a.z);return{x:a.x/n,y:a.y/n,z:a.z/n}}
export function directionBasis(index:number){
 const source=MODEL_DIRECTIONS[index]
 if(!source)throw new Error("Unknown source direction")
 const forward=unit(source),right=unit(cross({x:0,y:1,z:0},forward)),up=cross(forward,right)
 return Object.freeze({source,forward,right,up,status:"SELECTED" as const})
}
export function projectInDirection(point:Point3,index:number){const basis=directionBasis(index);return{x:dot(point,basis.right),y:dot(point,basis.up),depth:dot(point,basis.forward)}}
