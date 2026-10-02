import {parentPort,threadId,isMainThread} from 'node:worker_threads'
if(isMainThread)throw Error('Expected a real worker thread')
globalThis.postMessage=value=>parentPort.postMessage(value?.ready?{...value,environment:'node-worker-thread',threadId}:value)
parentPort.on('message',data=>globalThis.onmessage({data}))
await import('../../src/model/ei-mechanism-worker.ts')
