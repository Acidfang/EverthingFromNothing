import test from 'node:test'
import assert from 'node:assert/strict'
import {tetraMomentGate,recursiveMomentGates} from '../src/model/tetra-moment-gate.ts'
import type {TransitionReceipt} from '../src/model/transitionEngine.ts'
// Synthetic receipts exercise the adapter; no fixture is a recovered user event.
const receipt:TransitionReceipt={before:{temporal:{was:'WAS',is:'IS',next:'NEXT'},step:0},after:{temporal:{was:'IS',is:'NEXT',next:'WAS'},step:1},movement:'SEQUENTIAL_FOLLOW_LOCK',proceed:true,twist:true,rotate:true,turn:true}
const input={address:'test:gate',receiptAddress:'test:receipt',receipt,infinity:null,definitionSource:'test:definition'}
test('gate maps actual receipt identities using retained role correspondence',()=>{
  const gate=tetraMomentGate(input)
  assert.equal(gate.mappingResolved,true)
  assert.deepEqual(gate.ports.map(p=>[p.from,p.destinations[0]]),[['WAS','NEXT'],['IS','WAS'],['NEXT','IS']])
  assert.equal(gate.truthFunction,null);assert.equal(gate.physicalPose,null)
  assert.equal(gate.committedByThisView,false)
})
test('step does not invent an indexed infinity identity',()=>{
  const gate=tetraMomentGate(input)
  assert.equal(gate.infinity,null);assert.equal(gate.status,'OPEN_BINDING')
  assert.equal(gate.directedPort.status,'UNRESOLVED')
})
test('supplied indexed binding retains its exact spelling and provenance',()=>{
  const gate=tetraMomentGate({...input,infinity:{index:'.infinity3',source:'test:index-binding'}})
  assert.equal(gate.infinity?.index,'.infinity3')
  assert.equal(gate.status,'OPEN_BINDING')
  assert.equal(gate.directedPort.binding,null)
})
test('another grain retains the parent receipt and local differences separately',()=>{
  const gate=tetraMomentGate({...input,grain:{address:'test:grain/child',parentAddress:'test:grain',sourceReceipt:'test:parent-receipt',localDifference:['test:delta']}})
  assert.equal(gate.grain?.parentAddress,'test:grain')
  assert.deepEqual(gate.grain?.localDifference,['test:delta'])
  assert.ok(Object.isFrozen(gate.grain?.localDifference))
})
test('contradictory or duplicated port identities remain unresolved',()=>{
  const gate=tetraMomentGate({...input,receipt:{...receipt,after:receipt.before}})
  assert.equal(gate.mappingResolved,false)
  const duplicate=tetraMomentGate({...input,receipt:{...receipt,before:{...receipt.before,temporal:{was:'IS',is:'IS',next:'NEXT'}}}})
  assert.equal(duplicate.mappingResolved,false)
})
test('same mechanism repeats across self-centred grains without choosing world centres',()=>{
  const records=recursiveMomentGates([0,1,2].map(index=>({...input,address:`test:gate/${index}`,grain:{address:`test:grain/${index}`,parentAddress:index?`test:grain/${index-1}`:null,sourceReceipt:`test:receipt/${index}`,localDifference:[]}})))
  assert.equal(records.gates.length,3);assert.equal(records.threads.length,2)
  assert.ok(records.threads.every(thread=>thread.status==='RETAINED_PARENT'))
  for(const gate of records.gates){
    assert.equal(gate.centre.selfAddress,gate.address);assert.equal(gate.centre.worldPosition,null)
    assert.equal(gate.mechanism,records.gates[0].mechanism)
    assert.deepEqual(gate.ports.map(port=>port.destinations),records.gates[0].ports.map(port=>port.destinations))
  }
})
test('missing parent remains open rather than generating a replacement grain',()=>{
  const records=recursiveMomentGates([{...input,grain:{address:'child',parentAddress:'absent',sourceReceipt:'source',localDifference:[]}}])
  assert.equal(records.gates.length,1);assert.equal(records.threads[0].status,'OPEN_PARENT')
})
