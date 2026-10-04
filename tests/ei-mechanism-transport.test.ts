import {test} from 'node:test'
import assert from 'node:assert/strict'
import {Worker} from 'node:worker_threads'
import {createEIMechanismTransport,type EIMechanismWorker} from '../src/model/ei-mechanism-transport.ts'
import {createEIMechanismFrame,runEIMechanism} from '../src/model/ei-mechanism.ts'
const input={userRoot:'synthetic/user',sourceAddress:'root',sourceRevision:0,sourceId:'frame',records:[{address:'root',value:'root',sourceId:'s0',revision:0,links:[{address:'child',relation:'adjacent' as const,sourceId:'s0',revision:0}]},{address:'child',value:'child',sourceId:'s1',revision:0,links:[{address:'nested',relation:'adjacent' as const,sourceId:'s1',revision:0}]},{address:'nested',value:'nested',sourceId:'s2',revision:0,links:[]}]}
test('same transport and actual shared worker script run recursive C jobs on two real Node worker threads',async()=>{
 const threadIds=new Set<number>(),workers:Worker[]=[]
 const factory=()=>{const w=new Worker(new URL('./fixtures/mechanism-node-worker.mjs',import.meta.url),{execArgv:['--experimental-strip-types']}),adapter:EIMechanismWorker={postMessage:v=>w.postMessage(v),terminate:()=>w.terminate(),onmessage:null,onerror:null};workers.push(w);w.on('message',data=>{if(data.ready)threadIds.add(data.threadId);adapter.onmessage?.({data})});w.on('error',error=>adapter.onerror?.(error));return adapter}
 const transport=createEIMechanismTransport(factory)
 try{const f=await createEIMechanismFrame(input),r=await transport.run(f),serial=await runEIMechanism(f);assert.equal(threadIds.size,2);assert.equal(r.transport.mode,'workers');assert.equal(r.transport.maximumInFlight,2);assert.deepEqual(r.returns,serial.returns);assert.equal(r.complete,true);assert.equal(r.returns[2].job.depth,2);const again=await transport.run(f);assert.deepEqual(again,r);transport.close();await assert.rejects(transport.run(f),/closed/)}finally{transport.close();await Promise.all(workers.map(w=>w.terminate()))}
})
test('an unavailable carrier uses the same serial C code and labels its actual backend',async()=>{const transport=createEIMechanismTransport(null),f=await createEIMechanismFrame(input);try{const r=await transport.run(f);assert.equal(r.transport.mode,'serial');assert.equal(r.transport.maximumInFlight,1);assert.equal(r.complete,true)}finally{transport.close()}})
test('environment closure while worker jobs are pending cannot return a complete frame',async()=>{
 const factory=()=>{const adapter:EIMechanismWorker={postMessage:()=>{},terminate:()=>{},onmessage:null,onerror:null};setTimeout(()=>adapter.onmessage?.({data:{ready:true,environment:'dedicated-worker',externalEffects:false}}),0);return adapter}
 const transport=createEIMechanismTransport(factory),f=await createEIMechanismFrame(input),pending=transport.run(f);for(let i=0;i<30&&!transport.inspect().pending;i++)await new Promise(resolve=>setTimeout(resolve,1));assert.equal(transport.inspect().pending,2);transport.close();const r=await pending;assert.equal(r.complete,false);assert.equal(r.failures.length,3)
})
test('closing during worker initialization settles immediately without a delayed fallback',async()=>{const transport=createEIMechanismTransport(()=>({postMessage(){throw Error('must not send')},terminate(){},onmessage:null,onerror:null}));const frame=await createEIMechanismFrame({userRoot:'u',sourceAddress:'a',sourceRevision:0,sourceId:'s',records:[{address:'a',value:'a',sourceId:'s',revision:0,links:[]}]});const pending=transport.run(frame);transport.close();await assert.rejects(pending,/closed/);assert.equal(transport.inspect().pending,0)})
