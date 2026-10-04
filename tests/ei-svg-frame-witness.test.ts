import test from 'node:test'
import assert from 'node:assert/strict'
import {verifyWorldWitness} from '../scripts/verify-world-witness.ts'
test('actual component SVG primitives match independently composed source witness and reject invalid numbers',async()=>{const result=await verifyWorldWitness();assert.equal(result.matched,true);assert.equal(result.invalidNumberRejected,true);assert.equal(result.browserVerified,false)})
