import test from 'node:test'
import assert from 'node:assert/strict'
import {createEILedger,exportEILedger} from '../src/model/ei-engine.ts'
import {projectEIRootTree} from '../src/model/ei-root-tree.ts'
const record=(address:string,parents:string[]=[],relations:{relation:string;address:string}[]=[])=>({address,parents,relations,value:address,source:{id:address,text:address}})
test('tree follows actual roots and parents, preserving shared identities and unrelated links',()=>{
 const ledger=createEILedger({records:[record('root'),record('a',['root']),record('b',['root']),record('shared',['a','b']),record('other',[],[{relation:'supports',address:'shared'}])]}),before=exportEILedger(ledger)
 const rows=projectEIRootTree(ledger,new Set(['root','a','b','shared','other']))
 assert.equal(rows.filter(row=>row.address==='shared').length,2)
 assert.equal(rows.filter(row=>row.address==='shared'&&row.reference).length,1)
 assert.deepEqual(rows.filter(row=>row.depth===1).map(row=>row.address),['other','root'])
 assert.equal(exportEILedger(ledger),before)
})
test('cyclic non-parent threads remain retained without becoming a fabricated hierarchy',()=>{
 const ledger=createEILedger({records:[record('root'),record('a',['root'],[{relation:'returns-to',address:'b'}]),record('b',['root'],[{relation:'returns-to',address:'a'}])]}),before=exportEILedger(ledger)
 const rows=projectEIRootTree(ledger,new Set(['root','a','b']))
 assert.equal(rows.length,3);assert.equal(rows.filter(row=>row.depth===2).length,2)
 assert.equal(exportEILedger(ledger),before)
 assert.throws(()=>createEILedger({records:[record('a',['b']),record('b',['a'])]}),/parent cycle/)
})
test('collapse hides view rows, retaining source identity and deterministic array ordering',()=>{
 const records=[record('root'),record('b',['root']),record('a',['root'])],a=createEILedger({records}),b=createEILedger({records:[...records].reverse()})
 assert.equal(projectEIRootTree(a,new Set()).length,1)
 assert.deepEqual(projectEIRootTree(a,new Set(['root'])),projectEIRootTree(b,new Set(['root'])))
})
