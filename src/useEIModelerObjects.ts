import {useEffect,useRef,useState} from 'react'
import {deriveEIWorldObject,type EIWorldEntity,type EIWorldPresentation} from './model/ei-world-object'
import {bindEIWorldObjectToModeler,createEIModelerObjectDraw} from './model/ei-modeler-object'
export type EIModelerSprite=Readonly<{key:string;href:string;x:number;y:number;width:number;height:number;checksum:string;assigned:number;pixelWidth:number;pixelHeight:number}>
/** An explicit finite texture grain. These are texture pixels, not a claim that
 * the entire device/model field has been resolved. */
export const EI_OBJECT_TEXTURE_GRAIN=192
export function useEIModelerObjects(entities:readonly EIWorldEntity[],observer:{yaw:number;pitch:number},presentation:EIWorldPresentation='nature'){
 const keyFor=(entity:EIWorldEntity)=>JSON.stringify([entity.address,entity.revision,entity.sourceId,entity.partCount,entity.root,presentation,observer.yaw,observer.pitch,EI_OBJECT_TEXTURE_GRAIN])
 const keys=entities.map(keyFor),signature=JSON.stringify(keys),request=useRef({signature,entities,observer,keys,presentation});request.current={signature,entities,observer,keys,presentation}
 const cache=useRef(new Map<string,EIModelerSprite>()),kick=useRef<()=>void>(()=>{}),[result,setResult]=useState<{signature:string;sprites:ReadonlyMap<string,EIModelerSprite>}>({signature:'',sprites:new Map()}),[error,setError]=useState(''),[loaded,setLoaded]=useState<ReadonlySet<string>>(new Set())
 useEffect(()=>{let disposed=false,busy=false,last='',attempted='';const waits=new Set<()=>void>()
  const yieldCarrier=()=>new Promise<void>(resolve=>{if(!document.hidden){setTimeout(resolve,0);return}const resume=()=>{if(document.hidden&&!disposed)return;document.removeEventListener('visibilitychange',resume);waits.delete(resume);resolve()};waits.add(resume);document.addEventListener('visibilitychange',resume)})
  const run=async()=>{if(busy||disposed)return;busy=true;try{while(!disposed&&request.current.signature!==last){const jobRequest=request.current;attempted=jobRequest.signature;const sprites=new Map<string,EIModelerSprite>();for(let index=0;index<jobRequest.entities.length&&!disposed;index++){
    const entity=jobRequest.entities[index],key=jobRequest.keys[index];let sprite=cache.current.get(key)
    if(!sprite){const job=createEIModelerObjectDraw(bindEIWorldObjectToModeler(deriveEIWorldObject(entity,jobRequest.presentation)),{width:EI_OBJECT_TEXTURE_GRAIN,height:EI_OBJECT_TEXTURE_GRAIN,direction:0,...jobRequest.observer,transparentBackground:true,showVertexMarkers:false,showCentreMarker:false,strokeWidth:jobRequest.presentation==='solar'?0:.5})
     while(!job.receipt().complete&&!disposed){job.assign(4096);await yieldCarrier()}if(disposed){job.cancel();break}
     const returned=job.returnBuffer();if(!returned)throw new Error('Modeler has no completed object return')
     const canvas=document.createElement('canvas');canvas.width=returned.width;canvas.height=returned.height;const context=canvas.getContext('2d');if(!context)throw new Error('Image return unavailable');context.putImageData(new ImageData(new Uint8ClampedArray(returned.rgba),returned.width,returned.height),0,0)
     sprite=Object.freeze({key,href:canvas.toDataURL('image/png'),x:-returned.pixelOrigin.x/returned.pixelsPerUnit,y:-returned.pixelOrigin.y/returned.pixelsPerUnit,width:returned.width/returned.pixelsPerUnit,height:returned.height/returned.pixelsPerUnit,checksum:returned.checksum,assigned:returned.receipt.assigned,pixelWidth:returned.width,pixelHeight:returned.height});cache.current.set(key,sprite);while(cache.current.size>128){const oldest=cache.current.keys().next().value;if(oldest===undefined)break;cache.current.delete(oldest)}
    }
    sprites.set(entity.address,sprite)
   }if(disposed)break;last=jobRequest.signature;setResult({signature:last,sprites});setError('')}}catch(reason){if(!disposed){last=attempted;setError(reason instanceof Error?reason.message:String(reason))}}finally{busy=false;if(!disposed&&request.current.signature!==last)void run()}}
  kick.current=()=>{void run()};void run();return()=>{disposed=true;for(const resume of waits)resume();kick.current=()=>{}}
 },[])
 useEffect(()=>{kick.current()},[signature])
 const ready=result.signature===signature&&entities.every(entity=>{const sprite=result.sprites.get(entity.address);return !!sprite&&loaded.has(sprite.href)})
 return {sprites:result.sprites,ready,error,onLoad:(key:string,href:string)=>{if(!request.current.keys.includes(key))return;setLoaded(current=>{if(current.has(href))return current;const next=new Set([...current,href]);while(next.size>256)next.delete(next.values().next().value!);return next})},onError:(key:string,href:string)=>{if(!request.current.keys.includes(key))return;setLoaded(current=>{const next=new Set(current);next.delete(href);return next});setError('Returned PNG could not be decoded')},grain:EI_OBJECT_TEXTURE_GRAIN}
}
