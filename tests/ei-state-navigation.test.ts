import test from 'node:test'
import assert from 'node:assert/strict'
import {emptyEIStateHistory,visitEIState,moveEIState} from '../src/model/ei-state-navigation.ts'
import {createEILedger,proposeEI,advanceEI,exportEILedger} from '../src/model/ei-engine.ts'
import {createEIGrainRegistry,projectEIGrain,readEIGrain,resolveEIGrainTarget,EI_GRAINS} from '../src/model/ei-grain-identity.ts'
const source=(text:string)=>({id:`source:${text}`,text,realm:'synthetic-navigation-test'})
test('history retains exact address/revision, deduplicates repeat and truncates only abandoned forward views',()=>{
 let history=emptyEIStateHistory()
 history=visitEIState(history,{address:'root',revision:0});history=visitEIState(history,{address:'other',revision:0});history=visitEIState(history,{address:'root',revision:2})
 assert.equal(visitEIState(history,{address:'root',revision:2}),history)
 history=moveEIState(history,-1);assert.deepEqual(history.items[history.index],{address:'other',revision:0})
 history=moveEIState(history,1);assert.equal(history.index,2)
 history=visitEIState(moveEIState(history,-1),{address:'root',revision:1})
 assert.deepEqual(history.items,[{address:'root',revision:0},{address:'other',revision:0},{address:'root',revision:1}])
 assert.equal(moveEIState(history,1),history)
 for(const revision of [-1,NaN,1.5])assert.throws(()=>visitEIState(history,{address:'root',revision}))
})
test('every grain inspects old source without changing state; operation requires returning to current IS',()=>{
 const initial=createEILedger({records:[{address:'root',value:'before',source:source('before')}]})
 const proposal=proposeEI(initial,{id:'change',producer:'root',input:source('after'),candidates:[{id:'choice',label:'supplied',owner:'engine',source:source('after'),conditions:[],patches:[{address:'root',value:'after',source:source('after')}]}]})
 const result=advanceEI(initial,proposal);assert.equal(result.status,'committed')
 const ledger=result.ledger,registry=createEIGrainRegistry(ledger),before=exportEILedger(ledger)
 for(const grain of EI_GRAINS){
  const old=projectEIGrain(registry,'root',grain,0),current=projectEIGrain(registry,'root',grain,1)
  assert.equal(readEIGrain(ledger,old).value,'before');assert.equal(readEIGrain(ledger,old).source.id,'source:before');assert.equal(readEIGrain(ledger,old).role,'WAS')
  assert.throws(()=>resolveEIGrainTarget(ledger,old),/historical-operation-target/)
  assert.equal(resolveEIGrainTarget(ledger,current),'root');assert.equal(readEIGrain(ledger,current).value,'after')
 }
 assert.equal(exportEILedger(ledger),before);assert.equal(ledger.receipts.length,1)
})
