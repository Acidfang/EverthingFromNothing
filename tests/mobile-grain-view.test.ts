import test from 'node:test'
import assert from 'node:assert/strict'
import {mobileFractureGrain} from '../src/model/mobile-fracture.ts'
import {mobileGrainView,readMobileGrainRoute} from '../src/model/mobile-grain-view.ts'
import {EI_GRAINS} from '../src/model/ei-grain-identity.ts'
test('every grain retains the same issued state and parent while presenting its relevant relation',()=>{
 const root='USER/example',address=`${root}::T2:+X`,ledger=mobileFractureGrain(address,[root]),before=JSON.stringify(ledger)
 const views=EI_GRAINS.map(grain=>mobileGrainView(ledger,address,grain))
 for(const view of views){assert.equal(view.reference.address,address);assert.equal(view.reference.sourceId,'retained-zero');assert.deepEqual(view.parents,[root]);assert.equal(view.children.length,30);assert.equal(view.coordinate.physicalMapping,null)}
 assert.equal(views.find(view=>view.grain==='state')!.label,'IS r0: Local zero')
 assert.equal(views.find(view=>view.grain==='address')!.label,address)
 assert.equal(views.find(view=>view.grain==='coordinate')!.coordinate.zero,root)
 assert.equal(JSON.stringify(ledger),before)
})
test('reload restores grain and complete parent route, rejecting unrelated or invalid branches',()=>{
 const root='USER/example',route=[root,`${root}::T1:IS`,`${root}::T1:IS::T3:-Z`]
 for(const grain of EI_GRAINS){const restored=readMobileGrainRoute(new URLSearchParams({root,grain,route:JSON.stringify(route)}));assert.equal(restored.grain,grain);assert.deepEqual(restored.route,route)}
 for(const invalid of [[root,'OTHER/root'],[root,`${root}::T4:IS`],[root,`${root}::T1:IS`,`OTHER::T3:-Z`]])assert.deepEqual(readMobileGrainRoute(new URLSearchParams({root,grain:'pixel',route:JSON.stringify(invalid)})).route,[root])
 assert.equal(readMobileGrainRoute(new URLSearchParams({grain:'invented'})).grain,'node')
})
