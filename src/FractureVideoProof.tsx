/// <reference types="vite/client" />
import { useEffect, useRef, useState } from 'react'
import { deriveVideoPattern } from './model/video-pattern.ts'
import inventory from '../docs/FRACTURE-FIELD-INVENTORY.json'
import inventoryText from '../docs/FRACTURE-FIELD-INVENTORY.json?raw'
import './fracture-video-proof.css'

type Receipt = { frame: number; act: number; stateHash: string; proposedStateHash: string | null; previousReceiptSha256: string | null; receiptSha256: string; advanceAfterThisFrame: boolean; rawRGBSha256: string; logicalTick: number; delta: { changedPixels: number; reusedPixels: number; coveredPixels: number; fullBaselineEqual: boolean; unchangedPixelsBitIdentical: boolean }; draw: { width: number; height: number; assigned: number; complete: boolean; cancelled: boolean } }
type Plan = { sourceHashes: Record<string,string>; acts: { act: number; stateHash: string; nextHash: string | null; state: unknown }[] }
const base = `${import.meta.env.BASE_URL}fracture-proof/`
async function digest(value: string | ArrayBuffer) {
 const data = typeof value === 'string' ? new TextEncoder().encode(value) : value
 return [...new Uint8Array(await crypto.subtle.digest('SHA-256', data))].map(x => x.toString(16).padStart(2, '0')).join('')
}
/** Verifies an added video pattern against the unchanged existing map. Does not claim browser video generation. */
export function FractureVideoProof() {
 const [status, setStatus] = useState('12 seconds · 8 logical ticks → 8 delta frames · unchanged pixels retained')
 const [busy, setBusy] = useState(false)
 const abort = useRef<AbortController | null>(null)
 useEffect(() => () => abort.current?.abort(), [])
 async function verify() {
  if (abort.current) return
  const control = new AbortController(); abort.current = control; setBusy(true); setStatus('Replaying source states and checking the returned video…')
  try {
   async function get(name: string) { const r = await fetch(base + name, { signal: control.signal }); if (!r.ok) throw new Error(`${name}: HTTP ${r.status}`); return r }
   const plan = await (await get('plan.json')).json() as Plan
   const receipts = await (await get('frame-receipts.json')).json() as Receipt[]
   const verification = await (await get('verification.json')).json() as { videoSha256: string }
   if (plan.acts.length !== 8 || receipts.length !== 8) throw new Error('Unexpected proof bounds')
   let previous: string | null = null
   const replay = deriveVideoPattern(inventory)
   if(await digest(inventoryText) !== plan.sourceHashes['sources/FRACTURE-FIELD-INVENTORY.json']) throw new Error('Original map hash does not match the retained proof snapshot')
   for (const act of plan.acts) {
    const stateHash = await digest(JSON.stringify(replay[act.act]))
    if (stateHash !== act.stateHash || JSON.stringify(replay[act.act].state) !== JSON.stringify(act.state)) throw new Error(`Source constraint replay mismatch at Act ${act.act}`)
    const nextHash = act.act < 7 ? await digest(JSON.stringify(replay[act.act+1])) : null
    if(nextHash !== act.nextHash) throw new Error('Proposed-state mismatch')
    for (let held = 0; held < 1; held++) {
     const frame = act.act + held, r = receipts[frame]
     if (r.delta.changedPixels + r.delta.reusedPixels !== 921600 || r.delta.coveredPixels !== 921600 || !r.delta.fullBaselineEqual || !r.delta.unchangedPixelsBitIdentical || r.logicalTick !== act.act || r.frame !== frame || r.act !== act.act || r.stateHash !== stateHash || r.proposedStateHash !== nextHash || r.previousReceiptSha256 !== previous || r.advanceAfterThisFrame !== (act.act < 7) || r.draw.width !== 1280 || r.draw.height !== 720 || r.draw.assigned !== 921600 || !r.draw.complete || r.draw.cancelled) throw new Error(`Frame receipt mismatch at ${frame}`)
     const { receiptSha256, ...body } = r
     if (await digest(JSON.stringify(body)) !== receiptSha256) throw new Error(`Receipt hash mismatch at ${frame}`)
     previous = receiptSha256
    }
   }
   const video = await (await get('video.mp4')).arrayBuffer()
   if (await digest(video) !== verification.videoSha256) throw new Error('Returned video hash mismatch')
   if (!control.signal.aborted) setStatus('Verified: 8 source states, 8 linked delta-frame receipts, and the returned MP4 hash')
  } catch (error) {
   if (!control.signal.aborted) setStatus(`Verification failed: ${error instanceof Error ? error.message : String(error)}`)
  } finally { if (!control.signal.aborted) { setBusy(false); abort.current = null } }
 }
 return <section className="fracture-video-proof" aria-labelledby="fracture-video-title">
  <div><p className="fracture-video-kicker">ADDED PATTERN / EXISTING SCENE CONTAINER</p><h2 id="fracture-video-title">A video pattern in the existing map</h2>
  <p>This added output reads existing source-address, WAS / IS / NEXT, frame, delta-update, render-boundary and receipt records. It preserves the original map, container definitions and world Act. Only changed pixels are written; unchanged pixels carry forward. Every pattern tick returns one complete frame.</p></div>
  <video controls preload="metadata" poster={base + 'poster.png'} aria-label="Twelve-second source-driven WAS IS NEXT proof"><source src={base + 'video.mp4'} type="video/mp4" />Your browser cannot play the preview. Use Download video.</video>
  <div className="fracture-video-actions"><button onClick={() => void verify()} disabled={busy}>{busy ? 'Verifying…' : 'Run deterministic replay'}</button><a href={base + 'video.mp4'} download="fracture-proof.mp4">Download video</a><a href={base + 'frame-receipts.json'} download>Export frame receipts</a><a href={base + 'source.zip'} download>Download reproducible source</a></div>
  <p role="status" aria-live="polite">{status}</p>
  <details><summary>What does this added layer verify?</summary><p><strong>Verified:</strong> original map hash, source-linked content at the existing scene container, complete changed/reused pixel coverage, one frame per pattern tick, deterministic replay and returned MP4 identity. The browser button checks stored receipts and source content; it does not rerender raw pixels.</p><p><strong>Output-format choices:</strong> layout, colors, finite resolution and 1.5-second display duration per tick. They do not constrain or replace the map.</p><p><strong>Scope:</strong> a bounded video-path proof using existing source records. It adds no synthetic metric world, spatial law, new map topology or semantic comic-generation model.</p></details>
 </section>
}
