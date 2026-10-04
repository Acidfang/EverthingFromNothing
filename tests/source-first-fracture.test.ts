import test from 'node:test';
import assert from 'node:assert/strict';
import {produceSourceFractures,fractureView,type SourceRecord} from '../src/model/source-first-fracture.ts';
const record=(id:string,address:string,value:string,extra:Partial<SourceRecord>={}):SourceRecord=>({id,address,value,sourceRef:`synthetic-test:${id}`,...extra});
const root='ROOT';
test('SOURCE alone does not spontaneously populate a binary or four-child tree',()=>{
 const s=produceSourceFractures({sourceAddress:root,records:[]});
 assert.equal(s.nodes.length,1);assert.equal(s.gates.length,0);assert.equal(s.differences.length,0);
 for(const depth of [0,1,10,100])assert.equal(fractureView(s,depth).nodes.length,1);
});
test('actual retained change produces a stable addressed fracture without hand-fed poses',()=>{
 const records=[record('a',root,'THIS'),record('b',root,'NOT THIS',{previousId:'a'})];
 const s=produceSourceFractures({sourceAddress:root,records});
 assert.equal(s.differences.length,1);assert.equal(s.nodes.length,2);assert.equal(s.gates[0].wasRecordId,'a');assert.equal(s.gates[0].isRecordId,'b');
 assert.equal(s.gates[0].moment,null);assert.equal(s.gates[0].execution,'AVAILABLE');
 assert.deepEqual(s.nodes.filter(n=>n.anchor).map(n=>n.address),[root]);assert.ok(s.nodes.every(n=>n.position===null));
 assert.deepEqual(produceSourceFractures({sourceAddress:root,records}).differences,s.differences);
});
test('unchanged source and absent baseline never manufacture a Difference',()=>{
 const s=produceSourceFractures({sourceAddress:root,records:[record('a',root,'same'),record('b',root,'same',{previousId:'a'})]});
 assert.equal(s.differences.length,0);assert.equal(s.gates.length,0);
});
test('cross-grain actual Differences retain root paths and explicit indexed moment',()=>{
 const s=produceSourceFractures({sourceAddress:root,records:[record('a',root,'a'),record('b',root,'b',{previousId:'a'}),record('c','child','a',{parentAddress:root}),record('d','child','b',{previousId:'c',parentAddress:root,moment:{index:'.infinity2',sourceRef:'synthetic-test:explicit-index'}})]});
 assert.equal(s.gates.length,2);assert.ok(s.threads.every(t=>t.paths.length));
 assert.equal(s.gates[1].moment?.index,'.infinity2');
 assert.equal(fractureView(s,0).nodes.length,1);assert.equal(fractureView(s,2).nodes.length,4);
 assert.equal(s.nodes.length,4);
});
test('multiple supplied continuations remain separate, no unique choice invented',()=>{
 const records=[record('a',root,'a'),record('b',root,'b',{previousId:'a'}),record('c',root,'c',{previousId:'b'}),record('d',root,'d',{previousId:'b'})];
 const s=produceSourceFractures({sourceAddress:root,records});
 assert.deepEqual(s.gates[0].nextRecordIds,['c','d']);assert.equal(s.differences.length,3);
 assert.equal(s.gates.every(g=>g.execution==='AVAILABLE'),true);
});
test('equal text does not merge identity and missing provenance cannot enter',()=>{
 const s=produceSourceFractures({sourceAddress:root,records:[record('a','left','same',{parentAddress:root}),record('b','right','same',{parentAddress:root})]});
 assert.equal(s.nodes.length,3);assert.notEqual(s.nodes[1].id,s.nodes[2].id);
 assert.throws(()=>produceSourceFractures({sourceAddress:root,records:[record('a',root,'x',{sourceRef:''})]}),/provenance/);
});
test('missing or cross-address predecessor remains open instead of substituted',()=>{
 const s=produceSourceFractures({sourceAddress:root,records:[record('a',root,'a'),record('b','child','b',{previousId:'a'}),record('c',root,'c',{previousId:'missing'})]});
 assert.equal(s.differences.length,0);assert.ok(s.unresolved.some(u=>u.reason.startsWith('CROSS_ADDRESS')));assert.ok(s.unresolved.some(u=>u.reason.startsWith('PREVIOUS_NOT')));
});
test('cyclic containment terminates and disconnected path remains unresolved',()=>{
 const s=produceSourceFractures({sourceAddress:root,records:[record('a','A','x',{parentAddress:'B'}),record('b','B','y',{parentAddress:'A'})]});
 assert.ok(s.unresolved.some(u=>u.reason==='ROOT_RETURN_UNBOUND'));assert.equal(fractureView(s,99).nodes.length,1);
});
test('adding a later source change preserves all earlier fracture identities',()=>{
 const records=[record('a',root,'a'),record('b',root,'b',{previousId:'a'})];
 const old=produceSourceFractures({sourceAddress:root,records}),next=produceSourceFractures({sourceAddress:root,records:[...records,record('c',root,'c',{previousId:'b'})]});
 assert.deepEqual(next.differences[0],old.differences[0]);assert.equal(next.differences.length,2);
});
test('one record preserves multiple parents and compatible singular parent provenance',()=>{
 const s=produceSourceFractures({sourceAddress:root,records:[record('a','A','a',{parentAddress:root}),record('b','B','b',{parentAddress:root}),record('c','C','c',{parentAddress:'A',parentAddresses:['B','A']})]});
 const c=s.nodes.find(n=>n.address==='C')!;
 assert.equal(s.edges.filter(e=>e.from===c.id&&e.kind==='CONTAINED_BY').length,2);
 assert.equal(s.threads.find(t=>t.nodeId===c.id)!.paths.length,2);
 assert.equal(s.sourceRecords.length,3);
});
test('bounded shared DAG retains all edges and exact reachability when path evidence truncates',()=>{
 const records:SourceRecord[]=[];let parents=[root];
 for(let layer=0;layer<12;layer++){
  const next=[`L${layer}a`,`L${layer}b`];
  for(const address of next)records.push(record(address,address,'value',{parentAddresses:parents}));
  parents=next;
 }
 const s=produceSourceFractures({sourceAddress:root,records,pathLimits:{maxPathsPerNode:3,maxExpansions:80}});
 assert.equal(s.edges.filter(e=>e.kind==='CONTAINED_BY').length,46);
 assert.ok(s.threads.every(t=>t.reachable));assert.equal(s.pathEvidence.complete,false);
 assert.ok(s.pathEvidence.expansions<=80);assert.ok(s.threads.every(t=>t.paths.length<=3));
 assert.ok(s.unresolved.some(u=>u.reason==='ROOT_PATH_EVIDENCE_TRUNCATED'));
 assert.equal(s.unresolved.some(u=>u.reason==='ROOT_RETURN_UNBOUND'),false);
});
test('selected child SOURCE leaves upstream and unrelated addresses unbound',()=>{
 const s=produceSourceFractures({sourceAddress:'child',records:[record('a',root,'root'),record('b','child','child',{parentAddress:root}),record('c','other','other')]});
 assert.deepEqual(s.nodes.filter(n=>n.anchor).map(n=>n.address),['child']);
 assert.equal(s.threads.filter(t=>t.reachable).length,1);
 assert.equal(s.nodes.length,3);
});
test('input mutations cannot alter frozen retained output or explicit moment provenance',()=>{
 const parents=[root];const moment={index:'.infinity2',sourceRef:'synthetic-test:moment'};
 const input={sourceAddress:root,records:[record('a','child','a',{parentAddresses:parents}),record('b','child','b',{previousId:'a',parentAddresses:parents,moment})]};
 const s=produceSourceFractures(input),before=JSON.stringify(s);
 parents.push('elsewhere');moment.index='changed';input.records.push(record('c',root,'new'));
 assert.equal(JSON.stringify(s),before);assert.ok(Object.isFrozen(s));assert.ok(Object.isFrozen(s.sourceRecords));assert.ok(Object.isFrozen(s.gates[0].moment));
 assert.equal(s.gates[0].roleCycleStatus,'RETAINED_RULE_NOT_EXECUTED');assert.equal(s.gates[0].mappingResolved,false);
 assert.ok(Object.isFrozen(fractureView(s,3)));
});
test('malformed runtime values, addresses, parents, moments and limits are rejected',()=>{
 for(const bad of [null,{sourceAddress:3,records:[]},{sourceAddress:root,records:{}},
  ...[{value:4},{id:3},{previousId:4},{parentAddresses:'A'},{parentAddresses:[3]},{moment:null}].map(extra=>({sourceAddress:root,records:[{...record('a',root,'a'),...extra}]})),
  {sourceAddress:root,records:[],pathLimits:{maxExpansions:Infinity}}])
  assert.throws(()=>produceSourceFractures(bad as any));
});
