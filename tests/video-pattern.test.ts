import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {deriveVideoPattern} from '../src/model/video-pattern.ts'
const map=JSON.parse(readFileSync(new URL('../docs/FRACTURE-FIELD-INVENTORY.json',import.meta.url),'utf8'))
test('video is an added pattern at existing scene; map and containers unchanged',()=>{const before=JSON.stringify(map),frames=deriveVideoPattern(map);assert.equal(JSON.stringify(map),before);assert.equal(frames.length,8);frames.forEach((f,i)=>{assert.equal(f.act,i);assert.equal(f.state.worldActChanged,false);assert.equal(f.state.binding.containerId,'scene');assert.equal(f.state.binding.containerLocator,map.entries.find((e:{id:string})=>e.id==='scene').inventory_binary_address);assert.deepEqual(f.state.entry,map.entries.find((e:{id:string})=>e.id===f.input.focusId));assert.deepEqual(f.state.parents.map(p=>p.id),f.state.entry.parents)})})
test('source pattern replay is deterministic and missing target fails instead of inventing a container',()=>{assert.deepEqual(deriveVideoPattern(map),deriveVideoPattern(map));const missing=structuredClone(map);missing.binary_relation_order.nodes=missing.binary_relation_order.nodes.filter((n:{id:string})=>n.id!=='scene');assert.throws(()=>deriveVideoPattern(missing),/must already exist/)})
