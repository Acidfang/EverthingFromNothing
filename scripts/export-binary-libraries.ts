/** Reproducible raw instruction artifacts. Hosted lowering remains explicit. */
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {createHash} from 'node:crypto'
import assert from 'node:assert/strict'
import {parseEILedgerSource,compileEILedgerProgram} from '../src/model/ei-ledger-language.ts'
import {encodeEIBits,runEIBinaryProgram} from '../src/model/ei-binary-machine.ts'
const root=resolve(import.meta.dirname,'..'),inventory=JSON.parse(readFileSync(resolve(root,'docs/FRACTURE-FIELD-INVENTORY.json'),'utf8')),clauses=inventory.retained_binary_relations as string[]
const source={recordAddress:'model/inventory-root',sourceId:`public-inventory:${inventory.source_revision}`,revision:0,frameId:'published-retained-clause-audit',text:JSON.stringify(clauses)}
const program=compileEILedgerProgram([parseEILedgerSource(source,{pointers:clauses.map((_,index)=>`/${index}`)})]),directory=resolve(root,'public/mechanism-libraries/v1');mkdirSync(directory,{recursive:true})
const libraries=new Map<string,object>();let replayed=0
for(const evaluation of program.evaluations){const result=evaluation.result,mechanism=result.mechanism!;assert.ok(mechanism);const bytes=Buffer.from(mechanism.library.bytes),sha256=createHash('sha256').update(bytes).digest('hex'),file=`${sha256}.bin`;writeFileSync(resolve(directory,file),bytes)
 const restored=[...readFileSync(resolve(directory,file))],witnesses=[...result.identityWitnesses,...result.differenceWitnesses].map(witness=>({tag:witness.relation==='≡'?1:2,left:encodeEIBits(witness.left),right:encodeEIBits(witness.right)})),execution=runEIBinaryProgram(restored,witnesses,[encodeEIBits(result.query.left),encodeEIBits(result.query.right)])
 assert.deepEqual(execution,mechanism.execution);replayed++;libraries.set(sha256,{file,sha256,bytes:bytes.length,source:mechanism.library.source,instructionOrigins:mechanism.library.origins,bootstrap:mechanism.library.bootstrap,selfHosted:false})
}
const manifest={schema:'ei.binary-library-artifacts.v1',source:{recordAddress:source.recordAddress,sourceId:source.sourceId,revision:source.revision,textUtf16Sha256:createHash('sha256').update(Buffer.from(encodeEIBits(source.text))).digest('hex')},libraries:[...libraries.values()],verifiedRawBinaryReplays:replayed,opaqueClauses:program.opaqueClauses.length,artifactScope:'exact emitted rule instructions; not a complete standalone application',compilerHosted:true,executionAuthority:false}
writeFileSync(resolve(directory,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');console.log(JSON.stringify({libraries:libraries.size,verifiedRawBinaryReplays:replayed,opaqueClauses:program.opaqueClauses.length}))
