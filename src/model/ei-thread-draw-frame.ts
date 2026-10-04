import type {EIThreadDrawPlan} from './ei-thread-draw.ts'
/** A partial presentation frame. Phase is a draw cursor, never an addressed model state. */
export function projectEIThreadDrawFrame(plan:EIThreadDrawPlan,phase:number,retained:{nodes:ReadonlySet<string>;edges:ReadonlySet<string>}={nodes:new Set(),edges:new Set()}){
 if(!Number.isFinite(phase)||phase<0)throw new Error('Invalid thread draw cursor')
 const complete=phase>=plan.lastStage+1
 return {scope:'observer-thread-drawing' as const,modelAdvanced:false as const,complete,
  nodes:plan.nodes.map(node=>({...node,visible:retained.nodes.has(node.address)||(node.stage!==null&&node.stage<=phase)||(complete&&node.stage===null),unreached:node.stage===null})),
  edges:plan.edges.map(edge=>({...edge,retained:retained.edges.has(edge.id),fraction:edge.stage===null?0:Math.max(0,Math.min(1,phase-edge.stage)),visible:retained.edges.has(edge.id)||(edge.stage!==null&&phase>edge.stage)||(complete&&edge.status==='unreachable')}))}
}
