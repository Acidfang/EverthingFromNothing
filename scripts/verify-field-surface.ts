import {mkdtemp,rm,readFile,writeFile} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {pathToFileURL} from 'node:url'
import {execFileSync} from 'node:child_process'
import ts from 'typescript'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {createEIDeviceFieldRecords} from '../src/model/ei-device-field.ts'
import {createEIPublicFieldRecords} from '../src/model/ei-public-field.ts'
export function entryMountsEIField(text:string):boolean{
  const main=ts.createSourceFile('main.tsx',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
  const rendererImport=main.statements.find(statement=>ts.isImportDeclaration(statement)&&ts.isStringLiteral(statement.moduleSpecifier)&&/^\.\/EIModelLayer(?:\.tsx)?$/.test(statement.moduleSpecifier.text))
  const names=rendererImport&&ts.isImportDeclaration(rendererImport)?rendererImport.importClause?.namedBindings:undefined
  const local=names&&ts.isNamedImports(names)?names.elements.find(item=>(item.propertyName??item.name).text==='EIModelLayer')?.name.text:undefined
  const containsMountedField=(node:ts.Node):boolean=>{
   if(ts.isJsxSelfClosingElement(node)){const attrs=node.attributes.properties;return node.tagName.getText(main)===local&&attrs.length===1&&ts.isJsxAttribute(attrs[0])&&attrs[0].name.getText(main)==='open'&&!attrs[0].initializer}
   if(ts.isJsxElement(node))return node.openingElement.tagName.getText(main)==='StrictMode'&&node.children.some(child=>containsMountedField(child))
   if(ts.isJsxExpression(node)&&node.expression&&ts.isConditionalExpression(node.expression)){const branch=node.expression;return branch.condition.getText(main)==="new URLSearchParams(location.search).get('view')==='fracture'"&&ts.isJsxSelfClosingElement(branch.whenTrue)&&branch.whenTrue.tagName.getText(main)==='MobileFracture'&&containsMountedField(branch.whenFalse)}
   if(ts.isJsxFragment(node))return node.children.some(child=>containsMountedField(child))
   return false
  }
  return !!local&&main.statements.some(statement=>ts.isExpressionStatement(statement)&&ts.isCallExpression(statement.expression)&&ts.isPropertyAccessExpression(statement.expression.expression)&&statement.expression.expression.name.text==='render'&&ts.isCallExpression(statement.expression.expression.expression)&&statement.expression.expression.expression.expression.getText(main)==='createRoot'&&statement.expression.arguments.some(argument=>containsMountedField(argument)))
}
export function fieldContainsOperation(html:string,operation:string):boolean{
 const start=html.indexOf('<section class="ei-field-array"')
 if(start<0)return false
 const tags=/<\/?section\b[^>]*>/g;tags.lastIndex=start;let depth=0
 for(let match=tags.exec(html);match;match=tags.exec(html)){
  depth+=match[0].startsWith('</')?-1:1
  if(depth===0){const at=html.indexOf(operation,start);return at>=start&&at<match.index}
 }
 return false
}
/** Executes the mounted component tree. This checks surface presence, not browser interactions or field completion. */
export async function verifyFieldSurface(){
 const root=resolve(import.meta.dirname,'..'),directory=await mkdtemp(join(root,'.qa-field-'))
 try{
  const entryMounted=entryMountsEIField(await readFile(join(root,'src/main.tsx'),'utf8'))
  if(!entryMounted)throw new Error('The actual main entry no longer directly mounts the verified field surface; review its replacement before release')
  execFileSync(process.execPath,[join(root,'node_modules/vite/bin/vite.js'),'build','--ssr','src/EIModelLayer.tsx','--outDir',directory,'--configLoader','runner'],{cwd:root,stdio:'pipe'})
  const {EIModelLayer}=await import(pathToFileURL(join(directory,'EIModelLayer.js')).href)
  const warnings:unknown[][]=[],original=console.error
  let html:string
  try{console.error=(...values:unknown[])=>{warnings.push(values)};html=renderToStaticMarkup(createElement(EIModelLayer,{open:true}))}finally{console.error=original}
  const records=[...createEIDeviceFieldRecords(),...createEIPublicFieldRecords()],rootRecord=records.find(record=>record.address==='device')!,expected=new Set([rootRecord.address,...rootRecord.relations.filter(relation=>relation.relation==='CONTAINS').map(relation=>relation.address),...records.filter(record=>record.parents?.includes(rootRecord.address)).map(record=>record.address)]).size,actual=(html.match(/aria-label="Select (?:model\/|device)/g)??[]).length
  const field=html.indexOf('aria-label="Addressed field array"'),capture=html.indexOf('Start a conversation')
  const workspace=html.indexOf('class="ei-field-workspace" hidden=""'),workspaceSource=html.includes('data-field-address="device"')
  const checks={deviceCollections:['hardware','software','files','folders'].every(kind=>html.includes(`data-field-node="device/${kind}"`)),primaryField:field>=0&&capture>field&&fieldContainsOperation(html,'Start a conversation'),fieldOnlyInitialSurface:workspace>field&&capture>workspace&&workspaceSource&&!html.includes('Capture a source to begin'),retainedAddressControls:actual===expected,wholeSourceRetained:html.includes(`data-retained-addresses="${records.length}"`),zoom:html.includes('aria-label="Zoom field in"')&&html.includes('aria-label="Zoom field out"'),fit:html.includes('Fit field')&&html.includes('Fit selected'),addressSelection:html.includes('aria-label="Select field address"'),cleanRender:warnings.length===0}
  if(Object.values(checks).some(value=>!value))throw new Error(`Mounted field surface regression: ${JSON.stringify(checks)}`)
  return {scope:'static-mounted-field-surface' as const,checks,expectedAddresses:expected,actualAddresses:actual,retainedAddresses:records.length,wholeFieldComplete:false as const}
 }finally{await rm(directory,{recursive:true,force:true})}
}

/** Closed and open address-bound workspaces retain the same operation subtree. */
export async function verifyFieldWorkspace(){
 const root=resolve(import.meta.dirname,'..'),directory=await mkdtemp(join(root,'.qa-field-'))
 try{
  const entry=join(directory,'entry.ts')
  await writeFile(entry,"export {EIFieldArray} from '../src/EIFieldArray';export {createEILedger} from '../src/model/ei-engine';")
  execFileSync(process.execPath,[join(root,'node_modules/vite/bin/vite.js'),'build','--ssr',entry,'--outDir',join(directory,'output'),'--configLoader','runner'],{cwd:root,stdio:'pipe'})
  const {EIFieldArray,createEILedger}=await import(pathToFileURL(join(directory,'output/entry.js')).href)
  const ledger=createEILedger({records:createEIPublicFieldRecords()}),before=JSON.stringify(ledger)
  const props={ledger,sourceAddress:'model/inventory-root',address:'model/inventory-root',revision:0,grain:'state',disabled:false,onSelect:()=>{},onCloseWorkspace:()=>{}}
  const render=(workspaceOpen:boolean)=>renderToStaticMarkup(createElement(EIFieldArray,{...props,workspaceOpen},createElement('textarea',{'aria-label':'Retained draft',defaultValue:'unchanged draft'})))
  const closed=render(false),opened=render(true)
  const checks={closedInitially:closed.includes('class="ei-field-workspace" hidden=""'),openOnSelection:!opened.includes('class="ei-field-workspace" hidden=""'),addressBound:opened.includes('data-field-address="model/inventory-root" data-field-revision="0"'),retainsDraft:closed.includes('unchanged draft')&&opened.includes('unchanged draft'),returnControl:opened.includes('Return to field'),noLedgerMutation:before===JSON.stringify(ledger)}
  if(Object.values(checks).some(value=>!value))throw new Error(JSON.stringify(checks))
  return checks
 }finally{await rm(directory,{recursive:true,force:true})}
}

