import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
import {Script, createContext, runInContext} from "node:vm"

const core=readFileSync(new URL("../public/dca-atom-modeler-core.html",import.meta.url),"utf8")
const wrapper=readFileSync(new URL("../public/dca-atom-modeler.html",import.meta.url),"utf8")
const script=core.match(/<script>([\s\S]*?)<\/script>/)![1]
function clock(){
 const start=script.indexOf("const DISPLAY_CYCLE_MS=5200;")
 const end=script.indexOf("function hydrogenMoment",start)
 const context=createContext({performance:{now:()=>0}})
 runInContext("let orbiting=true,orbitStarted=100,presentationElapsed=0;"+script.slice(start,end),context)
 return (source:string)=>runInContext(source,context)
}

test("legacy modeler script remains syntactically valid",()=>{new Script(script)})
test("pause freezes presentation phase across arbitrary browser time and resume retains phase",()=>{
 const evaluate=clock()
 const before=evaluate("temporalPhase(1400)")
 evaluate("setOrbiting(false,1400)")
 assert.equal(evaluate("temporalPhase(100000)"),before)
 evaluate("setOrbiting(true,100000)")
 assert.equal(evaluate("temporalPhase(100000)"),before)
 assert.ok(Math.abs(evaluate("temporalPhase(101300)")-Math.PI)<1e-12)
})
test("repeat pause and resume accumulates only active presentation duration",()=>{
 const evaluate=clock()
 evaluate("setOrbiting(false,600);setOrbiting(true,900);setOrbiting(false,1200)")
 assert.equal(evaluate("presentationTime(99999)"),800)
 evaluate("presentationElapsed=0;orbiting=true;orbitStarted=99999")
 assert.equal(evaluate("temporalPhase(99999)"),0)
})
test("paused path remains rendered and spiral-axis changes request redraw",()=>{
 assert.doesNotMatch(script,/if\([^)]*!orbiting/)
 assert.match(script,/spiralAxis\.addEventListener\('change',\(\)=>render\(\)\)/)
 assert.match(script,/setOrbiting\(orbit\.value==='on'\)/)
})
test("camera and selected demonstration cannot be mistaken for the canonical node law or pixel completion",()=>{
 assert.match(core,/Camera yaw/);assert.match(core,/Camera pitch/)
 assert.match(core,/data-time-authority="browser-presentation-not-model-TIME"/)
 assert.match(core,/does not implement the addressed-pixel completion boundary/)
 assert.match(wrapper,/exact axis, sign and angle law remains unresolved/)
 assert.match(wrapper,/href="\.\/">Field and technical address overlay/)
 assert.doesNotMatch(wrapper,/retains every Moment/)
})
