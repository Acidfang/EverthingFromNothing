import type {MediaAction,MediaOperation} from './ei-phone-media.ts'
type Scope={address:string;revision:number}
export const mediaActionBinding=(op:MediaOperation,params:Readonly<Record<string,string>>,scope:Scope)=>JSON.stringify([op,scope.address,scope.revision,Object.entries(params).sort(([a],[b])=>a.localeCompare(b))])
export function matchesMediaActionReturn(action:MediaAction|null|undefined,issued:ReadonlyMap<string,string>,op:MediaOperation,params:Readonly<Record<string,string>>,scope:Scope){return !!action&&action.state==='returned'&&action.op===op&&action.address===scope.address&&action.revision===scope.revision&&issued.get(action.requestId)===mediaActionBinding(op,params,scope)}
