'use strict';
const {parentPort,threadId}=require('node:worker_threads');
const {restoreEIMechanismFrame,executeEIMechanismJob}=require('./kernel.cjs');
parentPort.on('message',async({id,frame,job})=>{try{if(typeof id!=='string'||id.length>128)throw Error('correlation');const pinned=await restoreEIMechanismFrame(frame);parentPort.postMessage({id,returned:await executeEIMechanismJob(pinned,job)})}catch(e){parentPort.postMessage({id,error:String(e.message).slice(0,4096)})}});
parentPort.postMessage({ready:true,environment:'node-worker-thread',threadId,externalEffects:false});
