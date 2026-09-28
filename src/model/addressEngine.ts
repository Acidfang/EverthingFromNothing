import type { SystemState, TransitionReceipt } from "./transitionEngine"

export type Address = Readonly<{root:"ZERO";path:readonly number[]}>
export type AddressedState = Readonly<{address:Address;state:SystemState;parent:Address|null}>
export type AddressReceipt = Readonly<{address:Address;parent:Address|null;transition:TransitionReceipt|null}>
export const ROOT_ADDRESS:Address=Object.freeze({root:"ZERO",path:Object.freeze([])})
export const addressKey=(address:Address)=>address.path.length===0?address.root:`${address.root}/${address.path.join("/")}`
export function childAddress(parent:Address,branch:number):Address{if(!Number.isInteger(branch)||branch<0)throw new Error("branch must be a non-negative integer");return Object.freeze({root:"ZERO" as const,path:Object.freeze([...parent.path,branch])})}
export function parentAddress(address:Address):Address|null{if(address.path.length===0)return null;return Object.freeze({root:"ZERO" as const,path:Object.freeze(address.path.slice(0,-1))})}
export function sameAddress(a:Address,b:Address):boolean{return addressKey(a)===addressKey(b)}
export function verifyAddressReturn():string[]{const differences:string[]=[],a=childAddress(ROOT_ADDRESS,0),b=childAddress(a,1),backA=parentAddress(b),backRoot=backA&&parentAddress(backA);if(!backA||!sameAddress(backA,a))differences.push("return-child-parent");if(!backRoot||!sameAddress(backRoot,ROOT_ADDRESS))differences.push("return-root");if(parentAddress(ROOT_ADDRESS)!==null)differences.push("root-parent");return differences}
