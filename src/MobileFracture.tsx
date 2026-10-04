import {useMemo,useState} from 'react'
import {EIFieldArray} from './EIFieldArray'
import {FRACTURE_ROOT,mobileFractureGrain} from './model/mobile-fracture'
import {EI_GRAINS,type EIGrain} from './model/ei-grain-identity'
import './ei-model.css'
import './mobile-fracture.css'
export function MobileFracture(){
 const [root,setRoot]=useState(()=>new URLSearchParams(location.search).get('root')?.trim()||FRACTURE_ROOT)
 const [rootInput,setRootInput]=useState(root)
 const [route,setRoute]=useState<string[]>([root])
 const [grain,setGrain]=useState<EIGrain>('node')
 const centre=route[route.length-1]!
 const ledger=useMemo(()=>mobileFractureGrain(centre,route.slice(0,-1)),[centre,route])
 function select(address:string){
  const prior=route.indexOf(address)
  if(prior>=0){setRoute(route.slice(0,prior+1));return}
  if(ledger.records.some(r=>r.address===address)&&route.length<5)setRoute([...route,address])
 }
 return <main className="ei-model-layer mobile-fracture">
  <header><a href={import.meta.env.BASE_URL}>Overlay home</a><h1>Fracture map</h1><button disabled={route.length===1} onClick={()=>setRoute(route.slice(0,-1))}>Back</button></header>
  <form onSubmit={e=>{e.preventDefault();const next=rootInput.trim();if(!next||next.length>120)return;setRoot(next);setRoute([next]);const url=new URL(location.href);url.searchParams.set("root",next);history.replaceState(null,"",url)}}><label>Your root<input aria-label="Your root" value={rootInput} maxLength={120} onChange={e=>setRootInput(e.target.value)}/></label><button>Open root</button></form>
  <nav aria-label="Grain"><label>Grain<select value={grain} onChange={e=>setGrain(e.target.value as EIGrain)}>{EI_GRAINS.map(g=><option key={g}>{g}</option>)}</select></label><button onClick={()=>setRoute([root])}>Root</button></nav>
  <EIFieldArray key={centre} ledger={ledger} address={centre} revision={0} grain={grain} disabled={false} onSelect={select} onChooseZero={select} onReaddress={select} contextLabel="Local recursive grain" rootLabel={centre} sourceAddress={centre} initialObserverZero={centre} initialDrawPhase={1000}>
   <output className="mobile-fracture-address" aria-live="polite">Zero: {centre}</output>
  </EIFieldArray>
  <details><summary>Relations and receipts</summary><p>30 members share this local zero. Tap a member to enter its own field; Back restores its parent. Pinch to zoom and drag to move.</p><p>This is a derived relational simulation. Physical geometry and the complete twist-and-turn mechanism remain unverified.</p><p>{route.length===5?'Current view depth reached; Back retains the route.':''}</p><ol>{route.map(address=><li key={address}>{address}</li>)}</ol><p>Source: src/model/mobile-fracture.ts · parent and LOCAL_ZERO references retained.</p></details>
 </main>
}


