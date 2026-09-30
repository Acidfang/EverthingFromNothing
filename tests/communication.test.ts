import test from "node:test"
import assert from "node:assert/strict"
import { COMMUNICATION_CHANNELS,COMMUNICATION_STAGES,communicate } from "../src/model/communication.ts"

const A={participant:"A",address:"A/0",was:"A.WAS",is:"A.IS",next:"A.NEXT"} as const
const B={participant:"B",address:"B/0",was:"B.WAS",is:"B.IS",next:"B.NEXT"} as const

test("every communication channel uses the complete interaction path",()=>{
 assert.deepEqual(COMMUNICATION_STAGES,["SOURCE_STATE","EXPRESSION","CARRIER","OBSERVATION","RECONSTRUCTION","RESPONSE","RECEIPT"])
 for(const channel of COMMUNICATION_CHANNELS){
  const x=communicate({id:`x-${channel}`,source:A,destination:B,channel,expression:"same"})
  assert.equal(x.source,A);assert.equal(x.destination,B);assert.equal(x.difference,false);assert.ok(x.receipt.includes(channel))
 }
})
test("reconstruction Difference is explicit without merging participant states",()=>{
 const x=communicate({id:"d",source:A,destination:B,channel:"TEXT",expression:"intent",reconstruction:"other"})
 assert.equal(x.difference,true);assert.notEqual(x.source.address,x.destination.address)
})
