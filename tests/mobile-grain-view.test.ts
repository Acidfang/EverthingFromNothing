import test from 'node:test'
import assert from 'node:assert/strict'
import {mobileFractureGrain} from '../src/model/mobile-fracture.ts'
import {mobileGrainView,readMobileGrainRoute} from '../src/model/mobile-grain-view.ts'
import {EI_GRAINS} from '../src/model/ei-grain-identity.ts'
test('every grain retains the same issued state and parent while presenting its relevant relation',()=>{
 const root='USER/example',address=`${root}::T2:IS`,ledger=mobileFractureGrain(address,[root]),before=JSON.stringify(ledger)
 const views=EI_GRAINS.map(grain=>mobileGrainView(ledger,address,grain))
 for(const view of views){assert.equal(view.reference.address,address);assert.equal(view.reference.sourceId,'derived-tip-state');assert.deepEqual(view.parents,[root]);assert.equal(view.children.length,9);assert.equal(view.coordinate.physicalMapping,null)}
 assert.equal(views.find(view=>view.grain==='state')!.label,"won't be · IS")
 assert.equal(views.find(view=>view.grain==='address')!.label,address)
 assert.equal(views.find(view=>view.grain==='coordinate')!.coordinate.zero,root)
 assert.equal(JSON.stringify(ledger),before)
})
test('reload restores grain and complete parent route, rejecting unrelated or invalid branches',()=>{
 const root='USER/example',route=[root,`${root}::T1:IS`,`${root}::T1:IS::T3:NEXT`]
 for(const grain of EI_GRAINS){const restored=readMobileGrainRoute(new URLSearchParams({root,grain,route:JSON.stringify(route)}));assert.equal(restored.grain,grain);assert.deepEqual(restored.route,route)}
 for(const invalid of [[root,'OTHER/root'],[root,`${root}::T4:IS`]])assert.deepEqual(readMobileGrainRoute(new URLSearchParams({root,grain:'pixel',route:JSON.stringify(invalid)})).route,[root])
 const legacy=readMobileGrainRoute(new URLSearchParams({root,grain:'coordinate',route:JSON.stringify([root,`${root}::T1:IS`,`${root}::T1:IS::T3:-Z`])}))
 assert.deepEqual(legacy.route,[root,`${root}::T1:IS`]);assert.match(legacy.routeDifference!,/direction operator in this view/)
 assert.equal(readMobileGrainRoute(new URLSearchParams({grain:'invented'})).grain,'node')
})

test('IS is retained at the fourth tip and shared centre without duplicating its identity',()=>{const address='USER/example',view=mobileGrainView(mobileFractureGrain(address),address,'node');assert.equal(view.tripleTetrahedron.isPositions.centre.address,address);assert.equal(view.tripleTetrahedron.isPositions.tip.address,address);assert.equal(view.tripleTetrahedron.isPositions.tip.vertex,3);assert.equal(view.tripleTetrahedron.isPositions.centre.role,'IS');assert.equal(view.tripleTetrahedron.isPositions.tip.role,'IS NEXT');assert.equal(view.tripleTetrahedron.isPositions.previousTip.role,'WAS NEXT');assert.equal(view.tripleTetrahedron.isPositions.previousTip.previousRole,'IS NEXT');assert.equal(view.tripleTetrahedron.isPositions.previousTip.address,null)})

test('retrospective alternatives preserve the source without substituting possibility for occurrence',()=>{const root='USER/example',ledger=mobileFractureGrain(root),before=JSON.stringify(ledger);for(const grain of EI_GRAINS){const view=mobileGrainView(ledger,root,grain);assert.equal(view.retrospective.sourceAddress,root);assert.equal(view.retrospective.sourceState.address,root);assert.deepEqual(view.retrospective.paths.map(path=>path.role),['DID','COULD HAVE','WOULD HAVE']);assert.ok(view.retrospective.paths.every(path=>path.status.endsWith('unresolved')))}assert.equal(JSON.stringify(ledger),before)})
