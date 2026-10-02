import MechanismWorker from './model/ei-mechanism-worker.ts?worker&inline'
import {createEIMechanismTransport,type EIMechanismWorker} from './model/ei-mechanism-transport'
import {restoreEIMechanismResult,type EIMechanismFrame} from './model/ei-mechanism'
import {readBoundedPublicText} from './model/ei-public-sync-return'
/** HOMEBASE keeps its existing CSP: bounded data goes to the fixed local
 * native worker bridge. Other carriers use packaged workers or serial C. */
export function createEIBrowserMechanism(){
 if(typeof window!=='undefined'&&window.location.origin==='https://appassets.androidplatform.net')return createEIMechanismTransport(null)
 if(typeof window==='undefined'||window.location.origin!=='https://homebase.local')return createEIMechanismTransport(typeof Worker==='undefined'?null:()=>new MechanismWorker() as unknown as EIMechanismWorker)
 let closed=false;const active=new Set<AbortController>()
 return Object.freeze({close:()=>{closed=true;for(const c of active)c.abort();active.clear()},async run(frame:EIMechanismFrame){
  if(closed)throw Error('Mechanism environment closed');const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000),requestId=`frame/${frame.digest}`;active.add(controller)
  try{const response=await fetch('https://homebase.local/EverthingFromNothing/__native/mechanism.json',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestId,frame}),signal:controller.signal,credentials:'omit',cache:'no-store',redirect:'error',referrerPolicy:'no-referrer'}),raw=await readBoundedPublicText(new Response(response.body),2200000),value=JSON.parse(raw);if(closed)throw Error('Mechanism environment closed');if(!response.ok||value.error)throw Error(`Native mechanism ${typeof value.error==='string'?value.error:'unreturned'}`);if(value.schema!=='field.homebase.mechanism.v1'||value.requestId!==requestId||value.applied!==false||Object.keys(value).sort().join(',')!=='applied,requestId,result,schema')throw Error('Native mechanism correlation changed');return restoreEIMechanismResult(frame,value.result)}finally{clearTimeout(timer);active.delete(controller)}
 }})
}
