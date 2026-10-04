import {attachPatternRecords} from './pattern-layer.ts'
export type ExistingEntry={id:string;term:string;parents:string[];inventory_binary_address:string;support:string;status:string;sources:{path:string;revision:string}[];state_frame:unknown}
export type ExistingMap={entries:ExistingEntry[];binary_relation_order:{nodes:{id:string;inventory_binary_address:string}[]}}
export const VIDEO_FOCUS_IDS=['source-address','was','is','next','frame','delta-update','render-boundary','receipt'] as const
export function deriveVideoPattern(map:ExistingMap){
 const before=JSON.stringify(map),entries=new Map(map.entries.map(entry=>[entry.id,entry]))
 const [binding]=attachPatternRecords(map.binary_relation_order.nodes,[{id:'requested-video-pattern',containerId:'scene',sourceIds:['frame','render-boundary','receipt','expected-actual'],kind:'video',output:'fracture-proof/video.mp4',scope:'Add-only source-linked presentation pattern. Existing map/container records and world Act are unchanged.'}])
 const states=VIDEO_FOCUS_IDS.map((focusId,act)=>{
  const entry=entries.get(focusId),container=entries.get(binding.containerId)
  if(!entry||!container)throw new Error('Existing pattern source/container is absent')
  const parents=entry.parents.map(id=>{const parent=entries.get(id);if(!parent)throw new Error(`Existing parent ${id} is absent`);return parent})
  return {act,input:{patternId:binding.id,focusId,containerId:binding.containerId},state:{binding,entry,parents,container,worldActChanged:false,scope:'Only the added display pattern advances'}}
 })
 if(JSON.stringify(map)!==before)throw new Error('Pattern modified the map')
 return states
}
