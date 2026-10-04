import test from 'node:test'
import assert from 'node:assert/strict'
import {createEILedger,exportEILedger} from '../src/model/ei-engine.ts'
import {projectEIFieldArray,clampEIFieldZoom} from '../src/model/ei-field-array-view.ts'
import {createEIPublicFieldRecords} from '../src/model/ei-public-field.ts'
import {EI_GRAINS} from '../src/model/ei-grain-identity.ts'
const source=(id:string)=>({id,text:id,realm:'synthetic-view-test'})
test('field view preserves every public canonical identity and relation occurrence across grains',()=>{
 const ledger=createEILedger({records:createEIPublicFieldRecords()}),raw=exportEILedger(ledger),reference=projectEIFieldArray(ledger,'state')
 assert.equal(reference.nodes.length,137)
 assert.equal(reference.edges.filter(edge=>edge.label!=='parent').length,367)
 for(const grain of EI_GRAINS){const view=projectEIFieldArray(ledger,grain);assert.deepEqual(view,reference);assert.ok(view.nodes.every(node=>node.worldPosition===null&&Number.isFinite(node.x)&&Number.isFinite(node.y)))}
 assert.equal(exportEILedger(ledger),raw);assert.equal(ledger.receipts.length,0)
})
test('view retains missing and parallel links without synthesizing target entities or root connections',()=>{
 const ledger=createEILedger({records:[{address:'root',value:'a',source:source('root'),relations:[{relation:'one',address:'child'},{relation:'two',address:'child'},{relation:'missing',address:'unknown'}]},{address:'child',value:'b',source:source('child')},{address:'separate',value:'c',source:source('separate')}]})
 const view=projectEIFieldArray(ledger,'coordinate')
 assert.equal(view.nodes.length,3);assert.equal(view.edges.length,3)
 assert.equal(view.edges.find(edge=>edge.label==='missing')?.known,false)
 assert.deepEqual(view.edges.map(edge=>edge.sourceId),['root','root','root'])
 assert.equal(view.nodes.find(node=>node.address==='child')?.depth,1)
 assert.notEqual(view.nodes.find(node=>node.address==='separate')?.component,view.nodes[0].component)
 assert.ok(!view.nodes.some(node=>node.address==='unknown'))
})
test('view remains finite for cycles and view zoom has no model operation',()=>{
 const ledger=createEILedger({records:[{address:'a',value:'a',source:source('a'),relations:[{relation:'to',address:'b'}]},{address:'b',value:'b',source:source('b'),relations:[{relation:'to',address:'a'}]}]})
 const before=exportEILedger(ledger),view=projectEIFieldArray(ledger,'pixel')
 assert.equal(view.nodes.length,2);assert.equal(view.edges.length,2)
 assert.equal(clampEIFieldZoom(Infinity),1);assert.equal(clampEIFieldZoom(1e9),32);assert.equal(clampEIFieldZoom(0),.08)
 assert.equal(exportEILedger(ledger),before)
})
test('selected historical field node resolves the same retained source and revision',async()=>{
 const {proposeEI,advanceEI}=await import('../src/model/ei-engine.ts')
 const initial=createEILedger({records:[{address:'root',value:'old',source:source('old')}]})
 const result=advanceEI(initial,proposeEI(initial,{id:'update',producer:'root',input:source('new'),candidates:[{id:'choice',label:'supplied',owner:'engine',source:source('new'),conditions:[],patches:[{address:'root',value:'new',source:source('new')}]}]}))
 assert.equal(result.status,'committed')
 const selected=projectEIFieldArray(result.ledger,'pixel',{address:'root',revision:0}).nodes[0]
 assert.equal(selected.role,'WAS');assert.equal(selected.value,'old');assert.equal(selected.sourceId,'old');assert.equal(selected.revision,0)
 assert.equal(result.ledger.records[0].is.value,'new');assert.equal(result.ledger.receipts.length,1)
})
test('zooming out from a fitted disconnected field cannot zoom in',()=>{
 const ledger=createEILedger({records:Array.from({length:30},(_,i)=>({address:`node/${i}`,value:String(i),source:source(String(i))}))})
 const {bounds:b}=projectEIFieldArray(ledger,'state'),fit=Math.min(1200/(b.right-b.left),620/(b.bottom-b.top))
 assert.ok(fit<.08);assert.ok(clampEIFieldZoom(fit/1.6,Math.min(.08,fit/10))<fit)
})
test('successive relation rings cannot cover each other at equal population',()=>{
 const records=[{address:'root',value:'root',source:source('root'),relations:Array.from({length:24},(_,i)=>({relation:'to',address:`a${i}`}))},...Array.from({length:24},(_,i)=>({address:`a${i}`,value:'a',source:source(`a${i}`),relations:[{relation:'to',address:`b${i}`}]})),...Array.from({length:24},(_,i)=>({address:`b${i}`,value:'b',source:source(`b${i}`),relations:[]}))]
 const view=projectEIFieldArray(createEILedger({records}),'node')
 for(let i=0;i<view.nodes.length;i++)for(let j=i+1;j<view.nodes.length;j++)assert.ok(Math.hypot(view.nodes[i].x-view.nodes[j].x,view.nodes[i].y-view.nodes[j].y)>76)
})
test('declared SOURCE remains the view origin when retained record order changes',()=>{
 const records=[{address:'child',value:'c',source:source('child'),parents:['root']},{address:'root',value:'r',source:source('root')}]
 const one=projectEIFieldArray(createEILedger({records}),'state',undefined,'root'),two=projectEIFieldArray(createEILedger({records:[...records].reverse()}),'state',undefined,'root')
 assert.equal(one.sourceAddress,'root');assert.deepEqual(one.nodes.find(node=>node.address==='root')&&[one.nodes.find(node=>node.address==='root')!.x,one.nodes.find(node=>node.address==='root')!.y],[0,0])
 for(const node of one.nodes){const same=two.nodes.find(other=>other.address===node.address)!;assert.equal(node.x,same.x);assert.equal(node.y,same.y)}
 assert.throws(()=>projectEIFieldArray(createEILedger({records}),'state',undefined,'absent'),/SOURCE address/)
})
