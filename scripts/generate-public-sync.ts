/** Publishes only the repository-authored public inventory, never runtime user state. */
import {mkdir,writeFile,readFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import {createHash} from 'node:crypto'
import {createEIPublicFieldRecords} from '../src/model/ei-public-field.ts'
import {EI_PUBLIC_SYNC,readEIPublicManifest,verifyEIPublicSnapshot} from '../src/model/ei-public-sync.ts'
const release=process.argv[2]
if(!release)throw new Error('Supply the coordinated shared release, for example 0.1.8')
const records=createEIPublicFieldRecords(),payload=JSON.stringify({schema:EI_PUBLIC_SYNC.snapshotSchema,records})+'\n'
const manifest=readEIPublicManifest(JSON.stringify({schema:EI_PUBLIC_SYNC.manifestSchema,release,payloadSha256:createHash('sha256').update(payload).digest('hex'),payloadBytes:Buffer.byteLength(payload),recordCount:records.length,sourceRepository:EI_PUBLIC_SYNC.repository,compatibility:EI_PUBLIC_SYNC.compatibility}))
await verifyEIPublicSnapshot(manifest,payload)
const directory=resolve(import.meta.dirname,'../public/shared-field/v1'),snapshot=resolve(directory,'snapshots',`${manifest.payloadSha256}.json`)
await mkdir(resolve(directory,'snapshots'),{recursive:true})
try{const existing=await readFile(snapshot,'utf8');if(existing!==payload)throw new Error('Immutable snapshot collision')}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;await writeFile(snapshot,payload,{flag:'wx'})}
await writeFile(resolve(directory,'latest.json'),JSON.stringify(manifest,null,2)+'\n')
console.log(JSON.stringify({release:manifest.release,payloadSha256:manifest.payloadSha256,payloadBytes:manifest.payloadBytes,recordCount:manifest.recordCount}))
