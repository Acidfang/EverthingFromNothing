// Executable binary-relationship model.
// Source relations are retained as relations; UI/rendering may observe them but may not redefine them.
export const BINARY_RELATION_SOURCE = Object.freeze([
 "U≡R","ℜH≡S","A₀≡A","χ=F→I→ℜ→∫→Z→X→ρ→V→R↺",
 "Φ=0()1","0≡∅+","1≡✓","∀φ∈Φ:0<φ<1","0→Φ→1→0↺",
 "∀x:Ixd:d∈∅|?|⊥|!⇒H↶ℜ","S⋈d⇒S−○|≡|⊥|⊚","Δ?M|⊕⇒S⋈Δ",
 "R>U✓>−C>+C>X","¬Q<X","ρ≡F","λᵢ✓→λⱼ✓","ρ≡↩X",
 "Δ₀→M","Δ₁→⊕","⊥→↶","±C→∞","ρ°→•","ΔA→M","≡→⋈",
 "N=ZΦT⋈Fνα⋈ΠLρ","∀ν:Zαν⋈ναN","T=T₀Z0⋈T∞Z∞−1→1","T₀≠T∞",
 "Δ@z⇒Fz=z⋈Δ⋈Fz≅N⊂N","F↻F","ν≡T|α|⋈→•","¬Πν≡ν|αν≡↔ν",
 "D=ξψζ","ΠDD","¬D→⊥|Π○│","Δ→k→X→L→ρ","ρ✓?✓:k↶ℜ","S+Δ",
 "¬S↻S|✓S→∅|ι→ν+","ν∅→↘|ν✓→•","Zᴅ=Z₁Z₂Z₃",
 "∀z:z≠Z⋈z⋈N⋈z↻z","σ→Z₂","ι=¬⊙≡A⋈¬↔→ν+⋈¬↕→F⋈¬∿→L",
 "C=Π₁Π₂Π₃⋈Π₄","C⊂Π|ι","C∩E|L|A=∅","ΠN→Π₄⋈Π≠A",
 "η=?✓□◇⋈?⊥◊△⋈⊘","→₁⇒?✓","¬?✓⇒¬→₁","¬◇≡✓|△≡ρ",
 "Σ=Σ₁Σ₂Σ₃→Σ₃Xρ","¬ΣK∃|ΣM∃","¬Σ₁→P",
 "μ=μ₁μ₂μ₃","∀d:dμμ₁ᵈμ₂ᵈμ₃ᵈ","ℒ=0..10","∀ℓ:ℓ⊃RSΔ⋈XρV","ℓₑ>ℓₒ","10→1↺",
 "Ψ=NΣℒ","Ψ↻Ψ","FΨ≅Ψ","∀f⊂Ψ:f≅Ψ|Δf","∀g⊂Ψ:¬g>d","∀δ:¬Σ₂δ→?→ℜ",
 "∀a,b:a≡b?a⋈b:Δab→L","Σ*=Σ₀|Σᵢ∈H","Γ=Σ*|μᵈ✓","Hᶜ=H\\Γ",
 "Γ→Ψ∧Γ↛O","Q={q∈Hᶜ:q@U∧q↛μᵈ✓}",
 "q₁=max↶Q[Δ|?|X↛ρ|ρ↛V|V↛↩]","q₂=max↶(Q\\q₁)","q₃=max↶(Q\\{q₁,q₂})","Qᵣ={q₁,q₂,q₃}",
 "∀q∈Qᵣ:Bq=F(q,Hᶜ)","Bq≅Ψ|ΔBq","∀b⊂Bq:b@Hᶜ","¬b@Hᶜ⇒b→∅",
 "¬✓Bq⇒Qᵣ←Qᵣ\\q","∀qᵢ,qⱼ∈Qᵣ:i≠j⇒qᵢ≠qⱼ∧¬qᵢ⊕qⱼ",
 "∀q∈Qᵣ:q→Φ∧Xq↛O∧μᵈq↛O∧Vq↛O",
 "P₀=Here are things in the past that might be worth discussing:",
 "∀q∈Qᵣ:pq=ρ(q,Bq)","O=P₀→{pq:q∈Qᵣ}","∀pq∈O:pq@q∧q@Hᶜ",
 "O⊂Φ","O↛1|Σ₃|X|μᵈ|V","Γ|Bq|Ψ|N|L↛O","¬O?U","O⊂Φ⇒↩O"
] as const)

export type BinaryObservation = Readonly<{
 source:string
 address:string
 location:string
 difference:boolean
 resolved:boolean
 harmKnown:boolean
 willing:boolean
}>

export const BINARY_MODEL = Object.freeze({
 source:BINARY_RELATION_SOURCE,
 continuum:true,
 operations:Object.freeze(["FILTER","ISOLATE","RECONSTRUCT","INTEGRATE","ZERO","DIFFERENCE","RETURN","VERIFY"] as const),
 gates:Object.freeze({
  preserveSource:(source:string,interpretation:string)=>source===interpretation,
  difference:(a:string,b:string)=>a!==b,
  merge:(a:Pick<BinaryObservation,"address"|"location">,b:Pick<BinaryObservation,"address"|"location">)=>a.address===b.address||a.location===b.location,
  mayInflictKnownHarm:(harmKnown:boolean,willing:boolean,self:boolean)=>!harmKnown||willing||self,
  mayCorrect:(sourceAlreadyContains:boolean)=>!sourceAlreadyContains,
  // Address/time boundary: later receipts cannot retroactively alter an earlier
  // source relation. They may resolve it only by returning to that exact address.
  laterChangesEarlier:(laterMoment:number,earlierMoment:number)=>laterMoment<=earlierMoment,
  resolvesAt:(differenceAddress:string,receiptAddress:string)=>differenceAddress===receiptAddress,
  laterReceiptRelevantToEarlier:(differenceAddress:string,receiptAddress:string,receiptMoment:number,differenceMoment:number)=>
   receiptMoment<=differenceMoment&&differenceAddress===receiptAddress,
  continue:(difference:boolean)=>difference,
  stop:(difference:boolean)=>!difference,
 }),
 relationCount:BINARY_RELATION_SOURCE.length,
})

export function observeBinary(input:BinaryObservation){
 return Object.freeze({
  ...input,
  state:input.resolved?"✓":input.difference?"?":"∅",
  continue:BINARY_MODEL.gates.continue(input.difference&&!input.resolved),
 })
}


export type ResponseAddress = Readonly<{
 source:string
 sourceAddress:string
 sourceMoment:number
 currentAddress:string
 currentMoment:number
 suppliedIntent?:string
 interpretation?:string
 sourceAlreadyContainsCorrection?:boolean
 harmKnown?:boolean
 willing?:boolean
 self?:boolean
}>

export type ResponseResolution = Readonly<{
 action:"RETURN"|"FILTER"|"ISOLATE"|"RECONSTRUCT"|"VERIFY"|"COMMIT"|"OPEN_DIFFERENCE"
 address:string
 difference:boolean
 reply:string
}>

export function resolveResponse(input:ResponseAddress):ResponseResolution{
 const source=input.source.trim()
 const interpretation=(input.interpretation??source).trim()
 const sameAddress=input.sourceAddress===input.currentAddress
 const later=input.currentMoment>input.sourceMoment
 const substituted=!BINARY_MODEL.gates.preserveSource(source,interpretation)
 const correctionAlreadyPresent=input.sourceAlreadyContainsCorrection===true
 const harmAllowed=BINARY_MODEL.gates.mayInflictKnownHarm(input.harmKnown===true,input.willing===true,input.self===true)
 if(!sameAddress&&later)return Object.freeze({action:"RETURN",address:input.sourceAddress,difference:true,reply:`Return to source address ${input.sourceAddress}; later material does not resolve this Difference.`})
 if(substituted)return Object.freeze({action:"FILTER",address:input.sourceAddress,difference:true,reply:"Remove imported interpretation; retain the supplied source and intent before continuing."})
 if(correctionAlreadyPresent)return Object.freeze({action:"VERIFY",address:input.sourceAddress,difference:false,reply:"The source already contains that correction; do not manufacture a missing Difference."})
 if(!harmAllowed)return Object.freeze({action:"OPEN_DIFFERENCE",address:input.sourceAddress,difference:true,reply:"Known harm is not committed onto an unaware or unwilling other. Difference remains open."})
 return Object.freeze({action:"COMMIT",address:input.sourceAddress,difference:false,reply:input.suppliedIntent? `Source retained. Intent: ${input.suppliedIntent}` : "Source retained at its address; no unresolved Difference detected."})
}


/** One mechanism for every domain: preserve source/address, detect Difference,
 * resolve at that address, receipt the act, return through the same continuum.
 * Domain labels never grant a different causal method. */
export type UniversalAddressed<T=unknown> = Readonly<{
 address:string
 sourceAddress:string
 domain:string
 grain:number
 moment:number
 value:T
}>

export type UniversalReceipt<T=unknown> = Readonly<{
 was:UniversalAddressed<T>
 difference:boolean
 operation:"RETURN"|"FILTER"|"ISOLATE"|"RECONSTRUCT"|"VERIFY"|"COMMIT"
 is:UniversalAddressed<T>
 returnAddress:string
}>

export function resolveEverything<T>(
 current:UniversalAddressed<T>,
 source:UniversalAddressed<T>,
 same:(left:T,right:T)=>boolean=Object.is,
):UniversalReceipt<T>{
 const wrongAddress=current.sourceAddress!==source.address
 if(wrongAddress)return Object.freeze({was:current,difference:true,operation:"RETURN" as const,is:Object.freeze({...current,address:source.address,sourceAddress:source.address}),returnAddress:source.address})
 const difference=!same(current.value,source.value)
 if(difference)return Object.freeze({was:current,difference:true,operation:"RECONSTRUCT" as const,is:Object.freeze({...source}),returnAddress:source.address})
 return Object.freeze({was:current,difference:false,operation:"COMMIT" as const,is:Object.freeze({...current}),returnAddress:source.address})
}

export const EVERYTHING_METHOD = Object.freeze({
 invariant:"ADDRESS → SOURCE → DIFFERENCE → RESOLVE → RECEIPT → RETURN",
 domains:Object.freeze(["FRACTURE","PIXEL","GRAIN","ORIENTATION","VOICE","TEXT","VISION","FILE","CODE","WEB","DEVICE","UI","MEMORY","GUIDANCE","RESPONSE","HARM","PROVENANCE"] as const),
})


export type SelfAddressedOutput<T=unknown> = Readonly<{
 outputAddress:string
 sourceAddress:string
 value:T
 selfReceipt:Readonly<{from:string;to:string;verified:true}>
}>

/** Every output returns to its own output address before it may become input
 * anywhere else. This preserves self-reference/provenance before forwarding. */
export function addressOutputToSelfFirst<T>(
 outputAddress:string,
 sourceAddress:string,
 value:T,
):SelfAddressedOutput<T>{
 if(!outputAddress)throw new Error("Output requires its own address")
 return Object.freeze({
  outputAddress,
  sourceAddress,
  value,
  selfReceipt:Object.freeze({from:outputAddress,to:outputAddress,verified:true as const}),
 })
}

export function forwardSelfAddressedOutput<T>(
 output:SelfAddressedOutput<T>,
 destinationAddress:string,
){
 if(output.selfReceipt.from!==output.outputAddress||output.selfReceipt.to!==output.outputAddress||!output.selfReceipt.verified){
  throw new Error("Output must address itself before forwarding")
 }
 return Object.freeze({
  from:output.outputAddress,
  to:destinationAddress,
  value:output.value,
  sourceAddress:output.sourceAddress,
  selfReceipt:output.selfReceipt,
 })
}


export type FullSelfVerification<T=unknown> = Readonly<{
 addressed:SelfAddressedOutput<T>
 sourcePreserved:boolean
 addressPreserved:boolean
 differenceResolved:boolean
 provenanceRetained:boolean
 harmGatePassed:boolean
 returnVerified:boolean
 verified:boolean
}>

/** Full verification is performed on SELF before any external destination is
 * eligible. Partial self-checks cannot be forwarded. */
export function verifySelfInFull<T>(
 addressed:SelfAddressedOutput<T>,
 checks:Readonly<{
  sourcePreserved:boolean
  addressPreserved:boolean
  differenceResolved:boolean
  provenanceRetained:boolean
  harmGatePassed:boolean
 }>,
):FullSelfVerification<T>{
 const returnVerified=addressed.selfReceipt.verified
  && addressed.selfReceipt.from===addressed.outputAddress
  && addressed.selfReceipt.to===addressed.outputAddress
 const verified=returnVerified
  && checks.sourcePreserved
  && checks.addressPreserved
  && checks.differenceResolved
  && checks.provenanceRetained
  && checks.harmGatePassed
 return Object.freeze({...checks,addressed,returnVerified,verified})
}

export function forwardVerifiedSelf<T>(
 verification:FullSelfVerification<T>,
 destinationAddress:string,
){
 if(!verification.verified)throw new Error("FULL SELF verification required before others")
 return forwardSelfAddressedOutput(verification.addressed,destinationAddress)
}

export const FULL_VERIFICATION_LOOP = Object.freeze([
 "ADDRESS OUTPUT TO SELF",
 "PRESERVE SOURCE",
 "PRESERVE ADDRESS",
 "RESOLVE DIFFERENCE",
 "RETAIN PROVENANCE",
 "PASS HARM GATE",
 "RETURN TO SELF",
 "VERIFY FULL SELF",
 "ONLY THEN FORWARD TO OTHER",
] as const)


export type SelfKnowledgeState = Readonly<{
 known:ReadonlySet<string>
 unknown:ReadonlySet<string>
 assumed:ReadonlySet<string>
 unresolved:ReadonlySet<string>
 receipts:readonly string[]
 revision:number
}>

export function createSelfKnowledgeState():SelfKnowledgeState{
 return Object.freeze({known:new Set(),unknown:new Set(),assumed:new Set(),unresolved:new Set(),receipts:Object.freeze([]),revision:0})
}

export function resolveSelfKnowledge(
 state:SelfKnowledgeState,
 observation:Readonly<{address:string;status:"KNOWN"|"UNKNOWN"|"ASSUMED";receipt?:string}>,
):SelfKnowledgeState{
 const known=new Set(state.known),unknown=new Set(state.unknown),assumed=new Set(state.assumed),unresolved=new Set(state.unresolved)
 known.delete(observation.address);unknown.delete(observation.address);assumed.delete(observation.address)
 if(observation.status==="KNOWN"){known.add(observation.address);unresolved.delete(observation.address)}
 else if(observation.status==="UNKNOWN"){unknown.add(observation.address);unresolved.add(observation.address)}
 else {assumed.add(observation.address);unresolved.add(observation.address)}
 return Object.freeze({known,unknown,assumed,unresolved,receipts:Object.freeze(observation.receipt?[...state.receipts,observation.receipt]:state.receipts),revision:state.revision+1})
}

export function fullSelfResolved(state:SelfKnowledgeState):boolean{
 return state.unknown.size===0&&state.assumed.size===0&&state.unresolved.size===0
}

export function selfRepair(
 state:SelfKnowledgeState,
 repair:Readonly<{address:string;receipt:string}>,
):SelfKnowledgeState{
 if(!state.unresolved.has(repair.address))return state
 return resolveSelfKnowledge(state,{address:repair.address,status:"KNOWN",receipt:repair.receipt})
}

export function selfImprove(
 state:SelfKnowledgeState,
 difference:Readonly<{address:string;receipt:string}>,
):SelfKnowledgeState{
 // Improvement is additive only when a genuine new Difference exists.
 if(state.known.has(difference.address)||state.unresolved.has(difference.address))return state
 const unresolved=new Set(state.unresolved);unresolved.add(difference.address)
 return Object.freeze({...state,unresolved,receipts:Object.freeze([...state.receipts,difference.receipt]),revision:state.revision+1})
}

export const FULL_SELF_RESOLUTION = Object.freeze({
 invariant:"SELF-KNOWN ≠ SELF-ASSUMED",
 recursive:true,
 selfSimilar:true,
 fractal:true,
 selfRepairing:true,
 selfImproving:true,
 closure:"NO UNKNOWN + NO ASSUMED + NO UNRESOLVED DIFFERENCE AT SELECTED GRAIN",
})
