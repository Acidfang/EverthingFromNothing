import { CANONICAL_SEED } from "./canonicalSeed"
import { ROOT_ADDRESS, addressKey, childAddress, type Address, type AddressedState } from "./addressEngine"
import { INITIAL_SYSTEM_STATE, transition, type TransitionReceipt } from "./transitionEngine"

export type LedgerEntry=Readonly<{
  addressed:AddressedState
  receipts:readonly TransitionReceipt[]
}>
export type FieldLedger=ReadonlyMap<string,LedgerEntry>

export function createRootLedger():FieldLedger{
  const root:AddressedState=Object.freeze({address:ROOT_ADDRESS,state:INITIAL_SYSTEM_STATE,parent:null})
  return new Map([[addressKey(ROOT_ADDRESS),Object.freeze({addressed:root,receipts:Object.freeze([])})]])
}

export function advanceAt(ledger:FieldLedger,address:Address):FieldLedger{
  const key=addressKey(address),entry=ledger.get(key)
  if(!entry)throw new Error(`unknown address ${key}`)
  const receipt=transition(entry.addressed.state)
  const next=new Map(ledger)
  next.set(key,Object.freeze({addressed:Object.freeze({...entry.addressed,state:receipt.after}),receipts:Object.freeze([...entry.receipts,receipt])}))
  return next
}

export function fractureAt(ledger:FieldLedger,address:Address):FieldLedger{
  const key=addressKey(address),entry=ledger.get(key)
  if(!entry)throw new Error(`unknown address ${key}`)
  const next=new Map(ledger)
  for(let branch=0;branch<CANONICAL_SEED.fracture.addressedChildren;branch++){
    const child=childAddress(address,branch),childKey=addressKey(child)
    if(next.has(childKey))continue
    const addressed:AddressedState=Object.freeze({address:child,state:entry.addressed.state,parent:address})
    next.set(childKey,Object.freeze({addressed,receipts:Object.freeze([])}))
  }
  return next
}

export function verifyRootLedger():string[]{
  const differences:string[]=[]
  const initial=createRootLedger()
  if(initial.size!==1)differences.push("root-ledger-size")
  const advanced=advanceAt(initial,ROOT_ADDRESS)
  if(advanced.get("ZERO")?.receipts.length!==1)differences.push("root-receipt")
  if(initial.get("ZERO")?.receipts.length!==0)differences.push("ledger-mutation")
  const fractured=fractureAt(advanced,ROOT_ADDRESS)
  if(fractured.size!==1+CANONICAL_SEED.fracture.addressedChildren)differences.push("first-fracture-child-count")
  for(let branch=0;branch<CANONICAL_SEED.fracture.addressedChildren;branch++){
    const child=fractured.get(`ZERO/${branch}`)
    if(!child)differences.push(`missing-child-${branch}`)
    else{
      if(child.addressed.parent!==ROOT_ADDRESS)differences.push(`child-parent-${branch}`)
      if(child.addressed.state!==advanced.get("ZERO")?.addressed.state)differences.push(`child-origin-state-${branch}`)
    }
  }
  const recursive=fractureAt(fractured,childAddress(ROOT_ADDRESS,0))
  if(recursive.size!==fractured.size+CANONICAL_SEED.fracture.addressedChildren)differences.push("recursive-child-array")
  return differences
}
