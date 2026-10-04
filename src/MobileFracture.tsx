import {useMemo,useState,useEffect,useRef,useCallback} from 'react'
import {EIFieldArray} from './EIFieldArray'
import {mobileFractureGrain,mobileTipState} from './model/mobile-fracture'
import {mobileGrainView,readMobileGrainRoute} from './model/mobile-grain-view'
import {EI_GRAINS,type EIGrain} from './model/ei-grain-identity'
import './ei-model.css'
import './mobile-fracture.css'
type PixelReadback={address:string;basis:'viewport CSS pixels';x:number;y:number;width:number;height:number;viewport:{width:number;height:number}}
export function MobileFracture(){
 const [initial]=useState(()=>readMobileGrainRoute(new URLSearchParams(location.search)))
 const [root,setRoot]=useState(initial.root),[rootInput,setRootInput]=useState(initial.root)
 const [route,setRoute]=useState(initial.route),[grain,setGrain]=useState<EIGrain>(initial.grain)
 const [pixels,setPixels]=useState<PixelReadback|null>(null),[message,setMessage]=useState(initial.routeDifference??''),[receiptText,setReceiptText]=useState('')
 const surface=useRef<HTMLElement>(null),centre=route[route.length-1]!
 const ledger=useMemo(()=>mobileFractureGrain(centre,route.slice(0,-1)),[centre,route])
 const projected=useMemo(()=>new Map(ledger.records.map(record=>[record.address,mobileGrainView(ledger,record.address,grain)])),[ledger,grain])
 const selected=projected.get(centre)!
 const relationNode=useCallback((address:string)=>address!==centre&&!!mobileTipState(centre,address),[centre])
 const tetrahedronPositions=useMemo(()=>new Map(ledger.records.flatMap(record=>{const tip=mobileTipState(centre,record.address);return tip?[[record.address,tip.tipIndex] as const]:[]})),[ledger,centre])
 useEffect(()=>{const url=new URL(location.href);url.searchParams.set('root',root);url.searchParams.set('grain',grain);url.searchParams.set('route',JSON.stringify(route));history.replaceState(null,'',url)},[root,grain,route])
 useEffect(()=>{try{const key=localStorage.getItem('fracture-receipt-latest:'+root),text=key?localStorage.getItem(key):null;const saved=text?JSON.parse(text):null;setReceiptText(saved?.root===root&&saved?.format==='mobile-grain-receipt/v1'?text!:'')}catch{setReceiptText('')}},[root])
 const measure=useCallback(()=>{const element=[...surface.current?.querySelectorAll<SVGGElement>('[data-field-node]')??[]].find(element=>element.getAttribute('data-field-node')===centre);if(!element)return;const rect=element.getBoundingClientRect();const observation:PixelReadback={address:centre,basis:'viewport CSS pixels',x:rect.x,y:rect.y,width:rect.width,height:rect.height,viewport:{width:innerWidth,height:innerHeight}};setPixels(previous=>JSON.stringify(previous)===JSON.stringify(observation)?previous:observation)},[centre])
 useEffect(()=>{setPixels(null);const frame=requestAnimationFrame(measure);const observer=new ResizeObserver(measure);if(surface.current)observer.observe(surface.current);window.addEventListener('scroll',measure,{passive:true});window.addEventListener('resize',measure);return()=>{cancelAnimationFrame(frame);observer.disconnect();window.removeEventListener('scroll',measure);window.removeEventListener('resize',measure)}},[measure,grain])
 function select(address:string){const prior=route.indexOf(address);if(prior>=0){setRoute(route.slice(0,prior+1));return}if(ledger.records.some(record=>record.address===address)&&route.length<5)setRoute([...route,address]);else setMessage('Current depth limit reached. Back retains this route.')}
 function saveReceipt(){
  const element=[...surface.current?.querySelectorAll<SVGGElement>('[data-field-node]')??[]].find(element=>element.getAttribute('data-field-node')===centre),rect=element?.getBoundingClientRect()
  const receipt={format:'mobile-grain-receipt/v1',recordedAt:new Date().toISOString(),root,zero:centre,grain,route,viewKind:"whole-at-selected-zero",projection:selected,screen:grain==='pixel'&&rect?{basis:'viewport CSS pixels',x:rect.x,y:rect.y,width:rect.width,height:rect.height,viewport:{width:innerWidth,height:innerHeight}}:null,source:'src/model/mobile-fracture.ts',unresolved:['physical mapping','complete twist-and-turn mechanism']}
  const text=JSON.stringify(receipt,null,2);setReceiptText(text);const key='fracture-receipt:'+JSON.stringify([root,receipt.recordedAt]);try{localStorage.setItem(key,text);if(localStorage.getItem(key)!==text)throw new Error('readback mismatch');localStorage.setItem('fracture-receipt-latest:'+root,key);setMessage('Receipt saved and read back at '+grain+' grain.')}catch{setMessage('Browser storage unavailable. Receipt remains visible here.')}
 }
 return <main ref={surface} className="ei-model-layer mobile-fracture" data-grain={grain} onPointerUp={()=>requestAnimationFrame(measure)} onWheel={()=>requestAnimationFrame(measure)}>
  <header><a href={import.meta.env.BASE_URL}>Overlay home</a><h1>Fracture map</h1><button disabled={route.length===1} onClick={()=>setRoute(route.slice(0,-1))}>Back</button></header>
  <form onSubmit={e=>{e.preventDefault();const next=rootInput.trim();if(!next||next.length>120){setMessage('Choose a root of 1–120 characters.');return}setRoot(next);setRoute([next]);setMessage('')}}><label>Your root<input aria-label="Your root" value={rootInput} maxLength={120} onChange={e=>setRootInput(e.target.value)}/></label><button>Open root</button></form>
  <nav aria-label="Grain"><label>Grain<select value={grain} onChange={e=>setGrain(e.target.value as EIGrain)}>{EI_GRAINS.map(g=><option key={g}>{g}</option>)}</select></label><button onClick={()=>setRoute([root])}>Root</button><button onClick={saveReceipt}>Save receipt</button></nav>
  <output className="mobile-grain-summary" aria-label="Current grain" aria-live="polite">
   {grain==='state'&&`${selected.state.role} · revision ${selected.state.revision} · ${selected.state.value}`}
   {grain==='node'&&`will / can / won’t be · IS centre · IS NEXT tip`}
   {grain==='address'&&centre}
   {grain==='coordinate'&&`Zero ${selected.coordinate.zero} → ${selected.coordinate.path.join(' → ')||'0'} · relational address; physical mapping unresolved`}
   {grain==='pixel'&&(pixels?.address===centre?`${Math.round(pixels.width)} × ${Math.round(pixels.height)} CSS px at (${Math.round(pixels.x)}, ${Math.round(pixels.y)}) · viewport ${pixels.viewport.width} × ${pixels.viewport.height}`:'Screen readback pending')}
  </output>
  <EIFieldArray key={centre} ledger={ledger} address={centre} revision={selected.state.revision} grain={grain} disabled={false} onSelect={select} onChooseZero={select} onReaddress={select} contextLabel="Local recursive grain" rootLabel={centre} sourceAddress={centre} initialObserverZero={centre} initialDrawPhase={1000} relationNode={relationNode} tetrahedronPositions={tetrahedronPositions} nodeLabel={address=>address===centre?'IS · '+(projected.get(address)?.label??address):projected.get(address)?.label??address} onFrameReturn={(_revision,complete)=>{if(complete)measure()}}/>
  <section className="mobile-tips" aria-label="Tip relations"><div><strong>IS</strong><button aria-label="Open IS centre" onClick={()=>select(centre)}>Centre</button><button aria-label="Open IS NEXT tip" onClick={()=>select(centre)}>IS NEXT tip</button></div>{selected.tips.map(tip=><div key={tip.label}><strong>{tip.label}</strong>{(['WAS','IS','NEXT'] as const).map(phase=>{const state=tip.states.find(state=>state?.phase===phase)!;return <button key={phase} aria-label={'Open '+tip.label+' '+phase} onClick={()=>select(state.address)}>{phase}</button>})}</div>)}</section>
  <details><summary>Relations and receipts · {grain}</summary><p>Zero: {centre}. Each member retains its address when grain changes. Tap a member to enter its own field; Back restores its parent at the same grain.</p><p>{grain==='state'?`Source ${selected.state.source.id} · ${selected.state.role} r${selected.state.revision}. No earlier state is supplied for this derived grain.`:grain==='node'?`${selected.children.length} direct members. Parents: ${selected.parents.join(', ')||'none'}.`:grain==='address'?`Exact address: ${centre}. Source locator: ${selected.state.source.locator}.`:grain==='coordinate'?`Relational coordinates use this address and its parent path. Numeric physical coordinates are not supplied.`:'Pixel values describe the observed screen area, in CSS pixels, and change with the view. They do not locate physical hardware.'}</p><p>WAS NEXT is the previous IS NEXT. This centre: IS. Final tip: IS NEXT. The previous tip’s exact address is not supplied; these labels do not infer another centre.</p><p>This is a derived relational simulation. Physical geometry and the complete twist-and-turn mechanism remain unverified.</p><ol>{route.map(address=><li key={address}>{address} · {grain}</li>)}</ol><p>Source: src/model/mobile-fracture.ts · parent and LOCAL_ZERO references retained.</p></details>
  {receiptText&&<details open><summary>Saved receipt</summary><pre className="mobile-receipt" aria-label="Saved receipt">{receiptText}</pre></details>}
  <details><summary>Directions and operations · {grain}</summary><p>These addresses serve as direction and continuation operators in this view. They can be selected as separate wholes at another grain while retaining their producing relation. No connected endpoints are supplied here.</p><ul>{selected.operators.map(operator=><li key={operator.address}>{operator.orientation} · {operator.kind}: {operator.relation} · from {operator.from} → unresolved endpoint{grain==="address"?` · ${operator.address}`:""}</li>)}</ul></details>
  <p role="status">{message}</p>
 </main>
}



