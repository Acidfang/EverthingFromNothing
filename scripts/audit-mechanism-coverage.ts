import {readFileSync,readdirSync,statSync,existsSync} from 'node:fs'
import {resolve,relative,dirname,join} from 'node:path'
import {pathToFileURL} from 'node:url'
import {parseEILedgerSource,compileEILedgerProgram} from '../src/model/ei-ledger-language.ts'
/** Executable engineering inventory, never a replacement source ontology.
 * Static imports include type dependencies; reachability is not execution. */
export function auditMechanismCoverage(root=resolve(import.meta.dirname,'..')){
 const files:string[]=[];const walk=(at:string)=>{for(const name of readdirSync(at).sort()){const path=join(at,name);if(statSync(path).isDirectory())walk(path);else if(/\.(ts|tsx|css)$/.test(name))files.push(path)}};walk(join(root,'src'))
 const edges:{from:string;to:string;kind:'local'|'host-package'}[]=[],text=new Map(files.map(path=>[path,readFileSync(path,'utf8')]))
 for(const [path,body]of text)for(const match of body.matchAll(/(?:from\s*|import\s*)['"]([^'"]+)['"]/g)){
  const name=match[1];let target=name,kind:'local'|'host-package'='host-package'
  if(name.startsWith('.')){kind='local';const base=resolve(dirname(path),name),found=[base,`${base}.ts`,`${base}.tsx`,`${base}.css`].find(p=>existsSync(p)&&statSync(p).isFile());target=relative(root,found??base)}
  edges.push({from:relative(root,path),to:target,kind})
 }
 const reached=new Set(['src/main.tsx']),queue=['src/main.tsx'];while(queue.length){const from=queue.shift()!;for(const edge of edges.filter(e=>e.from===from&&e.kind==='local'))if(!reached.has(edge.to)){reached.add(edge.to);queue.push(edge.to)}}
 const inventory=JSON.parse(readFileSync(join(root,'docs/FRACTURE-FIELD-INVENTORY.json'),'utf8')),clauses=inventory.retained_binary_relations as string[]
 const source={recordAddress:'model/inventory-root',sourceId:`public-inventory:${inventory.source_revision}`,revision:0,frameId:'published-retained-clause-audit',text:JSON.stringify(clauses)}
 const ast=parseEILedgerSource(source,{pointers:clauses.map((_,i)=>`/${i}`)}),program=compileEILedgerProgram([ast])
 const roles={sourceAdapter:['src/model/ei-addressed-program.ts','src/model/ei-grain-identity.ts'],hostedCompiler:['src/model/ei-ledger-language.ts','src/model/ei-binary-rule-library.ts'],binaryReducer:['src/model/ei-binary-machine.ts'],admissionAndReceipts:['src/model/source-bound-comparison.ts','src/model/ei-engine.ts'],presentation:['src/EIModelLayer.tsx','src/EIFieldArray.tsx'],carrierAdapters:['src/model/ei-homebase-environment.ts','src/model/ei-discovery.ts','src/model/ei-discovery-providers.ts','src/model/ei-phone-media.ts','src/model/ei-public-sync.ts']}
 return {format:'ei-mechanism-coverage/v1',canonicalOntology:false,wholeUserLedger:false,entry:'src/main.tsx',entryImports:edges.filter(e=>e.from==='src/main.tsx'),staticDependencies:edges.sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))),staticallyReached:[...reached].sort(),roles:Object.fromEntries(Object.entries(roles).map(([role,paths])=>[role,paths.map(path=>({path,present:existsSync(join(root,path)),staticallyReached:reached.has(path)}))])),hostPackages:[...new Set(edges.filter(e=>e.kind==='host-package'&&reached.has(e.from)).map(e=>e.to))].sort(),hostBootstrapStillRequired:true,selfHostedCompiler:false,retainedClauses:ast.clauses.length,recognizedRules:ast.clauses.filter(c=>c.syntax.kind==='comparison-rule').length,directPremises:ast.clauses.filter(c=>c.syntax.kind==='direct-comparison').length,opaqueClauses:program.opaqueClauses.map(c=>({source:c.source,text:c.source.exact})),evaluations:program.evaluations.length,proofs:program.evaluations.reduce((n,e)=>n+e.result.proofs.length,0),binaryReturns:program.evaluations.map(e=>({rule:e.ruleId,programBytes:e.result.mechanism?.library.bytes,admitted:e.result.mechanism?.admitted,outputCount:e.result.mechanism?.execution.outputs.length})),intentSources:program.opaqueClauses.filter(c=>c.source.exact.includes('Iᵁ')).map(c=>c.source),meaningSources:program.opaqueClauses.filter(c=>c.source.exact.includes('⟦')).map(c=>c.source),intentMeaningImplemented:false}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)process.stdout.write(JSON.stringify(auditMechanismCoverage(),null,2)+'\n')
