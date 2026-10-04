import {EI_LIMITS,type EILedger,type EIResult} from './ei-engine.ts'
import {createEISharedField,readEISharedEventState,type EISharedAcknowledgment,type EISharedEvent,type EISharedEndpoint} from './ei-shared-field.ts'
export type EIOverlayDelivery=Readonly<{receiptId:string;status:'pending'|'delivered'|'failed';attempts:number;eventId:string|null;error:string|null}>
/** Local outbox for already committed results. Delivery failure never rolls
 * back the caller's actual ledger; retries preserve the same result/receipt.
 * No persistence or remote authentication is implied by this runtime. */
export async function createEIOverlayServices(initial:EILedger,userRoot:string,fieldId:string){
 const field=await createEISharedField({identity:{userRoot,fieldId},ledger:initial})
 const writers=new Map<string,EISharedEndpoint>(),items:{previous:EILedger;result:EIResult;delivery:EIOverlayDelivery}[]=[]
 let draining:Promise<void>|null=null
 const inspect=()=>Object.freeze({field:field.inspect(),outbox:Object.freeze(items.map(item=>item.delivery))})
 const drain=():Promise<void>=>{
  if(draining)return draining
  draining=(async()=>{for(const item of items){
   if(item.delivery.status==='delivered')continue
   item.delivery=Object.freeze({...item.delivery,status:'pending',attempts:item.delivery.attempts+1,error:null})
   try{
    const producer=item.result.receipt.producer
    let writer=writers.get(producer)
    if(!writer){writer=field.connect({id:`execution/${writers.size}`,serviceId:'field-execution',sourceAddress:producer,destinationAddress:userRoot});writers.set(producer,writer)}
    const returned=await field.publish(writer,item.previous,item.result)
    if(!returned.event)throw new Error('Committed result produced no delivery event')
    item.delivery=Object.freeze({...item.delivery,status:'delivered',eventId:returned.event.eventId,error:null})
   }catch(reason){item.delivery=Object.freeze({...item.delivery,status:'failed',error:reason instanceof Error?reason.message:String(reason)});break}
  }})().finally(()=>{draining=null})
  return draining
 }
 return Object.freeze({inspect,retry:drain,
  async enqueue(previous:EILedger,result:EIResult){
   if(result.status!=='committed')throw new Error('Only an actual committed result can enter the overlay outbox')
   const known=items.find(item=>item.result.receipt.id===result.receipt.id)
   if(known){if(known.result!==result&&known.result.ledger!==result.ledger)throw new Error('Receipt identity conflict');await drain();return inspect()}
   if(items.length>=EI_LIMITS.receipts)throw new Error('Overlay outbox capacity reached; committed ledger remains with its caller')
   items.push({previous,result,delivery:Object.freeze({receiptId:result.receipt.id,status:'pending',attempts:0,eventId:null,error:null})})
   await drain();return inspect()
  },
  subscribe(serviceId:string,address:string,receive:(ledger:EILedger,event:EISharedEvent,received:EISharedAcknowledgment)=>boolean){
   const endpoint=field.connect({id:`overlay/${serviceId}`,serviceId,sourceAddress:address,destinationAddress:address})
   const unsubscribe=field.subscribe(endpoint,(event,received)=>{if(field.view(endpoint).revision!==event.predecessor.revision)return;const state=readEISharedEventState(event);if(receive(state,event,received)===true)field.admit(endpoint,event.eventId)})
   return Object.freeze({read:()=>field.view(endpoint),disconnect:()=>{field.disconnect(endpoint)},reconnect:()=>field.reconnect(endpoint),close:()=>{unsubscribe();field.disconnect(endpoint)}})
  },
 })
}
