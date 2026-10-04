import test from 'node:test'
import assert from 'node:assert/strict'
import { prepareIntegratedTransition, type AddressedNode, type ModelSnapshot, type TransitionInput } from '../src/model/integrated-transition.ts'

// Deliberately synthetic supplied poses. These fixtures do not establish the user's pose law.
const source: AddressedNode = { id: 'source', root: 'source', path: ['source'], predecessor: null, pose: { centre: [0,0,0], tip: [.25,.5,.75], orientation: [0,0,0,1], evidence: 'synthetic source' }, unresolved: [] }
const child = (id: string): AddressedNode => ({ id, root: 'source', path: ['source',id], predecessor: 'source', pose: { centre: [.25,.5,.75], tip: [.3,.6,.9], orientation: [0,0,0,1], evidence: 'synthetic inherited pose' }, unresolved: [] })
const selection=['source','a','b'].map((address,i)=>({address,x:i,y:i}))
const previous: ModelSnapshot = Object.freeze({ act: 0, source: 'source', nodes: [source], threads: [] })
const input = (): TransitionInput => ({ id: '0-to-1', source: 'source', from: 0, to: 1, nodes: [source,child('a'),child('b')], threads: ['a','b'].map(id => ({ id: `source/${id}`, root: 'source', from: 'source', to: id, evidence: 'synthetic thread' })), intersections: [{ id: 'junction', root: 'source', nodes: ['a','b'], evidence: 'synthetic exact model intersection' }], unresolved: [], derivation: { poseLaw: 'synthetic fixture only', threadClosure: 'synthetic fixture only', drawOrder: 'synthetic fixture only' } })

test('all supplied relations, exact junction identities, successor pixels and commit share one snapshot', async () => {
  const tx = prepareIntegratedTransition(previous,input())
  assert.deepEqual(tx.blockers,[])
  assert.deepEqual(tx.snapshot.junctions[0].paths,[['source','a'],['source','b']])
  tx.beginFrame(2,2,selection)
  // Supplied order may differ from row-major; the transport does not select it.
  tx.writePixel(2,[2,2,2,255]); tx.writePixel(0,[0,0,0,255])
  assert.throws(() => tx.commit(previous)); await assert.rejects(tx.present(() => {}))
  tx.writePixel(3,[3,3,3,255]); tx.writePixel(1,[1,1,1,255])
  assert.throws(() => tx.writePixel(1,[9,9,9,255]))
  let displayed: unknown
  await tx.present((pixels,snapshot) => { displayed = snapshot; assert.equal(pixels[8],2); assert.equal(previous.act,0) })
  const committed = tx.commit(previous)
  assert.equal(committed,displayed); assert.equal(committed.state.act,1); assert.equal(committed.state.nodes.length,3)
  assert.throws(() => tx.commit(previous)); assert.throws(() => tx.cancel())
})
test('missing derivation remains blocked, rather than borrowing six-face or oscillator geometry', () => {
  const tx = prepareIntegratedTransition(previous,{ ...input(), derivation: { poseLaw: null, threadClosure: null, drawOrder: null } })
  assert.equal(tx.blockers.length,3); assert.throws(() => tx.beginFrame(1,1,selection)); assert.equal(previous.act,0)
})
test('model intersections require exact identity evidence and coincident model centres', () => {
  const data=input(), b=child('b')
  const tx=prepareIntegratedTransition(previous,{...data,nodes:[source,child('a'),{...b,pose:{...b.pose!,centre:[.25,.5,.75000000001]}}]})
  assert.ok(tx.blockers.includes('junction:INTERSECTION_UNRESOLVED'))
  assert.ok(tx.blockers.includes('b:PREVIOUS_TIP_NOT_CENTRE'))
  const unwitnessed=prepareIntegratedTransition(previous,{...data,intersections:[{...data.intersections[0],evidence:''}]})
  assert.ok(unwitnessed.blockers.includes('junction:INTERSECTION_UNRESOLVED'))
})
test('orphan root paths and missing threads cannot commit', () => {
  const tx=prepareIntegratedTransition(previous,{...input(),threads:[]})
  assert.ok(tx.blockers.includes('a:ROOT_PATH_LINK_MISSING')); assert.ok(tx.blockers.includes('b:INHERITED_THREAD_MISSING'))
  assert.throws(()=>tx.beginFrame(1,1,selection))
})
test('cancellation, stale state identity and presentation failure preserve committed zero', async () => {
  const tx=prepareIntegratedTransition(previous,input()); tx.beginFrame(1,1,selection); tx.writePixel(0,[0,0,0,255])
  await assert.rejects(tx.present(()=>{throw new Error('renderer failed')})); assert.throws(()=>tx.commit(previous))
  await tx.present(()=>{}); assert.throws(()=>tx.commit({...previous})); tx.cancel(); assert.throws(()=>tx.commit(previous)); assert.equal(previous.act,0)
})
test('pending transition is insulated from caller array mutation', () => {
  const data=input(), tx=prepareIntegratedTransition(previous,data)
  ;(data.nodes as AddressedNode[]).pop()
  assert.equal(tx.snapshot.nodes.length,3); assert.ok(Object.isFrozen(tx.snapshot.nodes[1].pose!.centre))
})

test('async presentation and selection index must complete before commit', async()=>{
  const tx=prepareIntegratedTransition(previous,input())
  assert.throws(()=>tx.beginFrame(1,1,[]))
  tx.beginFrame(1,1,selection);tx.writePixel(0,[0,0,0,255])
  let finish!:()=>void
  const pending=tx.present(()=>new Promise<void>(resolve=>{finish=resolve}))
  assert.throws(()=>tx.commit(previous));finish();await pending
  assert.deepEqual(tx.commit(previous).selection,selection)
})

test('receipt identity is captured and rejected asynchronous presentation never commits', async()=>{
  const data=input(),tx=prepareIntegratedTransition(previous,data)
  Object.assign(data,{id:'changed',from:50,to:51})
  assert.equal(tx.receipt().id,'0-to-1');assert.equal(tx.receipt().to,1)
  tx.beginFrame(1,1,selection);tx.writePixel(0,[0,0,0,255])
  await assert.rejects(tx.present(async()=>{throw new Error('failed asynchronously')}))
  assert.throws(()=>tx.commit(previous));assert.equal(tx.receipt().presented,false)
})
