import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {createEILedger,proposeEI,chooseEI,executeEI,verifyEI,commitEI,type EISeedRecord,type EILedger,type EIProposal} from '../src/model/ei-engine.ts'
import {createEIPublicFieldRecords} from '../src/model/ei-public-field.ts'
import {readEIPublicManifest,verifyEIPublicSnapshot,compareEIPublicSnapshot,proposeEIPublicSync,advanceEIPublicSyncBaseline,eiPublicSnapshotURL,EI_PUBLIC_SYNC} from '../src/model/ei-public-sync.ts'
const revision='a'.repeat(40)
function record(id:string,index:number,parents:string[]=[]):EISeedRecord{return {address:`model/${id}`,value:`Public ${id}`,source:{id:`public-inventory:${revision}#/binary_relation_order/nodes/${index}`,text:JSON.stringify({source_revision:revision,node:{id}}),realm:'public-repository-inventory',locator:JSON.stringify({path:'docs/FRACTURE-FIELD-INVENTORY.json',source_revision:revision,pointer:`/binary_relation_order/nodes/${index}`,address_scope:'selected-inventory-presentation'})},parents,relations:[]}}
const baseline=[record('inventory-root',0),record('child',1,['model/inventory-root'])]
function envelope(records:unknown,extra:Record<string,unknown>={}){const text=JSON.stringify({schema:EI_PUBLIC_SYNC.snapshotSchema,records}),manifest={schema:EI_PUBLIC_SYNC.manifestSchema,release:'0.1.8',payloadSha256:createHash('sha256').update(text).digest('hex'),payloadBytes:Buffer.byteLength(text),recordCount:Array.isArray(records)?records.length:1,sourceRepository:EI_PUBLIC_SYNC.repository,compatibility:EI_PUBLIC_SYNC.compatibility,...extra};return {text,manifest:readEIPublicManifest(JSON.stringify(manifest))}}
async function snapshot(records:readonly EISeedRecord[]){const e=envelope(records);return verifyEIPublicSnapshot(e.manifest,e.text)}
function commit(ledger:EILedger,proposal:EIProposal){const execution=executeEI(ledger,proposal,chooseEI(proposal,proposal.candidates[0].candidate.id));assert.equal(execution.status,'staged');if(execution.status!=='staged')throw Error('not staged');const result=commitEI(ledger,verifyEI(execution,{kind:'rendered-address-values',values:execution.expected}));assert.equal(result.status,'committed');return result.ledger}

test('actual public fixture has exact hash, bytes, provenance and bounded derived URL',async()=>{
 const raw=await readFile(new URL('../public/shared-field/v1/latest.json',import.meta.url),'utf8'),m=readEIPublicManifest(raw),bytes=await readFile(new URL(`../public/shared-field/v1/snapshots/${m.payloadSha256}.json`,import.meta.url));const s=await verifyEIPublicSnapshot(m,bytes)
 assert.deepEqual(s.records,createEIPublicFieldRecords());assert.equal(bytes.length,m.payloadBytes);assert.equal(s.records.length,m.recordCount);assert.equal(eiPublicSnapshotURL(m),`https://acidfang.github.io/EverthingFromNothing/shared-field/v1/snapshots/${m.payloadSha256}.json`);assert.ok(Object.isFrozen(s.records[0].source));
})
test('manifest rejects unsupported keys, destinations, unsafe counts and releases',()=>{
 const m=envelope(baseline).manifest
 for(const edit of [{url:'https://evil.example'},{sourceRepository:'other/repo'},{compatibility:'arbitrary-js'},{schema:'v2'},{release:'bad\nrelease'},{release:'a'.repeat(81)},{payloadSha256:'../x'},{payloadBytes:1048577},{payloadBytes:0},{recordCount:257},{recordCount:0}])assert.throws(()=>readEIPublicManifest(JSON.stringify({...m,...edit})))
 assert.throws(()=>readEIPublicManifest(' '.repeat(16385)));assert.throws(()=>readEIPublicManifest('{'));assert.throws(()=>readEIPublicManifest('null'))
})
test('snapshot hash and byte count bind the exact raw representation',async()=>{
 const e=envelope(baseline);await assert.rejects(verifyEIPublicSnapshot(e.manifest,e.text+' '),/byte count/);await assert.rejects(verifyEIPublicSnapshot({...e.manifest,payloadSha256:'0'.repeat(64)},e.text),/hash/)
 await assert.rejects(verifyEIPublicSnapshot({...e.manifest,recordCount:1},e.text),/record count/)
 const bytes=Uint8Array.from([0xff]),m={...e.manifest,payloadBytes:1,payloadSha256:createHash('sha256').update(bytes).digest('hex')};await assert.rejects(verifyEIPublicSnapshot(m,bytes),/UTF-8/)
})
test('payload rejects executable extras, foreign provenance and malformed public graphs',async()=>{
 const bad=[null,[...baseline,baseline[1]],[{...baseline[0],address:'PRIVATE/root'}],[{...baseline[0],source:{...baseline[0].source,realm:'user-supplied-local-input'}}],[baseline[0],{...baseline[1],parents:['model/missing']}],[baseline[0],{...baseline[1],relations:[{relation:'to',address:'model/missing'}]}],[{...baseline[0],source:{...baseline[0].source,locator:'{}'}}],[{...baseline[0],source:{...baseline[0].source,text:'{}'}}],[{...baseline[0],unknown:true}]]
 for(const records of bad){const e=envelope(records);await assert.rejects(verifyEIPublicSnapshot(e.manifest,e.text))}
 const e=envelope(baseline),text=JSON.stringify({schema:EI_PUBLIC_SYNC.snapshotSchema,records:baseline,code:'alert(1)'}),m={...e.manifest,payloadBytes:Buffer.byteLength(text),payloadSha256:createHash('sha256').update(text).digest('hex')};await assert.rejects(verifyEIPublicSnapshot(m,text),/fields/)
})
test('unverified forged snapshots cannot compare or propose',()=>{
 const ledger=createEILedger({records:baseline}),fake={manifest:envelope(baseline).manifest,records:baseline};assert.throws(()=>compareEIPublicSnapshot(ledger,baseline,fake),/not passed/)
})
test('safe public update requires explicit selection and retains WAS and private records',async()=>{
 const privateRecord:EISeedRecord={address:'PRIVATE/root',value:'Local draft',source:{id:'local',text:'Local draft',realm:'user-supplied-local-input'}}
 const ledger=createEILedger({records:[...baseline,privateRecord]}),incoming=await snapshot([baseline[0],{...baseline[1],value:'Public child updated'}]),rows=compareEIPublicSnapshot(ledger,baseline,incoming)
 assert.equal(rows[1].status,'update');const proposal=proposeEIPublicSync({ledger,baselineRecords:baseline,snapshot:incoming,addresses:['model/child'],producer:'PRIVATE/root',id:'sync/one'});assert.equal(proposal.status,'selection-required');assert.equal(executeEI(ledger,proposal).status,'blocked')
 const next=commit(ledger,proposal),changed=next.records.find(r=>r.address==='model/child')!;assert.equal(changed.was[0].value,baseline[1].value);assert.equal(changed.is.value,'Public child updated');assert.equal(next.records.find(r=>r.address==='PRIVATE/root')!.is.value,'Local draft');assert.equal(compareEIPublicSnapshot(next,incoming.records,incoming).every(r=>r.status==='unchanged'),true)
})
test('local edits, missing baseline and structural changes are conflicts, removals never delete',async()=>{
 const edited=createEILedger({records:[baseline[0],{...baseline[1],value:'My local edit'}]}),incoming=await snapshot([baseline[0],{...baseline[1],value:'Remote change'}]);assert.equal(compareEIPublicSnapshot(edited,baseline,incoming)[1].status,'conflict');assert.throws(()=>proposeEIPublicSync({ledger:edited,baselineRecords:baseline,snapshot:incoming,addresses:['model/child'],producer:'model/inventory-root',id:'sync/conflict'}),/not safe/)
 const ledger=createEILedger({records:baseline}),structural=await snapshot([baseline[0],{...baseline[1],relations:[{relation:'new',address:'model/inventory-root'}]}]);assert.equal(compareEIPublicSnapshot(ledger,baseline,structural)[1].status,'conflict');const removed=await snapshot([baseline[0]]);assert.equal(compareEIPublicSnapshot(ledger,baseline,removed).find(r=>r.address==='model/child')!.status,'removed')
 const incompleteBaseline=[baseline[0]];assert.equal(compareEIPublicSnapshot(ledger,incompleteBaseline,incoming)[1].status,'conflict')
})
test('new public children need explicit dependency selection; root additions need migration',async()=>{
 const ledger=createEILedger({records:baseline}),a=record('new-a',2,['model/inventory-root']),b=record('new-b',3,['model/new-a']),root=record('new-root',4),incoming=await snapshot([...baseline,a,b,root]);const rows=compareEIPublicSnapshot(ledger,baseline,incoming);assert.equal(rows.find(r=>r.address===a.address)!.status,'add');assert.equal(rows.find(r=>r.address===root.address)!.status,'conflict')
 assert.throws(()=>proposeEIPublicSync({ledger,baselineRecords:baseline,snapshot:incoming,addresses:[b.address],producer:'model/inventory-root',id:'sync/dependency'}),/dependency/)
 const next=commit(ledger,proposeEIPublicSync({ledger,baselineRecords:baseline,snapshot:incoming,addresses:[a.address,b.address],producer:'model/inventory-root',id:'sync/add'}));assert.equal(next.records.length,4);assert.deepEqual(next.records.find(r=>r.address===b.address)!.parents,[a.address])
})
test('stale public proposals fail after a competing local operation',async()=>{
 const ledger=createEILedger({records:baseline}),incoming=await snapshot([baseline[0],{...baseline[1],value:'Remote update'}]),sync=proposeEIPublicSync({ledger,baselineRecords:baseline,snapshot:incoming,addresses:['model/child'],producer:'model/inventory-root',id:'sync/stale'}),source={id:'local',text:'local change'}
 const edit=proposeEI(ledger,{id:'local/edit',producer:'model/inventory-root',input:source,candidates:[{id:'edit',label:'Local edit',owner:'user',source,conditions:[],patches:[{address:'model/child',value:'Local update',source}]}]}),next=commit(ledger,edit)
 assert.equal(executeEI(next,sync,chooseEI(sync,'apply-reviewed-public-state')).status,'blocked');assert.equal(next.records.find(r=>r.address==='model/child')!.is.value,'Local update')
})
test('empty, duplicate, unchanged and oversized selections never silently apply',async()=>{
 const ledger=createEILedger({records:baseline}),incoming=await snapshot([baseline[0],{...baseline[1],value:'Update'}]);for(const addresses of [[],['model/child','model/child'],['model/inventory-root'],['PRIVATE/root']])assert.throws(()=>proposeEIPublicSync({ledger,baselineRecords:baseline,snapshot:incoming,addresses,producer:'model/inventory-root',id:'sync/bad'}))
 const before=[baseline[0],...Array.from({length:5},(_,i)=>record(`large-${i}`,i+1,['model/inventory-root']))],large=createEILedger({records:before}),after=await snapshot(before.map((r,i)=>i?{...r,value:'x'.repeat(32768)}:r));assert.throws(()=>proposeEIPublicSync({ledger:large,baselineRecords:before,snapshot:after,addresses:before.slice(1).map(r=>r.address),producer:'model/inventory-root',id:'sync/large'}),/bytes/)
})
test('partial commit advances only selected baseline records after matching rendered receipt',async()=>{
 const ledger=createEILedger({records:baseline}),incoming=await snapshot(baseline.map(r=>({...r,value:r.value+' newer'}))),proposal=proposeEIPublicSync({ledger,baselineRecords:baseline,snapshot:incoming,addresses:['model/child'],producer:'model/inventory-root',id:'sync/partial'}),next=commit(ledger,proposal),receiptId=next.receipts.at(-1)!.id
 const advanced=advanceEIPublicSyncBaseline({ledger:next,baselineRecords:baseline,snapshot:incoming,receiptId});assert.equal(advanced[0].value,baseline[0].value);assert.equal(advanced[1].value,incoming.records[1].value);assert.equal(compareEIPublicSnapshot(next,advanced,incoming)[0].status,'update');assert.equal(compareEIPublicSnapshot(next,advanced,incoming)[1].status,'unchanged')
 assert.throws(()=>advanceEIPublicSyncBaseline({ledger,baselineRecords:baseline,snapshot:incoming,receiptId}),/receipt/)
 const other=await snapshot(baseline);assert.throws(()=>advanceEIPublicSyncBaseline({ledger:next,baselineRecords:baseline,snapshot:other,receiptId}),/receipt/)
})
