/** Addressed Difference producer. It produces logical runtime instances, never a
 * tetra population from display depth, bit strings, or a selected spatial grid. */
export const FRACTURE_AUTHORITY = Object.freeze({
  source: 'docs/SOURCE-MECHANISM.md#addressed-difference',
  production: 'Δ@z⇒Fz=z⋈Δ⋈Fz≅N⊂N',
  recurrence: '∀z:z≠Z⋈z⋈N⋈z↻z',
  gate: 'docs/SOURCE-MECHANISM.md#gate',
  anotherGrain: 'docs/SOURCE-MECHANISM.md#grains',
  temporal: 'src/model/canonicalSeed.ts:transition',
});
export type SourceRecord = Readonly<{
  id:string; address:string; sourceRef:string; value:string;
  previousId?:string; parentAddress?:string; parentAddresses?:readonly string[];
  moment?:Readonly<{index:string; sourceRef:string}>;
}>;
export type FractureInput = Readonly<{
  sourceAddress:string; records:readonly SourceRecord[];
  pathLimits?:Readonly<{maxPathsPerNode?:number;maxExpansions?:number}>;
}>;
export type FractureNode = Readonly<{
  id:string; address:string; kind:'SOURCE'|'ADDRESS'|'FRACTURE';
  sourceAddress:string; canonicalEntityAddress:string; identityKind:'ENTITY_VIEW'|'DERIVATION_VIEW'; recordIds:readonly string[]; anchor:boolean;
  position:null; mechanismRef:string; parentId:string|null;
}>;
export type FractureEdge = Readonly<{
  id:string; from:string; to:string;
  kind:'RETAINED_AT'|'DIFFERENCE_AT'|'RETURN'|'CONTAINED_BY';
  sourceRefs:readonly string[];
}>;
export type FractureGate = Readonly<{
  id:string; fractureId:string; canonicalEntityAddress:string; identityKind:'DERIVATION_VIEW'; wasRecordId:string; isRecordId:string;
  nextRecordIds:readonly string[]; moment:SourceRecord['moment']|null;
  roleCycle:Readonly<{WAS:'NEXT';IS:'WAS';NEXT:'IS'}>;
  roleCycleStatus:'RETAINED_RULE_NOT_EXECUTED'; mappingResolved:false;
  execution:'AVAILABLE'; ports:'TETRAHEDRAL_BINDING_UNRESOLVED';
}>;
const id = (...parts:string[]) => JSON.stringify(parts);

function freeze<T>(value:T):T {
  if(value && typeof value==='object') {
    for(const child of Object.values(value))freeze(child);
    Object.freeze(value);
  }
  return value;
}
const nonempty=(value:unknown):value is string=>typeof value==='string'&&value.length>0;
const parentsOf=(r:SourceRecord)=>[...new Set([...(r.parentAddress?[r.parentAddress]:[]),...(r.parentAddresses??[])])];

export function produceSourceFractures(input:FractureInput) {
  if(!input || typeof input!=='object' || !nonempty(input.sourceAddress)) throw new Error('SOURCE address required');
  if(!Array.isArray(input.records))throw new Error('records must be an array');
  if(input.pathLimits!==undefined && (!input.pathLimits || typeof input.pathLimits!=='object' || Array.isArray(input.pathLimits)))throw new Error('invalid path limits');
  const maxPathsPerNode=input.pathLimits?.maxPathsPerNode??256,maxExpansions=input.pathLimits?.maxExpansions??100000;
  if(!Number.isSafeInteger(maxPathsPerNode)||maxPathsPerNode<1||!Number.isSafeInteger(maxExpansions)||maxExpansions<1)throw new Error('path limits must be positive finite integers');
  const records = new Map<string,SourceRecord>();
  for(const r of input.records) {
    if(!r || typeof r!=='object' || !nonempty(r.id) || !nonempty(r.address) || !nonempty(r.sourceRef)) throw new Error('record identity, address and provenance required');
    if(typeof r.value!=='string')throw new Error('record value must be a string');
    if(r.previousId!==undefined&&!nonempty(r.previousId))throw new Error('invalid previousId');
    if(r.parentAddress!==undefined&&!nonempty(r.parentAddress))throw new Error('invalid parentAddress');
    if(r.parentAddresses!==undefined&&(!Array.isArray(r.parentAddresses)||r.parentAddresses.some((p:unknown)=>!nonempty(p))))throw new Error('invalid parentAddresses');
    if(records.has(r.id)) throw new Error('duplicate record identity');
    if(r.moment!==undefined && (!r.moment || typeof r.moment!=='object' || !nonempty(r.moment.index) || !nonempty(r.moment.sourceRef))) throw new Error('moment requires explicit source binding');
    const copy:SourceRecord={id:r.id,address:r.address,sourceRef:r.sourceRef,value:r.value,
      ...(r.previousId!==undefined?{previousId:r.previousId}:{}),
      ...(r.parentAddress!==undefined?{parentAddress:r.parentAddress}:{}),
      ...(r.parentAddresses!==undefined?{parentAddresses:[...r.parentAddresses]}:{}),
      ...(r.moment?{moment:{index:r.moment.index,sourceRef:r.moment.sourceRef}}:{})};
    records.set(r.id,freeze(copy));
  }
  const sourceRecords=[...records.values()];
  const sourceId=id('ADDRESS',input.sourceAddress);
  const nodes:FractureNode[]=[]; const edges:FractureEdge[]=[]; const gates:FractureGate[]=[];
  const differences:{id:string;beforeId:string;afterId:string;address:string;comparison:'EXACT_SOURCE_TEXT';fractureId:string}[]=[];
  const unresolved:{address:string;reason:string}[]=[];
  const addresses=new Set([input.sourceAddress,...sourceRecords.map(r=>r.address)]);
  const addEdge=(from:string,to:string,kind:FractureEdge['kind'],refs:string[])=>{
    const edgeId=id('EDGE',from,kind,to); if(!edges.some(e=>e.id===edgeId)) edges.push({id:edgeId,from,to,kind,sourceRefs:refs});
  };
  for(const address of addresses) {
    const own=sourceRecords.filter(r=>r.address===address);
    const parents=[...new Set(own.flatMap(parentsOf))];
    // Parent relations are retained individually; no chosen parent overwrites a stitch.
    nodes.push({id:id('ADDRESS',address),address,kind:address===input.sourceAddress?'SOURCE':'ADDRESS',sourceAddress:input.sourceAddress,canonicalEntityAddress:address,identityKind:'ENTITY_VIEW',recordIds:own.map(r=>r.id),anchor:address===input.sourceAddress,position:null,mechanismRef:FRACTURE_AUTHORITY.source,parentId:null});
    for(const parent of parents) {
      if(!addresses.has(parent)) unresolved.push({address,reason:`PARENT_NOT_RETAINED:${parent}`});
      else addEdge(id('ADDRESS',address),id('ADDRESS',parent),'CONTAINED_BY',own.filter(r=>parentsOf(r).includes(parent)).map(r=>r.sourceRef));
    }
    if(address!==input.sourceAddress && parents.length===0) unresolved.push({address,reason:'CONTAINMENT_UNBOUND'});
  }
  for(const r of sourceRecords) {
    if(!r.previousId) { unresolved.push({address:r.address,reason:`BASELINE_ONLY:${r.id}`}); continue; }
    const was=records.get(r.previousId);
    if(!was) {unresolved.push({address:r.address,reason:`PREVIOUS_NOT_RETAINED:${r.previousId}`});continue;}
    if(was.address!==r.address) {unresolved.push({address:r.address,reason:`CROSS_ADDRESS_COMPARISON_UNBOUND:${was.id}`});continue;}
    if(was.id===r.id) {unresolved.push({address:r.address,reason:'SELF_PREVIOUS_INVALID'});continue;}
    if(was.value===r.value) continue;
    const fractureId=id('FRACTURE',r.address,was.id,r.id),differenceId=id('DIFFERENCE',was.id,r.id);
    differences.push({id:differenceId,beforeId:was.id,afterId:r.id,address:r.address,comparison:'EXACT_SOURCE_TEXT',fractureId});
    nodes.push({id:fractureId,address:r.address,kind:'FRACTURE',sourceAddress:input.sourceAddress,canonicalEntityAddress:r.address,identityKind:'DERIVATION_VIEW',recordIds:[was.id,r.id],anchor:false,position:null,mechanismRef:FRACTURE_AUTHORITY.source,parentId:id('ADDRESS',r.address)});
    addEdge(id('ADDRESS',r.address),fractureId,'DIFFERENCE_AT',[was.sourceRef,r.sourceRef,FRACTURE_AUTHORITY.source]);
    addEdge(fractureId,id('ADDRESS',r.address),'RETURN',[FRACTURE_AUTHORITY.source]);
    gates.push({id:id('GATE',fractureId),fractureId,canonicalEntityAddress:r.address,identityKind:'DERIVATION_VIEW',wasRecordId:was.id,isRecordId:r.id,nextRecordIds:sourceRecords.filter(next=>next.previousId===r.id&&next.address===r.address).map(next=>next.id),moment:r.moment??null,roleCycle:{WAS:'NEXT',IS:'WAS',NEXT:'IS'},roleCycleStatus:'RETAINED_RULE_NOT_EXECUTED',mappingResolved:false,execution:'AVAILABLE',ports:'TETRAHEDRAL_BINDING_UNRESOLVED'});
  }
  // Every fracture returns via its actual address/containment thread. No spatial
  // adjacency, new root, extra child, or successor act is inferred from this list.
  const adjacency=new Map<string,string[]>(),reverse=new Map<string,string[]>();
  for(const e of edges)if(e.kind==='RETURN'||e.kind==='CONTAINED_BY'){
    adjacency.set(e.from,[...(adjacency.get(e.from)??[]),e.to]);
    reverse.set(e.to,[...(reverse.get(e.to)??[]),e.from]);
  }
  // Exact reachability uses the full retained graph and never depends on the
  // bounded enumeration of path witnesses below.
  const reachable=new Set([sourceId]),queue=[sourceId];
  for(let i=0;i<queue.length;i++)for(const child of reverse.get(queue[i])??[])
    if(!reachable.has(child)){reachable.add(child);queue.push(child);}
  let expansions=0;
  const threads=nodes.map(n=>{
    const paths:string[][]=[];
    const stack=reachable.has(n.id)?[[n.id]]:[];
    while(stack.length && paths.length<maxPathsPerNode && expansions<maxExpansions){
      const path=stack.pop()!;expansions++;const at=path[path.length-1];
      if(at===sourceId){paths.push(path);continue;}
      for(const next of adjacency.get(at)??[])if(reachable.has(next)&&!path.includes(next))stack.push([...path,next]);
    }
    const truncated=stack.length>0;
    if(!reachable.has(n.id))unresolved.push({address:n.address,reason:'ROOT_RETURN_UNBOUND'});
    if(truncated)unresolved.push({address:n.address,reason:'ROOT_PATH_EVIDENCE_TRUNCATED'});
    return {nodeId:n.id,paths,reachable:reachable.has(n.id),truncated,pathsComplete:!truncated};
  });
  return freeze({sourceId,sourceRecords,nodes,edges,gates,differences,threads,unresolved,
    pathEvidence:{maxPathsPerNode,maxExpansions,expansions,complete:threads.every(t=>t.pathsComplete)},
    authority:FRACTURE_AUTHORITY,
    recursiveAvailability:nodes.map(n=>({nodeId:n.id,rule:FRACTURE_AUTHORITY.production,condition:'ACTUAL_ADDRESSED_DIFFERENCE_REQUIRED' as const})),
    spatialPlacement:'UNBOUND' as const,worldEvolution:'NOT_ASSERTED' as const,
    limitation:'Text Difference is witnessed; semantic Difference, gate port correspondence and unsupplied continuation are not inferred.'});
}

/** Resource view only: follows actual retained containment. It never produces
 * additional world nodes. Cycles are bounded by shortest discovered depth. */
export function fractureView(state:ReturnType<typeof produceSourceFractures>,maxDepth:number){
  if(!Number.isSafeInteger(maxDepth)||maxDepth<0)throw new Error('finite nonnegative view depth required');
  const depths=new Map<string,number>([[state.sourceId,0]]),queue=[state.sourceId];
  while(queue.length){const at=queue.shift()!,d=depths.get(at)!;
    for(const e of state.edges){const child=e.kind==='CONTAINED_BY'&&e.to===at?e.from:e.kind==='DIFFERENCE_AT'&&e.from===at?e.to:null;
      if(child&&!depths.has(child)){depths.set(child,d+1);queue.push(child);}}
  }
  const visible=state.nodes.filter(n=>(depths.get(n.id)??Infinity)<=maxDepth),ids=new Set(visible.map(n=>n.id));
  return freeze({nodes:visible,edges:state.edges.filter(e=>ids.has(e.from)&&ids.has(e.to)),hiddenNodeIds:state.nodes.filter(n=>!ids.has(n.id)).map(n=>n.id),maxDepth,kind:'RESOURCE_VIEW_ONLY' as const});
}
