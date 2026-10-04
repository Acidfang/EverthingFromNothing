import {proposeEI,type EILedger,type EISeedRecord} from './ei-engine.ts'
export const EI_DEVICE_ROOT='device'
export const EI_DEVICE_KINDS=['hardware','software','files','folders'] as const
export type EIDeviceKind=typeof EI_DEVICE_KINDS[number]
/** These are user-requested encounter collections, not discovered inventory. */
export function createEIDeviceFieldRecords():EISeedRecord[]{
 const source={id:'device-workspace-request',realm:'user-requested-device-workspace',text:'by device, i mean hardware, AND software, AND files and folders'}
 return [{address:EI_DEVICE_ROOT,value:'Device opportunities',source,relations:[...EI_DEVICE_KINDS.map(kind=>({relation:'CONTAINS',address:`device/${kind}`})),{relation:'CONTAINS',address:'model/inventory-root'}]},...EI_DEVICE_KINDS.map(kind=>({address:`device/${kind}`,value:`${kind[0].toUpperCase()+kind.slice(1)}\nAwaiting an explicit device encounter`,parents:[EI_DEVICE_ROOT],source,relations:[]}))]
}
export type EIDeviceEncounter=Readonly<{id:string;kind:EIDeviceKind;label:string;sourceText:string;realm:string;locator:string;producer:{address:string;revision:number};selectionAddress?:string}>
/** Retains encountered bytes/metadata, without promoting them into semantics. */
export function proposeEIDeviceEncounter(ledger:EILedger,item:EIDeviceEncounter,id:string){
 if(!EI_DEVICE_KINDS.includes(item.kind)||!item.id||item.id.length>100||!item.label||!item.sourceText)throw new Error('Invalid device encounter')
 const address=`device/${item.kind}/${encodeURIComponent(item.id)}`,existing=ledger.records.find(record=>record.address===address)
 const source={id:item.id,text:item.sourceText,realm:item.realm,locator:item.locator}
 const value=`${item.label}\n${item.sourceText}`
 if(existing){const original=existing.was[0]??existing.is;if(original.value===value&&JSON.stringify(original.source)===JSON.stringify(source))return null;throw new Error('Device encounter address already has a different source')}
 const producer=ledger.records.find(record=>record.address===item.producer.address)
 if(!producer||producer.is.revision!==item.producer.revision)throw new Error('Device encounter belongs to a different selected state')
 const collection=`device/${item.kind}`,collectionRecord=ledger.records.find(record=>record.address===collection)
 const patches: Parameters<typeof proposeEI>[1]['candidates'][number]['patches'][number][]=[]
 if(!collectionRecord){if(!ledger.records.some(record=>record.address===EI_DEVICE_ROOT))patches.push(createEIDeviceFieldRecords()[0]);patches.push(createEIDeviceFieldRecords().find(record=>record.address===collection)!)}
 let encounteredParent:string|undefined
 if(item.realm==='android-device-encounter'){try{const metadata=JSON.parse(item.sourceText);if(typeof metadata.parentEncounterId==='string'){encounteredParent=ledger.records.find(record=>{const state=record.was[0]??record.is;if(state.source.realm!=='android-device-encounter')return false;try{return JSON.parse(state.source.text).encounterId===metadata.parentEncounterId}catch{return false}})?.address}}catch{}}
 const creates=patches.map(patch=>({...patch,kind:'create' as const}))
 creates.push({kind:'create',address,value,source,parents:[collection],relations:[{relation:'encountered-from',address:producer.address},...(item.selectionAddress?[{relation:'encountered-in-selection',address:item.selectionAddress}]:[]),...(encounteredParent?[{relation:'provider-parent',address:encounteredParent}]:[])]})
 return proposeEI(ledger,{id,producer:producer.address,input:source,candidates:[{id:`${id}/retain`,label:'Retain encountered source',owner:'user',source,conditions:[{address:producer.address,equals:producer.is.value}],patches:creates}]})
}
export function proposeEIDeviceWorkspace(ledger:EILedger,producerAddress:string,id:string){
 const producer=ledger.records.find(record=>record.address===producerAddress);if(!producer)throw new Error('Selected source is missing')
 const records=createEIDeviceFieldRecords(),missing=records.filter(record=>!ledger.records.some(existing=>existing.address===record.address));if(!missing.length)return null
 const source=records[0].source
 return proposeEI(ledger,{id,producer:producerAddress,input:source,candidates:[{id:`${id}/add`,label:'Add device encounter collections',owner:'user',source,conditions:[{address:producerAddress,equals:producer.is.value}],patches:missing.map(record=>({...record,kind:'create' as const,...(record.address===EI_DEVICE_ROOT?{parents:[producerAddress],relations:record.relations?.filter(relation=>relation.address!=='model/inventory-root'||ledger.records.some(item=>item.address===relation.address))}:{})}))}]})
}
