import test from 'node:test'
import assert from 'node:assert/strict'
import {createEIThreadDrawPlan} from '../src/model/ei-thread-draw.ts'
import {commitEIAnimationFrame, createEIAnimationCycle, proposeNextEIAnimationFrame, replayEIAnimationCycle, rebaseEIAnimationCycle,
  verifyEIAnimationReadback, exportEIAnimationCycle, restoreEIAnimationCycle, projectEIAnimationContent, fingerprintEIAnimationContent, type EIAnimationCycle, type EIAnimationReadback, type EIAnimationTraceContent} from '../src/model/ei-animation-cycle.ts'

const nodes = ['root','child','leaf','elsewhere'].map(address => ({address, revision: 3, sourceId: `source:${address}`}))
const edge = (id: string, from: string, to: string) => ({id,from,to,label:'thread',sourceId:`source:${id}`,sourceRevision:2,known:true})
const plan = createEIThreadDrawPlan(nodes,[edge('a','root','child'),edge('b','child','leaf'),edge('c','leaf','root')],'root')
const start = () => proposeNextEIAnimationFrame(createEIAnimationCycle(plan,{generation:'run:1'}))
// Test renderer fixture: the production adapter must supply the actual DOM read.
const rendered = (cycle: EIAnimationCycle): EIAnimationReadback => {
  const {frameKey,source,generation,sequence,content} = cycle.NEXT!
  return structuredClone({frameKey,source,generation,sequence,content})
}
const commit = (cycle: EIAnimationCycle) => commitEIAnimationFrame(cycle,verifyEIAnimationReadback(cycle,rendered(cycle)))
const finish = (cycle: EIAnimationCycle) => {
  while (!cycle.complete) cycle = commit(proposeNextEIAnimationFrame(cycle))
  return cycle
}

test('WAS, IS and proposed NEXT are source addressed and only exact evidence commits', () => {
  const cycle = start(), next = cycle.NEXT!, receipt = verifyEIAnimationReadback(cycle,rendered(cycle))
  assert.equal(cycle.IS,null); assert.equal(cycle.WAS,null); assert.equal(next.source.entityAddress,'root')
  assert.equal(next.source.revision,3); assert.equal(next.source.sourceId,'source:root')
  assert.equal(proposeNextEIAnimationFrame(cycle),cycle)
  const first = commitEIAnimationFrame(cycle,receipt)
  assert.equal(first.IS,next); assert.equal(first.WAS,null); assert.equal(first.NEXT,null)
  const pending = proposeNextEIAnimationFrame(first), second = commit(pending)
  assert.equal(pending.IS,first.IS); assert.equal(second.WAS,first.IS); assert.equal(second.IS,pending.NEXT)
  assert.equal(second.modelAdvanced,false); assert.equal(second.scope,'renderer-addressed-frame')
  assert.deepEqual(plan,cycle.plan)
})

test('missing, failed, stale, corrupt or mismatched evidence never promotes NEXT or loses IS', () => {
  const initial = commit(start()), cycle = proposeNextEIAnimationFrame(initial), actual = rendered(cycle)
  const variants: (EIAnimationReadback|null)[] = [null, {...actual,failure:'surface disconnected'},
    {...actual,generation:'old-run'}, {...actual,sequence:actual.sequence-1}, {...actual,frameKey:'other'},
    {...actual,source:{...actual.source,revision:999}}, {...actual,source:{...actual.source,snapshotKey:'other'}},
    {...actual,content:{...actual.content as EIAnimationTraceContent,nodes:[]}},
    {...actual,content:{...actual.content as EIAnimationTraceContent,edges:(actual.content as EIAnimationTraceContent).edges.map((e,i)=>i ? e : {...e,fraction:NaN})}}]
  for (const readback of variants) {
    const receipt = verifyEIAnimationReadback(cycle,readback), rejected = commitEIAnimationFrame(cycle,receipt)
    assert.equal(receipt.verified,false); assert.equal(rejected.IS,initial.IS); assert.equal(rejected.WAS,initial.WAS)
    assert.equal(rejected.NEXT,cycle.NEXT); assert.equal(rejected.cursor,cycle.cursor)
    assert.deepEqual(rejected.history,initial.history); assert.ok(rejected.openReasons.length)
  }
  assert.equal(commitEIAnimationFrame(cycle,null).IS,initial.IS)
  assert.equal(commitEIAnimationFrame(cycle,{...verifyEIAnimationReadback(cycle,null),verified:true}).IS,initial.IS)
  const good = verifyEIAnimationReadback(cycle,actual)
  assert.equal(commitEIAnimationFrame(cycle,{...good,actualFingerprint:'forged'}).IS,initial.IS)
})

test('duplicate receipts are idempotent and a replay generation rejects old pending evidence', () => {
  const first = start(), old = verifyEIAnimationReadback(first,rendered(first)), current = commitEIAnimationFrame(first,old)
  assert.equal(commitEIAnimationFrame(current,old),current)
  const pending = proposeNextEIAnimationFrame(current), late = verifyEIAnimationReadback(pending,rendered(pending))
  const replay = proposeNextEIAnimationFrame(replayEIAnimationCycle(pending,'run:2'))
  assert.equal(replay.IS,current.IS); assert.deepEqual(replay.history,current.history)
  assert.equal(commitEIAnimationFrame(replay,late).IS,current.IS)
  assert.equal(commitEIAnimationFrame(replay,old),replay)
  assert.throws(()=>replayEIAnimationCycle(replay,'run:1'))
  const resumed = commit(replay)
  assert.equal(resumed.IS!.generation,'run:2'); assert.equal(resumed.WAS,current.IS)
})

test('finite source-derived stages terminate with backlinks and preserve all actual trace on replay', () => {
  const before = JSON.stringify(plan), done = finish(start())
  assert.equal(done.complete,true); assert.equal(done.NEXT,null); assert.equal(proposeNextEIAnimationFrame(done),done)
  assert.deepEqual(done.phases,[0,2,4,6]); assert.equal(done.history.length,done.phases.length)
  assert.deepEqual(done.retained.nodes,['child','elsewhere','leaf','root']); assert.deepEqual(done.retained.edges,['a','b','c'])
  const replay = proposeNextEIAnimationFrame(replayEIAnimationCycle(done,'run:2'))
  assert.ok(replay.NEXT!.traceContent.nodes.every(node=>node.visible)); assert.ok(replay.NEXT!.traceContent.edges.every(e=>e.retained&&e.visible))
  assert.deepEqual(finish(replay).retained,done.retained); assert.equal(JSON.stringify(plan),before)
  assert.ok(done.history.every(frame=>frame.traceContent.nodes.every(node=>node.revision===3)))
})

test('pause/resume has the same state outcome and pure cycles cannot mutate external inputs', () => {
  let cycle = start()
  cycle = commit(cycle); cycle = proposeNextEIAnimationFrame(cycle)
  const paused = JSON.stringify(cycle), readback = rendered(cycle), receipt = verifyEIAnimationReadback(cycle,readback)
  ;((readback.content as EIAnimationTraceContent).nodes as unknown as {address:string}[])[0].address='changed-after-read'
  assert.equal(JSON.stringify(cycle),paused); assert.ok(Object.isFrozen(cycle)); assert.ok(Object.isFrozen(cycle.plan.nodes[0]))
  assert.ok(Object.isFrozen((receipt.readback!.content as EIAnimationTraceContent).nodes[0]))
  const resumed = finish(commitEIAnimationFrame(cycle,receipt)), uninterrupted = finish(start())
  assert.deepEqual(resumed,uninterrupted)
})

test('initial selection is still only NEXT; source receipt and partial Boolean cannot imply completion', () => {
  const cycle = proposeNextEIAnimationFrame(createEIAnimationCycle(plan,{generation:'skip',initialPhase:plan.lastStage+1}))
  assert.equal(cycle.complete,false); assert.equal(cycle.IS,null); assert.equal(commit(cycle).complete,true)
  assert.throws(()=>createEIAnimationCycle(plan,{generation:''})); assert.throws(()=>createEIAnimationCycle(plan,{generation:'a',initialPhase:NaN}))
  assert.notEqual(createEIAnimationCycle({...plan, nodes:plan.nodes.map((node,i)=>i?node:{...node,revision:4})},{generation:'a'}).source.snapshotKey,cycle.source.snapshotKey)
})


test('source-composed SVG witness is checked byte-for-byte instead of trusting a passed flag', () => {
  const witness = (phase: number) => JSON.stringify({nodes:[{address:'root',revision:3,transform:'translate(12 23)',opacity:1}],
    edges:[{id:'a',x1:12,y1:23,x2:phase>=2?45:12,y2:phase>=2?67:23}]})
  const cycle = proposeNextEIAnimationFrame(createEIAnimationCycle(plan,{generation:'geometry'}),witness)
  assert.equal(typeof cycle.NEXT!.content,'string')
  assert.equal(cycle.NEXT!.content,witness(0))
  const actual = rendered(cycle), wrongGeometry = {...actual,content:(actual.content as string).replace('12 23','999 23')}
  const failed = verifyEIAnimationReadback(cycle,wrongGeometry)
  assert.equal(failed.verified,false)
  assert.equal(commitEIAnimationFrame(cycle,{...failed,verified:true}).IS,null)
  const good = verifyEIAnimationReadback(cycle,actual), done = commitEIAnimationFrame(cycle,good)
  assert.equal(done.IS,cycle.NEXT); assert.deepEqual(done.receipts,[good])
  assert.equal(done.receipts[0].readback!.content,witness(0))
  assert.deepEqual(done.retained.nodes,['root'])
})

test('all retained metadata and trace are copied while disconnected and unknown sources stay explicit', () => {
  const mutable = structuredClone(plan), cycle = createEIAnimationCycle(mutable,{generation:'copy'})
  mutable.nodes[0].sourceId='altered'; mutable.edges[0].sourceRevision=800
  assert.notEqual(cycle.plan.nodes[0].sourceId,'altered'); assert.notEqual(cycle.plan.edges[0].sourceRevision,800)
  const isolated = createEIThreadDrawPlan(nodes,[edge('unknown','root','absent'),edge('separate','elsewhere','elsewhere')],'root')
  const done = finish(proposeNextEIAnimationFrame(createEIAnimationCycle(isolated,{generation:'unknown'})))
  assert.deepEqual(done.plan.unknownEndpoints,['absent']); assert.ok(done.plan.unreachableAddresses.includes('elsewhere'))
  assert.ok(!done.IS!.traceContent.edges.some(e=>e.id==='unknown')); assert.ok(!done.retained.edges.includes('unknown'))
  assert.ok(done.retained.edges.includes('separate')); assert.equal(done.IS!.traceContent.edges[0].status,'unreachable')
})


test('IS retains its verified presentation inputs while only future proposals inherit new trace', () => {
  let cycle = start()
  while (cycle.NEXT!.phase < 2) cycle = proposeNextEIAnimationFrame(commit(cycle))
  assert.ok(!cycle.NEXT!.retained.edges.includes('a'))
  const committed = commit(cycle)
  assert.ok(committed.retained.edges.includes('a'))
  assert.ok(!committed.IS!.retained.edges.includes('a'))
  assert.equal(committed.IS!.traceContent.edges.find(edge=>edge.id==='a')!.retained,false)
  const next = proposeNextEIAnimationFrame(committed)
  assert.ok(next.NEXT!.retained.edges.includes('a'))
  assert.equal(next.NEXT!.traceContent.edges.find(edge=>edge.id==='a')!.retained,true)
})


test('source rebase preserves actual frame and receipt history while rejecting pending old-source evidence', () => {
  let cycle = start()
  while (cycle.NEXT!.phase < 4) cycle = proposeNextEIAnimationFrame(commit(cycle))
  const late = verifyEIAnimationReadback(cycle,rendered(cycle))
  const newPlan = createEIThreadDrawPlan(nodes,plan.edges,'child')
  const rebased = rebaseEIAnimationCycle(cycle,newPlan,{generation:'source:child',snapshotKey:'new-snapshot'})
  assert.equal(rebased.source.entityAddress,'child'); assert.equal(rebased.source.snapshotKey,'new-snapshot')
  assert.equal(rebased.NEXT,null); assert.equal(rebased.cursor,0); assert.equal(rebased.complete,false)
  assert.equal(rebased.IS,cycle.IS); assert.equal(rebased.IS!.source.entityAddress,'root'); assert.equal(rebased.WAS,cycle.WAS)
  assert.equal(rebased.history,cycle.history); assert.equal(rebased.receipts,cycle.receipts)
  assert.deepEqual(rebased.retained,cycle.retained)
  const pending = proposeNextEIAnimationFrame(rebased), rejected = commitEIAnimationFrame(pending,late)
  assert.equal(rejected.IS,cycle.IS); assert.equal(rejected.NEXT,pending.NEXT); assert.deepEqual(rejected.history,cycle.history)
  const next = commit(pending)
  assert.equal(next.IS!.source.entityAddress,'child'); assert.equal(next.WAS,cycle.IS)
  assert.equal(next.history.length,cycle.history.length+1); assert.equal(next.receipts.length,cycle.receipts.length+1)
  assert.throws(()=>rebaseEIAnimationCycle(next,plan,{generation:'run:1'}))
})

test('new or changed source identities cannot inherit prior trace merely by reusing an address or occurrence ID', () => {
  const completed = finish(start())
  const modifiedNodes = nodes.map(node=>node.address==='child'?{...node,revision:4}:node.address==='elsewhere'?{...node,sourceId:'replacement'}:node)
  const modifiedEdges = plan.edges.map(edge=>edge.id==='c'?{...edge,sourceId:'replacement-edge'}:edge)
  const rebased = rebaseEIAnimationCycle(completed,createEIThreadDrawPlan(modifiedNodes,modifiedEdges,'root'),{generation:'replacement'})
  assert.deepEqual(rebased.retained.nodes,['leaf','root'])
  assert.deepEqual(rebased.retained.edges,[]) // incident endpoints changed for a/b; source changed for c
  assert.equal(rebased.history,completed.history); assert.equal(rebased.receipts,completed.receipts)
  assert.deepEqual(completed.retained.nodes,['child','elsewhere','leaf','root']); assert.deepEqual(completed.retained.edges,['a','b','c'])
  const proposed = proposeNextEIAnimationFrame(rebased)
  assert.equal(proposed.NEXT!.traceContent.nodes.find(node=>node.address==='child')!.visible,false)
  assert.equal(proposed.NEXT!.traceContent.nodes.find(node=>node.address==='elsewhere')!.visible,false)
  assert.ok(proposed.NEXT!.traceContent.edges.every(edge=>!edge.retained))
})

test('added plan incidence receives a new proposal while unchanged source-bound trace survives', () => {
  const completed = finish(start())
  const expanded = createEIThreadDrawPlan([...nodes,{address:'new-leaf',revision:0,sourceId:'source:new-leaf'}],
    [...plan.edges,edge('new-edge','leaf','new-leaf')],'root')
  const rebased = rebaseEIAnimationCycle(completed,expanded,{generation:'expanded'})
  assert.deepEqual(rebased.retained,completed.retained)
  assert.ok(!rebased.retained.nodes.includes('new-leaf')); assert.ok(!rebased.retained.edges.includes('new-edge'))
  const proposed = proposeNextEIAnimationFrame(rebased)
  assert.equal(proposed.IS,completed.IS); assert.notEqual(proposed.NEXT!.source.snapshotKey,completed.IS!.source.snapshotKey)
  const done = finish(proposed)
  assert.ok(done.retained.nodes.includes('new-leaf')); assert.ok(done.retained.edges.includes('new-edge'))
  assert.equal(done.history.length,completed.history.length+done.phases.length)
})


test('every scheduled source projection differs without invisible thread-start states', () => {
  const cycle = createEIAnimationCycle(plan,{generation:'difference'})
  assert.deepEqual(cycle.phases,[0,2,4,6])
  const fingerprints = cycle.phases.map(phase=>fingerprintEIAnimationContent(projectEIAnimationContent(plan,phase,{nodes:[],edges:[]})))
  for (let index=1;index<fingerprints.length;index++) assert.notEqual(fingerprints[index],fingerprints[index-1])
  const done = finish(proposeNextEIAnimationFrame(cycle))
  for (let index=1;index<done.history.length;index++) assert.notEqual(done.history[index].contentFingerprint,done.history[index-1].contentFingerprint)
  assert.equal(cycle.phases.at(-1),plan.lastStage+1)
})

test('equivalent terminal boundaries collapse without inventing a second source-only state', () => {
  const singleton = createEIThreadDrawPlan([nodes[0]],[],'root')
  const cycle = createEIAnimationCycle(singleton,{generation:'single'})
  assert.deepEqual(cycle.phases,[singleton.lastStage+1])
  const done = finish(proposeNextEIAnimationFrame(cycle))
  assert.equal(done.history.length,1); assert.equal(done.IS!.traceContent.nodes[0].visible,true)
  assert.equal(done.WAS,null); assert.equal(done.complete,true)
  const chain = createEIThreadDrawPlan(nodes.slice(0,2),[edge('a','root','child')],'root')
  const chainCycle = createEIAnimationCycle(chain,{generation:'chain'})
  assert.deepEqual(chainCycle.phases,[0,chain.lastStage+1])
  assert.equal(chainCycle.phases.at(-1),chain.lastStage+1)
  const chainDone = finish(proposeNextEIAnimationFrame(chainCycle))
  assert.ok(chainDone.IS!.traceContent.nodes.every(node=>node.visible))
  assert.equal(chainDone.IS!.traceContent.edges[0].fraction,1)
})


test('compact fingerprints cannot admit an actual content collision', () => {
  const expected = 'c610e1b81031b9b7', collision = 'f255369ed3f3ad65'
  assert.equal(fingerprintEIAnimationContent(expected),fingerprintEIAnimationContent(collision))
  const cycle = proposeNextEIAnimationFrame(createEIAnimationCycle(plan,{generation:'collision'}),()=>expected)
  const wrong = {...rendered(cycle),content:collision}, receipt = verifyEIAnimationReadback(cycle,wrong)
  assert.equal(receipt.actualFingerprint,receipt.expectedFingerprint)
  assert.equal(receipt.verified,false); assert.equal(commitEIAnimationFrame(cycle,receipt).IS,null)
  assert.ok(cycle.NEXT!.contentFingerprint.length<40)
})

test('normalized storage shares large witness strings and grows linearly across replay history', () => {
  const witness = (phase: number) => `<svg data-phase="${phase}">${'geometry-source-'.repeat(6000)}</svg>`
  const consume = (input: EIAnimationCycle) => {
    let cycle = input
    while(!cycle.complete) cycle = commit(proposeNextEIAnimationFrame(cycle,witness))
    return cycle
  }
  let cycle = consume(createEIAnimationCycle(plan,{generation:'storage:0'}))
  const first = exportEIAnimationCycle(cycle), lengths=[first.length]
  for(let index=1;index<=8;index++) {
    cycle = consume(replayEIAnimationCycle(cycle,`storage:${index}`))
    lengths.push(exportEIAnimationCycle(cycle).length)
  }
  const serialized = exportEIAnimationCycle(cycle), table = JSON.parse(serialized).values
  for(const phase of cycle.phases) assert.equal(table.filter((value: unknown)=>value===witness(phase)).length,1)
  assert.ok(lengths.at(-1)!<first.length*1.3)
  const increments=lengths.slice(2).map((length,index)=>length-lengths[index+1])
  assert.ok(Math.max(...increments)<Math.min(...increments)*1.5)
  assert.ok(cycle.history.every(frame=>frame.frameKey.length<200&&frame.contentFingerprint.length<40))
  assert.ok(cycle.receipts.every(receipt=>receipt.receiptId.length<240&&!receipt.receiptId.includes('<svg')))
  const restored = restoreEIAnimationCycle(serialized,{generation:'restored'})
  assert.deepEqual(restored.history,cycle.history); assert.deepEqual(restored.receipts,cycle.receipts)
  assert.deepEqual(restored.source,cycle.source); assert.deepEqual(restored.plan,cycle.plan)
  assert.equal(restored.IS,restored.history.at(-1)); assert.equal(restored.WAS,restored.history.at(-2))
  assert.equal(restored.NEXT,null); assert.equal(restored.complete,false)
  assert.ok(restored.openReasons.length); assert.ok(Object.isFrozen(restored.history[0].source))
})

test('corrupt or oversized snapshots fail without replacing the old source/history', () => {
  const cycle=finish(start()), before=JSON.stringify(cycle)
  let saved=exportEIAnimationCycle(cycle)
  const original=saved
  assert.throws(()=>{saved=exportEIAnimationCycle(cycle,{maxBytes:20})},/exceeds/)
  assert.equal(saved,original); assert.equal(JSON.stringify(cycle),before)
  assert.throws(()=>restoreEIAnimationCycle(saved,{generation:'restore',maxBytes:20}),/exceeds/)
  const corrupt=JSON.parse(saved)
  const checksumIndex=corrupt.values.findIndex((value:unknown)=>typeof value==='string'&&value.startsWith('ei1:'))
  corrupt.values[checksumIndex]='ei1:corrupted:0'
  assert.throws(()=>restoreEIAnimationCycle(JSON.stringify(corrupt),{generation:'restore'}),/checksum/)
  const cyclic=JSON.parse(saved)
  cyclic.values[0]={type:'array',items:[0]}
  assert.throws(()=>restoreEIAnimationCycle(JSON.stringify(cyclic),{generation:'restore'}),/cyclic reference/)
  assert.throws(()=>restoreEIAnimationCycle(saved,{generation:'run:1'}),/unused generation/)
  assert.throws(()=>restoreEIAnimationCycle('not JSON',{generation:'restore'}))
})

test('restored history needs fresh readback and can continue with new source input', () => {
  let cycle=commit(start())
  cycle=proposeNextEIAnimationFrame(cycle)
  const oldReceipt=verifyEIAnimationReadback(cycle,rendered(cycle))
  const restored=restoreEIAnimationCycle(exportEIAnimationCycle(cycle),{generation:'resume'})
  assert.equal(restored.NEXT,null); assert.equal(restored.IS!.frameKey,cycle.IS!.frameKey)
  const pending=proposeNextEIAnimationFrame(restored)
  assert.equal(commitEIAnimationFrame(pending,oldReceipt).IS,pending.IS)
  const resumed=commit(pending)
  assert.equal(resumed.IS!.generation,'resume'); assert.deepEqual(resumed.WAS,cycle.IS)
  const changed=createEIThreadDrawPlan([...nodes,{address:'new',revision:0,sourceId:'new-source'}],
    [...plan.edges,edge('new-edge','leaf','new')],'child')
  const rebased=rebaseEIAnimationCycle(resumed,changed,{generation:'new-source-run',snapshotKey:'explicit-source-snapshot'})
  const done=finish(proposeNextEIAnimationFrame(rebased))
  const again=restoreEIAnimationCycle(exportEIAnimationCycle(done),{generation:'second-restore'})
  assert.deepEqual(again.history,done.history); assert.deepEqual(again.receipts,done.receipts)
  assert.equal(again.source.entityAddress,'child'); assert.equal(again.source.snapshotKey,'explicit-source-snapshot')
  assert.ok(again.retained.nodes.includes('new'))
})


test('normalized snapshots preserve every original source plan across rebasing, including undrawn incidence', () => {
  const original = createEIThreadDrawPlan(nodes,[...plan.edges,edge('unbound','root','unknown-source')],'root')
  const first = finish(proposeNextEIAnimationFrame(createEIAnimationCycle(original,{generation:'original',snapshotKey:'original-key'})))
  const nextPlan = createEIThreadDrawPlan(nodes.slice(0,2),[edge('a','root','child')],'child')
  const second = finish(proposeNextEIAnimationFrame(rebaseEIAnimationCycle(first,nextPlan,{generation:'rebase',snapshotKey:'second-key'})))
  const restored = restoreEIAnimationCycle(exportEIAnimationCycle(second),{generation:'restored'})
  assert.equal(restored.sourceSnapshots.length,2)
  assert.deepEqual(restored.sourceSnapshots[0].plan,original)
  assert.ok(restored.sourceSnapshots[0].plan.edges.some(edge=>edge.id==='unbound'&&edge.to==='unknown-source'))
  assert.deepEqual(restored.sourceSnapshots[1].plan,nextPlan)
  const changed = createEIThreadDrawPlan([...nodes,{address:'added',revision:0,sourceId:'added'}],plan.edges,'root')
  assert.throws(()=>rebaseEIAnimationCycle(first,changed,{generation:'conflict',snapshotKey:'original-key'}),/snapshot key/)
  assert.equal(first.sourceSnapshots.length,1)
})
