import {checkCapabilitySnapshot} from './ei-capability-snapshot.ts'
export type PhoneScope=Readonly<{address:string;revision:number}>
export async function readEIPhoneReturn(scope:PhoneScope,origin:string,requestId:string,request:typeof fetch=fetch){
 if(origin!=='https://appassets.androidplatform.net')throw new Error('Phone bridge unavailable on this origin')
 if(!scope.address||!Number.isSafeInteger(scope.revision)||scope.revision<0||!/^[A-Za-z0-9._:-]{1,128}$/.test(requestId))throw new Error('Invalid addressed phone request')
 const retained=Object.freeze({...scope})
 const response=await request(`${origin}/EverthingFromNothing/__native/capabilities.json?requestId=${encodeURIComponent(requestId)}`,{method:'GET',credentials:'omit',cache:'no-store',redirect:'error'})
 if(!response.ok)throw new Error(`Phone metadata return ${response.status}`)
 const value:unknown=await response.json(),check=checkCapabilitySnapshot(value,requestId)
 if(check.status==='invalid')throw new Error(`Invalid phone return: ${check.errors.join(', ')}`)
 return Object.freeze({scope:retained,requestId,check,value})
}
export const phoneReturnMatches=(scope:PhoneScope,current:PhoneScope)=>scope.address===current.address&&scope.revision===current.revision
