export type EIPhoneInput=Readonly<{id:string;channel:'share'|'process-text';mime:'text/plain';text:string;utf8Sha256:string;readOnly:boolean;fieldScope?:Readonly<{address:string;revision:number;sourceId:string}>;source:Readonly<{kind:'android-explicit-intent';packageName?:string}>}>
export async function readEIPhoneInputs(origin:string,requestId:string,request:typeof fetch=fetch):Promise<Readonly<{inputs:readonly EIPhoneInput[];rejections:readonly string[]}>>{
 if(origin!=='https://appassets.androidplatform.net'||!/^[A-Za-z0-9._:-]{1,128}$/.test(requestId))throw new Error('Invalid native input route')
 const response=await request(`${origin}/EverthingFromNothing/__native/inputs.json?requestId=${requestId}`,{credentials:'omit',cache:'no-store',redirect:'error'})
 if(!response.ok)throw new Error(`Phone input return ${response.status}`)
 const body=await response.json()
 if(body?.schema!=='field.android.user-input.v1'||body.requestId!==requestId||!Array.isArray(body.inputs)||body.inputs.length>64)throw new Error('Invalid native input return')
 if(!Array.isArray(body.rejections)||body.rejections.some((item:unknown)=>!item||typeof item!=='object'||typeof (item as {code?:unknown}).code!=='string'))throw new Error('Invalid input rejection return')
 const rejections=Object.freeze(body.rejections.map((item:{code:string})=>item.code))
 const ids=new Set<string>(),inputs:EIPhoneInput[]=[]
 for(const item of body.inputs){
  if(!item||typeof item.id!=='string'||!item.id||ids.has(item.id)||!['share','process-text'].includes(item.channel)||item.mime!=='text/plain'||typeof item.text!=='string'||typeof item.readOnly!=='boolean'||item.source?.kind!=='android-explicit-intent'||(item.source.packageName!==undefined&&typeof item.source.packageName!=='string'))throw new Error('Invalid native input source')
  const bytes=new TextEncoder().encode(item.text);if(bytes.length>65536)throw new Error('Phone input exceeds 64 KiB')
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('')
  if(item.utf8Sha256!==hash)throw new Error('Phone input bytes did not match returned digest')
  ids.add(item.id);inputs.push(Object.freeze({id:item.id,channel:item.channel,mime:item.mime,text:item.text,utf8Sha256:hash,readOnly:item.readOnly,source:Object.freeze({kind:'android-explicit-intent',...(item.source.packageName===undefined?{}:{packageName:item.source.packageName})})}))
 }
 return Object.freeze({inputs:Object.freeze(inputs),rejections})
}

export const phoneInputLocator=(input:EIPhoneInput)=>{const {text,...metadata}=input;return JSON.stringify(metadata)}
export const phoneInputAdmissionError=(input:EIPhoneInput)=>input.text.length>8192||new TextEncoder().encode(JSON.stringify(input.text)).length>32768?'Input exceeds the current exact conversation capture limit':!input.text.trim()?'Empty input cannot be retained':null
export async function acknowledgeEIPhoneInput(origin:string,requestId:string,input:{id:string;utf8Sha256:string;receiptId:string},request:typeof fetch=fetch){
 if(origin!=='https://appassets.androidplatform.net'||!/^[A-Za-z0-9._:-]{1,128}$/.test(requestId)||!input.id||!/^[a-f0-9]{64}$/.test(input.utf8Sha256)||!input.receiptId)throw new Error('Invalid retained native input acknowledgment')
 const query=new URLSearchParams({requestId,inputId:input.id,utf8Sha256:input.utf8Sha256,receiptId:input.receiptId})
 const response=await request(`${origin}/EverthingFromNothing/__native/input-ack.json?${query}`,{credentials:'omit',cache:'no-store',redirect:'error'})
 if(!response.ok)throw new Error(`Native acknowledgment ${response.status}`)
 const value=await response.json();if(value?.schema!=='field.android.input-ack.v1'||value.requestId!==requestId||value.inputId!==input.id||value.receiptId!==input.receiptId||!['acknowledged','already-acknowledged','invalid','not-found'].includes(value.status))throw new Error('Invalid native acknowledgment return')
 return value as {status:string}
}
export async function discardEIPhoneInput(origin:string,requestId:string,input:{id:string;utf8Sha256:string},request:typeof fetch=fetch){
 if(origin!=='https://appassets.androidplatform.net'||!/^[A-Za-z0-9._:-]{1,128}$/.test(requestId)||!input.id||!/^[a-f0-9]{64}$/.test(input.utf8Sha256))throw new Error('Invalid native input discard')
 const query=new URLSearchParams({requestId,inputId:input.id,utf8Sha256:input.utf8Sha256})
 const response=await request(`${origin}/EverthingFromNothing/__native/input-discard.json?${query}`,{credentials:'omit',cache:'no-store',redirect:'error'})
 if(!response.ok)throw new Error(`Native discard ${response.status}`)
 const value=await response.json();if(value?.schema!=='field.android.input-discard.v1'||value.requestId!==requestId||value.inputId!==input.id||!['discarded','already-discarded','invalid','not-found'].includes(value.status))throw new Error('Invalid native discard return')
 return value as {status:string}
}
