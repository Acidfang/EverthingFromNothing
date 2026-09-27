import { useMemo, useState } from "react"
import { FirstActExplorer } from "./model/explorer.ts"

type Channel = "NONE" | "FILTER" | "ISOLATE" | "RECONSTRUCT"

type FieldAddress = {
  grain: number
  act: number
  x: number
  y: number
  z: number
  depth: number
  channel: Channel
  subject?: string
}

const DEFAULT_ADDRESS: FieldAddress = { grain: 0, act: 0, x: 0, y: 0, z: 0, depth: 1, channel: "NONE" }

function readAddress(): FieldAddress {
  const source = new URLSearchParams(location.search).get("field") || new URLSearchParams(location.hash.replace(/^#/, "")).get("field")
  if (!source) return DEFAULT_ADDRESS
  try {
    const value = JSON.parse(decodeURIComponent(source)) as Partial<FieldAddress>
    return { ...DEFAULT_ADDRESS, ...value }
  } catch {
    return DEFAULT_ADDRESS
  }
}

function writeAddress(address: FieldAddress) {
  const encoded = encodeURIComponent(JSON.stringify(address))
  history.replaceState(null, "", `${location.pathname}#field=${encoded}`)
}

export function InfinityApp() {
  const explorer = useMemo(() => new FirstActExplorer(), [])
  const [address, setAddress] = useState<FieldAddress>(() => readAddress())
  const [frame, setFrame] = useState(() => explorer.frame())
  const [message, setMessage] = useState("Whole loaded")

  const apply = (next: FieldAddress) => {
    setAddress(next)
    writeAddress(next)
    try {
      explorer.setQueryDepth(Math.max(0, Math.min(4, next.depth)))
      setFrame(explorer.frame())
      setMessage(`${next.channel}: Whole preserved at ${next.x},${next.y},${next.z}`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to resolve address")
    }
  }

  const requestMedia = async (kind: "microphone" | "camera") => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: kind === "microphone", video: kind === "camera" })
      stream.getTracks().forEach((track) => track.stop())
      setMessage(`${kind} permission available for this addressed client`)
    } catch {
      setMessage(`${kind} permission not granted or unavailable`)
    }
  }

  const requestUsb = async () => {
    try {
      const usb = (navigator as Navigator & { usb?: { requestDevice(options: { filters: unknown[] }): Promise<unknown> } }).usb
      if (!usb) throw new Error("WebUSB unavailable")
      await usb.requestDevice({ filters: [] })
      setMessage("USB device permission granted to this client")
    } catch {
      setMessage("USB permission not granted or WebUSB unavailable")
    }
  }

  return <main className="infinity-map">
    <header className="infinity-hud">
      <strong>INFINITY FIELD</strong>
      <span>{message}</span>
      <button onClick={() => document.documentElement.requestFullscreen?.()}>Fullscreen</button>
    </header>

    <section className="infinity-field" aria-label="Infinity field map">
      <div className="infinity-centre">
        <div className="infinity-zero">0</div>
        <div className="infinity-address">{`G${address.grain} · A${address.act} · ${address.x},${address.y},${address.z}`}</div>
        <div className="infinity-stats">Whole {frame.recursiveQuery.eventCount} events · {frame.recursiveQuery.relationCount} relations · {frame.recursiveQuery.frontierCount} frontier</div>
      </div>
      <div className="infinity-channels">
        {(["FILTER", "ISOLATE", "RECONSTRUCT", "NONE"] as Channel[]).map((channel) =>
          <button key={channel} data-active={address.channel === channel} onClick={() => apply({ ...address, channel })}>{channel === "NONE" ? "DO NOTHING / MOVE ON" : channel}</button>
        )}
      </div>
    </section>

    <aside className="infinity-controls">
      <label>Depth <input type="range" min="0" max="4" value={address.depth} onChange={(e) => apply({ ...address, depth: Number(e.target.value) })} /></label>
      <button onClick={() => requestMedia("microphone")}>Microphone</button>
      <button onClick={() => requestMedia("camera")}>Camera</button>
      <button onClick={requestUsb}>USB</button>
      <button onClick={() => navigator.clipboard?.writeText(location.href)}>Copy address</button>
    </aside>
  </main>
}
