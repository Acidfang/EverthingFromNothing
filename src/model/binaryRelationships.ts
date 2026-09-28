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
