import type {PhoneScope} from './ei-phone-return.ts'
export const EI_OVERLAY_OPERATIONS=['status','request-permission','show-passive','interact','hide'] as const
export type EIOverlayOperation=typeof EI_OVERLAY_OPERATIONS[number]
export async function requestEIPhoneOverlay(scope:PhoneScope,origin:string,requestId:string,op:EIOverlayOperation,request:typeof fetch=fetch){
 if(origin!=='https://appassets.androidplatform.net'||!EI_OVERLAY_OPERATIONS.includes(op)||!scope.address||scope.address.length>256||!Number.isSafeInteger(scope.revision)||scope.revision<0||!/^[A-Za-z0-9._:-]{1,128}$/.test(requestId))throw new Error('Invalid addressed overlay request')
 const captured=Object.freeze({...scope}),query=new URLSearchParams({requestId,op,address:scope.address,revision:String(scope.revision)})
 const response=await request(`${origin}/EverthingFromNothing/__native/overlay.json?${query}`,{credentials:'omit',cache:'no-store',redirect:'error'})
 if(!response.ok)throw new Error(`Overlay return ${response.status}`)
 const body=await response.json()
 if(body?.schema!=='field.android.overlay.v1'||body.requestId!==requestId||typeof body.permissionGranted!=='boolean'||typeof body.windowAttached!=='boolean'||!['off','passive','interactive'].includes(body.mode))throw new Error('Invalid overlay return')
 if(body.lastAction!=null){const action=body.lastAction;if(typeof action.requestId!=='string'||!EI_OVERLAY_OPERATIONS.includes(action.op)||typeof action.address!=='string'||!Number.isSafeInteger(action.revision)||!['queued','applied','blocked','failed'].includes(action.state))throw new Error('Invalid overlay action receipt');if(op!=='status'&&(action.requestId!==requestId||action.op!==op||action.address!==captured.address||action.revision!==captured.revision))throw new Error('Overlay action correlation mismatch')}
 else if(op!=='status')throw new Error('Missing overlay action receipt')
 return Object.freeze({scope:captured,requestId,op,value:body})
}
