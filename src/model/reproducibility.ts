import {firstDifference,resolveTick,reverseTick} from './kernel.ts'
import {constrainedNodes,directedTetra} from './constrained-node.ts'
import {createAddressedDraw,mayAdvanceAfterDraw} from './addressed-draw.ts'
export type Graph = Readonly<{nodes:readonly {id:string;inventory_binary_address:string}[];relations:readonly {left:string;right:string}[]}>
export const CAPABILITIES = [
 {id:'graph',title:'Binary source graph',sources:['binary-address','topology','parent','membership'],method:'Unique binary locators and existing relation endpoints; reject a deliberately broken endpoint.',inputs:'Current finite source inventory',scope:'Inventory transport consistency only; binary locators do not establish physical geometry.'},
 {id:'replay',title:'Historical six-face replay · WAS',sources:['ledger','immutable','gf2','reversible','temporal-cycle'],method:'Execute Act 0 → 1 → 2, compare Act 1 with six independently listed neighbors, then reverse Act 1.',inputs:'WAS = empty; IS = {0,0,0}; selected six-face parity rule',scope:'Historical selected kernel, retained separately from the requested additive pattern layer. The supplied seed and six Cartesian directions are not derived from NOTHING.'},
 {id:'orientation',title:'Historical lattice glyph check · WAS',sources:['next-count','can-next','cant-next','coordinates','tetrahedra'],method:'Admit surviving successor receipts, align tetra tips with displacement; reject zero displacement and excluded successors.',inputs:'Single origin at Act 0; returned Act 1 ledger; display size 0.38',scope:'Historical selected lattice drawing, retained separately from the requested additive pattern layer; no exact twist or axial-roll law is established.'},
 {id:'pixels',title:'Finite completion barrier',sources:['render-boundary','frame','expected-actual','completion-states'],method:'Assign 2 × 2 synthetic pixel addresses, block incomplete/unpresented/cancelled draws, admit completed presented draw.',inputs:'Width 2; height 2; two batches of 2; synthetic presentation flag',scope:'Executed software barrier; no claim that this check displays pixels or measures a physical device.'},
] as const
export type CapabilityId = typeof CAPABILITIES[number]['id']
export type Check = Readonly<{name:string;pass:boolean;expected:unknown;actual:unknown}>
export type Run = Readonly<{capability:CapabilityId;checks:readonly Check[];output:unknown;passed:boolean}>
const sorted=(values:ReadonlySet<string>)=>[...values].sort()
const equal=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b)
export function graphValid(graph:Graph):boolean{
 const ids=new Set(graph.nodes.map(n=>n.id)),addresses=new Set(graph.nodes.map(n=>n.inventory_binary_address))
 return graph.nodes.length>0&&ids.size===graph.nodes.length&&addresses.size===graph.nodes.length&&graph.nodes.every(n=>/^[01]*$/.test(n.inventory_binary_address))&&graph.relations.every(r=>ids.has(r.left)&&ids.has(r.right))
}
export function runCapability(id:CapabilityId,graph:Graph):Run{
 const checks:Check[]=[]
 const check=(name:string,actual:unknown,expected:unknown)=>checks.push({name,actual,expected,pass:equal(actual,expected)})
 let output:unknown
 if(id==='graph'){
  check('Unique binary addresses and known endpoints',graphValid(graph),true)
  check('Broken endpoint rejected',graphValid({...graph,relations:[...graph.relations,{left:'__missing_endpoint__',right:graph.nodes[0]?.id??''}]}),false)
  output={nodes:graph.nodes,relations:graph.relations}
 }else if(id==='replay'){
  const initial=firstDifference(),one=resolveTick(initial),two=resolveTick(one.state),back=reverseTick(one.state)
  check('Act 1 independent six-neighbor oracle',sorted(one.state.is),['-1,0,0','0,-1,0','0,0,-1','0,0,1','0,1,0','1,0,0'])
  check('Act 2 independent axial oracle',sorted(two.state.is),['-2,0,0','0,-2,0','0,0,-2','0,0,0','0,0,2','0,2,0','2,0,0'])
  check('Reversal returns declared initial state',{act:back.act,was:sorted(back.was),is:sorted(back.is)},{act:0,was:[],is:['0,0,0']})
  check('Input snapshot unchanged',{act:initial.act,was:sorted(initial.was),is:sorted(initial.is)},{act:0,was:[],is:['0,0,0']})
  output={WAS:sorted(initial.is),IS:sorted(one.state.is),NEXT:sorted(two.state.is),receipt:one.ledger}
 }else if(id==='orientation'){
  const initial=firstDifference(),next=resolveTick(initial),nodes=constrainedNodes(initial.is,next.ledger)
  check('Six alternatives at origin',nodes[0].next.length,6)
  check('Independent address/displacement pairs',nodes[0].next,[
   {address:'-1,0,0',delta:{x:-1,y:0,z:0}},
   {address:'0,-1,0',delta:{x:0,y:-1,z:0}},
   {address:'0,0,-1',delta:{x:0,y:0,z:-1}},
   {address:'0,0,1',delta:{x:0,y:0,z:1}},
   {address:'0,1,0',delta:{x:0,y:1,z:0}},
   {address:'1,0,0',delta:{x:1,y:0,z:0}},
  ])
  check('Mixed survivor ledger admits only returned survivor',constrainedNodes(initial.is,{...next.ledger,entries:next.ledger.entries.map(e=>({...e,remainsDifferent:e.address==='1,0,0'}))})[0].next,[{address:'1,0,0',delta:{x:1,y:0,z:0}}])
  check('All tips match admitted displacement',nodes[0].next.every(n=>{const tip=directedTetra(n.delta)?.[0];return !!tip&&equal(tip,{x:n.delta.x*.38,y:n.delta.y*.38,z:n.delta.z*.38})}),true)
  check('Zero direction rejected',directedTetra({x:0,y:0,z:0}),null)
  check('Excluded successors not admitted',constrainedNodes(initial.is,{...next.ledger,entries:next.ledger.entries.map(e=>({...e,remainsDifferent:false}))})[0].next.length,0)
  output=nodes
 }else{
  const draw=createAddressedDraw(2,2),writes:number[][]=[]
  const write=(i:number,x:number,y:number)=>{writes.push([i,x,y])}
  check('Incomplete draw blocked',mayAdvanceAfterDraw(draw.assign(2,write),true),false)
  const complete=draw.assign(2,write)
  check('Independent row-major oracle',writes,[[0,0,0],[1,1,0],[2,0,1],[3,1,1]])
  check('Unpresented draw blocked',mayAdvanceAfterDraw(complete,false),false)
  check('Complete presented draw admitted',mayAdvanceAfterDraw(complete,true),true)
  draw.cancel();check('Cancelled draw blocked',mayAdvanceAfterDraw(draw.receipt(),true),false)
  output={writes,complete,cancelled:draw.receipt()}
 }
 return {capability:id,checks,output,passed:checks.every(c=>c.pass)}
}
export function sameRun(left:Run,right:Run):boolean{return left.passed&&right.passed&&equal(left,right)}
export function capabilitiesFor(sourceId:string){return CAPABILITIES.filter(c=>(c.sources as readonly string[]).includes(sourceId))}
