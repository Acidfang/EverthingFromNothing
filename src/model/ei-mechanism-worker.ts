import {restoreEIMechanismFrame,executeEIMechanismJob} from './ei-mechanism.ts'
const port=globalThis as unknown as {postMessage:(value:unknown)=>void;onmessage:((event:MessageEvent)=>void)|null}
port.onmessage=async event=>{const {id,frame,job}=event.data??{};try{if(typeof id!=='string'||id.length>128)throw Error('Invalid job correlation');const pinned=await restoreEIMechanismFrame(frame),returned=await executeEIMechanismJob(pinned,job);port.postMessage({id,returned})}catch(reason){port.postMessage({id,error:reason instanceof Error?reason.message:String(reason)})}}
port.postMessage({ready:true,environment:'dedicated-worker',externalEffects:false})
