import {readEIDiscoveryReturn,type EIDiscoveryReturn} from './ei-discovery.ts'
/** Engineering storage bounds, not a limit on the user's logical whole. */
export const EI_SPOOL_LIMITS=Object.freeze({pageBytes:98_304,totalBytes:67_108_864,pages:65_536,pageWindow:32})
export type EISpoolPage=Readonly<{format:'ei-spool-page/v1';userRoot:string;address:string;scanKey:string;sequence:number;nextCursor:number|null;content:string;sha256:string;bytes:number}>
export type EISpoolHead=Readonly<{format:'ei-spool-head/v1';userRoot:string;generation:number;address:string|null;bytes:number}>
export type EISpoolStoredPage=Readonly<{page:EISpoolPage;ordinal:number;parentAddress:string|null;storageHead:EISpoolHead}>
export type EISpoolAppendReceipt=Readonly<{kind:'stored-provider-return';head:EISpoolHead;stored:EISpoolStoredPage;duplicate:boolean;engineCommitted:false;durability:'indexeddb-transaction-complete'|'memory-only'}>
export interface EISpoolStorage{head(root:string):Promise<EISpoolHead>;append(expected:EISpoolHead,page:EISpoolPage):Promise<EISpoolAppendReceipt>;read(root:string,address:string):Promise<EISpoolStoredPage|null>;window(root:string,after:number,limit?:number):Promise<readonly EISpoolStoredPage[]>}
export class EISpoolError extends Error{readonly code:string;constructor(code:string,message:string){super(`EI spool: ${message}`);this.name='EISpoolError';this.code=code}}
export const spoolFail=(code:string,message:string):never=>{throw new EISpoolError(code,message)}
const issued=new WeakSet<object>(),encoder=new TextEncoder()
function plain(value:unknown):asserts value is Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))spoolFail('invalid-data','plain data required');for(const key of Reflect.ownKeys(value as object)){const d=Object.getOwnPropertyDescriptor(value as object,key)!;if(typeof key!=='string'||!('value'in d)||typeof d.value==='function')spoolFail('invalid-data','accessors and executable properties are not accepted')}}
export function spoolRoot(root:unknown):asserts root is string{if(typeof root!=='string'||!root.trim()||root.length>256)spoolFail('invalid-root','a bounded exact user root is required')}
export const emptySpoolHead=(userRoot:string):EISpoolHead=>{spoolRoot(userRoot);return Object.freeze({format:'ei-spool-head/v1',userRoot,generation:0,address:null,bytes:0})}
const digest=async(text:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(text))),n=>n.toString(16).padStart(2,'0')).join('')
/** Raw returned bytes remain intact. Address is the SAME batch occurrence used
 * by the engine; storage does not invent a competing canonical entity. */
export async function prepareEISpoolPage(userRoot:string,returned:EIDiscoveryReturn):Promise<EISpoolPage>{
 spoolRoot(userRoot);plain(returned);if(!returned||typeof returned.raw!=='string'||returned.raw.length>65536||!['homebase','android','web'].includes(returned.carrier))spoolFail('invalid-return','a provider return is required')
 const parsed=JSON.parse(returned.raw);const valid=readEIDiscoveryReturn(returned.raw,{requestId:parsed.requestId,address:parsed.address,revision:parsed.revision},returned.carrier),batch=valid.value
 const scanKey=await digest(JSON.stringify([userRoot,returned.carrier,batch.scanId])),address=`discovery/${scanKey}/${batch.sequence}`
 const content=JSON.stringify({format:'ei-spool-content/v1',userRoot,carrier:valid.carrier,raw:valid.raw}),bytes=encoder.encode(content).length
 if(bytes>EI_SPOOL_LIMITS.pageBytes)spoolFail('page-capacity','returned page exceeds the storage-page bound; original remains with caller')
 const page=Object.freeze({format:'ei-spool-page/v1' as const,userRoot,address,scanKey,sequence:batch.sequence,nextCursor:batch.nextCursor,content,sha256:await digest(content),bytes});issued.add(page);return page
}
export function assertPreparedSpoolPage(page:EISpoolPage){if(!issued.has(page))spoolFail('unvalidated-page','only a prepared or verified returned page may be stored')}
export async function verifyEISpoolPage(input:unknown):Promise<EISpoolPage>{
 plain(input);if(!input||typeof input!=='object')spoolFail('corrupt-page','missing stored page')
 const p=input as EISpoolPage;if(Object.keys(p).sort().join(',')!=='address,bytes,content,format,nextCursor,scanKey,sequence,sha256,userRoot'||typeof p.address!=='string'||typeof p.scanKey!=='string'||typeof p.sha256!=='string'||typeof p.userRoot!=='string'||typeof p.format!=='string'||!Number.isSafeInteger(p.bytes)||!Number.isSafeInteger(p.sequence)||!(p.nextCursor===null||Number.isSafeInteger(p.nextCursor)))spoolFail('corrupt-page','invalid page fields');if(typeof p.content!=='string'||p.content.length>EI_SPOOL_LIMITS.pageBytes||encoder.encode(p.content).length>EI_SPOOL_LIMITS.pageBytes)spoolFail('corrupt-page','invalid content size')
 let c:any;try{c=JSON.parse(p.content)}catch{spoolFail('corrupt-page','invalid content encoding')}
 if(c.format!=='ei-spool-content/v1'||Object.keys(c).sort().join(',')!=='carrier,format,raw,userRoot'||typeof c.raw!=='string')spoolFail('corrupt-page','invalid content envelope')
 const raw=JSON.parse(c.raw),returned=readEIDiscoveryReturn(c.raw,{requestId:raw.requestId,address:raw.address,revision:raw.revision},c.carrier)
 const expected=await prepareEISpoolPage(c.userRoot,returned)
 if(JSON.stringify(input)!==JSON.stringify(expected))spoolFail('corrupt-page','stored source, address, hash or byte count changed')
 return expected
}
export function readSpoolHead(input:unknown,root:string):EISpoolHead{
 if(input===undefined||input===null)return emptySpoolHead(root)
 plain(input);const h=input as EISpoolHead;if(!h||h.format!=='ei-spool-head/v1'||h.userRoot!==root||!Number.isSafeInteger(h.generation)||h.generation<0||h.generation>EI_SPOOL_LIMITS.pages||!Number.isSafeInteger(h.bytes)||h.bytes<0||h.bytes>EI_SPOOL_LIMITS.totalBytes||(h.generation===0?h.address!==null||h.bytes!==0:typeof h.address!=='string')||Object.keys(h).sort().join(',')!=='address,bytes,format,generation,userRoot')spoolFail('corrupt-head','stored whole-root head is invalid')
 return Object.freeze({...h})
}
export function nextSpoolHead(current:EISpoolHead,expected:EISpoolHead,page:EISpoolPage):EISpoolHead{
 assertPreparedSpoolPage(page);if(current.userRoot!==page.userRoot||JSON.stringify(current)!==JSON.stringify(expected))spoolFail('head-conflict','the addressed whole changed; reload its head before retrying')
 if(current.generation>=EI_SPOOL_LIMITS.pages||current.bytes+page.bytes>EI_SPOOL_LIMITS.totalBytes)spoolFail('capacity','storage quota reached; no page or continuation was discarded')
 return Object.freeze({...current,generation:current.generation+1,address:page.address,bytes:current.bytes+page.bytes})
}
export function spoolWindow(after:number,limit:number){if(!Number.isSafeInteger(after)||after<0||!Number.isSafeInteger(limit)||limit<1||limit>EI_SPOOL_LIMITS.pageWindow)spoolFail('invalid-window','invalid bounded page window')}
