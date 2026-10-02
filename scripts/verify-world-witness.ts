import {mkdtemp,writeFile,rm} from 'node:fs/promises'
import {join,resolve} from 'node:path'
import {pathToFileURL} from 'node:url'
import {execFileSync} from 'node:child_process'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
/** Reads actual component-emitted SVG attributes through an XML adapter. This
 * verifies the renderer contract, not browser painting or Android interaction. */
export async function verifyWorldWitness(){
 const root=resolve(import.meta.dirname,'..'),dir=await mkdtemp(join(root,'.qa-witness-'))
 try{
  const entry=join(dir,'entry.ts');await writeFile(entry,"export {EIFieldArray} from '../src/EIFieldArray';export {createEILedger} from '../src/model/ei-engine';export {projectEIFieldArray} from '../src/model/ei-field-array-view';export {createEIThreadDrawPlan} from '../src/model/ei-thread-draw';export {projectEIEnvironmentHorizon} from '../src/model/ei-field-environment';export {projectEIWorldObject} from '../src/model/ei-world-object';export {projectEISvgWitness,readEISvgWitness} from '../src/model/ei-svg-frame-witness';")
  execFileSync(join(root,'node_modules/.bin/vite'),['build','--ssr',entry,'--outDir',join(dir,'output'),'--configLoader','runner'],{cwd:root,stdio:'pipe'})
  const api=await import(pathToFileURL(join(dir,'output/entry.js')).href)
  const ledger=api.createEILedger({records:[{address:'root',value:'Known retained input',source:{id:'source-root',text:'Known retained input'}}]})
  const html=renderToStaticMarkup(createElement(api.EIFieldArray,{ledger,address:'root',sourceAddress:'root',revision:0,grain:'state',disabled:false,onSelect:()=>{},initialDrawPhase:100}))
  const svg=html.match(/<svg[^>]*class="ei-field-surface"[\s\S]*?<\/svg>/)?.[0];if(!svg)throw new Error('Missing actual field SVG')
  const tree=JSON.parse(execFileSync('python3',['-c',"import sys,json,xml.etree.ElementTree as E\ndef walk(x):return {'tag':x.tag.split('}')[-1],'attrs':x.attrib,'children':[walk(c) for c in x]}\nprint(json.dumps(walk(E.fromstring(sys.stdin.read()))))"],{input:svg,encoding:'utf8'}))
  class Node{tag:string;attrs:Record<string,string>;children:Node[];constructor(value:any){this.tag=value.tag;this.attrs=value.attrs;this.children=value.children.map((child:any)=>new Node(child))}getAttribute(name:string){return this.attrs[name]??null}querySelectorAll(selector:string):Node[]{return this.children.flatMap(child=>[...(selector.startsWith('[')?Object.hasOwn(child.attrs,selector.slice(1,-1)):child.tag===selector)?[child]:[],...child.querySelectorAll(selector)])}querySelector(selector:string){return this.querySelectorAll(selector)[0]??null}}
  const surface=new Node(tree),field=api.projectEIFieldArray(ledger,'state',{address:'root',revision:0},'root'),plan=api.createEIThreadDrawPlan(field.nodes,field.edges,'root'),shape=api.projectEIWorldObject({address:'root',revision:0,sourceId:'source-root',value:'Known retained input',partCount:0,root:true},.46,.18,'solar')
  const zoom=Math.min(1200/220,(800-150-90)/240),y=-30+(150-90)/(2*zoom),viewBox=`${-1200/(2*zoom)} ${y-800/(2*zoom)} ${1200/zoom} ${800/zoom}`
  const expected=api.projectEISvgWitness(field,plan,plan.lastStage+1,{nodes:[],edges:[]},{mirrors:[],environment:(()=>{const h=api.projectEIEnvironmentHorizon({x:0,y,zoom},{width:1200,height:800},.18);return {skyPath:h.skyPath,groundPath:h.groundPath,linePath:h.linePath}})(),viewBox,sceneTransform:`rotate(0 0 ${y})`,nodes:{root:{path:shape.path,faces:[]}}})
  const actual=api.readEISvgWitness(surface);if(actual!==expected)throw new Error('Actual component SVG differs from source-composed witness')
  const node=surface.querySelector('[data-field-node]')!;node.attrs.opacity='0x0';let rejected=false;try{api.readEISvgWitness(surface)}catch{rejected=true};if(!rejected)throw new Error('Invalid SVG number admitted')
  return {scope:'actual-component-svg-attributes',matched:true,invalidNumberRejected:true,browserVerified:false}
 }finally{await rm(dir,{recursive:true,force:true})}
}
