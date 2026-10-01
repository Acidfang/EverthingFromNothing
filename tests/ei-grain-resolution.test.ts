import test from 'node:test'
import assert from 'node:assert/strict'
import { createEILedger, exportEILedger, proposeEI, advanceEI, executeEI } from '../src/model/ei-engine.ts'
import { createEIGrainRegistry, projectEIGrain, EI_GRAINS, type EIGrainHandle } from '../src/model/ei-grain-identity.ts'
import { resolveEIGrainRelations } from '../src/model/ei-grain-resolution.ts'
import { verifyEIQueryAnswer } from '../src/model/ei-relation-reasoner.ts'

const source = (id: string, text: string) => ({id, text, realm: 'synthetic-test'})
function seed() { return createEILedger({records: [
  {address: 'root', value: 'whole', source: source('s0','whole')},
  {address: 'a', value: '0', source: source('s1','0'), parents: ['root'], relations: [{relation:'retained-link',address:'b'}]},
  {address: 'b', value: '1', source: source('s2','1'), parents: ['root']},
]}) }

test('read, context, trace, compare and follow resolve identically through all five grains', async () => {
  const ledger = seed(), registry = createEIGrainRegistry(ledger), before = exportEILedger(ledger)
  const baseline = new Map<string,string>()
  for (const grain of EI_GRAINS) {
    const target = projectEIGrain(registry,'a',grain), other = projectEIGrain(registry,'b',grain)
    const operations = [
      {kind:'read',target}, {kind:'context',target}, {kind:'trace',target},
      {kind:'compare',target,other}, {kind:'follow',target,relations:['retained-link']},
    ] as const
    for (const operation of operations) {
      const result = await resolveEIGrainRelations(ledger,operation)
      assert.equal(result.verification.status,'passed')
      const serialized = JSON.stringify(result)
      if (baseline.has(operation.kind)) assert.equal(serialized,baseline.get(operation.kind))
      else baseline.set(operation.kind,serialized)
      if (operation.kind==='compare') assert.equal(result.answer.comparison?.result,'different')
      if (operation.kind==='follow') assert.equal(result.answer.matches[0].address,'b')
      if (operation.kind==='context') assert.equal(result.answer.context?.incident[0].edge.relation,'retained-link')
    }
  }
  assert.equal(exportEILedger(ledger),before)
})

test('relation direction and missing links remain explicit; absence is not false', async () => {
  const ledger=seed(), registry=createEIGrainRegistry(ledger)
  const result=await resolveEIGrainRelations(ledger,{kind:'follow',target:projectEIGrain(registry,'b','pixel'),relations:['retained-link']})
  assert.equal(result.answer.matches.length,0)
  assert.ok(result.answer.unknowns.length || result.answer.gaps.length)
  assert.notEqual(result.status,'resolved')
})

test('stale, copied, historical and proposed operands cannot silently resolve current IS', async () => {
  const ledger=seed(), registry=createEIGrainRegistry(ledger), target=projectEIGrain(registry,'a','node')
  await assert.rejects(resolveEIGrainRelations(ledger,{kind:'read',target:{...target} as EIGrainHandle}),/unissued-handle/)
  const s=source('change','2')
  const proposal=proposeEI(ledger,{id:'change',producer:'a',input:s,candidates:[{id:'one',label:'test',owner:'engine',source:s,conditions:[],patches:[{address:'a',value:'2',source:s}]}]})
  const execution=executeEI(ledger,proposal)
  assert.equal(execution.status,'staged');if(execution.status!=='staged')throw Error('expected staged')
  const proposed=projectEIGrain(createEIGrainRegistry(ledger,execution),'a','pixel')
  await assert.rejects(resolveEIGrainRelations(ledger,{kind:'read',target:proposed}),/proposed-operation-target/)
  const next=advanceEI(ledger,proposal).ledger
  await assert.rejects(resolveEIGrainRelations(next,{kind:'read',target}),/stale-snapshot/)
  const historical=projectEIGrain(createEIGrainRegistry(next),'a','coordinate',0)
  await assert.rejects(resolveEIGrainRelations(next,{kind:'compare',target:projectEIGrain(createEIGrainRegistry(next),'b','state'),other:historical}),/historical-operation-target/)
})

test('result verification rejects altered comparison while original source remains intact', async () => {
  const ledger=seed(), registry=createEIGrainRegistry(ledger)
  const result=await resolveEIGrainRelations(ledger,{kind:'compare',target:projectEIGrain(registry,'a','state'),other:projectEIGrain(registry,'b','state')})
  const altered=structuredClone(result.answer)
  Object.assign(altered.comparison!,{result:'equal'})
  assert.equal((await verifyEIQueryAnswer(ledger,result.query,altered)).status,'failed')
})
