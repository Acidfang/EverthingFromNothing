import {mkdir,writeFile} from 'node:fs/promises'
import {createEILedger} from '../src/model/ei-engine.ts'
import {createEIPublicFieldRecords} from '../src/model/ei-public-field.ts'
import {createEIDeviceFieldRecords} from '../src/model/ei-device-field.ts'
import {projectEIFieldArray} from '../src/model/ei-field-array-view.ts'
import {deriveEIFieldObject} from '../src/model/ei-field-object.ts'
import {deriveEIWorldObject} from '../src/model/ei-world-object.ts'
import {bindEIWorldObjectToModeler,createEIModelerObjectDraw} from '../src/model/ei-modeler-object.ts'
import {projectEIEnvironmentHorizon} from '../src/model/ei-field-environment.ts'
const dir=process.argv[2]??'/workspace/shared/horizon-modeler-preview';await mkdir(dir,{recursive:true})
const ledger=createEILedger({records:[...createEIDeviceFieldRecords(),...createEIPublicFieldRecords()]}),object=deriveEIFieldObject(ledger,'device','state'),ids=new Set(['device',...object.partAddresses]),field=projectEIFieldArray(ledger,'state',undefined,'device'),nodes=field.nodes.filter(n=>ids.has(n.address)),xs=nodes.map(n=>n.x),ys=nodes.map(n=>n.y),size={width:1100,height:760},view={x:(Math.min(...xs)+Math.max(...xs))/2,y:(Math.min(...ys)+Math.max(...ys))/2,zoom:Math.min(1000/(Math.max(...xs)-Math.min(...xs)+240),670/(Math.max(...ys)-Math.min(...ys)+250))},horizon=projectEIEnvironmentHorizon(view,size,.18),output=[]
for(const [index,node] of nodes.entries()){
 const partCount=deriveEIFieldObject(ledger,node.address,'state').partAddresses.length,mesh=deriveEIWorldObject({...node,partCount,root:node.address==='device'},'solar'),job=createEIModelerObjectDraw(bindEIWorldObjectToModeler(mesh),{width:192,height:192,yaw:.46,pitch:.18,transparentBackground:true,showVertexMarkers:false,showCentreMarker:false,strokeWidth:0})
 while(!job.receipt().complete)job.assign(4096)
 const returned=job.returnBuffer()!;await writeFile(`${dir}/${index}.rgba`,returned.rgba);output.push({index,address:node.address,label:node.address==='model/inventory-root'?'Model':node.value.split('\n')[0],x:node.x,y:node.y,origin:returned.pixelOrigin,pixelsPerUnit:returned.pixelsPerUnit,checksum:returned.checksum,assigned:returned.receipt.assigned})
}
await writeFile(`${dir}/scene.json`,JSON.stringify({nodes:output,edges:field.edges.filter(e=>ids.has(e.from)&&ids.has(e.to)),view,size,horizon,scope:'declared-collections-modeler-and-observer-horizon',browserVerified:false},null,2))
