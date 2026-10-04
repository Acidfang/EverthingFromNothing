import {runEIMechanism,validateEIMechanismReturn,type EIMechanismFrame,type EIMechanismJob,type EIMechanismReturn} from './ei-mechanism.ts'
/** Two packaged local workers, or an explicit serial backend when this carrier
 * cannot create workers. There are no network/model calls or generated rules. */
export interface EIMechanismWorker{postMessage:(value:unknown)=>void;terminate:()=>unknown;onmessage:((event:{data:any})=>void)|null;onerror:((event?:unknown)=>void)|null}
export function createEIMechanismTransport(factory:(()=>EIMechanismWorker)|null){
 let closed=false,sequence=0,ready:Promise<EIMechanismWorker[]|null>|null=null
 const workers:EIMechanismWorker[]=[],idle:EIMechanismWorker[]=[],waiting:{resolve:(w:EIMechanismWorker)=>void;reject:(e:unknown)=>void}[]=[],pending=new Map<string,{resolve:(r:EIMechanismReturn)=>void;reject:(e:unknown)=>void;timer:ReturnType<typeof setTimeout>}>()
 const startups=new Set<()=>void>()
 const close=()=>{closed=true;for(const reject of startups)reject();startups.clear();for(const w of workers)w.terminate();for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('Mechanism environment closed'))}pending.clear();for(const waiter of waiting)waiter.reject(Error('Mechanism environment closed'));waiting.length=0;idle.length=0}
 const initialize=()=>ready??=(async()=>{
  if(!factory)return null
  try{for(let i=0;i<2;i++){if(closed)throw Error('Mechanism environment closed');const worker=factory();workers.push(worker);await new Promise<void>((resolve,reject)=>{const finish=(error?:Error)=>{clearTimeout(timer);startups.delete(cancel);error?reject(error):resolve()},cancel=()=>finish(Error('Mechanism environment closed')),timer=setTimeout(()=>finish(Error('Worker startup unavailable')),3000);startups.add(cancel);worker.onmessage=e=>{if(e.data?.ready===true&&['dedicated-worker','node-worker-thread'].includes(e.data.environment)&&e.data.externalEffects===false)finish()};worker.onerror=()=>finish(Error('Worker startup failed'))});worker.onmessage=e=>{const item=pending.get(e.data?.id);if(!item)return;pending.delete(e.data.id);clearTimeout(item.timer);e.data.error?item.reject(Error(String(e.data.error))):item.resolve(e.data.returned)};worker.onerror=()=>close();idle.push(worker)}return workers}catch{for(const w of workers)w.terminate();workers.length=0;return null}
 })()
 return Object.freeze({close,inspect:()=>Object.freeze({closed,workers:workers.length,pending:pending.size}),async run(frame:EIMechanismFrame){if(closed)throw Error('Mechanism environment closed');const pool=await initialize();if(closed)throw Error('Mechanism environment closed');if(!pool)return runEIMechanism(frame)
  const acquire=()=>closed?Promise.reject(Error('Mechanism environment closed')):idle.length?Promise.resolve(idle.shift()!):new Promise<EIMechanismWorker>((resolve,reject)=>waiting.push({resolve,reject}));const release=(worker:EIMechanismWorker)=>{if(closed)return;const next=waiting.shift();if(next)next.resolve(worker);else idle.push(worker)}
  return runEIMechanism(frame,{parallelism:2,mode:'workers',runner:async(f,job)=>{const worker=await acquire(),id=`job/${++sequence}`;try{const returned=await new Promise<EIMechanismReturn>((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(id);reject(Error('Mechanism job exceeded its return deadline'));close()},5000);pending.set(id,{resolve,reject,timer});worker.postMessage({id,frame:f,job})});validateEIMechanismReturn(f,job,returned);return returned}finally{release(worker)}}})
 }})
}
