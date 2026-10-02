import type {MediaSource} from './ei-phone-media.ts'
import {sameEIMediaDescriptor} from './ei-media-retention.ts'
export type MediaDiscardChoice=Readonly<{source:MediaSource;description:string}>
export function chooseMediaDiscard(source:MediaSource):MediaDiscardChoice{return Object.freeze({source,description:source.retainedOriginal?'retained original':'derived frame'})}
/** Only the separate user confirmation resolves the exact currently available
 * native object into delete parameters. Ledger records are never touched. */
export function confirmMediaDiscard(choice:MediaDiscardChoice|null,sources:readonly MediaSource[]){
 if(!choice)throw new Error('Choose a source before confirming removal')
 const current=sources.find(source=>source.id===choice.source.id)
 if(!current||!sameEIMediaDescriptor(current,choice.source))throw new Error('Native source changed; choose it again')
 return Object.freeze({scope:{address:current.address,revision:current.revision},params:{sourceId:current.id,sourceSha256:current.sha256,confirm:'delete-original' as const}})
}
