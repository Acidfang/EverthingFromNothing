import test from 'node:test'
import assert from 'node:assert/strict'
import {advanceEI,createEILedger,proposeEI} from '../src/model/ei-engine.ts'
import {createEIOverlayServices} from '../src/model/ei-overlay-services.ts'
const source=(text:string)=>({id:text,text})
const seed=()=>createEILedger({records:[{address:'root',value:'0',source:source('0')}]})
const next=(ledger:ReturnType<typeof seed>,id:string,value:string)=>advanceEI(ledger,proposeEI(ledger,{id,producer:'root',input:source(id),candidates:[{id:'one',label:'supplied',owner:'engine',source:source(id),conditions:[],patches:[{address:'root',value,source:source(value)}]}]}))
test('committed result reaches two overlay services with separate local acknowledgments',async()=>{
 const before=seed(),runtime=await createEIOverlayServices(before,'root','field'),seen:string[]=[]
 const a=runtime.subscribe('scene','root',ledger=>{seen.push(`scene:${ledger.revision}`);return true}),b=runtime.subscribe('workspace','root',ledger=>{seen.push(`workspace:${ledger.revision}`);return true})
 const result=next(before,'one','1');await runtime.enqueue(before,result)
 assert.deepEqual(seen,['scene:1','workspace:1']);assert.equal(a.read(),result.ledger);assert.equal(b.read(),result.ledger)
 await runtime.enqueue(before,result);assert.equal(seen.length,2);assert.equal(runtime.inspect().outbox.length,1)
})
test('closed overlay retains pending notification and reconnect admits in order',async()=>{
 const before=seed(),runtime=await createEIOverlayServices(before,'root','field'),seen:number[]=[]
 const overlay=runtime.subscribe('scene','root',ledger=>{seen.push(ledger.revision);return true});overlay.disconnect()
 const one=next(before,'one','1'),two=next(one.ledger,'two','2');await runtime.enqueue(before,one);await runtime.enqueue(one.ledger,two)
 assert.deepEqual(seen,[]);overlay.reconnect();assert.deepEqual(seen,[1,2]);assert.equal(overlay.read(),two.ledger)
})
test('publication conflict is retained without undoing either actual committed ledger',async()=>{
 const before=seed(),runtime=await createEIOverlayServices(before,'root','field'),one=next(before,'one','1'),fork=next(before,'fork','other')
 await runtime.enqueue(before,one);const result=await runtime.enqueue(before,fork)
 assert.equal(result.outbox[1].status,'failed');assert.equal(result.field.ledger,one.ledger)
 assert.equal(fork.ledger.records[0].is.value,'other');await runtime.retry();assert.equal(runtime.inspect().outbox[1].attempts,2)
})
test('a consumer declining one state is not offered later states as if the gap were admitted',async()=>{
 const before=seed(),runtime=await createEIOverlayServices(before,'root','field'),seen:number[]=[];let accept=false
 const overlay=runtime.subscribe('scene','root',ledger=>{seen.push(ledger.revision);return accept})
 const one=next(before,'one','1'),two=next(one.ledger,'two','2');await runtime.enqueue(before,one);await runtime.enqueue(one.ledger,two)
 assert.deepEqual(seen,[1]);assert.equal(overlay.read(),before)
 accept=true;overlay.disconnect();overlay.reconnect();assert.deepEqual(seen,[1,1,2]);assert.equal(overlay.read(),two.ledger)
})
