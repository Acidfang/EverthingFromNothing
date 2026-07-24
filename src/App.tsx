import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react"
import {
  FirstActExplorer,
  type ExplorerFrame,
} from "./model/explorer.ts"
import type { ScenePoint } from "./model/scene.ts"

const STATUS_ORDER = ["GIVEN", "DERIVED", "SELECTED", "GENERATED", "UNRESOLVED"] as const
const PLAYBACK_SPEEDS = [
  { label: "0.5×", milliseconds: 1400 },
  { label: "1×", milliseconds: 700 },
  { label: "2×", milliseconds: 350 },
] as const

type ProjectedPoint = Readonly<{
  point: ScenePoint
  x: number
  y: number
}>

function project([x, y, z]: readonly [number, number, number]): readonly [number, number] {
  return [400 + (x - y) * 92, 260 + (x + y) * 45 - z * 84]
}

function compactAddress(address: string): string {
  return address.replaceAll(",", " ")
}

function FieldCanvas({
  frame,
  onSelect,
  isPlaying,
}: Readonly<{
  frame: ExplorerFrame
  onSelect: (address: string) => void
  isPlaying: boolean
}>) {
  const projected = useMemo<ProjectedPoint[]>(
    () => frame.scene.points.map((point) => {
      const [x, y] = project(point.position)
      return { point, x, y }
    }),
    [frame.scene.points],
  )
  const byId = useMemo(
    () => new Map(projected.map((item) => [item.point.id, item])),
    [projected],
  )
  const momentPoints = useMemo(() => {
    const fieldByAddress = new Map(
      frame.formation.fields.flatMap((field, fieldIndex) =>
        field.addresses.map((address) => [address, fieldIndex] as const),
      ),
    )
    const addresses = frame.chronology.is.map((address) => {
      const [x, y, z] = address.split(",").map(Number)
      return { address, fieldIndex: fieldByAddress.get(address) ?? 0, x, y, z }
    })
    const extent = Math.max(
      1,
      ...addresses.flatMap(({ x, y, z }) => [
        Math.abs(x),
        Math.abs(y),
        Math.abs(z),
      ]),
    )
    const scale = Math.min(72, 245 / (extent * 2))
    return addresses.map(({ address, fieldIndex, x, y, z }) => ({
      address,
      fieldIndex,
      x: 400 + (x - y) * scale,
      y: 260 + (x + y) * scale * 0.48 - z * scale * 0.92,
    }))
  }, [frame.chronology.is])

  const selectByKey = (
    event: KeyboardEvent<SVGGElement>,
    address: string,
  ): void => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      onSelect(address)
    }
  }

  return (
    <div
      className={`field-wrap ${isPlaying ? "is-playing" : ""}`}
      data-act={frame.observer.act}
    >
      <svg
        className="field"
        viewBox="0 0 800 520"
        role="img"
        aria-labelledby="field-title field-description"
      >
        <title id="field-title">First complete whole projection</title>
        <desc id="field-description">{frame.scene.accessibilitySummary}</desc>
        <defs>
          <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
            <path d="M 24 0 L 0 0 0 24" className="grid-line" />
          </pattern>
          <radialGradient id="field-fade">
            <stop offset="0%" stopColor="var(--surface-2)" stopOpacity=".85" />
            <stop offset="100%" stopColor="var(--surface-0)" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="800" height="520" fill="url(#grid)" />
        <ellipse cx="400" cy="265" rx="330" ry="225" fill="url(#field-fade)" />
        <g className="edges" aria-hidden="true">
          {frame.scene.edges.map((edge) => {
            const from = byId.get(edge.from)
            const to = byId.get(edge.to)
            if (!from || !to) return null
            return (
              <line
                key={edge.id}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                className="presentation-edge"
              />
            )
          })}
        </g>
        <g aria-label="Complete child wholes">
          {projected
            .filter(({ point }) => point.kind === "CHILD_WHOLE")
            .map(({ point, x, y }) => (
              <g key={point.id} transform={`translate(${x} ${y})`} className="source-node">
                <rect x="-9" y="-9" width="18" height="18" rx="2" />
                <path d="M -5 0 H 5 M 0 -5 V 5" />
              </g>
            ))}
        </g>
        <g aria-label="Resolved relations">
          {projected
            .filter(({ point }) => point.kind === "RESOLVED_RELATION")
            .map(({ point, x, y }) => {
              const address = point.id.slice("relation:".length)
              const label =
                `${address}; ${point.arrivalCount} arrivals; result ${point.result}`
              return (
                <g
                  key={point.id}
                  transform={`translate(${x} ${y})`}
                  className={`relation-node ${point.result.toLowerCase()} ${
                    point.selected ? "selected" : ""
                  }`}
                  role="button"
                  aria-label={label}
                  aria-pressed={point.selected}
                  tabIndex={0}
                  onClick={() => onSelect(address)}
                  onKeyDown={(event) => selectByKey(event, address)}
                >
                  <circle r={point.arrivalCount === 6 ? 13 : point.arrivalCount === 2 ? 9 : 7} />
                  {point.arrivalCount > 1 ? (
                    <text y="3">{point.arrivalCount}</text>
                  ) : null}
                </g>
              )
            })}
        </g>
        <g
          className="moment-field"
          aria-label={`Moment ${frame.observer.act}: ${momentPoints.length} active Differences`}
        >
          {momentPoints.map((point) => (
            <circle
              key={`${frame.observer.act}:${point.address}`}
              className={`detected-field-${point.fieldIndex % 6}`}
              cx={point.x}
              cy={point.y}
              r={momentPoints.length > 500 ? 1.7 : momentPoints.length > 100 ? 2.3 : 3.4}
            />
          ))}
        </g>
        <g className="axis" aria-hidden="true">
          <line x1="400" y1="260" x2="500" y2="309" />
          <line x1="400" y1="260" x2="300" y2="309" />
          <line x1="400" y1="260" x2="400" y2="168" />
          <text x="506" y="315">+X</text>
          <text x="277" y="315">+Y</text>
          <text x="407" y="158">+Z</text>
        </g>
      </svg>
      <div className="canvas-caption">
        <span>Moment {frame.observer.act} · {momentPoints.length} active Differences</span>
        <span>Completed whole remains beneath as the containing relation</span>
      </div>
    </div>
  )
}

function StatusMark({ status }: Readonly<{ status: string }>) {
  return <span className={`status-mark status-${status.toLowerCase()}`}>{status}</span>
}

export function App() {
  const explorer = useRef<FirstActExplorer | null>(null)
  if (explorer.current === null) explorer.current = new FirstActExplorer()
  const [frame, setFrame] = useState(() => explorer.current!.frame())
  const [leftOpen, setLeftOpen] = useState(true)
  const [rightOpen, setRightOpen] = useState(true)
  const [ledgerOpen, setLedgerOpen] = useState(true)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playbackSpeed, setPlaybackSpeed] = useState(700)
  const [targetMoment, setTargetMoment] = useState(
    () => frame.observer.act + 1,
  )

  const update = useCallback((next: ExplorerFrame) => setFrame(next), [])
  const resolve = useCallback(
    () => update(explorer.current!.resolveOneTick()),
    [update],
  )
  const resetPlayback = useCallback(() => {
    setIsPlaying(false)
    explorer.current = new FirstActExplorer()
    update(explorer.current.frame())
  }, [update])
  const was = useCallback(
    () => update(explorer.current!.returnToWas()),
    [update],
  )
  const enter = useCallback(
    () => update(explorer.current!.enterWhole()),
    [update],
  )
  const outward = useCallback(
    () => update(explorer.current!.returnOutward()),
    [update],
  )
  const setDepth = useCallback(
    (depth: number) => update(explorer.current!.setQueryDepth(depth)),
    [update],
  )
  const selectRelation = useCallback(
    (address: string) =>
      update(explorer.current!.selectProjectionRelation(address)),
    [update],
  )

  useEffect(() => {
    if (!isPlaying) return
    if (frame.observer.act === targetMoment) {
      setIsPlaying(false)
      return
    }
    const advance = frame.observer.act < targetMoment ? resolve : was
    const timer = window.setTimeout(advance, playbackSpeed)
    return () => window.clearTimeout(timer)
  }, [
    frame.observer.act,
    isPlaying,
    playbackSpeed,
    resolve,
    targetMoment,
    was,
  ])

  useEffect(() => {
    const handleKey = (event: globalThis.KeyboardEvent): void => {
      if (event.target instanceof HTMLInputElement) return
      if (event.code === "Space") {
        event.preventDefault()
        setIsPlaying(false)
        if (event.shiftKey) was()
        else resolve()
      } else if (event.key === "[") {
        setDepth(Math.max(0, frame.observer.queryDepth - 1))
      } else if (event.key === "]") {
        setDepth(Math.min(4, frame.observer.queryDepth + 1))
      }
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [frame.observer.queryDepth, resolve, setDepth, was])

  const chronology = [
    { label: "WAS", value: frame.chronology.was.length },
    { label: "IS", value: frame.chronology.is.length },
    {
      label: "NEXT",
      value: frame.chronology.next === null ? "—" : frame.chronology.next.length,
    },
  ]
  const selectedEntry = frame.selected?.source === "WHOLE_PROJECTION"
    ? frame.wholeProjection.entries.find(
      (entry) => entry.normalizedAddress === frame.selected?.address,
    )
    : null

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="identity">
          <span className="binary-mark" aria-hidden="true">01</span>
          <div>
            <h1>FIRST ACT</h1>
            <p>Difference / Resolution explorer</p>
          </div>
        </div>
        <div className="chronology" aria-label="Shared chronology">
          {chronology.map((item) => (
            <div className={item.label === "IS" ? "now" : ""} key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>
        <div className="playback-controls">
          <button
            className={`play-action ${isPlaying ? "playing" : ""}`}
            type="button"
            onClick={() => {
              if (frame.observer.act === targetMoment && targetMoment > 0) {
                resetPlayback()
                setIsPlaying(true)
                return
              }
              setIsPlaying((playing) => !playing)
            }}
            aria-pressed={isPlaying}
            disabled={frame.observer.act === 0 && targetMoment === 0}
          >
            <span aria-hidden="true">{isPlaying ? "Ⅱ" : "▶"}</span>
            <span>
              {isPlaying
                ? "Pause formation"
                : frame.observer.act === targetMoment
                  ? `Replay to ${targetMoment}`
                  : `Play to ${targetMoment}`}
            </span>
          </button>
          <label className="moment-control">
            <span>Target moment</span>
            <input
              type="number"
              min="0"
              step="1"
              value={targetMoment}
              onChange={(event) => {
                const requested = Number(event.target.value)
                if (!Number.isSafeInteger(requested) || requested < 0) return
                setIsPlaying(false)
                setTargetMoment(requested)
              }}
              aria-label="Target moment"
            />
          </label>
          <label className="speed-control">
            <span>Speed</span>
            <select
              value={playbackSpeed}
              onChange={(event) => setPlaybackSpeed(Number(event.target.value))}
              aria-label="Playback speed"
            >
              {PLAYBACK_SPEEDS.map((speed) => (
                <option key={speed.label} value={speed.milliseconds}>
                  {speed.label}
                </option>
              ))}
            </select>
          </label>
          <button
            className="primary-action"
            type="button"
            onClick={() => {
              setIsPlaying(false)
              resolve()
            }}
          >
            <span>One tick</span>
            <kbd>Space</kbd>
          </button>
          <button className="reset-action" type="button" onClick={resetPlayback}>
            Reset
          </button>
        </div>
      </header>

      <section
        className={`workspace ${leftOpen ? "" : "left-closed"} ${
          rightOpen ? "" : "right-closed"
        }`}
      >
        <aside className="rail provenance-rail" aria-label="Causal derivation">
          <div className="rail-heading">
            <div>
              <span className="eyebrow">Causal ancestry</span>
              <h2>What allows</h2>
            </div>
            <button
              className="icon-button"
              type="button"
              onClick={() => setLeftOpen(false)}
              aria-label="Collapse causal ancestry"
            >‹</button>
          </div>
          <ol className="provenance-list">
            {frame.provenance.map((node, index) => (
              <li key={node.id} className={`provenance-node ${node.status.toLowerCase()}`}>
                <span className="node-index">{String(index).padStart(2, "0")}</span>
                <div>
                  <StatusMark status={node.status} />
                  <h3>{node.label}</h3>
                  <p>{node.reason}</p>
                </div>
              </li>
            ))}
          </ol>
        </aside>

        {!leftOpen ? (
          <button
            type="button"
            className="rail-tab left-tab"
            onClick={() => setLeftOpen(true)}
          >What allows</button>
        ) : null}

        <section className="stage" aria-label="Field explorer">
          <div className="stage-toolbar">
            <div className="location">
              <span>Act {frame.observer.act}</span>
              <span>Grain {frame.observer.relativeGrain}</span>
              <span>Address {frame.observer.spatialAddress}</span>
            </div>
            <div className="toolbar-actions">
              <button type="button" onClick={was} disabled={frame.observer.act === 0}>
                Return to WAS
              </button>
              <button type="button" onClick={outward} disabled={frame.observer.relativeWholePath.length === 0}>
                Return outward
              </button>
              <button type="button" onClick={enter}>Enter whole</button>
            </div>
          </div>
          <FieldCanvas
            frame={frame}
            onSelect={selectRelation}
            isPlaying={isPlaying}
          />
          <div className="field-status" aria-live="polite">
            <div>
              <span className="eyebrow">Observer</span>
              <strong>
                {frame.observer.relativeWholePath.length === 0
                  ? "Containing whole"
                  : frame.observer.relativeWholePath.join(" / ")}
              </strong>
            </div>
            <div>
              <span className="eyebrow">Recursive query</span>
              <strong>{frame.recursiveQuery.eventCount} events</strong>
            </div>
            <div>
              <span className="eyebrow">Frontier</span>
              <strong>{frame.recursiveQuery.frontierCount} expandable</strong>
            </div>
            <label className="depth-control">
              <span>Depth {frame.observer.queryDepth}</span>
              <input
                type="range"
                min="0"
                max="4"
                value={frame.observer.queryDepth}
                onChange={(event) => setDepth(Number(event.target.value))}
              />
            </label>
          </div>
        </section>

        {!rightOpen ? (
          <button
            type="button"
            className="rail-tab right-tab"
            onClick={() => setRightOpen(true)}
          >Inspect</button>
        ) : null}

        <aside className="rail inspector-rail" aria-label="Selected relation inspector">
          <div className="rail-heading">
            <div>
              <span className="eyebrow">Current frame</span>
              <h2>Resolution</h2>
            </div>
            <button
              className="icon-button"
              type="button"
              onClick={() => setRightOpen(false)}
              aria-label="Collapse inspector"
            >›</button>
          </div>
          <section className="formation-analysis" aria-label="Moment formation analysis">
            <div className="analysis-heading">
              <div>
                <span className="eyebrow">Detected this moment</span>
                <h3>Fields & model energies</h3>
              </div>
              <StatusMark status="GENERATED" />
            </div>
            <dl className="formation-metrics">
              <div><dt>Connected fields</dt><dd>{frame.formation.fieldCount}</dd></div>
              <div><dt>Largest field</dt><dd>{frame.formation.largestField}</dd></div>
              <div><dt>Appeared</dt><dd>+{frame.formation.appearedDifferences}</dd></div>
              <div><dt>Resolved</dt><dd>−{frame.formation.resolvedDifferences}</dd></div>
            </dl>
            <div className="energy-grid">
              <div>
                <span>Difference</span>
                <strong>{frame.formation.modelEnergy.difference}</strong>
              </div>
              <div>
                <span>Transition</span>
                <strong>{frame.formation.modelEnergy.transition}</strong>
              </div>
              <div>
                <span>Boundary</span>
                <strong>{frame.formation.modelEnergy.boundary}</strong>
              </div>
            </div>
            <ol className="detected-fields">
              {frame.formation.fields.slice(0, 6).map((field, index) => (
                <li key={field.id}>
                  <i className={`field-swatch detected-field-${index % 6}`} />
                  <span>Field {index + 1}</span>
                  <strong>{field.activeDifferences} Δ</strong>
                  <small>{field.boundaryFaces} faces</small>
                </li>
              ))}
            </ol>
            <p className="energy-qualification">
              Fields connect through a shared possible resolving source. Exact
              model counts; no physical unit or external identity is assigned.
            </p>
          </section>
          <dl className="metric-list">
            <div><dt>Inward wholes</dt><dd>6</dd></div>
            <div><dt>Presentations</dt><dd>{frame.wholeProjection.presentations}</dd></div>
            <div><dt>Resolved Same</dt><dd>{frame.wholeProjection.resolvedSame}</dd></div>
            <div><dt>Outward Difference</dt><dd>{frame.wholeProjection.outwardDifference}</dd></div>
          </dl>
          <div className="selection">
            <span className="eyebrow">Selected relation</span>
            {selectedEntry ? (
              <>
                <strong>{compactAddress(selectedEntry.normalizedAddress)}</strong>
                <dl>
                  <div><dt>Arrivals</dt><dd>{selectedEntry.arrivalCount}</dd></div>
                  <div><dt>Result</dt><dd>{selectedEntry.result}</dd></div>
                </dl>
                <p>{selectedEntry.contributors.join(" · ")}</p>
              </>
            ) : (
              <p>Select any relation point to inspect why it exists.</p>
            )}
          </div>
          <div className="legend" aria-label="Provenance legend">
            {STATUS_ORDER.map((status) => (
              <div key={status}><StatusMark status={status} /><span>{
                status === "SELECTED" ? "formalization" :
                  status === "UNRESOLVED" ? "interpretation" : "statement"
              }</span></div>
            ))}
          </div>
        </aside>
      </section>

      <section className={`ledger ${ledgerOpen ? "" : "ledger-closed"}`}>
        <button
          type="button"
          className="ledger-toggle"
          onClick={() => setLedgerOpen((open) => !open)}
          aria-expanded={ledgerOpen}
        >
          <span>Causal ledger</span>
          <span>{ledgerOpen ? "Close" : "Open"}</span>
        </button>
        {ledgerOpen ? (
          <div className="ledger-body">
            <div className="ledger-sequence">
              {chronology.map((item, index) => (
                <div className="moment" key={item.label}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                  <small>{index === 0 ? "retained" : index === 1 ? "observed" : "not yet committed"}</small>
                </div>
              ))}
            </div>
            <div className="why">
              <div>
                <span className="eyebrow">Why this exists</span>
                <h2>{frame.explanation?.title ?? "Select a generated relation"}</h2>
              </div>
              {frame.explanation ? (
                <>
                  <StatusMark status={frame.explanation.status} />
                  <ol>
                    {frame.explanation.because.map((reason) => <li key={reason}>{reason}</li>)}
                  </ol>
                  <div className="claim-gate">
                    External physical comparison:
                    <strong>{frame.explanation.externalComparisonAllowed ? " allowed" : " blocked"}</strong>
                  </div>
                </>
              ) : (
                <p>The ledger will reconstruct the selected relation from its contributors and declared operation.</p>
              )}
            </div>
          </div>
        ) : null}
      </section>
      <footer>
        <span>Kernel {frame.kernelVersion}</span>
        <span>One shared Act · complete snapshots · reversible update</span>
        <a href="https://github.com/Acidfang/EverthingFromNothing/blob/main/ACT-AND-EFFECT.md">
          ACT / EFFECT
        </a>
        <a href="https://github.com/Acidfang/EverthingFromNothing">Source and limitations</a>
      </footer>
    </main>
  )
}
