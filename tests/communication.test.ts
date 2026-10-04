import test from "node:test"
import assert from "node:assert/strict"
import { COMMUNICATION_CHANNELS,COMMUNICATION_STAGES,communicate,cycleTriad,triadComplete } from "../src/model/communication.ts"

const A={participant:"A",address:"A/0",was:"A.WAS",is:"A.IS",next:"A.NEXT"} as const
const B={participant:"B",address:"B/0",was:"B.WAS",is:"B.IS",next:"B.NEXT"} as const

test("every channel has every stage and every stage has a complete WAS IS NEXT triad",()=>{
 for(const channel of COMMUNICATION_CHANNELS){
  const x=communicate({id:`x-${channel}`,source:A,destination:B,channel,expression:"same"})
  assert.equal(x.allTriadsMet,true)
  for(const stage of COMMUNICATION_STAGES){
   assert.equal(triadComplete(x.triads[stage]),true,`${channel} / ${stage} triad incomplete`)
   assert.ok(x.triads[stage].was.includes("/WAS"))
   assert.ok(x.triads[stage].is.includes("/IS:"))
   assert.ok(x.triads[stage].next.includes("/NEXT"))
  }
  assert.equal(x.source,A);assert.equal(x.destination,B);assert.equal(x.difference,false);assert.ok(x.receipt.includes(channel))
 }
})

test("triad cycle retains all three positions without loss",()=>{
 const start={was:"WAS",is:"IS",next:"NEXT"} as const
 const one=cycleTriad(start),two=cycleTriad(one),three=cycleTriad(two)
 assert.deepEqual(one,{was:"IS",is:"NEXT",next:"WAS"})
 assert.deepEqual(two,{was:"NEXT",is:"WAS",next:"IS"})
 assert.deepEqual(three,start)
})

test("reconstruction Difference is explicit without merging participant states",()=>{
 const x=communicate({id:"d",source:A,destination:B,channel:"TEXT",expression:"intent",reconstruction:"other"})
 assert.equal(x.difference,true);assert.notEqual(x.source.address,x.destination.address)
})

test("incomplete participant triad cannot enter communication chain",()=>{
 assert.throws(()=>communicate({id:"bad",source:{...A,next:""},destination:B,channel:"TEXT",expression:"x"}),/participant triads/)
})
