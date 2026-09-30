import {useEffect,useMemo,useRef,useState} from "react"
import inventory from "../docs/FRACTURE-FIELD-INVENTORY.json"
import {relationsAt,searchInventory,sourceHref,validSpatialAddress} from "./model/field-inventory"
import {resolveTick,type LedgerContinuum} from "./model/kernel"
import {OPEN_DIFFERENCES} from "./model/canonicalSeed"

import {FractureVideoProof} from "./FractureVideoProof"
import {ReproducibilityExplorer} from "./ReproducibilityExplorer"

const graph=inventory.binary_relation_order
const nodes=new Map(graph.nodes.map(node=>[node.id,node]))
const entries=new Map(inventory.entries.map(entry=>[entry.id,entry]))
const refinementIds=["can-be","can-next","cant-next"]
type Props=Readonly<{fieldRole:"WAS"|"IS"|"NEXT";selected:string;onSelect:(address:string)=>void;onFollowNext:(address:string)=>void;continuum:LedgerContinuum;paused:boolean;onPause:()=>void;onStep:()=>void;onClose:()=>void}>

export function FieldAddressOverlay({fieldRole,selected,onSelect,onFollowNext,continuum,paused,onPause,onStep,onClose}:Props){
 const [query,setQuery]=useState(""),[route,setRoute]=useState({ids:["nothing"],index:0}),[role,setRole]=useState<"WAS"|"IS"|"NEXT">("IS"),[coordinate,setCoordinate]=useState(selected),[error,setError]=useState("")
 const sourceDetail=useRef<HTMLElement>(null)
 const search=useRef<HTMLInputElement>(null)
 const id=route.ids[route.index],node=nodes.get(id)!,entry=entries.get(id)
 const matched=searchInventory(graph.nodes,query),relations=relationsAt(graph.relations,id)
 const preview=useMemo(()=>resolveTick(continuum.state),[continuum])
 const receipt=continuum.receipts.at(-1)?.entries.find(item=>item.address===selected)
 const following=useMemo(()=>resolveTick(preview.state),[preview])
 const successor=fieldRole==="WAS"?continuum.receipts.at(-1):fieldRole==="IS"?preview.ledger:following.ledger
 const allowedNext=(successor?.entries??[]).filter(item=>item.remainsDifferent&&item.arrivals.some(arrival=>arrival.source===selected))
 const nextReceipt=preview.ledger.entries.find(item=>item.address===selected)
 const go=(target:string)=>{if(!nodes.has(target)||target===id)return;setRoute(current=>({ids:[...current.ids.slice(0,current.index+1),target],index:current.index+1}));setRole("IS")}
 useEffect(()=>{search.current?.focus()},[])
 useEffect(()=>{setCoordinate(selected);setError("")},[selected])
 return <aside className="field-address-overlay" aria-label="Address and relation inspector" onKeyDown={event=>{if(event.key==="Escape"){event.stopPropagation();onClose()}}}>
  <header><div><small>ONE FIELD · ADDRESSED RELATIONS</small><h1>Address inspector</h1></div><button type="button" onClick={onClose} aria-label="Close address inspector">Close</button></header>
  <section aria-label="Selected runtime address">
   <h2>Selected spatial address · {selected}</h2>
   <form onSubmit={event=>{event.preventDefault();const value=coordinate.trim();if(!validSpatialAddress(value)){setError("Use three safe integers: x,y,z");return}onSelect(value.split(",").map(Number).join(","));setError("")}}><label>Spatial address <input value={coordinate} onChange={event=>setCoordinate(event.target.value)} aria-label="Spatial address"/></label><button type="submit">Select address</button></form>
   {error?<p role="alert">{error}</p>:null}
   <div className="address-actions"><button type="button" onClick={onPause}>{paused?"Resume shared Act":"Pause shared Act"}</button><button type="button" onClick={onStep}>Advance one Act</button><span>Act {continuum.state.act}</span></div>
   <dl className="address-frame"><div><dt>WAS</dt><dd>{continuum.state.was.has(selected)?"DIFFERENT":"SAME"}</dd></div><div><dt>IS</dt><dd>{continuum.state.is.has(selected)?"DIFFERENT":"SAME"}</dd></div><div><dt>NEXT · calculated</dt><dd>{preview.state.is.has(selected)?"DIFFERENT":"SAME"}</dd></div></dl>
   <p>SELECTED six-face parity model · NEXT is a preview until the shared Act advances. Address navigation does not advance time.</p>
   <details><summary>Allowed NEXT directions</summary><p>From displayed {fieldRole}. {allowedNext.length} surviving successor addresses in the selected kernel. Multiple candidates remain alternatives; inspecting one does not commit it or exclude the others.</p>{allowedNext.map(item=><button type="button" key={item.address} disabled={fieldRole==="NEXT"} onClick={()=>onFollowNext(item.address)}>{fieldRole==="WAS"?"Inspect IS":"Inspect proposed"} {item.address}</button>)}{fieldRole==="NEXT"?<p>These are calculated beyond the displayed NEXT frame; they are not committed or traversed as current state.</p>:null}{allowedNext.length===0?<p>No admissible successor returned for this source at this Act.</p>:null}</details>
   <details><summary>Returned evidence and source arrivals</summary>
    <p>{receipt?`Receipt ${continuum.state.act-1} → ${continuum.state.act}: ${receipt.arrivalCount} arrivals · ${receipt.result}`:"No returned receipt at this address in the latest Act. SAME is absence of a represented Difference in this selected model."}</p>
    {receipt?.arrivals.map(arrival=><button type="button" key={arrival.source+arrival.face} onClick={()=>onSelect(arrival.source)}>SOURCE {arrival.source} · face {arrival.face}</button>)}
    <p>Calculated NEXT arrivals: {nextReceipt?.arrivalCount??0}</p>
    {nextReceipt?.arrivals.map(arrival=><button type="button" key={arrival.source+arrival.face} onClick={()=>onSelect(arrival.source)}>NEXT source {arrival.source} · face {arrival.face}</button>)}
    <a href={sourceHref({path:"src/model/kernel.ts",revision:inventory.source_revision})} target="_blank" rel="noreferrer">Inspect retained kernel source</a>
   </details>
  </section>
  <ReproducibilityExplorer onInspect={id=>{go(id);requestAnimationFrame(()=>sourceDetail.current?.focus())}}/>
  <section aria-label="Source-backed inventory">
   <h2>Source-backed field addresses</h2>
   <p>{inventory.entries.length} entries · {graph.nodes.length} addressed nodes · {graph.relations.length} binary relations. Finite inventory, not an infinite enumeration.</p>
   <label>Search term, symbol or binary locator<input ref={search} value={query} onChange={event=>setQuery(event.target.value)} placeholder="NOTHING, Φ, twist, 00000010…"/></label>
   <p role="status">{matched.length} matching addresses</p>
   <nav className="address-results" aria-label="Matching inventory addresses">{matched.map(item=><button type="button" key={item.id} aria-current={item.id===id?"true":undefined} onClick={()=>go(item.id)}><small>{item.inventory_binary_address||"ε"} · {item.status}</small>{item.label}</button>)}{matched.length===0?<p>No matching source address. Clear or change the search.</p>:null}</nav>
   <div className="address-actions"><button type="button" disabled={route.index===0} onClick={()=>setRoute(current=>({...current,index:current.index-1}))}>Back</button><button type="button" disabled={route.index===route.ids.length-1} onClick={()=>setRoute(current=>({...current,index:current.index+1}))}>Forward</button><button type="button" onClick={()=>go("inventory-root")}>Containing inventory</button></div>
   <article ref={sourceDetail} tabIndex={-1} aria-label="Selected inventory address"><h2>{node.label}</h2><p>{node.status} · locator {node.inventory_binary_address||"ε"} · {node.id}</p>
    <p>Binary locators are SELECTED inventory addresses. No spatial, per-grain geometric or source-identity mapping is asserted.</p>
    {entry?<><div className="address-actions" aria-label="Inventory state frame">{(["WAS","IS","NEXT"] as const).map(value=><button type="button" key={value} aria-pressed={role===value} onClick={()=>setRole(value)}>{value}</button>)}</div>
     {role==="WAS"?<section aria-label="WAS retained sources"><h3>WAS · retained sources</h3>{entry.sources.map(source=><p key={source.path}><a href={sourceHref(source)} target="_blank" rel="noreferrer">{source.path}</a> · {source.revision}</p>)}</section>:role==="IS"?<section aria-label="IS source statement"><h3>IS · {entry.status}</h3><p>{entry.support}</p><p>{entry.verification}</p></section>:<section aria-label="NEXT open remainder"><h3>NEXT · open remainder</h3><p>{entry.gap}</p><p>No new Act claimed. Candidate classification needs addressed rules and evidence.</p><div className="address-actions">{refinementIds.map(target=><button type="button" key={target} onClick={()=>go(target)}>{nodes.get(target)?.label}</button>)}</div></section>}
     <details><summary>Source evidence, verification and gap</summary><p>{entry.support}</p><p>{entry.verification}</p><p>{entry.gap}</p>{entry.sources.map(source=><p key={source.path}><a href={sourceHref(source)} target="_blank" rel="noreferrer">{source.path}</a></p>)}</details>
    </>:<p>SELECTED document grouping only. Follow CONTAINS edges to inspect its members.</p>}
    <h3>Binary relations · {relations.length}</h3><p>Support and membership do not imply elapsed pre-temporal sequence.</p>
    <ul className="address-relations">{relations.map((edge,index)=><li key={`${edge.left}-${edge.relation}-${edge.right}-${index}`}><div><button type="button" onClick={()=>go(edge.left)}>{nodes.get(edge.left)?.label??edge.left}</button><strong>{edge.relation}</strong><button type="button" onClick={()=>go(edge.right)}>{nodes.get(edge.right)?.label??edge.right}</button></div><small>{edge.status}</small><p>{edge.support}</p></li>)}</ul>
   </article>
  </section>
  <details><summary>Four unresolved geometry gaps</summary><ul>{OPEN_DIFFERENCES.map(gap=><li key={gap}>{gap}</li>)}</ul><p>Source declares twist, rotate and turn. Exact spatial twist remains unspecified; camera orientation is a viewing operation.</p></details>
  <details><summary>Retained source symbols · {inventory.retained_binary_relations.length}</summary>{inventory.retained_binary_relations.map(symbol=><p key={symbol}>{symbol}</p>)}</details>
  <FractureVideoProof/>
  <p><a href="./dca-atom-modeler.html" target="_blank" rel="noreferrer">Open separate DCA spiral modeler</a></p>
  <footer>Selection and search stay in this page’s memory. No private address data is loaded or sent. Source-stated and derived claims remain scoped; runtime identity is unverified.</footer>
 </aside>
}
