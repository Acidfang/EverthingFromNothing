import {SHARED_TETRAHEDRON_VERTICES} from './three-tetrahedron-drawing.ts'
import type {EILedger} from './ei-engine.ts'
import {resolveEIObserverZero} from './ei-observer-zero.ts'
import type {EIGrain} from './ei-grain-identity.ts'
/** A contained-part view over actual retained addresses; no generated world nodes. */
export function deriveEIFieldObject(ledger:EILedger,address:string,grain:EIGrain){
 const zero=resolveEIObserverZero(ledger,address,grain),record=ledger.records.find(item=>item.address===address)!,known=new Set(ledger.records.map(item=>item.address))
 const edges=[...ledger.records.filter(item=>item.parents.includes(address)).map(item=>({from:address,to:item.address,relation:'parent-of',sourceAddress:item.address,sourceId:(item.was[0]??item.is).source.id})),...record.relations.filter(item=>item.relation==='CONTAINS').map(item=>({from:address,to:item.address,relation:item.relation,sourceAddress:address,sourceId:(record.was[0]??record.is).source.id}))]
 const parts=[...new Set(edges.filter(edge=>known.has(edge.to)).map(edge=>edge.to))].sort()
 return Object.freeze({zero,partAddresses:Object.freeze(parts),edges:Object.freeze(edges),unknownParts:Object.freeze(edges.filter(edge=>!known.has(edge.to)).map(edge=>edge.to)),modelAdvanced:false as const})
}
/** Same fixed retained 3D primitive; only the observer basis changes. */
export function projectEIFieldTetrahedron(yaw:number,pitch:number){
 if(!Number.isFinite(yaw)||!Number.isFinite(pitch))throw new Error('Invalid observer basis')
 const points=SHARED_TETRAHEDRON_VERTICES.map(p=>{const x=p.x*Math.cos(yaw)-p.z*Math.sin(yaw),z=p.x*Math.sin(yaw)+p.z*Math.cos(yaw);return {x:x*19,y:-(p.y*Math.cos(pitch)-z*Math.sin(pitch))*19,z:p.y*Math.sin(pitch)+z*Math.cos(pitch)}})
 const edges=points.flatMap((a,i)=>points.slice(i+1).map(b=>`M${a.x} ${a.y}L${b.x} ${b.y}`)).join('')
 const faces=[[0,1,2],[0,1,3],[0,2,3],[1,2,3]].map(indices=>({depth:indices.reduce((sum,i)=>sum+points[i].z,0)/3,points:indices.map(i=>`${points[i].x},${points[i].y}`).join(' ')})).sort((a,b)=>a.depth-b.depth)
 return Object.freeze({points:Object.freeze(points),path:edges,faces:Object.freeze(faces.map(face=>face.points)),scope:'observer-projection-of-retained-3d-vertices' as const})
}
