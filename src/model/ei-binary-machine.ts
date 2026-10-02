/** Bootstrap ABI for the bounded relation library. These byte tags are an
 * engineering encoding, not authored meanings or canonical field addresses.
 * This kernel sees bytes, registers and matching witnesses; no source words. */
export type EIBits = readonly number[]
export type EIBinaryWitness = Readonly<{tag:number;left:EIBits;right:EIBits}>
export const EI_BINARY_ABI=Object.freeze({version:1,branch:1,literal:0,register:1,maxProgramBytes:65536,maxWitnesses:10000,maxWork:2_000_000,maxOutputBytes:1_048_576,maxOutputs:10000})
function fail(reason:string):never{throw Error(`EI binary machine: ${reason}`)}
/** Public ABI arguments are bounded plain data. Accessors, sparse arrays,
 * custom methods/prototypes and cycles cannot replace the reducer's work. */
export function checkEIData(value:unknown){
 let visits=0;const active=new Set<object>()
 const visit=(v:unknown,depth:number)=>{if(++visits>250000||depth>20)fail('data bound');if(v===null||v===undefined||typeof v==='boolean')return;if(typeof v==='string'){if(v.length>2_000_000)fail('text bound');return}if(typeof v==='number'){if(!Number.isFinite(v))fail('non-finite data');return}if(typeof v!=='object')fail('non-data value')
  const object=v as object,array=Array.isArray(v),keys=Reflect.ownKeys(object),prototype=Object.getPrototypeOf(object)
  if(prototype!==(array?Array.prototype:Object.prototype)&&(!array&&prototype!==null||array))fail('non-data prototype')
  if(active.has(object))fail('cyclic data');active.add(object)
  if(array){if(keys.length!==v.length+1)fail('non-data array');for(let i=0;i<v.length;i++){const d=Object.getOwnPropertyDescriptor(v,String(i));if(!d||!('value'in d))fail('sparse or accessor array');visit(d.value,depth+1)}}
  else for(const key of keys){const d=Object.getOwnPropertyDescriptor(object,key)!;if(typeof key!=='string'||!('value'in d))fail('accessor or symbolic data');visit(d.value,depth+1)}
  active.delete(object)
 };visit(value,0)
}
export function equalEIBits(a:EIBits,b:EIBits){checkEIBits(a);checkEIBits(b);return a.length===b.length&&a.every((v,i)=>v===b[i])}
export function checkEIBits(bits:EIBits,max=EI_BINARY_ABI.maxProgramBytes){if(!Array.isArray(bits)||Object.getPrototypeOf(bits)!==Array.prototype||bits.length>max||Reflect.ownKeys(bits).length!==bits.length+1)fail('invalid or excessive byte data');for(let i=0;i<bits.length;i++){const d=Object.getOwnPropertyDescriptor(bits,String(i));if(!d||!('value'in d)||!Number.isInteger(d.value)||d.value<0||d.value>255)fail('invalid or sparse byte data')}}
/** UTF-16 code units are retained exactly, including unpaired surrogates.
 * The encoding boundary does not assert semantic equality or interpret text. */
export function encodeEIBits(text:string):EIBits{if(typeof text!=='string'||text.length>32767)fail('source string bound');const out:number[]=[];for(let i=0;i<text.length;i++){const n=text.charCodeAt(i);out.push(n>>>8,n&255)}return Object.freeze(out)}
export function decodeEIBits(bits:EIBits):string{checkEIBits(bits);if(bits.length%2)fail('incomplete code unit');let out='';for(let i=0;i<bits.length;i+=2)out+=String.fromCharCode((bits[i]<<8)|bits[i+1]);return out}
type Field=Readonly<{kind:0;bits:EIBits}|{kind:1;register:0|1}>
export type EIBinaryInstruction=Readonly<{offset:number;tag:number;shape:number;fields:readonly Field[]}>
/** Format: version, count, then branch/tag/shape/field-count; each field is a
 * length-prefixed literal or a register. Trailing data is never executable. */
export function readEIBinaryProgram(program:EIBits):readonly EIBinaryInstruction[]{
 checkEIBits(program);let at=0;const byte=()=>{if(at>=program.length)fail('truncated program');return program[at++]}
 if(byte()!==EI_BINARY_ABI.version)fail('unsupported ABI');const count=byte();if(count>32)fail('instruction bound');const instructions:EIBinaryInstruction[]=[]
 for(let i=0;i<count;i++){const offset=at;if(byte()!==EI_BINARY_ABI.branch)fail('unknown instruction');const tag=byte(),shape=byte(),fields:Field[]=[],n=byte();if(!n||n>16)fail('field bound')
  for(let j=0;j<n;j++){const kind=byte();if(kind===EI_BINARY_ABI.register){const register=byte();if(register!==0&&register!==1)fail('unknown register');fields.push(Object.freeze({kind:1,register}))}
   else if(kind===EI_BINARY_ABI.literal){const length=byte()*256+byte();if(at+length>program.length)fail('truncated literal');fields.push(Object.freeze({kind:0,bits:Object.freeze(program.slice(at,at+length))}));at+=length}
   else fail('unknown field encoding')}
  instructions.push(Object.freeze({offset,tag,shape,fields:Object.freeze(fields)}))
 }
 if(at!==program.length)fail('trailing program bytes');return Object.freeze(instructions)
}
/** Matching is over exact byte registers and explicit relation tags. All
 * matching witnesses survive. Conflict/authority policies belong to admission. */
export function runEIBinaryProgram(program:EIBits,witnesses:readonly EIBinaryWitness[],registers:readonly [EIBits,EIBits]){
 checkEIData({witnesses,registers});if(!Array.isArray(witnesses)||!Array.isArray(registers)||registers.length!==2)fail('invalid argument collections')
 const instructions=readEIBinaryProgram(program);if(witnesses.length>EI_BINARY_ABI.maxWitnesses)fail('witness bound');registers.forEach(v=>checkEIBits(v));for(const witness of witnesses){if(!Number.isInteger(witness.tag)||witness.tag<0||witness.tag>255)fail('invalid witness tag');checkEIBits(witness.left);checkEIBits(witness.right)}
 let work=0,outputBytes=0;const outputs:{instructionOffset:number;witnessIndex:number;shape:number;fields:readonly EIBits[]}[]=[]
 for(const instruction of instructions)for(const [witnessIndex,witness]of witnesses.entries()){
  work+=1+witness.left.length+witness.right.length;if(work>EI_BINARY_ABI.maxWork)fail('work bound')
  if(witness.tag!==instruction.tag||!equalEIBits(witness.left,registers[0])||!equalEIBits(witness.right,registers[1]))continue
  outputBytes+=instruction.fields.reduce((n,field)=>n+(field.kind===0?field.bits.length:registers[field.register].length),0);if(outputBytes>EI_BINARY_ABI.maxOutputBytes||outputs.length>=EI_BINARY_ABI.maxOutputs)fail('returned output bound')
  outputs.push(Object.freeze({instructionOffset:instruction.offset,witnessIndex,shape:instruction.shape,fields:Object.freeze(instruction.fields.map(field=>Object.freeze([...(field.kind===0?field.bits:registers[field.register])])))}))
 }
 return Object.freeze({abi:EI_BINARY_ABI.version,program:Object.freeze([...program]),registers:Object.freeze(registers.map(v=>Object.freeze([...v]))),outputs:Object.freeze(outputs),work,authority:false as const})
}
