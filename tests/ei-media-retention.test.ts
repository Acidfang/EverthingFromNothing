import test from 'node:test'
import assert from 'node:assert/strict'
import {createEILedger,executeEI,chooseEI,verifyEI,commitEI,proposeEI,type EILedger} from '../src/model/ei-engine.ts'
import {proposeEIMediaRetention,sameEIMediaDescriptor} from '../src/model/ei-media-retention.ts'
const source={id:'media-fixture',kind:'motion' as const,mime:'application/json',sha256:'a'.repeat(64),bytes:25,address:'root',revision:0,retainedOriginal:true,nativeAvailable:true,contentUrl:`__native/media-content?sourceId=media-fixture&sourceSha256=${'a'.repeat(64)}`,metadata:{sensors:[],durationMs:2000}}
const base=()=>createEILedger({records:[{address:'root',value:'Original input',source:{id:'original',text:'Original input'}}]})
test('native descriptor uses same staged/readback/commit path and preserves exact original and root',()=>{const ledger=base(),proposal=proposeEIMediaRetention(ledger,source,'retain-1')!;const stage=executeEI(ledger,proposal,chooseEI(proposal,proposal.candidates[0].candidate.id));assert.equal(stage.status,'staged');if(stage.status!=='staged')throw Error();assert.equal(ledger.records.length,1);const returned=commitEI(ledger,verifyEI(stage,{kind:'rendered-address-values',values:stage.expected.map(value=>({...value}))}));assert.equal(returned.status,'committed');assert.deepEqual(returned.ledger.records[0].is,ledger.records[0].is);assert.deepEqual(returned.ledger.records[0].was,ledger.records[0].was);const observed=returned.ledger.records.find(record=>record.address==='native/media/media-fixture')!;assert.equal(observed.is.value,JSON.stringify(source));assert.deepEqual(observed.parents,['root']);assert.equal(proposeEIMediaRetention(returned.ledger,source,'retain-2'),null)})
test('missing/mismatched readback never admits returned metadata as current state',()=>{const ledger=base(),proposal=proposeEIMediaRetention(ledger,source,'retain-fail')!;const stage=executeEI(ledger,proposal,chooseEI(proposal,proposal.candidates[0].candidate.id));if(stage.status!=='staged')throw Error();const returned=commitEI(ledger,verifyEI(stage,{kind:'rendered-address-values',values:[]}));assert.notEqual(returned.status,'committed');assert.equal(returned.ledger.records.length,1)})
test('stale field revision, unavailable source and conflicting source identity reject',()=>{assert.throws(()=>proposeEIMediaRetention(base(),{...source,revision:1},'stale'));assert.throws(()=>proposeEIMediaRetention(base(),{...source,nativeAvailable:false},'missing'));const ledger=createEILedger({records:[...base().records.map(r=>({address:r.address,value:r.is.value,source:r.is.source})),{address:'native/media/media-fixture',value:'different',source:{id:source.id,text:'different'},parents:['root']}]});assert.throws(()=>proposeEIMediaRetention(ledger,source,'conflict'))})

const commitProposal=(ledger:EILedger,proposal:ReturnType<typeof proposeEI>)=>{
 const staged=executeEI(ledger,proposal,chooseEI(proposal,proposal.candidates[0].candidate.id))
 assert.equal(staged.status,'staged');if(staged.status!=='staged')throw Error('Expected staged transition')
 const returned=commitEI(ledger,verifyEI(staged,{kind:'rendered-address-values',values:staged.expected.map(value=>({...value}))}))
 assert.equal(returned.status,'committed');return returned.ledger
}
const retain=()=>{const ledger=base();return commitProposal(ledger,proposeEIMediaRetention(ledger,source,'retain-original')!)}
test('descriptor key reordering is an idempotent retry without changing the originally retained text',()=>{
 const ledger=retain(),before=JSON.stringify(ledger),value=ledger.records.find(record=>record.address==='native/media/media-fixture')!.is.value
 const reordered={...Object.fromEntries(Object.entries(source).reverse()),metadata:Object.fromEntries(Object.entries(source.metadata).reverse())} as typeof source
 assert.notEqual(JSON.stringify(reordered),JSON.stringify(source));assert.equal(sameEIMediaDescriptor(source,reordered),true)
 assert.equal(proposeEIMediaRetention(ledger,reordered,'retain-reordered'),null)
 assert.equal(JSON.stringify(ledger),before);assert.equal(value,JSON.stringify(source))
 assert.equal(sameEIMediaDescriptor(source,{...source,sha256:'b'.repeat(64)}),false)
 assert.equal(sameEIMediaDescriptor(source,{...source,metadata:{...source.metadata,durationMs:1999}}),false)
 assert.equal(sameEIMediaDescriptor({samples:[1,2]},{samples:[2,1]}),false)
 assert.equal(sameEIMediaDescriptor({samples:[NaN]},{samples:[NaN]}),false)
 assert.equal(sameEIMediaDescriptor({extra:undefined},{}),false)
})
test('retrying original retention after its producer advances remains a no-op; a new stale source still rejects',()=>{
 const ledger=retain(),input={id:'producer-change',text:'Changed root'}
 const proposal=proposeEI(ledger,{id:'change-producer',producer:'root',input,candidates:[{id:'change',label:'Change producer',owner:'user',source:input,conditions:[],patches:[{kind:'update',address:'root',value:input.text,source:input}]}]})
 const updated=commitProposal(ledger,proposal),before=JSON.stringify(updated)
 assert.notEqual(updated.records.find(record=>record.address==='root')!.is.revision,source.revision)
 assert.equal(proposeEIMediaRetention(updated,source,'retry-original'),null)
 assert.equal(JSON.stringify(updated),before)
 assert.throws(()=>proposeEIMediaRetention(updated,{...source,id:'new-media-source'},'new-stale-source'),/different retained field revision/)
})
test('retrying an original descriptor preserves a later explicitly changed media field value',()=>{
 const ledger=retain(),address='native/media/media-fixture',input={id:'media-note',text:'Explicit later interpretation'}
 const proposal=proposeEI(ledger,{id:'change-media-field',producer:'root',input,candidates:[{id:'change',label:'Change media field',owner:'user',source:input,conditions:[],patches:[{kind:'update',address,value:input.text,source:input}]}]})
 const updated=commitProposal(ledger,proposal),before=JSON.stringify(updated)
 assert.equal(proposeEIMediaRetention(updated,source,'retry-original'),null)
 assert.equal(JSON.stringify(updated),before)
 const record=updated.records.find(record=>record.address===address)!
 assert.equal(record.was[0].value,JSON.stringify(source));assert.equal(record.is.value,input.text)
 assert.throws(()=>proposeEIMediaRetention(updated,{...source,sha256:'b'.repeat(64)},'conflict'),/conflicts/)
})
