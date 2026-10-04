'use strict';
const {Worker}=require('node:worker_threads'),path=require('node:path');
const kernel=require('./kernel.cjs');
const ORIGIN='https://homebase.local',PATH='/EverthingFromNothing/__native/mechanism.json';
const LIMITS=Object.freeze({requestBytes:1060000,responseBytes:2200000,requests:128,retainedBytes:8388608,activeFrames:2,bodyReaders:4,bodyTimeoutMs:5000});
function createMechanismRoute({foreground=()=>false,makeTransport=kernel.createEIMechanismTransport}={}){
 const threads=[],readyThreadIds=new Set();let exitedThreads=0;const factory=()=>{const worker=new Worker(path.join(__dirname,'worker.cjs'),{execArgv:[],resourceLimits:{maxOldGenerationSizeMb:64,maxYoungGenerationSizeMb:16,stackSizeMb:4}}),adapter={postMessage:v=>worker.postMessage(v),terminate:()=>worker.terminate(),onmessage:null,onerror:null};threads.push(worker);worker.on('message',data=>{if(data?.ready&&data.environment==='node-worker-thread'&&Number.isSafeInteger(data.threadId))readyThreadIds.add(data.threadId);adapter.onmessage?.({data})});worker.on('error',error=>adapter.onerror?.(error));worker.on('exit',()=>{exitedThreads++;adapter.onerror?.(Error('Native worker exited'))});return adapter};
 const transport=makeTransport(factory),requests=new Map();let closed=false,retainedBytes=0,activeFrames=0,bodyReaders=0;
 const reply=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
 const route=async request=>{try{
  const u=new URL(request.url);if(u.origin!==ORIGIN||u.pathname!==PATH||u.search||u.hash||u.username||u.password||request.method!=='POST'||request.initiatorOrigin!==ORIGIN||request.headers.get('content-type')!=='application/json')return reply({error:'route-denied'},403);
  if(closed)return reply({error:'environment-closed'},409);
  if(request.signal?.aborted)return reply({error:'request-cancelled'},409);
  if(bodyReaders>=LIMITS.bodyReaders)return reply({error:'capacity'},429);
  const reader=request.body?.getReader();if(!reader)return reply({error:'body-required'},400);let size=0,parts=[],timer,abort;
  bodyReaders++;const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('body-timeout')),LIMITS.bodyTimeoutMs);timer.unref?.();abort=()=>reject(Error('request-cancelled'));request.signal?.addEventListener('abort',abort,{once:true})});
  try{for(;;){const {done,value}=await Promise.race([reader.read(),deadline]);if(done)break;size+=value.length;if(size>LIMITS.requestBytes)throw Error('body-limit');parts.push(value)}}catch(error){await reader.cancel().catch(()=>{});throw error}finally{clearTimeout(timer);request.signal?.removeEventListener('abort',abort);bodyReaders--;reader.releaseLock()}
  const data=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(parts)));if(!data||Object.keys(data).sort().join(',')!=='frame,requestId'||typeof data.requestId!=='string'||!/^[A-Za-z0-9._:/-]{1,128}$/.test(data.requestId))throw Error('invalid-request');
  const frame=await kernel.restoreEIMechanismFrame(data.frame),known=requests.get(data.requestId);if(known){if(known.digest!==frame.digest)return reply({error:'source-conflict'},409);const old=await known.promise;return reply(old.value,old.status)}
  if(closed)return reply({error:'environment-closed'},409);if(request.signal?.aborted)return reply({error:'request-cancelled'},409);
  if(!foreground())return reply({error:'foreground-required'},409);if(requests.size>=LIMITS.requests||retainedBytes+(activeFrames+1)*1024>LIMITS.retainedBytes||activeFrames>=LIMITS.activeFrames)return reply({error:'capacity'},429);
  let resolve;const promise=new Promise(r=>resolve=r);requests.set(data.requestId,{digest:frame.digest,promise});
  activeFrames++;
  try{const result=await transport.run(frame);if(closed)throw Error('environment-closed');const envelope={schema:'field.homebase.mechanism.v1',requestId:data.requestId,result,applied:false},bytes=Buffer.byteLength(JSON.stringify(envelope));if(bytes>LIMITS.responseBytes||retainedBytes+bytes+(activeFrames-1)*1024>LIMITS.retainedBytes)throw Error('return-capacity');retainedBytes+=bytes;resolve({value:envelope,status:200});return reply(envelope)}catch(error){const failure={schema:'field.homebase.mechanism.v1',requestId:data.requestId,error:closed?'environment-closed':['return-capacity','environment-closed'].includes(error.message)?error.message:'execution-failed',applied:false};retainedBytes+=Buffer.byteLength(JSON.stringify(failure));resolve({value:failure,status:409});return reply(failure,409)}finally{activeFrames--}
 }catch{return reply({error:'invalid-request'},400)}};
 route.dispose=async()=>{closed=true;transport.close();await Promise.all(threads.map(w=>w.terminate()))};route.inspect=()=>({...transport.inspect(),closed,requests:requests.size,retainedBytes,activeFrames,bodyReaders,readyThreadIds:[...readyThreadIds],exitedThreads});return route;
}
module.exports={ORIGIN,PATH,LIMITS,createMechanismRoute};
