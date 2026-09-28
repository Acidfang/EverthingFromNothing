import { ROOT_ADDRESS, addressKey, type Address, type AddressedState } from "./addressEngine"
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
  const key=addressKey(address)
  const entry=ledger.get(key)
  if(!entry)throw new Error(`unknown address ${key}`)
  const receipt=transition(entry.addressed.state)
  const nextEntry:LedgerEntry=Object.freeze({
    addressed:Object.freeze({...entry.addressed,state:receipt.after}),
    receipts:Object.freeze([...entry.receipts,receipt]),
  })
  const next=new Map(ledger)
  next.set(key,nextEntry)
  return next
}

export function verifyRootLedger():string[]{
  const differences:string[]=[]
  const initial=createRootLedger()
  if(initial.size!==1)differences.push("root-ledger-size")
  const root=initial.get("ZERO")
  if(!root)differences.push("root-address")
  const advanced=advanceAt(initial,ROOT_ADDRESS)
  const after=advanced.get("ZERO")
  if(!after||after.receipts.length!==1)differences.push("root-receipt")
  if(initial.get("ZERO")?.receipts.length!==0)differences.push("ledger-mutation")
  if(advanced.size!==1)differences.push("must-not-spawn-without-rule")
  return differences
}
