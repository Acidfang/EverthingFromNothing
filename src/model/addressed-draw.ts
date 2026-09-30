/** User source tokens retained verbatim; finite device-pixel transport, not canonical geometry. */
export const ADDRESSED_DRAW_SOURCE = Object.freeze({first:".finity1",next:".infinity2",rule:"Assign one pixel, then the next; finish framing and the addressed draw before model TIME advances."})
export type DrawReceipt=Readonly<{width:number;height:number;assigned:number;complete:boolean;cancelled:boolean}>
export function createAddressedDraw(width:number,height:number){
 if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<1||height<1||!Number.isSafeInteger(width*height))throw new Error("Invalid finite draw dimensions")
 let cursor=0,cancelled=false
 const total=width*height
 return {
  assign(limit:number,write:(index:number,x:number,y:number)=>void){
   if(!Number.isSafeInteger(limit)||limit<1)throw new Error("Invalid pixel batch")
   const stop=Math.min(total,cursor+limit)
   while(!cancelled&&cursor<stop){const index=cursor;write(index,index%width,Math.floor(index/width));cursor++}
   return this.receipt()
  },
  cancel(){cancelled=true},
  receipt():DrawReceipt{return Object.freeze({width,height,assigned:cursor,complete:!cancelled&&cursor===total,cancelled})},
 }
}
export function mayAdvanceAfterDraw(receipt:DrawReceipt,presented:boolean):boolean{
 return presented&&!receipt.cancelled&&receipt.complete&&receipt.assigned===receipt.width*receipt.height
}
