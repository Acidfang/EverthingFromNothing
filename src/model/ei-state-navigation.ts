/** Local view history. Addresses and retained revisions are data, never URL state. */
export type EIStateLocation=Readonly<{address:string;revision:number}>
export type EIStateHistory=Readonly<{items:readonly EIStateLocation[];index:number}>
export const emptyEIStateHistory=():EIStateHistory=>({items:[],index:-1})
export function visitEIState(history:EIStateHistory,location:EIStateLocation):EIStateHistory{
 if(!location.address||!Number.isSafeInteger(location.revision)||location.revision<0)throw new Error('A retained address and revision are required')
 const current=history.items[history.index]
 if(current?.address===location.address&&current.revision===location.revision)return history
 const items=[...history.items.slice(0,history.index+1),{address:location.address,revision:location.revision}]
 return {items,index:items.length-1}
}
export function moveEIState(history:EIStateHistory,offset:-1|1):EIStateHistory{
 const index=history.index+offset
 return index<0||index>=history.items.length?history:{items:history.items,index}
}
