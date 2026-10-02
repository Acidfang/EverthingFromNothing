import {useEffect,useMemo,useRef,useState} from 'react'
import type {EILedger} from './model/ei-engine'
import {projectEIRootTree} from './model/ei-root-tree'
export function EIRootTree({ledger,address,revision,disabled,onSelect,onChooseZero}:{ledger:EILedger;address:string;revision:number|null;disabled:boolean;onSelect:(address:string)=>void;onChooseZero:()=>void}){
 const [open,setOpen]=useState(false),[expanded,setExpanded]=useState<Set<string>>(()=>new Set()),[focus,setFocus]=useState('')
 const root=useRef<HTMLDivElement>(null),toggle=useRef<HTMLButtonElement>(null)
 useEffect(()=>{const parents=new Map(ledger.records.map(record=>[record.address,record.parents])),pending=[...(parents.get(address)??[])],seen=new Set<string>();while(pending.length){const at=pending.pop()!;if(seen.has(at))continue;seen.add(at);pending.push(...(parents.get(at)??[]))}setExpanded(value=>new Set([...value,...seen]))},[ledger,address])
 const rows=useMemo(()=>projectEIRootTree(ledger,expanded),[ledger,expanded])
 const change=(at:string,value:boolean)=>setExpanded(previous=>{const next=new Set(previous);if(value)next.add(at);else next.delete(at);return next})
 const move=(key:string)=>{setFocus(key);requestAnimationFrame(()=>{const item=[...root.current?.querySelectorAll<HTMLElement>('[data-tree-key]')??[]].find(node=>node.dataset.treeKey===key);item?.focus()})}
 const focusKey=rows.some(row=>row.key===focus)?focus:rows.find(row=>row.address===address)?.key??rows[0]?.key
 return <div className="ei-root-tree"><button ref={toggle} aria-label="Show main root tree" aria-expanded={open} onClick={()=>setOpen(value=>!value)}>Roots</button>{open&&<div ref={root} role="tree" aria-label="Main root addresses" onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();setOpen(false);toggle.current?.focus()}}}>{rows.map((row,index)=><div key={row.key} role="treeitem" data-tree-key={row.key} data-tree-address={row.address} data-tree-revision={row.revision} aria-level={row.depth} aria-expanded={row.expandable?row.expanded:undefined} aria-selected={row.address===address&&(revision===null||revision===row.revision)} aria-disabled={disabled} aria-keyshortcuts={row.address===address?'0':undefined} tabIndex={row.key===focusKey?0:-1} style={{paddingLeft:8+(row.depth-1)*16}} onFocus={()=>setFocus(row.key)} onClick={()=>{if(!disabled)onSelect(row.address)}} onKeyDown={event=>{
 if(disabled)return
 const key=event.key
 if(['ArrowDown','ArrowUp','Home','End','ArrowLeft','ArrowRight','Enter',' '].includes(key)){event.preventDefault();event.stopPropagation()}
 if(key==='ArrowDown'&&rows[index+1])move(rows[index+1].key)
 else if(key==='ArrowUp'&&rows[index-1])move(rows[index-1].key)
 else if(key==='Home'&&rows[0])move(rows[0].key)
 else if(key==='End'&&rows.length)move(rows.at(-1)!.key)
 else if(key==='ArrowRight'){if(row.expandable&&!row.expanded)change(row.address,true);else if(rows[index+1]?.parentKey===row.key)move(rows[index+1].key)}
 else if(key==='ArrowLeft'){if(row.expanded)change(row.address,false);else if(row.parentKey)move(row.parentKey)}
 else if(key==='Enter'||key===' ')onSelect(row.address)
 else if(key==='0'&&row.address===address){event.preventDefault();event.stopPropagation();onChooseZero()}
 }}>
 {row.expandable&&<button tabIndex={-1} disabled={disabled} aria-label={`${row.expanded?'Collapse':'Expand'} ${row.address}`} onClick={event=>{event.stopPropagation();change(row.address,!row.expanded)}}>{row.expanded?'−':'+'}</button>}
 <span title={`${row.address} · IS ${row.revision} · ${row.sourceId}`}>{row.reference?'↗ ':''}{row.label}</span><small>{row.address}{row.unreached?' · unreached':''}</small>
 {row.address===address&&<button tabIndex={-1} disabled={disabled} aria-label={`Choose tree ${row.address} IS as ZERO`} onClick={event=>{event.stopPropagation();onChooseZero()}}>0</button>}
 </div>)}</div>}</div>
}
