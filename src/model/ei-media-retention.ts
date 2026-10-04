import {proposeEI,type EILedger} from './ei-engine.ts'
import type {MediaSource} from './ei-phone-media.ts'
function canonicalDescriptor(value:unknown):string{
 if(value===null||typeof value==='string'||typeof value==='boolean'||(typeof value==='number'&&Number.isFinite(value)))return JSON.stringify(value)
 if(Array.isArray(value))return `[${value.map(canonicalDescriptor).join(',')}]`
 if(value&&typeof value==='object')return `{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonicalDescriptor((value as Record<string,unknown>)[key])}`).join(',')}}`
 throw new Error('Media descriptor must contain finite JSON values')
}
/** Object key order is not native source identity. Every value and array position
 * still participates; this does not normalize or rewrite retained source text. */
export function sameEIMediaDescriptor(a:unknown,b:unknown):boolean{
 try{return canonicalDescriptor(a)===canonicalDescriptor(b)}catch{return false}
}
/** Retains the exact native descriptor. The native digest identifies the media
 * bytes; this local transaction checks descriptor retention, not interpretation. */
export function proposeEIMediaRetention(ledger:EILedger,source:MediaSource,id:string){
 const address=`native/media/${source.id}`,existing=ledger.records.find(record=>record.address===address)
 if(existing){
  // A retry acknowledges the already retained original, even when the producer
  // or this field's current value has advanced. It never rewrites either one.
  const original=existing.was[0]??existing.is
  if(original.source.id===source.id&&original.source.realm==='android-explicit-media-descriptor'){
   try{if(sameEIMediaDescriptor(JSON.parse(original.value),source))return null}catch{ /* conflicting retained source stays untouched */ }
  }
  throw new Error('Media source address conflicts with retained content')
 }
 const producer=ledger.records.find(record=>record.address===source.address)
 if(!producer||producer.is.revision!==source.revision)throw new Error('Media return belongs to a different retained field revision')
 if(!source.nativeAvailable)throw new Error('Native source availability is unresolved')
 const value=JSON.stringify(source)
 const input={id:source.id,text:value,realm:'android-explicit-media-descriptor',locator:JSON.stringify({sourceId:source.id,sha256:source.sha256,contentUrl:source.contentUrl,scope:'native-retained-descriptor'})}
 const parent=typeof source.metadata.parentSourceId==='string'?`native/media/${source.metadata.parentSourceId}`:null
 return proposeEI(ledger,{id,producer:source.address,input,candidates:[{id:`${id}/retain`,label:'Retain returned media source',owner:'user',source:input,conditions:[{address:producer.address,equals:producer.is.value}],patches:[{kind:'create',address,value,source:input,parents:[source.address],relations:parent?[{relation:'derived-from-native-source',address:parent}]:[]}]}]})
}
