import {exportEILedger,importEILedger,proposeEI,type EILedger,type EIProposal} from './ei-engine.ts'
export type EIPageAttempt=Readonly<{transactionId:string;producer:string;phase:'engine'|'render'|'storage';message:string;detail:string;committed:false}>
const limit=1_048_576
export function saveEISession(root:string,ledger:EILedger,pending:EIProposal|null,attempts:readonly EIPageAttempt[]){
  if(!ledger.records.some(record=>record.address===root&&!record.parents.length))throw new Error('Session root is not a retained root address')
  const json=JSON.stringify({format:'ei-page-session/v1',root,ledger:exportEILedger(ledger),pending:pending?.input??null,attempts})
  if(new TextEncoder().encode(json).length>limit)throw new Error('EI session exceeds 1 MiB; retained state was not changed')
  // A successful write must never create a session that our recovery rejects.
  restoreEISession(json)
  return json
}
export function restoreEISession(json:string){
  if(new TextEncoder().encode(json).length>limit)throw new Error('EI session exceeds 1 MiB')
  const value=JSON.parse(json)
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join(',')!=='attempts,format,ledger,pending,root'||value.format!=='ei-page-session/v1'||typeof value.root!=='string'||typeof value.ledger!=='string')throw new Error('Unsupported EI session envelope')
  const ledger=importEILedger(value.ledger)
  if(!ledger.records.some(record=>record.address===value.root&&!record.parents.length))throw new Error('Session root does not match the retained ledger')
  const pending=value.pending===null?null:proposeEI(ledger,value.pending)
  if(!Array.isArray(value.attempts)||value.attempts.length>512)throw new Error('Invalid attempt history')
  const attempts:readonly EIPageAttempt[]=Object.freeze(value.attempts.map((item:unknown)=>{
    if(!item||typeof item!=='object'||Array.isArray(item))throw new Error('Invalid attempt record')
    const a=item as Record<string,unknown>
    if(Object.keys(a).sort().join(',')!=='committed,detail,message,phase,producer,transactionId'||a.committed!==false||!['engine','render','storage'].includes(String(a.phase))||['transactionId','producer','message','detail'].some(key=>typeof a[key]!=='string'))throw new Error('Invalid attempt record')
    if((a.transactionId as string).length>256||(a.producer as string).length>256||(a.message as string).length>8192||(a.detail as string).length>524288)throw new Error('Attempt record exceeds bounds')
    return Object.freeze({...a}) as EIPageAttempt
  }))
  const ids=[...ledger.receipts.map(receipt=>receipt.transactionId),...(pending?[pending.input.id]:[]),...attempts.map(attempt=>attempt.transactionId)]
  const numbers=ids.map(id=>{const n=Number(id.match(/local-proposal\/(\d+)$/)?.[1]??0);if(!Number.isSafeInteger(n)||n>=Number.MAX_SAFE_INTEGER-1)throw new Error('Local proposal sequence exceeds safe bounds');return n})
  const nextSequence=Math.max(0,...numbers)+1
  return Object.freeze({root:value.root as string,ledger,pending,attempts,nextSequence})
}
