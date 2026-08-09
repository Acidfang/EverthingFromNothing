import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react"
import {
  FirstActExplorer,
  type ExplorerFrame,
} from "./model/explorer.ts"
import {
  combineFaceViews,
  observe,
  observeFromSixFaces,
  resolveViewRemainders,
  type ObserverFace,
  type Sight,
} from "./model/observation.ts"
import { fromKey } from "./model/address.ts"
import { generateLineageLevel, lineageCount } from "./model/lineage.ts"
import { analysePotential } from "./model/potential.ts"
import { searchAtomInvariants } from "./model/atom-search.ts"
import {
  PARTICLE_MOMENTS_PER_ACT,
  PARTICLE_ROTATIONS_PER_ACT,
  deriveFirstActParticle,
  sampleParticleHelix,
  type ParticleCausalTrace,
  type ParticleForceMoment,
  type ParticleTransformStep,
} from "./model/particle.ts"
import {
  emptyThoughtState,
  resolveThought,
  type ThoughtResolution,
} from "./model/thought.ts"
import type { ScenePoint } from "./model/scene.ts"
import { deriveNestedGrain } from "./model/grain.ts"
import { verifySphericalClosure } from "./model/field-closure.ts"
import {
  buildGrainPlayback,
  GRAIN_PLAYBACK_MOMENTS,
  planCrossGrainResolution,
} from "./model/grain-playback.ts"
import {
  buildStateTransferEngine,
  resolveRecursiveSweep,
  resolveReceiverView,
} from "./model/state-transfer.ts"
import {
  EARTH_OBSERVATIONS,
  resolveEarthCandidates,
} from "./model/earth-observation.ts"
import {
  CUBE_RESOLUTION_COUNTS,
  CUBE_RESOLUTION_POINTS,
  CUBE_RESOLUTION_RADII,
  CUBE_WHOLE_MOMENT,
  type CubeResolutionKind,
} from "./model/cube-resolution.ts"
import {
  TRIANGULAR_PRISM_RESOLUTION_COUNTS,
  TRIANGULAR_PRISM_RESOLUTION_POINTS,
  TRIANGULAR_PRISM_WHOLE_MOMENT,
} from "./model/triangular-prism-resolution.ts"
import { COMPLETE_GEOMETRY_RESOLUTION } from "./model/resolution-catalogue.ts"
import { COLLISION_RESOLUTION_RULE } from "./model/collision-resolution.ts"
import {
  COMPLETE_MEDIUM_ANALYSIS,
  SHAPE_MEDIUM_ANALYSIS,
} from "./model/medium-resolution.ts"
import {
  SIMULTANEOUS_RECURSIVE_VOLUME,
  recursiveGapAtGrain,
} from "./model/volume-gap.ts"
import { reconstructFirstAct } from "./model/first-act.ts"

const STATUS_ORDER = ["GIVEN", "DERIVED", "SELECTED", "GENERATED", "UNRESOLVED"] as const
const PLAYBACK_SPEEDS = [
  { label: "0.5×", milliseconds: 240 },
  { label: "1×", milliseconds: 120 },
  { label: "2×", milliseconds: 60 },
] as const
const INITIAL_SPIRAL_DISCOVERY = deriveNestedGrain("1,0,0", 0)
const ATOM_FIELD_MOMENT = INITIAL_SPIRAL_DISCOVERY.moments.length
const FIRST_ACT_RESOLUTION = reconstructFirstAct()

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

function OperatorResolutionStage({
  moment,
  isPlaying,
  onMomentChange,
  onTogglePlay,
}: Readonly<{
  moment: number
  isPlaying: boolean
  onMomentChange: (moment: number) => void
  onTogglePlay: () => void
}>) {
  const [depth, setDepth] = useState(1)
  const nestedMoment = moment === 0
    ? null
    : INITIAL_SPIRAL_DISCOVERY.moments[Math.min(moment, ATOM_FIELD_MOMENT) - 1]
  const childScale = 2 ** -depth
  const projectedDisplacement = .5 ** depth
  const boundaryState = depth === 1 ? "BOUNDARY REMAINDER" : "UNRESOLVED"
  const localPhase = moment === 0
    ? "WAS · NO LOCAL PATH"
    : moment === 1
      ? "IS · FIRST TRANSFER"
      : moment < ATOM_FIELD_MOMENT
        ? "IS · TURNING TRANSFER"
        : "IS · COMPLETE LOCAL FIELD"
  const localPoints = nestedMoment?.states.map((state) => ({
    x: 320 + state.localPosition.x * 120,
    y: 210 + state.localPosition.y * 120 - state.localPosition.z * 64,
  })) ?? []
  const originalNodes = Array.from({ length: 6 }, (_, index) => {
    const angle = Math.PI * 2 * index / 6
    return {
      x: 250 + Math.cos(angle) * 112,
      y: 210 + Math.sin(angle) * 112,
    }
  })
  const missingVariable = 0
  const mechanismMoment = FIRST_ACT_RESOLUTION.moments[Math.min(moment, 5)]

  return (
    <section className="operator-stage" aria-labelledby="operator-stage-title">
      <header className="operator-stage-heading">
        <div>
          <h2 id="operator-stage-title">Everything begins with one Difference</h2>
          <p>
            The generating ledger comes first. Geometry, binary and parity are
            later projections and cannot create their own Root.
          </p>
        </div>
        <div className="operator-stage-readout" aria-live="polite">
          <span>MOMENT</span>
          <strong>{moment} / {ATOM_FIELD_MOMENT}</strong>
          <span>GRAIN</span>
          <strong>0 → -{depth}</strong>
        </div>
      </header>

      <section className="generating-ledger" aria-label="Carrier-independent First Act resolution">
        <div className="generating-now">
          <span>ROOT · {mechanismMoment.root}</span>
          <strong>{mechanismMoment.did}</strong>
          <p>{mechanismMoment.evidence}</p>
        </div>
        <ol>
          {FIRST_ACT_RESOLUTION.moments.map((state) => (
            <li
              key={state.moment}
              className={state.moment === mechanismMoment.moment ? "active" : state.moment < mechanismMoment.moment ? "passed" : ""}
            >
              <span>M{state.moment} · {state.status}</span>
              <strong>{state.is.length === 0 ? "NO REPRESENTED DIFFERENCE" : state.is.join(" · ")}</strong>
              <small>WAS → {state.did} → IS → {state.canBe.join(" / ")}</small>
            </li>
          ))}
        </ol>
        <div className="projection-gate">
          <span>SELECTED ONLY AFTER ADMISSION</span>
          <strong>{FIRST_ACT_RESOLUTION.selectedProjections.join(" · ")}</strong>
        </div>
      </section>

      <div className="operator-views">
        <section className="operator-view original-view" aria-label="Original view">
          <div className="operator-view-title">
            <span>ORIGINAL VIEW</span>
            <strong>ME RETAINED</strong>
          </div>
          <svg viewBox="0 0 500 420" role="img" aria-label="Original observer retains the whole">
            <circle className="operator-boundary" cx="250" cy="210" r="154" />
            <circle className="operator-range" cx="250" cy="210" r="112" />
            {originalNodes.map((node, index) => (
              <g key={index}>
                <line
                  className="operator-relation"
                  x1="250"
                  y1="210"
                  x2={node.x}
                  y2={node.y}
                />
                <circle className="operator-node" cx={node.x} cy={node.y} r="5" />
              </g>
            ))}
            <circle className="operator-nothing" cx="250" cy="210" r="18" />
            <text className="operator-nothing-label" x="250" y="215">NOTHING</text>
            <path
              className="operator-inward"
              d="M 86 210 C 132 110, 194 126, 232 191"
            />
            <path
              className="operator-outward"
              d="M 268 191 C 306 126, 368 110, 414 210"
            />
            <text className="operator-direction-label" x="92" y="190">INWARD</text>
            <text className="operator-direction-label" x="364" y="190">OUTWARD</text>
          </svg>
          <dl className="operator-view-stats">
            <div><dt>VISIBLE</dt><dd>WHOLE</dd></div>
            <div><dt>{boundaryState}</dt><dd>{projectedDisplacement.toFixed(4)} CELL</dd></div>
          </dl>
        </section>

        <div className="operator-fold" aria-hidden="true">
          <span>INWARD</span>
          <i />
          <b>NOTHING</b>
          <i />
          <span>OUTWARD</span>
        </div>

        <section className="operator-view local-view" aria-label="Local grain view">
          <div className="operator-view-title">
            <span>LOCAL GRAIN VIEW</span>
            <strong>{localPhase}</strong>
          </div>
          <svg viewBox="0 0 500 420" role="img" aria-label="Local field resolves from its own centre">
            <circle className="operator-boundary local" cx="250" cy="210" r="154" />
            <circle className="operator-nothing" cx="250" cy="210" r="18" />
            <text className="operator-nothing-label" x="250" y="215">NOTHING</text>
            {localPoints.map((point, index) => (
              <g key={index}>
                <path
                  className={`local-trace ${moment >= 2 ? "turning" : ""}`}
                  d={`M 250 210 Q ${
                    250 + (point.x - 250) * .45 - (point.y - 210) * .28
                  } ${
                    210 + (point.y - 210) * .45 + (point.x - 250) * .28
                  } ${point.x} ${point.y}`}
                />
                <circle className="operator-node local" cx={point.x} cy={point.y} r="5" />
              </g>
            ))}
            {moment === 0 ? (
              <text className="operator-empty-label" x="250" y="278">
                LOCAL FIELD NOT YET EXPRESSED
              </text>
            ) : null}
          </svg>
          <dl className="operator-view-stats">
            <div><dt>LOCAL SCALE</dt><dd>{childScale.toFixed(4)}</dd></div>
            <div><dt>NEXT</dt><dd>{moment === 36 ? "ME" : "RESOLVE"}</dd></div>
          </dl>
        </section>
      </div>

      <div className="operator-ledger">
        <div className="operator-timeline">
          {([
            [0, "WAS"],
            [1, "TRANSFER"],
            [2, "TURNING"],
            [36, "IS"],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={moment === value ? "active" : moment > value ? "passed" : ""}
              onClick={() => onMomentChange(Number(value))}
            >
              <span>{label}</span>
              <strong>{value}</strong>
            </button>
          ))}
        </div>
        <label className="operator-scrubber">
          <span>RESOLUTION MOMENT</span>
          <input
            type="range"
            min="0"
            max={ATOM_FIELD_MOMENT}
            value={moment}
            onChange={(event) => onMomentChange(Number(event.target.value))}
          />
        </label>
        <div className="operator-actions">
          <button type="button" onClick={onTogglePlay}>
            {isPlaying ? "PAUSE" : "PLAY"}
          </button>
          <label>
            <span>GRAIN DEPTH</span>
            <select value={depth} onChange={(event) => setDepth(Number(event.target.value))}>
              {[1, 2, 3, 4].map((value) => (
                <option value={value} key={value}>-{value}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="missing-variable-audit">
          <span>MISSING VARIABLE</span>
          <strong>{missingVariable}</strong>
          <small>VISIBLE + REMAINDER + REFERENCE = RECONSTRUCTED WHOLE</small>
        </div>
      </div>
    </section>
  )
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

function faceProjection(
  face: ObserverFace,
  address: string,
  extent: number,
): readonly [number, number] {
  const { x, y, z } = fromKey(address)
  const scale = 38 / Math.max(1, extent)
  const [horizontal, vertical] = {
    "-X": [y, z],
    "+X": [-y, z],
    "-Y": [x, z],
    "+Y": [-x, z],
    "-Z": [x, y],
    "+Z": [x, -y],
  }[face]
  return [50 + horizontal * scale, 50 - vertical * scale]
}

function combinations<T>(values: readonly T[], size: number): readonly (readonly T[])[] {
  const result: T[][] = []
  const visit = (start: number, selected: T[]): void => {
    if (selected.length === size) {
      result.push([...selected])
      return
    }
    for (
      let index = start;
      index <= values.length - (size - selected.length);
      index += 1
    ) {
      selected.push(values[index])
      visit(index + 1, selected)
      selected.pop()
    }
  }
  visit(0, [])
  return result
}

function PotentialFlowResolution({
  frame,
  isPlaying,
}: Readonly<{ frame: ExplorerFrame; isPlaying: boolean }>) {
  const potential = useMemo(
    () => analysePotential(
      new Set(frame.chronology.was),
      new Set(frame.chronology.is),
    ),
    [frame.chronology.is, frame.chronology.was],
  )
  const geometry = useMemo(() => {
    const addresses = new Set([
      ...potential.presentations.flatMap((presentation) => [
        presentation.source,
        presentation.target,
      ]),
      ...potential.cells.map((cell) => cell.address),
    ])
    const extent = Math.max(
      1,
      ...[...addresses].flatMap((address) => {
        const { x, y, z } = fromKey(address)
        return [Math.abs(x), Math.abs(y), Math.abs(z)]
      }),
    )
    const scale = Math.min(32, 108 / (extent * 2))
    const points = new Map([...addresses].map((address) => {
      const { x, y, z } = fromKey(address)
      return [address, {
        x: 160 + (x - y) * scale,
        y: 112 + (x + y) * scale * .48 - z * scale * .92,
      }] as const
    }))
    return { points }
  }, [potential])

  return (
    <section
      className={`potential-flow ${isPlaying ? "is-playing" : ""}`}
      aria-labelledby="potential-flow-title"
      data-potential-moment={frame.observer.act + 1}
    >
      <div className="potential-heading">
        <div>
          <span className="eyebrow">IS resolves into WILL BE</span>
          <h2 id="potential-flow-title">Potential flow resolution</h2>
        </div>
        <strong>moment {frame.observer.act} → {frame.observer.act + 1}</strong>
      </div>
      <div className="potential-body">
        <svg
          key={`potential:${frame.observer.act}`}
          className="potential-canvas"
          viewBox="0 0 320 224"
          role="img"
          aria-label={`${potential.presentationCount} potential Face presentations resolve into ${potential.willBeDifferences} WILL BE Differences`}
        >
          <defs>
            <marker
              id={`potential-arrow-${frame.observer.act}`}
              viewBox="0 0 6 6"
              refX="5"
              refY="3"
              markerWidth="4"
              markerHeight="4"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 6 3 L 0 6 z" />
            </marker>
          </defs>
          <rect width="320" height="224" />
          {potential.presentations.slice(0, 900).map((presentation, index) => {
            const source = geometry.points.get(presentation.source)
            const target = geometry.points.get(presentation.target)
            if (!source || !target) return null
            return (
              <line
                key={`${presentation.source}:${presentation.face}:${index}`}
                x1={source.x}
                y1={source.y}
                x2={target.x}
                y2={target.y}
                markerEnd={`url(#potential-arrow-${frame.observer.act})`}
              />
            )
          })}
          {potential.cells.map((cell) => {
            const point = geometry.points.get(cell.address)
            if (!point) return null
            return (
              <circle
                key={cell.address}
                cx={point.x}
                cy={point.y}
                r={cell.arrivalCount > 2 ? 4 : 3}
                className={cell.willBeDifferent ? "will-be-different" : "will-be-same"}
              />
            )
          })}
        </svg>
        <div className="potential-metrics">
          <div><span>WAS Differences</span><strong>{frame.chronology.was.length}</strong></div>
          <div><span>IS Differences</span><strong>{frame.chronology.is.length}</strong></div>
          <div><span>Face presentations</span><strong>{potential.presentationCount}</strong></div>
          <div><span>Addressed potential</span><strong>{potential.addressedPotential}</strong></div>
          <div><span>Convergence excess</span><strong>{potential.convergenceExcess}</strong></div>
          <div><span>Opposing pairs</span><strong>{potential.opposingPairs}</strong></div>
          <div><span>Directional remainder</span><strong>{potential.directionalRemainder}</strong></div>
          <div className="will-be"><span>WILL BE Differences</span><strong>{potential.willBeDifferences}</strong></div>
        </div>
      </div>
      <div className="allowance-copy">
        <div>
          <span className="eyebrow">What it is</span>
          <p>
            Every IS Difference presents to all six Faces. Shared target
            addresses retain every incoming direction before the selected
            resolution rule is applied.
          </p>
        </div>
        <div>
          <span className="eyebrow">What it allows</span>
          <p>
            WILL BE is calculated without committing the next moment. When
            playback advances, this exact field becomes IS and a new potential
            field is resolved alongside it.
          </p>
        </div>
      </div>
    </section>
  )
}

function MotifFrame({
  addresses,
  label,
}: Readonly<{ addresses: readonly string[]; label: string }>) {
  const points = addresses.map((address) => {
    const { x, y, z } = fromKey(address)
    return {
      address,
      x: 90 + (x - y) * 28,
      y: 70 + (x + y) * 14 - z * 26,
    }
  })
  return (
    <figure className="motif-frame">
      <figcaption>{label}</figcaption>
      <svg viewBox="0 0 180 140" role="img" aria-label={`${label}: ${addresses.length} Differences`}>
        <rect width="180" height="140" />
        <line x1="90" y1="70" x2="150" y2="100" />
        <line x1="90" y1="70" x2="30" y2="100" />
        <line x1="90" y1="70" x2="90" y2="15" />
        {points.map((point) => (
          <circle key={point.address} cx={point.x} cy={point.y} r="6" />
        ))}
      </svg>
      <strong>{addresses.length} Δ</strong>
    </figure>
  )
}

function CompleteCubeResolution() {
  const [selectedKind, setSelectedKind] = useState<CubeResolutionKind | "ALL">("ALL")
  const [geometry, setGeometry] = useState<"CUBE" | "TRIANGULAR_PRISM">("CUBE")
  const isCube = geometry === "CUBE"
  const resolutionPoints = isCube
    ? CUBE_RESOLUTION_POINTS
    : TRIANGULAR_PRISM_RESOLUTION_POINTS
  const counts = isCube
    ? CUBE_RESOLUTION_COUNTS
    : TRIANGULAR_PRISM_RESOLUTION_COUNTS
  const wholeMoment = isCube
    ? CUBE_WHOLE_MOMENT
    : TRIANGULAR_PRISM_WHOLE_MOMENT
  const projected = resolutionPoints.map((point) => {
    const [x, y] = project([point.position.x, point.position.y, point.position.z])
    return { ...point, x, y }
  })
  return (
    <section className="complete-cube-resolution" aria-labelledby="complete-cube-resolution-title">
      <div className="complete-cube-heading">
        <div>
          <span className="eyebrow">Every resolution point · one complete Act</span>
          <h3 id="complete-cube-resolution-title">
            {isCube ? "Cube" : "Equilateral triangular prism"} · Faces + edges + corners
          </h3>
        </div>
        <strong>{counts.FACE} + {counts.EDGE} + {counts.CORNER} = {resolutionPoints.length}</strong>
      </div>
      <div className="complete-geometry-summary">
        <span>Simultaneously resolved possibilities</span>
        <strong>{COMPLETE_GEOMETRY_RESOLUTION.resolvedGeometryCount} wholes</strong>
        <strong>{COMPLETE_GEOMETRY_RESOLUTION.resolutionPoints} points</strong>
        <strong>{COMPLETE_GEOMETRY_RESOLUTION.perspectivePresentations} perspectives</strong>
        <strong>{COMPLETE_GEOMETRY_RESOLUTION.filledVolumeGeometryCount} filled-volume wholes</strong>
        <strong>orientation ≡ same whole</strong>
        <strong>{COLLISION_RESOLUTION_RULE.contactClassCount} contact classes</strong>
      </div>
      <div className="resolution-geometry-selector" aria-label="Geometry observation filter">
        <span>Observation filter · resolution is unchanged</span>
        <button type="button" className={isCube ? "selected" : ""} onClick={() => setGeometry("CUBE")}>
          Cube
        </button>
        <button type="button" className={!isCube ? "selected" : ""} onClick={() => setGeometry("TRIANGULAR_PRISM")}>
          Equilateral triangular prism
        </button>
      </div>
      <div className="complete-cube-body">
        <svg viewBox="260 80 280 360" role="img" aria-label="All 26 cube resolution points">
          <rect x="260" y="80" width="280" height="360" />
          {projected.map((point) => (
            <circle
              key={point.address}
              cx={point.x}
              cy={point.y}
              r={point.kind === "FACE" ? 6 : point.kind === "EDGE" ? 4.8 : 4}
              className={`cube-resolution-${point.kind.toLowerCase()} ${
                selectedKind === "ALL" || selectedKind === point.kind ? "active" : "muted"
              }`}
            >
              <title>
                {point.kind} {point.address} · {point.perspectiveCount} perspectives
                {" "}· {2 ** point.perspectiveCount - 1} outward regions remain resolving medium
              </title>
            </circle>
          ))}
        </svg>
        <div className="complete-cube-layers">
          {(["FACE", "EDGE", "CORNER"] as const).map((kind) => (
            <button
              type="button"
              key={kind}
              className={selectedKind === kind ? "selected" : ""}
              aria-pressed={selectedKind === kind}
              onClick={() => setSelectedKind((selected) => selected === kind ? "ALL" : kind)}
            >
              <span>{kind}</span>
              <strong>{counts[kind]}</strong>
              <small>
                {kind === "FACE" ? "1 perspective" : kind === "EDGE" ? "2 perspectives" : "3 perspectives"}
                {isCube ? (
                  <> · radius {kind === "FACE" ? "√1" : kind === "EDGE" ? "√2" : "√3"}
                    {" "}· {CUBE_RESOLUTION_RADII[kind].toFixed(3)}</>
                ) : <> · multiple radii</>}
              </small>
            </button>
          ))}
        </div>
      </div>
      <div className="whole-moment-effect">
        <div><span>Previous whole moment</span><strong>WAS retained</strong></div>
        <b>→</b>
        <div><span>Resolution points</span><strong>{wholeMoment.resolutionPoints}</strong></div>
        <b>→</b>
        <div><span>Perspective presentations</span><strong>{wholeMoment.perspectivePresentations}</strong></div>
        <b>→</b>
        <div><span>Beyond visible whole</span><strong>{wholeMoment.outwardState}</strong></div>
      </div>
      <div className="collision-map-summary">
        <div><span>Relative placement</span><strong>MAP CONTACT</strong></div>
        <b>→</b>
        <div><span>Overlap</span><strong>POSSIBLE COLLISION</strong></div>
        <b>→</b>
        <div><span>Unoccupied neighbour</span><strong>RESOLVING MEDIUM</strong></div>
        <b>→</b>
        <div><span>Avoidance</span><strong>CAN BE</strong></div>
      </div>
      <div className="medium-analysis">
        <div className="medium-analysis-heading">
          <span>Cube + prism · simultaneous recursive Act</span>
          <strong>{SIMULTANEOUS_RECURSIVE_VOLUME.resolution}</strong>
        </div>
        <div className="all-moment-volume">
          <span>One-grain relational gap</span>
          <strong>{SIMULTANEOUS_RECURSIVE_VOLUME.oneGrainRelationalGap.toFixed(6)}</strong>
          <small>8 − 3√3/2 · retained while both shapes resolve together</small>
        </div>
        <div className="medium-shape-grid">
          {[0, 1, 2, 3].map((depth) => (
            <div key={depth}>
              <span>GRAIN DEPTH {depth}</span>
              <strong>{recursiveGapAtGrain(depth).toFixed(6)}</strong>
              <small>cube 6 Faces · prism 5 Faces · half scale</small>
            </div>
          ))}
          <div className="maximum">
            <span>ALL RECURSIVE GRAINS</span>
            <strong>{SIMULTANEOUS_RECURSIVE_VOLUME.infiniteRecursiveGapContribution.toFixed(6)}</strong>
            <small>convergent resolution-volume contribution</small>
          </div>
        </div>
        <details className="medium-incidence-detail">
          <summary>Boundary-incidence count · not volume</summary>
          <div className="medium-moment-grid">
            {COMPLETE_MEDIUM_ANALYSIS.moments.map((mediumMoment) => (
              <div key={mediumMoment.kind}>
                <span>{mediumMoment.kind}</span>
                <strong>{mediumMoment.mediumPresentations}</strong>
                <small>{mediumMoment.resolutionPoints} points</small>
              </div>
            ))}
          </div>
          <div className="medium-shape-grid">
          {SHAPE_MEDIUM_ANALYSIS.map((shape) => (
            <div key={shape.shape}>
              <span>{shape.shape.replace("_", " ")}</span>
              <strong>{shape.totalMediumPresentations}</strong>
              <small>maximum at {shape.maximumMediumMoment.kind.toLowerCase()} moments</small>
            </div>
          ))}
          </div>
        </details>
      </div>
      <p>
        {isCube
          ? "The complete cube retains 6 Face, 12 edge, and 8 corner resolutions. Its 26 boundary points make 54 perspective presentations into the previous whole moment."
          : "The complete equilateral triangular prism retains 5 Face, 9 edge, and 6 corner resolutions. Its 20 boundary points make 41 perspective presentations, distributed across more than three radii. It is an allowed filled-volume whole because repeated prisms remain the same intrinsic relation regardless of orientation, including when resolutions overlap or nest."}
        {" "}What lies beyond the currently visible whole is retained as
        resolving medium, not classified as Nothing. Switching this display
        changes only which resolved possibility is observed; both geometries
        remain present in the complete model. Rotation or reflection does not
        create another result: orientation changes presentation, not the
        intrinsic whole. Relative orientation and placement can still change
        which Faces, edges, and corners meet. Overlap or nesting is retained as
        a possible collision map, not committed as physical coexistence. The
        unoccupied neighbouring resolution remains medium, preserving possible
        avoidance as CAN BE until the next whole moment resolves it. In the
        cube and prism resolve together at every grain. Their one-grain
        relational gap is 8 − 3√3/2. At each inward grain the six-Face cube
        family contributes at ratio 6/8, while the five-Face prism family
        contributes at ratio 5/8. Their complete recursive resolution-volume
        Difference converges to 32 − 4√3.
      </p>
    </section>
  )
}

function ParticleTraceFrame({
  traces,
  forceMoments,
  transformPaths,
  transformStepCount,
  isPlaying,
}: Readonly<{
  traces: readonly ParticleCausalTrace[]
  forceMoments: readonly ParticleForceMoment[]
  transformPaths: ReadonlyMap<string, readonly ParticleTransformStep[]>
  transformStepCount: number
  isPlaying: boolean
}>) {
  const [selectedMoment, setSelectedMoment] = useState(2)
  const [selectedFace, setSelectedFace] = useState(() => traces[0].to)
  const [isForcePlaying, setIsForcePlaying] = useState(false)
  useEffect(() => {
    if (!isForcePlaying) return
    if (selectedMoment >= PARTICLE_MOMENTS_PER_ACT) {
      setIsForcePlaying(false)
      return
    }
    const timer = window.setTimeout(
      () => setSelectedMoment((moment) => moment + 1),
      110,
    )
    return () => window.clearTimeout(timer)
  }, [isForcePlaying, selectedMoment])
  const centre = { x: 90, y: 70 }
  const project = ({ x, y, z }: Readonly<{ x: number; y: number; z: number }>) => ({
    x: 90 + (x - y) * 28,
    y: 70 + (x + y) * 14 - z * 26,
  })
  const paths = traces.map((trace) => {
    const helix = sampleParticleHelix(trace.to).map(project)
    const endpoint = helix[helix.length - 1]
    const momentsPerStage = PARTICLE_MOMENTS_PER_ACT / trace.subcauses.length
    return {
      ...trace,
      ...endpoint,
      selectedPoint: helix[selectedMoment],
      stages: trace.subcauses.map((label, index) => {
        const endIndex = (index + 1) * momentsPerStage
        const startIndex = index * momentsPerStage
        return {
          label,
          x: helix[endIndex].x,
          y: helix[endIndex].y,
          points: helix
            .slice(startIndex, endIndex + 1)
            .map((point) => `${point.x},${point.y}`)
            .join(" "),
        }
      }),
    }
  })
  const selectedTransform = transformPaths.get(selectedFace)?.[selectedMoment - 1]
  const nestedGrain = useMemo(() => deriveNestedGrain(selectedFace), [selectedFace])
  const nestedMoment = nestedGrain.moments[selectedMoment - 1]
  const selectedForce = forceMoments[selectedMoment - 2]
  const forceValue = {
    outwardTransfer: selectedForce?.outwardTransfer ?? selectedTransform?.outwardTransfer ?? 0,
    inwardTurningForce: selectedForce?.inwardTurningForce ?? 0,
    rotationalForce: selectedForce?.rotationalForce ?? 0,
    axialForce: selectedForce?.axialForce ?? 0,
    resultantForce: selectedForce?.resultantForce ?? 0,
    sixFaceResultant: selectedForce?.sixFaceResultant ?? 0,
  }
  const formatForce = (value: number) => value.toExponential(4)
  const formatVector = (vector: Readonly<{ x: number; y: number; z: number }>) =>
    `(${vector.x.toFixed(4)}, ${vector.y.toFixed(4)}, ${vector.z.toFixed(4)})`
  return (
    <figure className={`particle-trace-frame ${isPlaying || isForcePlaying ? "is-playing" : ""}`}>
      <figcaption>WHAT ALLOWED THE PARTICLE TO BE</figcaption>
      <svg viewBox="0 0 180 140" role="img" aria-label="Six causal traces from the First Difference to the complete particle">
        <defs>
          <marker id="particle-trace-arrow" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="5" markerHeight="5" orient="auto">
            <path d="M 0 0 L 6 3 L 0 6 z" />
          </marker>
        </defs>
        <rect width="180" height="140" />
        {paths.map((trace, index) => (
          <g key={trace.to} style={{ "--trace-index": index } as CSSProperties}>
            <line
              className="causal-axis"
              x1={centre.x}
              y1={centre.y}
              x2={trace.x}
              y2={trace.y}
            />
            {trace.stages.map((stage, stageIndex) => {
              return (
                <g
                  key={stage.label}
                  style={{ "--sub-trace-index": stageIndex } as CSSProperties}
                >
                  <polyline
                    className={`causal-trace sub-trace sub-trace-${stageIndex + 1}`}
                    points={stage.points}
                    markerEnd={stageIndex === trace.stages.length - 1 ? "url(#particle-trace-arrow)" : undefined}
                  />
                  {stageIndex < trace.stages.length - 1 ? (
                    <circle
                      className={`sub-cause-node sub-cause-node-${stageIndex + 1}`}
                      cx={stage.x}
                      cy={stage.y}
                      r="2.25"
                    />
                  ) : null}
                </g>
              )
            })}
            <circle className="allowed-address" cx={trace.x} cy={trace.y} r="6" />
            <circle
              className="force-moment-marker"
              cx={trace.selectedPoint.x}
              cy={trace.selectedPoint.y}
              r="3.2"
            />
          </g>
        ))}
        <circle className="first-difference-node" cx={centre.x} cy={centre.y} r="7" />
      </svg>
      <div className="trace-key">
        <span><i className="trace-source" />FIRST DIFFERENCE</span>
        <span><i className="trace-path" />SUB-CAUSAL RESOLUTION</span>
        <span><i className="trace-result" />PARTICLE ADDRESS</span>
      </div>
      <ol aria-label="Particle causal trace addresses">
        {traces.map((trace) => (
          <li key={trace.to}>
            <span>{trace.from}</span>
            <b>→ · → · →</b>
            <strong>{trace.to}</strong>
          </li>
        ))}
      </ol>
      <div className="force-moment-calculator">
        <div className="force-calculator-heading">
          <div>
            <span className="eyebrow">Between-moment calculation</span>
            <strong>Moment {selectedMoment} / {PARTICLE_MOMENTS_PER_ACT}</strong>
          </div>
          <div className="force-step-actions">
            <button
              type="button"
              aria-label="Previous force moment"
              disabled={selectedMoment <= 1}
              onClick={() => {
                setIsForcePlaying(false)
                setSelectedMoment((moment) => Math.max(1, moment - 1))
              }}
            >−</button>
            <button
              type="button"
              onClick={() => {
                if (selectedMoment >= PARTICLE_MOMENTS_PER_ACT) setSelectedMoment(1)
                setIsForcePlaying((playing) => !playing)
              }}
            >
              {isForcePlaying ? "Pause forces" : "Play forces"}
            </button>
            <button
              type="button"
              aria-label="Next force moment"
              disabled={selectedMoment >= PARTICLE_MOMENTS_PER_ACT}
              onClick={() => {
                setIsForcePlaying(false)
                setSelectedMoment((moment) => Math.min(PARTICLE_MOMENTS_PER_ACT, moment + 1))
              }}
            >+</button>
          </div>
        </div>
        <input
          aria-label="Particle force moment"
          type="range"
          min="1"
          max={PARTICLE_MOMENTS_PER_ACT}
          value={selectedMoment}
          onChange={(event) => {
            setIsForcePlaying(false)
            setSelectedMoment(Number(event.target.value))
          }}
        />
        <div className="force-equation">
          <code>Δp = pₙ − pₙ₋₁</code>
          <code>Δ²p = Δpₙ − Δpₙ₋₁</code>
          <span>{PARTICLE_ROTATIONS_PER_ACT} rotation · 6 faces · normalized</span>
        </div>
        <dl>
          <div><dt>Outward transfer</dt><dd>{formatForce(forceValue.outwardTransfer)}</dd></div>
          <div><dt>Inward turning</dt><dd>{formatForce(forceValue.inwardTurningForce)}</dd></div>
          <div><dt>Rotational</dt><dd>{formatForce(forceValue.rotationalForce)}</dd></div>
          <div><dt>Axial change</dt><dd>{formatForce(forceValue.axialForce)}</dd></div>
          <div><dt>Resultant / Face</dt><dd>{formatForce(forceValue.resultantForce)}</dd></div>
          <div><dt>Six-Face total</dt><dd>{formatForce(forceValue.sixFaceResultant)}</dd></div>
        </dl>
        <p>
          These are dimensionless resolution-force components generated by the
          difference between consecutive model moments. They are not SI-force
          claims; no mass or measured constant has been introduced.
        </p>
      </div>
      {selectedTransform ? (
        <div className="transform-path-inspector">
          <div className="transform-heading">
            <div>
              <span className="eyebrow">Full transform ancestry</span>
              <strong>{transformStepCount} preserved transforms</strong>
            </div>
            <span>6 Faces × {PARTICLE_MOMENTS_PER_ACT} moments</span>
          </div>
          <div className="transform-face-selector" aria-label="Transform Face">
            {traces.map((trace) => (
              <button
                type="button"
                key={trace.to}
                className={selectedFace === trace.to ? "selected" : ""}
                aria-pressed={selectedFace === trace.to}
                onClick={() => setSelectedFace(trace.to)}
              >{trace.to}</button>
            ))}
          </div>
          <div className="transform-moment-path" aria-label="Complete transform moments">
            {(transformPaths.get(selectedFace) ?? []).map((step) => (
              <button
                type="button"
                key={step.id}
                className={`${step.phase.toLowerCase().replaceAll(" ", "-")} ${step.moment === selectedMoment ? "selected" : ""}`}
                aria-label={`Transform moment ${step.moment}`}
                aria-pressed={step.moment === selectedMoment}
                onClick={() => {
                  setIsForcePlaying(false)
                  setSelectedMoment(step.moment)
                }}
              >
                <span>{step.moment}</span>
              </button>
            ))}
          </div>
          <div className="transform-detail">
            <div>
              <span>WAS · {selectedTransform.parentId ?? "FIRST DIFFERENCE"}</span>
              <strong>{formatVector(selectedTransform.was)}</strong>
            </div>
            <div className="transform-operator">
              <span>{selectedTransform.phase}</span>
              <b>ROTATE + RESOLVE</b>
              <small>Δ {formatVector(selectedTransform.transfer)}</small>
              <small>AXIS + {selectedTransform.axisOffset.symbol} {formatVector(selectedTransform.axisOffset.direction)}</small>
            </div>
            <div>
              <span>IS · {selectedTransform.id}</span>
              <strong>{formatVector(selectedTransform.is)}</strong>
            </div>
          </div>
          <div className="transform-created">
            <span>CREATED BY THIS TRANSFORM</span>
            <code>Δ² {formatVector(selectedTransform.changeInTransfer)}</code>
            <strong>|F| {formatForce(selectedTransform.resultantForce)}</strong>
            <small>NEXT · {selectedTransform.nextId ?? "PARTICLE ADDRESS RESOLVED"}</small>
          </div>
        </div>
      ) : null}
      <div className="nested-grain-inspector">
        <div className="nested-grain-heading">
          <div>
            <span className="eyebrow">That ME · grain in grain</span>
            <strong>Grain 0 → Grain {nestedGrain.childGrain}</strong>
          </div>
          <span>
            carrier spiral · moment {nestedGrain.spiralStartsAt.moment}
            {" "}· spiral-of-spiral · grain {nestedGrain.spiralingSpiralStartsAt.grain}
          </span>
        </div>
        <div className="nested-grain-body">
          <svg viewBox="0 0 180 140" role="img" aria-label={`Nested grain ${nestedGrain.childGrain} at moment ${selectedMoment}`}>
            <rect width="180" height="140" />
            <polyline
              className="nested-carrier-path"
              points={nestedMoment.carrierPath
                .map((point) => {
                  const projected = project(point)
                  return `${projected.x},${projected.y}`
                })
                .join(" ")}
            />
            {nestedMoment.states.map((state) => {
              const displayOffset = {
                x: state.axisOffset.direction.x * 0.08,
                y: state.axisOffset.direction.y * 0.08,
                z: state.axisOffset.direction.z * 0.08,
              }
              const axisOrigin = project({
                x: nestedMoment.carrierPosition.x + displayOffset.x,
                y: nestedMoment.carrierPosition.y + displayOffset.y,
                z: nestedMoment.carrierPosition.z + displayOffset.z,
              })
              const point = project({
                x: state.parentPosition.x + displayOffset.x,
                y: state.parentPosition.y + displayOffset.y,
                z: state.parentPosition.z + displayOffset.z,
              })
              return (
                <g key={state.face}>
                  <polyline
                    className="nested-standing-wave"
                    points={state.standingWavePath
                      .map((wavePoint) => {
                        const projected = project(wavePoint)
                        return `${projected.x},${projected.y}`
                      })
                      .join(" ")}
                  />
                  <line x1={axisOrigin.x} y1={axisOrigin.y} x2={point.x} y2={point.y} />
                  <circle className="nested-axis-origin" cx={axisOrigin.x} cy={axisOrigin.y} r="1.8" />
                  <circle className="nested-emission" cx={point.x} cy={point.y} r="5" />
                </g>
              )
            })}
            <circle className="nested-cube-origin" cx="90" cy="70" r="3" />
            {(() => {
              const carrier = project(nestedMoment.carrierPosition)
              return <circle className="nested-me" cx={carrier.x} cy={carrier.y} r="7" />
            })()}
          </svg>
          <div className="nested-grain-resolution">
            <div className="nested-handoff">
              <span>PARENT ME</span>
              <strong>{selectedFace} @ grain 0</strong>
              <b>→</b>
              <span>CHILD ORIGIN</span>
              <strong>0,0,0 @ grain {nestedGrain.childGrain}</strong>
            </div>
            <div className="nested-metrics">
              <div><span>Moment</span><strong>{selectedMoment} / {PARTICLE_MOMENTS_PER_ACT}</strong></div>
              <div><span>What it becomes</span><strong>{nestedMoment.states.length} child states</strong></div>
              <div><span>What comes off</span><strong>{formatForce(nestedMoment.totalEmittedMagnitude)}</strong></div>
              <div><span>Force created</span><strong>{formatForce(nestedMoment.totalCreatedForce)}</strong></div>
              <div><span>Standing amplitude</span><strong>{formatForce(nestedMoment.totalStandingAmplitude)}</strong></div>
            </div>
            <ol>
              {nestedMoment.states.map((state) => (
                <li key={state.face}>
                  <span>{state.face}</span>
                  <code>OUT {formatVector(state.emittedTransfer)}</code>
                  <strong>|Δ| {formatForce(state.emittedMagnitude)}</strong>
                  <small>{state.axisOffset.symbol}</small>
                </li>
              ))}
            </ol>
          </div>
        </div>
        <p>
          The parent address is retained as the child grain origin. At each
          selected moment, all six local transforms are embedded back into the
          parent grain at scale 1/2, so the display shows both what the ME
          becomes internally and the Difference it expresses outward as it goes.
          Axis offsets are retained symbolically as ε = 0…01; their visible
          separation is exaggerated only so they can be seen. The amber carrier
          is the parent spiral; each cyan child path is the equal outward/return
          superposition, producing fixed standing-wave nodes while the carrier
          itself spirals.
        </p>
      </div>
    </figure>
  )
}

function FirstActParticleResolution({ isPlaying }: Readonly<{ isPlaying: boolean }>) {
  const particle = useMemo(deriveFirstActParticle, [])
  return (
    <section className="particle-resolution" aria-labelledby="particle-title">
      <div className="particle-heading">
        <div>
          <span className="eyebrow">Derived directly from the First Difference</span>
          <h2 id="particle-title">Particle from one Act</h2>
        </div>
        <strong>1 → 6 → PARTICLE</strong>
      </div>
      <div className="particle-act">
        <MotifFrame addresses={[...particle.firstDifference]} label="FIRST DIFFERENCE" />
        <div className="particle-operation">
          <span>ONE ACT</span>
          <strong>{particle.facePresentations}</strong>
          <small>six-Face presentations</small>
        </div>
        <MotifFrame addresses={particle.particleAddresses} label="SIX-FACE FIELD" />
      </div>
      <CompleteCubeResolution />
      <ParticleTraceFrame
        traces={particle.causalTraces}
        forceMoments={particle.forceMoments}
        transformPaths={particle.transformPaths}
        transformStepCount={particle.transformStepCount}
        isPlaying={isPlaying}
      />
      <div className="particle-observer-heading">
        <div>
          <span className="eyebrow">What each ME receives</span>
          <strong>{particle.observerSignature}</strong>
        </div>
        <div>
          <span className="eyebrow">What their merge resolves</span>
          <strong>{particle.mergedCount} complete addresses</strong>
        </div>
      </div>
      <div className="particle-views">
        {[...particle.observerViews].map(([face, addresses]) => (
          <MotifFrame key={face} addresses={addresses} label={face} />
        ))}
      </div>
      <div className="particle-merge">
        <span>MERGE ALL SIX VIEWS</span>
        <strong>→</strong>
        <MotifFrame addresses={[...particle.mergedField]} label="COMPLETE PARTICLE" />
      </div>
      <div className="allowance-copy">
        <div>
          <span className="eyebrow">What it is</span>
          <p>
            The centre presents through all six Faces in one Act. The resulting
            field contains six distinct addresses. Every individual Face
            observer receives five because one axial address is hidden by its
            opposite presentation.
          </p>
        </div>
        <div>
          <span className="eyebrow">What it allows</span>
          <p>
            Combining all six observer states recovers all six generated
            addresses exactly. The complete merged six-Face state is therefore
            the model particle produced by the First Act.
          </p>
        </div>
      </div>
      <p className="particle-proof">
        Merge audit: {particle.mergeRecoversParticle ? "COMPLETE PARTICLE RECOVERED" : "INCOMPLETE"}
      </p>
      <RecursiveGrainPlayback />
      <StateTransferResolution />
      <EarthCandidateMatrix />
    </section>
  )
}

function EarthCandidateMatrix() {
  const [selectedCandidate, setSelectedCandidate] = useState("first-act-recursive-surface")
  const candidates = useMemo(() => resolveEarthCandidates(), [])
  const selected = candidates.find(({ id }) => id === selectedCandidate)
    ?? candidates[0]
  const observationById = new Map(
    EARTH_OBSERVATIONS.map((observation) => [observation.id, observation]),
  )
  return (
    <section className="earth-candidate-matrix" aria-labelledby="earth-matrix-title">
      <div className="earth-matrix-heading">
        <div>
          <span className="eyebrow">Black hole → galaxy → star → Earth · containing-grain filter</span>
          <h3 id="earth-matrix-title">What outer and local observations require</h3>
        </div>
        <strong>{EARTH_OBSERVATIONS.length} constraints · {candidates.length} candidates</strong>
      </div>
      <div className="earth-observations">
        {EARTH_OBSERVATIONS.map((observation) => (
          <a
            key={observation.id}
            href={observation.sourceUrl}
            target="_blank"
            rel="noreferrer"
          >
            <span>{observation.id.replaceAll("_", " ")}</span>
            <strong>{observation.value}</strong>
            <small>{observation.qualification} · {observation.sourceLabel}</small>
          </a>
        ))}
      </div>
      <div className="earth-candidate-layout">
        <div className="earth-candidate-list">
          {candidates.map((candidate) => (
            <button
              type="button"
              key={candidate.id}
              className={candidate.id === selected.id ? "selected" : ""}
              onClick={() => setSelectedCandidate(candidate.id)}
            >
              <strong>{candidate.label}</strong>
              <span>{candidate.status}</span>
              <small>
                match {candidate.matched.length}
                {" · "}unresolved {candidate.unresolved.length}
                {" · "}conflict {candidate.conflicts.length}
              </small>
            </button>
          ))}
        </div>
        <div className="earth-candidate-result">
          <span>WHAT IT COULD BE</span>
          <h4>{selected.label}</h4>
          <strong>{selected.status}</strong>
          <div>
            <span>MATCHED</span>
            <p>{selected.matched.map((id) => observationById.get(id)!.value).join(" · ") || "NONE"}</p>
          </div>
          <div>
            <span>MISSING FACTS</span>
            <p>{selected.unresolved.map((id) => observationById.get(id)!.whatMeWitnessed).join(" · ") || "NONE"}</p>
          </div>
          <div>
            <span>CONFLICTS</span>
            <p>{selected.conflicts.map((id) => observationById.get(id)!.whatMeWitnessed).join(" · ") || "NONE"}</p>
          </div>
        </div>
      </div>
      <p>
        Candidates are ranked by recorded constraints, not by desired identity.
        The First-ACT surface currently matches closure and retains every
        unresolved black-hole, galactic, stellar, Sun–Earth, and local Earth
        behaviour. An isolated Earth candidate is rejected because the observed
        containing-grain transfers cannot be removed.
      </p>
    </section>
  )
}

function StateTransferResolution() {
  const [spatialStep, setSpatialStep] = useState(0.08)
  const [temporalStep, setTemporalStep] = useState(2)
  const engine = useMemo(() => buildStateTransferEngine(), [])
  const recursiveSweep = useMemo(() => resolveRecursiveSweep(engine), [engine])
  const receiver = useMemo(() => resolveReceiverView(engine, {
    spatialStep,
    temporalStep,
  }), [engine, spatialStep, temporalStep])
  const captured = new Set(receiver.capturedMoments)
  const points = engine.moments.map((moment) => ({
    moment: moment.moment,
    x: 24 + (moment.location.x - moment.location.y) * 220,
    y: 116 + (moment.location.x + moment.location.y) * 34
      - moment.location.z * 120,
    captured: captured.has(moment.moment),
  }))

  return (
    <section className="state-transfer-engine" aria-labelledby="state-transfer-title">
      <div className="state-transfer-heading">
        <div>
          <span className="eyebrow">State Transfer Engine</span>
          <h3 id="state-transfer-title">Capture only changed behaviour</h3>
        </div>
        <strong>
          {engine.uniqueTemporalBehaviours} computed · {engine.referencedComputes} referenced
        </strong>
      </div>
      <div className="state-transfer-controls">
        <label>
          <span>RECEIVER SPATIAL STEP</span>
          <input
            type="range"
            min="0.01"
            max="0.25"
            step="0.01"
            value={spatialStep}
            onChange={(event) => setSpatialStep(Number(event.target.value))}
          />
          <strong>{spatialStep.toFixed(2)}</strong>
        </label>
        <label>
          <span>RECEIVER MOMENT STEP</span>
          <input
            type="range"
            min="1"
            max="8"
            step="1"
            value={temporalStep}
            onChange={(event) => setTemporalStep(Number(event.target.value))}
          />
          <strong>{temporalStep}</strong>
        </label>
        <div className="receiver-presets" aria-label="Receiver resolution presets">
          <button
            type="button"
            onClick={() => {
              setSpatialStep(0.01)
              setTemporalStep(1)
            }}
          >FINE RECEIVER</button>
          <button
            type="button"
            onClick={() => {
              setSpatialStep(0.2)
              setTemporalStep(8)
            }}
          >COARSE RECEIVER</button>
          <button
            type="button"
            onClick={() => {
              setSpatialStep(0.001)
              setTemporalStep(1)
            }}
          >RESOLVE REMAINDER</button>
        </div>
      </div>
      <div className="state-transfer-body">
        <svg viewBox="0 0 280 140" role="img" aria-label="Receiver-visible state-transfer path">
          <rect width="280" height="140" />
          <polyline points={points.map((point) => `${point.x},${point.y}`).join(" ")} />
          {points.map((point) => (
            <circle
              key={point.moment}
              cx={point.x}
              cy={point.y}
              r={point.captured ? 3 : 1.4}
              className={point.captured ? "captured" : "unresolved"}
            >
              <title>
                moment {point.moment} · {point.captured
                  ? "visible to this receiver"
                  : "present but unresolved by this receiver"}
              </title>
            </circle>
          ))}
        </svg>
        <div className="state-transfer-result">
          <div><span>ME CAPTURES</span><strong>{receiver.capturedMoments.length}</strong></div>
          <div><span>ME RETAINS UNRESOLVED</span><strong>{receiver.unresolvedMoments.length}</strong></div>
          <div><span>VISIBLE COVERAGE</span><strong>{receiver.visibleCoverageCount}</strong></div>
          <div><span>TRACE</span><strong>{engine.emergentGeometry}</strong></div>
        </div>
      </div>
      <div className="behaviour-intervals">
        {engine.intervals.map((interval) => (
          <article key={interval.signature.key}>
            <span>{interval.signature.key}</span>
            <strong>M{interval.firstMoment}–M{interval.lastMoment}</strong>
            <small>
              compute {interval.computedMomentCount}
              {" · "}reference {interval.referencedMomentCount}
              {" · "}new coverage {interval.newCoverageCount}
            </small>
          </article>
        ))}
      </div>
      <div className="state-transfer-allowance">
        <span>WHAT THE RECURSIVE PATH RESOLVES</span>
        <strong>{recursiveSweep.topology}</strong>
        <small>
          {recursiveSweep.phaseCount} axis phases
          {" × "}{recursiveSweep.pathSampleCount} path samples
          {" → "}{recursiveSweep.uniqueSurfacePointCount} unique surface locations
          {" · "}endpoint radii {recursiveSweep.startRadius.toExponential(1)}
          {" / "}{recursiveSweep.endRadius.toExponential(1)}
        </small>
      </div>
      <p>
        A moment is skipped only when its WAS, IS, and WILL-BE behaviour already
        resolves by reference. New spatial coverage is still accumulated.
        Visibility is what this receiver can distinguish; every missed moment
        remains in its temporal remainder. Once all 36 axis phases are resolved,
        their recursively carried copies of the open path collapse at both
        endpoints and form the closed surface shown above.
      </p>
    </section>
  )
}

function RecursiveGrainPlayback() {
  const [stopGrain, setStopGrain] = useState(-6)
  const [pixelSpan, setPixelSpan] = useState(180)
  const [frameIndex, setFrameIndex] = useState(0)
  const [moment, setMoment] = useState(1)
  const [playing, setPlaying] = useState(false)
  const spiralMapRef = useRef<SVGSVGElement>(null)
  const playback = useMemo(
    () => buildGrainPlayback(0, stopGrain, pixelSpan),
    [pixelSpan, stopGrain],
  )
  const crossGrainPlan = useMemo(
    () => planCrossGrainResolution(playback),
    [playback],
  )
  const frame = playback.frames[Math.min(frameIndex, playback.frames.length - 1)]
  const resolutionNeed = crossGrainPlan.needs[
    Math.min(frameIndex, crossGrainPlan.needs.length - 1)
  ]
  useEffect(() => {
    setFrameIndex(0)
    setMoment(1)
    setPlaying(false)
  }, [pixelSpan, stopGrain])
  useEffect(() => {
    const element = spiralMapRef.current
    if (!element) return
    const updatePixelSpan = () => setPixelSpan(Math.max(1, element.clientWidth))
    updatePixelSpan()
    const observer = new ResizeObserver(updatePixelSpan)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    if (!playing) return
    const atFinal = frameIndex === playback.frames.length - 1
      && moment === GRAIN_PLAYBACK_MOMENTS
    if (atFinal) {
      setPlaying(false)
      return
    }
    const timer = window.setTimeout(() => {
      if (moment < GRAIN_PLAYBACK_MOMENTS) setMoment((value) => value + 1)
      else {
        setFrameIndex((value) => value + 1)
        setMoment(1)
      }
    }, 80)
    return () => window.clearTimeout(timer)
  }, [frameIndex, moment, playback.frames.length, playing])
  const visibleSpiral = frame.spiral.slice(0, moment + 1)
  const points = visibleSpiral.map((point) => ({
    x: 90 + (point.x - point.y) * 44,
    y: 70 + (point.x + point.y) * 22 - point.z * 40,
  }))
  return (
    <section className="grain-playback" aria-labelledby="grain-playback-title">
      <div className="grain-playback-heading">
        <div>
          <span className="eyebrow">Recursive transport player</span>
          <h3 id="grain-playback-title">Where the spiral starts · stops · goes</h3>
        </div>
        <strong>GRAIN {frame.grain} · MOMENT {moment}</strong>
      </div>
      <div className="grain-playback-controls">
        <label>Stop grain
          <select value={stopGrain} onChange={(event) => setStopGrain(Number(event.target.value))}>
            {[-2, -3, -6, -9, -12].map((grain) => <option key={grain} value={grain}>{grain}</option>)}
          </select>
        </label>
        <div className="pixel-map-rule">
          <span>AVAILABLE PIXEL MAP</span>
          <strong>{Math.round(playback.pixelSpan)} px · resolve at ≥ {playback.pixelThreshold} px</strong>
        </div>
        <button type="button" onClick={() => {
          if (frameIndex === playback.frames.length - 1 && moment === GRAIN_PLAYBACK_MOMENTS) {
            setFrameIndex(0)
            setMoment(1)
          }
          setPlaying((value) => !value)
        }}>{playing ? "Pause grain playback" : "Play grain playback"}</button>
      </div>
      <div className="grain-playback-body">
        <svg ref={spiralMapRef} viewBox="0 0 180 140" role="img" aria-label={`Spiral playback at grain ${frame.grain} moment ${moment}`}>
          <rect width="180" height="140" />
          <polyline points={points.map((point) => `${point.x},${point.y}`).join(" ")} />
          <circle cx={points.at(-1)!.x} cy={points.at(-1)!.y} r="5" />
        </svg>
        <div className="grain-route">
          <div><span>CAME FROM</span><strong>{frame.sourceGrain === null ? "FIRST DIFFERENCE" : `grain ${frame.sourceGrain}`}</strong></div>
          <b>→</b>
          <div><span>IS RESOLVING</span><strong>grain {frame.grain}</strong><small>scale {frame.scale.toExponential(3)} · Δ {frame.projectedChangePixels.toFixed(2)} px</small></div>
          <b>→</b>
          <div><span>GOES TO</span><strong>grain {frame.destinationGrain}</strong></div>
        </div>
      </div>
      <div className="grain-conditions">
        <div><span>START CONDITION</span><strong>{frame.startCondition}</strong></div>
        <div><span>STOP CONDITION</span><strong>{frame.stopCondition} · moment {GRAIN_PLAYBACK_MOMENTS}</strong></div>
        <div><span>CAUSAL GRAINS</span><strong>{playback.causalGrainCount}</strong></div>
        <div><span>RENDERED</span><strong>{playback.renderedGrainCount}</strong></div>
        <div><span>HIDDEN, PRESERVED</span><strong>{playback.hiddenGrainCount}</strong></div>
      </div>
      <div className="cross-grain-plan" aria-label="Cross-grain resolution needs">
        <div className="cross-grain-plan-heading">
          <div>
            <span className="eyebrow">Resolution needs</span>
            <strong>{resolutionNeed.mode}</strong>
          </div>
          <small>
            {resolutionNeed.referenceGrain === null
              ? `grain ${resolutionNeed.grain} establishes this exact shape`
              : `grain ${resolutionNeed.grain} references the exact shape resolved at grain ${resolutionNeed.referenceGrain}`}
          </small>
        </div>
        <div className="cross-grain-plan-ledger">
          <div>
            <span>RESOLVED PATTERNS</span>
            <strong>{crossGrainPlan.uniquePatternCount}</strong>
          </div>
          <div>
            <span>GRAIN REFERENCES</span>
            <strong>{crossGrainPlan.referencedPatternCount}</strong>
          </div>
          <div>
            <span>POINTS EVALUATED</span>
            <strong>{crossGrainPlan.evaluatedPointCount}</strong>
          </div>
          <div>
            <span>REPEATED EVALUATIONS SAVED</span>
            <strong>{crossGrainPlan.savedPointEvaluations}</strong>
          </div>
        </div>
        <div className="cross-grain-transform">
          <span>SHAPE</span>
          <strong>{resolutionNeed.shapeSignature.slice(0, 18)}…</strong>
          <span>ORIENTATION</span>
          <strong>{resolutionNeed.orientationSignature}</strong>
          <span>LOCAL SIZE</span>
          <strong>{(resolutionNeed.size * frame.scale).toExponential(3)}</strong>
        </div>
        <p>
          Only an exact shape signature may be referenced. Its orientation and
          size are applied locally with grain, scale, and causal route. A shape
          that can match but has not matched is still resolved here.
        </p>
      </div>
      <div className="grain-frame-strip">
        {playback.frames.map((item, index) => (
          <button
            type="button"
            key={item.grain}
            className={index === frameIndex ? "selected" : ""}
            onClick={() => {
              setPlaying(false)
              setFrameIndex(index)
              setMoment(1)
            }}
          >
            G{item.grain}
            {item.hiddenGrainsBefore > 0 ? <small>+{item.hiddenGrainsBefore} hidden</small> : null}
          </button>
        ))}
      </div>
      <p>Sub-pixel changes are not calculated as animation frames. Their difference accumulates until it reaches one available pixel; every omitted handoff remains counted in the causal route.</p>
    </section>
  )
}

function AtomInvariantSearch() {
  const search = useMemo(() => searchAtomInvariants(12, 1, 1), [])
  const atom = search.strongest
  if (!atom) {
    return (
      <section className="atom-search">
        <span className="eyebrow">WAS → IS → WILL BE search</span>
        <h2>No closed local invariant through moment {search.searchedThroughMoment}</h2>
      </section>
    )
  }
  const resolutionField = atom.resolutionSignature.length === 0
    ? []
    : atom.resolutionSignature.split(";")
  return (
    <section className="atom-search" aria-labelledby="atom-search-title">
      <div className="atom-heading">
        <div>
          <span className="eyebrow">Exhaustive local closure search</span>
          <h2 id="atom-search-title">First model-atom invariant</h2>
        </div>
        <strong>FOUND · moment {atom.firstMoment}</strong>
      </div>
      <div className="atom-cycle">
        <MotifFrame addresses={atom.exampleField} label="WAS" />
        <div className="cycle-arrow">→</div>
        <MotifFrame addresses={resolutionField} label="IS" />
        <div className="cycle-arrow">→</div>
        <MotifFrame addresses={atom.exampleField} label="WILL BE" />
      </div>
      <div className="atom-metrics">
        <div><span>Closure</span><strong>{atom.motifSize} → {resolutionField.length} → {atom.motifSize}</strong></div>
        <div><span>Cube observer signature</span><strong>{atom.observerSignature}</strong></div>
        <div><span>Closure span</span><strong>{atom.closureSpan} moments</strong></div>
        <div><span>Recurrence-step GCD</span><strong>{atom.recurrenceStepGcd}</strong></div>
        <div><span>Found moments</span><strong>{atom.uniqueMoments.join(" · ")}</strong></div>
        <div><span>Exact occurrences</span><strong>{atom.occurrences.length}</strong></div>
      </div>
      <div className="allowance-copy">
        <div>
          <span className="eyebrow">What it is</span>
          <p>
            A five-Difference local field returns cube-equivalent in WILL BE
            after resolving through one IS Difference one Face-step away. All
            six observer views receive five addresses.
          </p>
        </div>
        <div>
          <span className="eyebrow">What it allows</span>
          <p>
            This is the smallest nontrivial chronologically closed invariant
            found under the declared radius-1 and one-Face-transfer search. It
            gives the modeller an exact internal definition of a model atom.
          </p>
        </div>
      </div>
      <p className="atom-qualification">
        Search result of the selected recurrence—not a visual resemblance.
        Relationships to observed atoms require a separately declared mapping.
      </p>
    </section>
  )
}

function SixObserverResolution({
  frame,
}: Readonly<{ frame: ExplorerFrame }>) {
  const resolution = useMemo(
    () => observeFromSixFaces(new Set(frame.chronology.is)),
    [frame.chronology.is],
  )
  const extent = Math.max(
    1,
    ...frame.chronology.is.flatMap((address) => {
      const { x, y, z } = fromKey(address)
      return [Math.abs(x), Math.abs(y), Math.abs(z)]
    }),
  )

  return (
    <section className="six-observer" aria-labelledby="six-observer-title">
      <div className="six-observer-heading">
        <div>
          <span className="eyebrow">Six simultaneous MEs · moment {frame.observer.act}</span>
          <h2 id="six-observer-title">Cube-face resolution</h2>
        </div>
        <div className="observer-equation" aria-label="Observer radius">
          <span>Equal radius</span>
          <strong>{resolution.radius}</strong>
        </div>
      </div>
      <div className="face-views">
        {resolution.observers.map((observer) => {
          const view = resolution.views.get(observer.id) ?? []
          const shown = view.length > 450
            ? view.filter((_, index) => index % Math.ceil(view.length / 450) === 0)
            : view
          return (
            <figure className="face-view" key={observer.id}>
              <figcaption>
                <strong>{observer.id}</strong>
                <span>{view.length} received</span>
              </figcaption>
              <svg
                viewBox="0 0 100 100"
                role="img"
                aria-label={`${observer.id} observer received ${view.length} Differences`}
              >
                <rect x="1" y="1" width="98" height="98" />
                <line x1="50" y1="4" x2="50" y2="96" />
                <line x1="4" y1="50" x2="96" y2="50" />
                {shown.map((sight) => {
                  const [x, y] = faceProjection(observer.id, sight.address, extent)
                  const visibility = resolution.visibility.get(sight.address) ?? 0
                  return (
                    <circle
                      key={sight.address}
                      cx={x}
                      cy={y}
                      r={view.length > 150 ? 1.1 : 1.8}
                      className={`visibility-${visibility}`}
                    />
                  )
                })}
              </svg>
            </figure>
          )
        })}
      </div>
      <div className="combined-resolution" aria-live="polite">
        <div>
          <span>Whole field</span>
          <strong>{frame.chronology.is.length}</strong>
        </div>
        <div>
          <span>Seen by any ME</span>
          <strong>{resolution.visibleFromAnyFace.length}</strong>
        </div>
        <div>
          <span>Seen by all six</span>
          <strong>{resolution.visibleFromEveryFace.length}</strong>
        </div>
        <div>
          <span>Interior unresolved</span>
          <strong>{resolution.hiddenFromEveryFace.length}</strong>
        </div>
      </div>
      <p>
        Every view is resolved independently from the same distance and shared
        moment. Colour records how many of the six observers receive the same
        field address. Hidden addresses remain in the generated whole; they are
        not invented by the combined view.
      </p>
    </section>
  )
}

function ProgressiveObserverResolution({
  frame,
  isPlaying,
}: Readonly<{ frame: ExplorerFrame; isPlaying: boolean }>) {
  const [observerStage, setObserverStage] = useState(2)
  const [variantIndex, setVariantIndex] = useState(0)
  const [meDistanceOffset, setMeDistanceOffset] = useState(0)
  const [otherDistanceOffset, setOtherDistanceOffset] = useState(0)
  const [mergedMode, setMergedMode] = useState<
    "COMPLETE" | "ANY" | "EVERY" | "DEPENDENT" | "UNRECEIVED"
  >("COMPLETE")
  const field = useMemo(
    () => new Set(frame.chronology.is),
    [frame.chronology.is],
  )
  const resolution = useMemo(
    () => observeFromSixFaces(field),
    [field],
  )
  const variants = useMemo(
    () => combinations(
      resolution.observers.map((observer) => observer.id),
      observerStage,
    ).map((faces) => combineFaceViews(field, resolution, faces)),
    [field, observerStage, resolution],
  )
  const selectedIndex = Math.min(variantIndex, variants.length - 1)
  const selectedVariant = variants[selectedIndex]
  const pairViews = useMemo(() => {
    const positionFor = (face: ObserverFace, radius: number) => {
      if (face === "-X") return { x: -radius, y: 0, z: 0 }
      if (face === "+X") return { x: radius, y: 0, z: 0 }
      if (face === "-Y") return { x: 0, y: -radius, z: 0 }
      if (face === "+Y") return { x: 0, y: radius, z: 0 }
      if (face === "-Z") return { x: 0, y: 0, z: -radius }
      return { x: 0, y: 0, z: radius }
    }
    const [meFace, otherFace] = selectedVariant.faces
    const views = new Map<ObserverFace, readonly Sight[]>()
    views.set(meFace, observe(field, {
      id: "ME",
      position: positionFor(meFace, resolution.radius + meDistanceOffset),
    }))
    views.set(otherFace, observe(field, {
      id: "OTHER",
      position: positionFor(otherFace, resolution.radius + otherDistanceOffset),
    }))
    return views
  }, [
    field,
    meDistanceOffset,
    otherDistanceOffset,
    resolution.radius,
    selectedVariant.faces,
  ])
  const pairedTruth = useMemo(() => {
    const [meFace, otherFace] = selectedVariant.faces
    const remainder = resolveViewRemainders(
      field,
      pairViews.get(meFace) ?? [],
      pairViews.get(otherFace) ?? [],
    )
    return {
      seenByBoth: remainder.same,
      meOnly: remainder.meRemainder,
      otherOnly: remainder.otherRemainder,
      unseenButPresent: remainder.unseenRemainder,
      reconstructedMe: remainder.reconstructedMe,
      reconstructedOther: remainder.reconstructedOther,
      reconstructedWhole: remainder.reconstructedWhole,
    }
  }, [field, pairViews, selectedVariant.faces])
  const extent = Math.max(
    1,
    ...frame.chronology.is.flatMap((address) => {
      const { x, y, z } = fromKey(address)
      return [Math.abs(x), Math.abs(y), Math.abs(z)]
    }),
  )
  const mergedPoints = useMemo(() => {
    const addresses = {
      COMPLETE: [...field],
      ANY: selectedVariant.receivedByAny,
      EVERY: selectedVariant.receivedByEvery,
      DEPENDENT: selectedVariant.observerDependent,
      UNRECEIVED: selectedVariant.unreceived,
    }[mergedMode]
    const selectedViews = selectedVariant.faces.map((face) =>
      new Set((resolution.views.get(face) ?? []).map((sight) => sight.address)),
    )
    const mergedExtent = Math.max(
      1,
      ...[...field].flatMap((address) => {
        const { x, y, z } = fromKey(address)
        return [Math.abs(x), Math.abs(y), Math.abs(z)]
      }),
    )
    const scale = Math.min(34, 102 / (mergedExtent * 2))
    return addresses.map((address) => {
      const { x, y, z } = fromKey(address)
      return {
        address,
        visibility: selectedViews.reduce(
          (total, view) => total + Number(view.has(address)),
          0,
        ),
        x: 160 + (x - y) * scale,
        y: 112 + (x + y) * scale * .48 - z * scale * .92,
      }
    })
  }, [field, mergedMode, resolution.views, selectedVariant])

  return (
    <section
      className={`six-observer progressive ${isPlaying ? "is-playing" : ""}`}
      aria-labelledby="progressive-observer-title"
      data-shared-moment={frame.observer.act}
    >
      <div className="six-observer-heading">
        <div>
          <span className="eyebrow">Progressive observers · moment {frame.observer.act}</span>
          <h2 id="progressive-observer-title">
            Cube-face resolution · stage {observerStage}
          </h2>
        </div>
        <div className="observer-equation" aria-label="Observer radius">
          <span>{meDistanceOffset === otherDistanceOffset ? "Equal radius" : "Different radii"}</span>
          <strong>{resolution.radius + meDistanceOffset} · {resolution.radius + otherDistanceOffset}</strong>
        </div>
      </div>
      {observerStage === 2 ? (
        <div className="observer-distance-controls">
          <label>
            <span>ME DISTANCE</span>
            <input
              type="range"
              min="0"
              max="8"
              value={meDistanceOffset}
              onChange={(event) => setMeDistanceOffset(Number(event.target.value))}
            />
            <strong>{resolution.radius + meDistanceOffset}</strong>
          </label>
          <label>
            <span>OTHER DISTANCE</span>
            <input
              type="range"
              min="0"
              max="8"
              value={otherDistanceOffset}
              onChange={(event) => setOtherDistanceOffset(Number(event.target.value))}
            />
            <strong>{resolution.radius + otherDistanceOffset}</strong>
          </label>
        </div>
      ) : null}
      <div className="observer-stages" aria-label="Observer stages">
        {[2, 3, 4, 5, 6].map((stage) => (
          <button
            type="button"
            key={stage}
            className={observerStage === stage ? "selected" : ""}
            aria-pressed={observerStage === stage}
            onClick={() => {
              setObserverStage(stage)
              setVariantIndex(0)
            }}
          >
            <span>{stage}</span>
            <small>{stage === 2 ? "MINIMUM" : `${stage} MEs`}</small>
          </button>
        ))}
      </div>
      <div className="allowance-copy">
        <div>
          <span className="eyebrow">What it is</span>
          <p>
            {observerStage} observers at distinct positions and independently
            resolved distances inspect the same field from the same ACT and
            shared moment.
          </p>
        </div>
        <div>
          <span className="eyebrow">What it allows</span>
          <p>
            This configuration distinguishes {selectedVariant.receivedByAny.length} received
            addresses, {selectedVariant.observerDependent.length} observer-dependent
            addresses, and {selectedVariant.unreceived.length} addresses not received
            by these views.
          </p>
        </div>
      </div>
      <div className="view-variants" aria-label={`${observerStage}-observer configurations`}>
        {variants.map((variant, index) => (
          <button
            type="button"
            key={variant.faces.join(":")}
            className={index === selectedIndex ? "selected" : ""}
            aria-pressed={index === selectedIndex}
            onClick={() => setVariantIndex(index)}
          >
            <strong>{variant.faces.join(" · ")}</strong>
            <span>
              any {variant.receivedByAny.length} · every {variant.receivedByEvery.length}
              {" "}· dependent {variant.observerDependent.length} · hidden {variant.unreceived.length}
            </span>
            <small>result {variant.signature}</small>
            <small>
              {variant.symmetryClass} · complement {variant.complementFaces.join(" · ") || "NONE"}
            </small>
          </button>
        ))}
      </div>
      <div className="face-views">
        {resolution.observers
          .filter((observer) => selectedVariant.faces.includes(observer.id))
          .map((observer) => {
            const view = observerStage === 2
              ? pairViews.get(observer.id) ?? []
              : resolution.views.get(observer.id) ?? []
            const shown = view.length > 450
              ? view.filter((_, index) => index % Math.ceil(view.length / 450) === 0)
              : view
            return (
              <figure className="face-view" key={observer.id}>
                <figcaption>
                  <strong>{observer.id}</strong>
                  <span>{view.length} received</span>
                </figcaption>
                <svg
                  key={`${frame.observer.act}:${observer.id}`}
                  viewBox="0 0 100 100"
                  role="img"
                  aria-label={`${observer.id} observer received ${view.length} Differences`}
                >
                  <rect x="1" y="1" width="98" height="98" />
                  <line x1="50" y1="4" x2="50" y2="96" />
                  <line x1="4" y1="50" x2="96" y2="50" />
                  {shown.map((sight) => {
                    const [x, y] = faceProjection(observer.id, sight.address, extent)
                    const visibility = resolution.visibility.get(sight.address) ?? 0
                    return (
                      <circle
                        key={sight.address}
                        cx={x}
                        cy={y}
                        r={view.length > 150 ? 1.1 : 1.8}
                        className={`visibility-${visibility}`}
                      />
                    )
                  })}
                  {observerStage === 2
                    ? (observer.id === selectedVariant.faces[0]
                      ? pairedTruth.otherOnly
                      : pairedTruth.meOnly
                    ).map((address) => {
                      const [x, y] = faceProjection(observer.id, address, extent)
                      return (
                        <circle
                          key={`indicated:${address}`}
                          cx={x}
                          cy={y}
                          r="2.8"
                          className="cross-view-indicator"
                        >
                          <title>
                            {address} is present in the complete field and received by the
                            other observer, but this view cannot receive it because a nearer
                            relation occupies the same sight direction.
                          </title>
                        </circle>
                      )
                    })
                    : null}
                </svg>
              </figure>
            )
          })}
      </div>
      {observerStage === 2 ? (
        <section className="triangulated-truth" aria-label="Triangulated truth ledger">
          <div>
            <span>SEEN BY BOTH</span>
            <strong>{pairedTruth.seenByBoth.length}</strong>
            <small>Resolved SAME</small>
          </div>
          <div>
            <span>ME ONLY</span>
            <strong>{pairedTruth.meOnly.length}</strong>
            <small>ME remainder · indicated in OTHER</small>
          </div>
          <div>
            <span>OTHER ONLY</span>
            <strong>{pairedTruth.otherOnly.length}</strong>
            <small>OTHER remainder · indicated in ME</small>
          </div>
          <div>
            <span>UNSEEN BUT PRESENT</span>
            <strong>{pairedTruth.unseenButPresent.length}</strong>
            <small>Retained from the complete field</small>
          </div>
          <div className="remainder-equation">
            <span>RECONSTRUCTION</span>
            <strong>
              ME {pairedTruth.reconstructedMe.length}
              {" · "}OTHER {pairedTruth.reconstructedOther.length}
              {" · "}WHOLE {pairedTruth.reconstructedWhole.length}
            </strong>
            <small>SAME + every remainder = complete prior state</small>
          </div>
        </section>
      ) : null}
      <section className="merged-view-state" aria-labelledby="merged-view-title">
        <div className="merged-view-heading">
          <div>
            <span className="eyebrow">Combined causal requirements</span>
            <h3 id="merged-view-title">Merged view states</h3>
          </div>
          <strong>
            {selectedVariant.faces.join(" · ")} · moment {frame.observer.act}
          </strong>
        </div>
        <div className="merged-state-controls">
          {(["COMPLETE", "ANY", "EVERY", "DEPENDENT", "UNRECEIVED"] as const).map((mode) => (
            <button
              type="button"
              key={mode}
              className={mergedMode === mode ? "selected" : ""}
              aria-pressed={mergedMode === mode}
              onClick={() => setMergedMode(mode)}
            >
              <span>{mode}</span>
              <strong>
                {{
                  COMPLETE: field.size,
                  ANY: selectedVariant.receivedByAny.length,
                  EVERY: selectedVariant.receivedByEvery.length,
                  DEPENDENT: selectedVariant.observerDependent.length,
                  UNRECEIVED: selectedVariant.unreceived.length,
                }[mode]}
              </strong>
            </button>
          ))}
        </div>
        <svg
          key={`${frame.observer.act}:${mergedMode}:${selectedVariant.faces.join(":")}`}
          className="merged-state-canvas"
          viewBox="0 0 320 224"
          role="img"
          aria-label={`${mergedMode} merged state contains ${mergedPoints.length} field addresses`}
        >
          <rect width="320" height="224" />
          <line x1="160" y1="112" x2="260" y2="160" />
          <line x1="160" y1="112" x2="60" y2="160" />
          <line x1="160" y1="112" x2="160" y2="20" />
          {mergedPoints.map((point) => (
            <circle
              key={point.address}
              cx={point.x}
              cy={point.y}
              r={mergedPoints.length > 500 ? 1.5 : mergedPoints.length > 100 ? 2.1 : 3.2}
              className={`visibility-${point.visibility}`}
            />
          ))}
        </svg>
        <p>
          COMPLETE retains the generated field. The other states filter what
          the selected MEs jointly receive without replacing the complete field.
          Colour is the number of selected observers receiving each address.
        </p>
      </section>
      <div className="combined-resolution" aria-live="polite">
        <div><span>Whole field</span><strong>{frame.chronology.is.length}</strong></div>
        <div><span>Received by any</span><strong>{selectedVariant.receivedByAny.length}</strong></div>
        <div><span>Received by every</span><strong>{selectedVariant.receivedByEvery.length}</strong></div>
        <div><span>Not received</span><strong>{selectedVariant.unreceived.length}</strong></div>
      </div>
      <p>
        Every result remains separate. Matching counts do not make two
        configurations identical: their Face addresses and complete visibility
        histograms remain part of the result.
      </p>
    </section>
  )
}

function RecursiveLineageResolution() {
  const [depth, setDepth] = useState(2)
  const level = useMemo(() => generateLineageLevel(depth), [depth])
  return (
    <section className="model-extension lineage-resolution" aria-labelledby="lineage-title">
      <div className="extension-heading">
        <div>
          <span className="eyebrow">Causal identity before projection</span>
          <h2 id="lineage-title">Infinite six-Face lineage</h2>
        </div>
        <strong>6^{depth} = {level.count}</strong>
      </div>
      <div className="lineage-levels" aria-label="Lineage depth">
        {[0, 1, 2, 3, 4, 5].map((value) => (
          <button
            type="button"
            key={value}
            className={value === depth ? "selected" : ""}
            aria-pressed={value === depth}
            onClick={() => setDepth(value)}
          >
            <span>Level {value}</span>
            <strong>{lineageCount(value)}</strong>
          </button>
        ))}
        <div className="lineage-infinite">
          <span>Next</span>
          <strong>6^{depth + 1} = {lineageCount(depth + 1)}</strong>
        </div>
        <div className="lineage-infinite">
          <span>No final level</span>
          <strong>6ⁿ as n → ∞</strong>
        </div>
      </div>
      <div className="allowance-copy">
        <div>
          <span className="eyebrow">What it is</span>
          <p>
            Every branch retains its ordered Face path. Binary-scaled levels
            currently produce {level.count} distinct causal addresses and
            {level.unique ? " no lineage identity is lost" : " an identity conflict"}.
          </p>
        </div>
        <div>
          <span className="eyebrow">What it allows</span>
          <p>
            A visible coordinate can be treated as a projection while the
            complete path remains available. Presentation, overlap in a view,
            and causal identity are therefore separate relations.
          </p>
        </div>
      </div>
      <ol className="lineage-sample">
        {level.nodes.slice(0, 12).map((node) => (
          <li key={node.path.join("/") || "origin"}>
            <span>{node.path.join(" → ") || "NOTHING → ME"}</span>
            <strong>{node.position}</strong>
          </li>
        ))}
      </ol>
      {level.nodes.length > 12 ? (
        <p className="extension-note">
          Showing 12 of {level.nodes.length} exact lineages. Every lineage was
          included in the uniqueness calculation.
        </p>
      ) : null}
    </section>
  )
}

function ThoughtResolutionPanel() {
  const [thoughtState, setThoughtState] = useState(emptyThoughtState)
  const [thoughtInput, setThoughtInput] = useState("the cube")
  const [lastResolution, setLastResolution] = useState<ThoughtResolution | null>(null)

  const resolveInput = useCallback((content: string) => {
    if (content.trim().length === 0) return
    const resolution = resolveThought(thoughtState, content)
    setLastResolution(resolution)
    setThoughtState(resolution.is)
  }, [thoughtState])

  return (
    <section className="model-extension thought-resolution" aria-labelledby="thought-title">
      <div className="extension-heading">
        <div>
          <span className="eyebrow">ME resolves a represented Difference</span>
          <h2 id="thought-title">Thought becomes an event</h2>
        </div>
        <strong>Moment {thoughtState.moment}</strong>
      </div>
      <div className="thought-controls">
        <label>
          <span>Something ME can think</span>
          <input
            value={thoughtInput}
            onChange={(event) => setThoughtInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") resolveInput(thoughtInput)
            }}
          />
        </label>
        <button type="button" onClick={() => resolveInput(thoughtInput)}>
          Resolve thought
        </button>
        <button
          type="button"
          disabled={lastResolution === null}
          onClick={() => {
            if (lastResolution) resolveInput(`thought(${lastResolution.content})`)
          }}
        >
          Think about that thought
        </button>
      </div>
      <div className="thought-transition">
        <div>
          <span className="eyebrow">WAS</span>
          <strong>{lastResolution ? (lastResolution.wasPresent ? "PRESENT" : "NOT PRESENT") : "UNRESOLVED"}</strong>
        </div>
        <div className="thought-arrow">→</div>
        <div>
          <span className="eyebrow">IS</span>
          <strong>{lastResolution ? "PRESENT" : "UNRESOLVED"}</strong>
        </div>
        <div>
          <span className="eyebrow">Recursion</span>
          <strong>{lastResolution?.recurrence ?? 0}</strong>
        </div>
      </div>
      <div className="allowance-copy">
        <div>
          <span className="eyebrow">What it is</span>
          <p>
            A local observer state changes because a represented Difference is
            absent or differently retained in WAS and present in IS.
          </p>
        </div>
        <div>
          <span className="eyebrow">What it allows</span>
          <p>
            The distinction can be maintained, resolved again, or become the
            NOT ME of a further thought without claiming that it is the external
            thing being represented.
          </p>
        </div>
      </div>
      <ol className="thought-memory" aria-label="Maintained thoughts">
        {thoughtState.records.map((record) => (
          <li key={record.content}>
            <span>{record.content}</span>
            <strong>{record.resolutions} resolution{record.resolutions === 1 ? "" : "s"}</strong>
          </li>
        ))}
      </ol>
    </section>
  )
}

function StatusMark({ status }: Readonly<{ status: string }>) {
  return <span className={`status-mark status-${status.toLowerCase()}`}>{status}</span>
}

type PageExplanation = Readonly<{
  title: string
  whatItIs: string
  whatItAllows: string
  x: number
  y: number
}>

const INFO_TARGETS = [
  "button", "[role='button']", "a", "input", "select", "label", "[role='img']", "figure",
  "h1", "h2", "h3", ".eyebrow", "dt", "dd", "strong", "p", "li",
  ".status-mark", ".field-status > div", ".energy-grid > div",
  ".grain-route > div", ".grain-conditions > div",
].join(",")

function explainPageTarget(
  target: Element,
  x: number,
  y: number,
): PageExplanation {
  const text = (
    target.getAttribute("aria-label")
    ?? (target instanceof HTMLInputElement ? target.value : target.textContent)
    ?? target.tagName
  ).replace(/\s+/g, " ").trim().slice(0, 180)
  const title = text || "Model information"
  if (target.matches("button, [role='button']")) {
    return {
      title,
      whatItIs: `A model control labelled “${title}”.`,
      whatItAllows: "It allows ME to change the selected view or advance the declared resolution without changing the underlying causal history.",
      x, y,
    }
  }
  if (target.matches("input, select, label")) {
    return {
      title,
      whatItIs: "An observer-controlled constraint on what the modeller calculates or displays.",
      whatItAllows: "Changing it reconstructs the visible result from the same declared rules at the newly selected constraint.",
      x, y,
    }
  }
  if (target.matches("a")) {
    return {
      title,
      whatItIs: `A path from this model to “${title}”.`,
      whatItAllows: "It allows the explanation or source behind this part of the model to be inspected directly.",
      x, y,
    }
  }
  if (target.matches("[role='img'], figure, svg")) {
    return {
      title,
      whatItIs: "A rendered projection of the currently resolved field. It is a view of model state, not the complete state itself.",
      whatItAllows: "It allows spatial relations, symmetry, paths, and changes between moments to be seen from this observer position.",
      x, y,
    }
  }
  if (target.matches("dt, dd, strong, .status-mark, .field-status > div, .energy-grid > div")) {
    return {
      title,
      whatItIs: `A current model value or qualification: “${title}”.`,
      whatItAllows: "It allows the visible state to be checked against the calculation and its declared causal limits.",
      x, y,
    }
  }
  return {
    title,
    whatItIs: `This part of the explanation states: “${title}”.`,
    whatItAllows: "It identifies the role this statement plays in reconstructing the current model view.",
    x, y,
  }
}

function PageInfoBubble({
  explanation,
  onClose,
}: Readonly<{
  explanation: PageExplanation
  onClose: () => void
}>) {
  return (
    <aside
      className="page-info-bubble"
      role="dialog"
      aria-label={`Explanation: ${explanation.title}`}
      style={{ left: explanation.x, top: explanation.y }}
      onClick={(event) => event.stopPropagation()}
    >
      <button type="button" className="page-info-close" onClick={onClose} aria-label="Close explanation">×</button>
      <strong>{explanation.title}</strong>
      <div><span>WHAT IT IS</span><p>{explanation.whatItIs}</p></div>
      <div><span>WHAT IT ALLOWS</span><p>{explanation.whatItAllows}</p></div>
    </aside>
  )
}

const BREAKDOWN_LEVELS = ["EVERYTHING", "FIELD", "MEDIUM", "PARTICLE", "ATOM", "INSIDE"] as const

function EverythingBreakdown({
  frame,
  isPlaying,
  resolutionPhase,
  onEnter,
  onOutward,
  onSelect,
  onTogglePlay,
}: Readonly<{
  frame: ExplorerFrame
  isPlaying: boolean
  resolutionPhase: number
  onEnter: () => void
  onOutward: () => void
  onSelect: (address: string) => void
  onTogglePlay: () => void
}>) {
  const levelIndex = Math.min(
    BREAKDOWN_LEVELS.length - 1,
    Math.abs(frame.observer.relativeGrain),
  )
  const level = BREAKDOWN_LEVELS[levelIndex]
  const projection = useMemo(() => {
    const entries = frame.wholeProjection.entries
    const extent = Math.max(1, ...entries.flatMap((entry) => {
      const point = fromKey(entry.normalizedAddress)
      return [Math.abs(point.x), Math.abs(point.y), Math.abs(point.z)]
    }))
    const occupied = new Set<string>()
    const visible: Array<{
      address: string
      x: number
      y: number
      result: string
    }> = []
    for (const entry of entries) {
      const point = fromKey(entry.normalizedAddress)
      const x = 360 + ((point.x - point.y) / (extent * 2 + 1)) * 270
      const y = 230 + ((point.x + point.y - point.z * 1.6) / (extent * 3 + 1)) * 180
      const pixel = `${Math.round(x)},${Math.round(y)}`
      if (occupied.has(pixel)) continue
      occupied.add(pixel)
      visible.push({ address: entry.normalizedAddress, x, y, result: entry.result })
    }
    return {
      visible,
      hidden: entries.length - visible.length,
      total: entries.length,
    }
  }, [frame.wholeProjection.entries])
  const selected = frame.selected?.address ?? projection.visible[0]?.address ?? "0,0,0"
  const discoveryMoment = resolutionPhase === 0
    ? null
    : INITIAL_SPIRAL_DISCOVERY.moments[
      Math.min(resolutionPhase, ATOM_FIELD_MOMENT) - 1
    ]
  const projectDiscovery = (point: Readonly<{ x: number; y: number; z: number }>) => ({
    x: 360 + (point.x - point.y) * 115,
    y: 230 + (point.x + point.y) * 55 - point.z * 95,
  })
  const causalRender = useMemo(() => {
    const activeMoments = INITIAL_SPIRAL_DISCOVERY.moments.slice(
      0,
      Math.min(resolutionPhase, ATOM_FIELD_MOMENT),
    )
    const paths = activeMoments.flatMap((moment) =>
      moment.states.map((state) => state.standingWavePath.map(projectDiscovery)),
    )
    const inViewport = (point: Readonly<{ x: number; y: number }>) =>
      point.x >= 0 && point.x <= 720 && point.y >= 0 && point.y <= 460
    const visiblePaths = paths.filter((path) => path.some(inViewport))
    const visiblePoints = visiblePaths.flatMap((path) => path.filter(inViewport))
    const closure = verifySphericalClosure(
      activeMoments.flatMap((moment) =>
        moment.states.flatMap((state) => state.standingWavePath),
      ),
    )
    return {
      visiblePaths,
      omittedPaths: paths.length - visiblePaths.length,
      closure,
    }
  }, [resolutionPhase])

  return (
    <section className="everything-breakdown" aria-labelledby="everything-title">
      <nav className="breakdown-rail" aria-label="Break down the whole">
        <h2>BREAK DOWN</h2>
        <ol>
          {BREAKDOWN_LEVELS.map((item, index) => (
            <li key={item} className={index === levelIndex ? "selected" : index < levelIndex ? "passed" : ""}>
              <button
                type="button"
                onClick={() => {
                  if (index > levelIndex) onEnter()
                  else if (index < levelIndex) onOutward()
                }}
                aria-current={index === levelIndex ? "step" : undefined}
              >
                <span>{String(index).padStart(2, "0")}</span>
                <strong>{item}</strong>
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <div className="everything-canvas">
        <div className="everything-heading">
          <div>
            <h2 id="everything-title">{level}</h2>
            <p>{levelIndex === 0
              ? "The complete field available to this observer."
              : `The ${level.toLowerCase()} now visible from grain ${frame.observer.relativeGrain}.`}
            </p>
          </div>
          <div className="everything-actions">
            <button type="button" onClick={onTogglePlay}>{isPlaying ? "PAUSE" : "PLAY"}</button>
            <strong>MOMENT {frame.observer.act} · RESOLUTION {resolutionPhase}/{ATOM_FIELD_MOMENT}</strong>
          </div>
        </div>
        <div className="spiral-discovery" aria-label="Detected spiral chronology">
          <div className={resolutionPhase === 0 ? "current" : "resolved"}>
            <span>FIRST DIFFERENCE · GRAIN {INITIAL_SPIRAL_DISCOVERY.initialState.grain} · MOMENT 0</span>
            <strong>NO SPIRAL → NO SPIRAL</strong>
            <small>Existence is already distinguished. NOTHING has no playable duration.</small>
          </div>
          <b>→</b>
          <div className={resolutionPhase === 1 ? "current" : resolutionPhase > 1 ? "resolved" : ""}>
            <span>MOMENT {frame.observer.act} · RESOLUTION 1</span>
            <strong>MOVEMENT → NO DETECTED SPIRAL</strong>
            <small>One transfer cannot establish a turn.</small>
          </div>
          <b>→</b>
          <div className={resolutionPhase === INITIAL_SPIRAL_DISCOVERY.spiralStartsAt.moment ? "current" : ""}>
            <span>GRAIN {INITIAL_SPIRAL_DISCOVERY.spiralStartsAt.grain} · RESOLUTION {INITIAL_SPIRAL_DISCOVERY.spiralStartsAt.moment}</span>
            <strong>FIRST SPIRAL</strong>
            <small>Successive transfers become non-collinear.</small>
          </div>
          <b>→</b>
          <div className={resolutionPhase === INITIAL_SPIRAL_DISCOVERY.spiralingSpiralStartsAt.moment ? "current" : ""}>
            <span>GRAIN {INITIAL_SPIRAL_DISCOVERY.spiralingSpiralStartsAt.grain} · RESOLUTION {INITIAL_SPIRAL_DISCOVERY.spiralingSpiralStartsAt.moment}</span>
            <strong>SPIRALING SPIRAL</strong>
            <small>The child turn is carried by the parent turn.</small>
          </div>
          <b>→</b>
          <div className={resolutionPhase >= ATOM_FIELD_MOMENT ? "current unresolved" : ""}>
            <span>GRAIN {INITIAL_SPIRAL_DISCOVERY.childGrain} · RESOLUTION {ATOM_FIELD_MOMENT}</span>
            <strong>{causalRender.closure.closed ? "SPHERICAL FIELD VERIFIED" : "FIELD REMAINS OPEN"}</strong>
            <small>
              Direction {Math.round(causalRender.closure.directionalCoverage * 100)}%
              {" · "}radial uniformity {Math.round(causalRender.closure.radialUniformity * 100)}%.
            </small>
          </div>
        </div>
        <div className="all-levels-map" aria-label="All recursive levels shown together">
          {BREAKDOWN_LEVELS.map((item, index) => {
            const radius = Math.max(8, 31 - index * 4)
            return (
              <button
                type="button"
                key={item}
                className={index === levelIndex ? "selected" : ""}
                aria-label={`${item}, grain ${-index}, shown in the complete sequence`}
              >
                <svg viewBox="0 0 74 74" aria-hidden="true">
                  <circle cx="37" cy="37" r={radius + 8} className="level-boundary" />
                  <circle cx="37" cy="37" r={radius} className="level-field" />
                  <circle cx="37" cy="37" r="3" className="level-me" />
                  <path d={`M37 ${37 - radius} A${radius} ${radius} 0 0 1 ${37 + radius} 37`} />
                </svg>
                <span>{item}</span>
                <small>grain {-index}</small>
              </button>
            )
          })}
        </div>
        <svg viewBox="0 0 720 460" role="img" aria-label={`${level} field with ${projection.visible.length} visible relations`}>
          <defs>
            <radialGradient id="field-fade">
              <stop offset="0" stopColor="#69d5ce" stopOpacity=".16" />
              <stop offset="1" stopColor="#69d5ce" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle className="field-aura" cx="360" cy="230" r="210" />
          <circle className="field-orbit" cx="360" cy="230" r="150" />
          <circle className="field-orbit inner" cx="360" cy="230" r="82" />
          {causalRender.closure.closed ? (
            <circle
              className="atom-field-envelope closed"
              cx="360"
              cy="230"
              r="190"
            />
          ) : null}
          <g className={`spiral-finding-stage moment-${resolutionPhase}`}>
            <circle className="first-difference-point" cx="360" cy="230" r="5" />
            {discoveryMoment ? (
              <>
                <polyline
                  className="detected-carrier"
                  points={[
                    { x: 360, y: 230 },
                    ...discoveryMoment.carrierPath.map(projectDiscovery),
                  ].map((point) => `${point.x},${point.y}`).join(" ")}
                />
                {resolutionPhase >= INITIAL_SPIRAL_DISCOVERY.spiralingSpiralStartsAt.moment
                  ? causalRender.visiblePaths.map((path, index) => (
                    <polyline
                      key={`causal:${index}`}
                      className="detected-child-spiral"
                      points={path
                        .map((point) => `${point.x},${point.y}`)
                        .join(" ")}
                    />
                  ))
                  : null}
              </>
            ) : null}
          </g>
          {projection.visible.map((point, index) => {
            const next = projection.visible[(index + 1) % projection.visible.length]
            return next ? (
              <line
                key={`line:${point.address}`}
                x1={point.x}
                y1={point.y}
                x2={next.x}
                y2={next.y}
                className="field-thread"
              />
            ) : null
          })}
          {projection.visible.map((point) => (
            <circle
              key={point.address}
              cx={point.x}
              cy={point.y}
              r={point.address === selected ? 7 : 3.5}
              className={point.address === selected ? "field-node selected" : "field-node"}
              role="button"
              tabIndex={0}
              aria-label={`Relation ${point.address}: ${point.result}`}
              onClick={() => onSelect(point.address)}
            />
          ))}
        </svg>
        <div className="observer-resolution">
          <div><span>VISIBLE AT THIS GRAIN</span><strong>{projection.visible.length} calculated</strong></div>
          <div>
            <span>OUTSIDE / BELOW PIXEL</span>
            <strong>{projection.hidden + causalRender.omittedPaths} not rendered</strong>
          </div>
          <label>
            <span>OUT</span>
            <input
              type="range"
              min="0"
              max={BREAKDOWN_LEVELS.length - 1}
              value={levelIndex}
              onChange={(event) => {
                const requested = Number(event.target.value)
                if (requested > levelIndex) onEnter()
                else if (requested < levelIndex) onOutward()
              }}
              aria-label="Observer grain"
            />
            <span>IN</span>
          </label>
        </div>
      </div>

      <aside className="how-it-is" aria-label="How the selected whole is">
        <h2>HOW IT IS</h2>
        <section>
          <span>WHAT IT IS</span>
          <p>
            {levelIndex === 0
              ? "One complete resolved field presented from the current observer grain."
              : `A ${level.toLowerCase()} is the currently visible part of the containing field.`}
          </p>
        </section>
        <section>
          <span>WHAT IT ALLOWS</span>
          <p>
            Selecting a visible difference allows its containing structure to
            be entered and reconstructed at the next grain.
          </p>
        </section>
        <div className="breakdown-route">
          <span>CAME FROM<strong>{levelIndex === 0 ? "FIRST DIFFERENCE" : BREAKDOWN_LEVELS[levelIndex - 1]}</strong></span>
          <b>→</b>
          <span>IS<strong>{level}</strong></span>
          <b>→</b>
          <span>GOES TO<strong>{BREAKDOWN_LEVELS[Math.min(levelIndex + 1, BREAKDOWN_LEVELS.length - 1)]}</strong></span>
        </div>
        <button type="button" className="enter-selected" onClick={onEnter}>ENTER SELECTED FIELD</button>
        <small>Selected relation · {selected}</small>
      </aside>
    </section>
  )
}

export function App() {
  const explorer = useRef<FirstActExplorer | null>(null)
  if (explorer.current === null) explorer.current = new FirstActExplorer()
  const [frame, setFrame] = useState(() => explorer.current!.frame())
  const [leftOpen, setLeftOpen] = useState(true)
  const [rightOpen, setRightOpen] = useState(true)
  const [ledgerOpen, setLedgerOpen] = useState(true)
  const [isPlaying, setIsPlaying] = useState(false)
  const [atNothingBoundary, setAtNothingBoundary] = useState(true)
  const [boundaryCycle, setBoundaryCycle] = useState(0)
  const [playbackSpeed, setPlaybackSpeed] = useState(120)
  const [resolutionPhase, setResolutionPhase] = useState(0)
  const [pageExplanation, setPageExplanation] = useState<PageExplanation | null>(null)
  const [targetMoment, setTargetMoment] = useState(
    () => ATOM_FIELD_MOMENT,
  )

  const update = useCallback((next: ExplorerFrame) => setFrame(next), [])
  const resolve = useCallback(
    () => update(explorer.current!.resolveOneTick()),
    [update],
  )
  const resetPlayback = useCallback(() => {
    setIsPlaying(false)
    setAtNothingBoundary(true)
    setBoundaryCycle((cycle) => cycle + 1)
    setResolutionPhase(0)
    setTargetMoment(ATOM_FIELD_MOMENT)
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
    if (!atNothingBoundary) return
    const boundaryFrame = window.requestAnimationFrame(() => {
      setAtNothingBoundary(false)
      setIsPlaying(true)
    })
    return () => window.cancelAnimationFrame(boundaryFrame)
  }, [atNothingBoundary, boundaryCycle])

  useEffect(() => {
    if (!isPlaying) return
    if (frame.observer.act === 0) {
      const firstDifference = window.setTimeout(resolve, playbackSpeed)
      return () => window.clearTimeout(firstDifference)
    }
    if (resolutionPhase === targetMoment) {
      setIsPlaying(false)
      return
    }
    const direction = resolutionPhase < targetMoment ? 1 : -1
    const timer = window.setTimeout(
      () => setResolutionPhase((phase) => phase + direction),
      playbackSpeed,
    )
    return () => window.clearTimeout(timer)
  }, [
    frame.observer.act,
    isPlaying,
    playbackSpeed,
    resolve,
    resolutionPhase,
    targetMoment,
  ])

  useEffect(() => {
    const handleKey = (event: globalThis.KeyboardEvent): void => {
      if (event.target instanceof HTMLInputElement) return
      if (event.code === "Space") {
        event.preventDefault()
        setIsPlaying(false)
        if (event.shiftKey) {
          setResolutionPhase((phase) => Math.max(0, phase - 1))
        } else if (frame.observer.act === 0) {
          resolve()
        } else {
          setResolutionPhase((phase) => Math.min(ATOM_FIELD_MOMENT, phase + 1))
        }
      } else if (event.key === "[") {
        setDepth(Math.max(0, frame.observer.queryDepth - 1))
      } else if (event.key === "]") {
        setDepth(Math.min(4, frame.observer.queryDepth + 1))
      }
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [frame.observer.act, frame.observer.queryDepth, resolve, setDepth])

  const explainClick = useCallback((event: ReactMouseEvent<HTMLElement>) => {
    const origin = event.target
    if (!(origin instanceof Element) || origin.closest(".page-info-bubble")) return
    const target = origin.closest(INFO_TARGETS)
    if (!target) {
      setPageExplanation(null)
      return
    }
    const bubbleWidth = Math.min(360, window.innerWidth - 24)
    const x = Math.max(12, Math.min(event.clientX + 14, window.innerWidth - bubbleWidth - 12))
    const y = Math.max(12, Math.min(event.clientY + 14, window.innerHeight - 290))
    setPageExplanation(explainPageTarget(target, x, y))
  }, [])

  useEffect(() => {
    if (pageExplanation === null) return
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setPageExplanation(null)
    }
    window.addEventListener("keydown", closeOnEscape)
    return () => window.removeEventListener("keydown", closeOnEscape)
  }, [pageExplanation])

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

  if (atNothingBoundary) return <main className="nothing-boundary" />

  return (
    <main className="app-shell info-enabled" onClickCapture={explainClick}>
      <div className="page-info-hint">CLICK ANY LABEL · VALUE · CONTROL · VIEW FOR ITS EXPLANATION</div>
      {pageExplanation ? (
        <PageInfoBubble explanation={pageExplanation} onClose={() => setPageExplanation(null)} />
      ) : null}
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
              if (resolutionPhase === targetMoment && targetMoment > 0) {
                resetPlayback()
                setIsPlaying(true)
                return
              }
              setIsPlaying((playing) => !playing)
            }}
            aria-pressed={isPlaying}
            disabled={resolutionPhase === 0 && targetMoment === 0}
          >
            <span aria-hidden="true">{isPlaying ? "Ⅱ" : "▶"}</span>
            <span>
              {isPlaying
                ? "Pause formation"
                : resolutionPhase === targetMoment
                  ? `Replay resolution ${targetMoment}`
                  : `Resolve to ${targetMoment}`}
            </span>
          </button>
          <label className="moment-control">
            <span>Resolution phase</span>
            <input
              type="number"
              min="0"
              max={ATOM_FIELD_MOMENT}
              step="1"
              value={targetMoment}
              onChange={(event) => {
                const requested = Number(event.target.value)
                if (!Number.isSafeInteger(requested) || requested < 0) return
                setIsPlaying(false)
                setTargetMoment(Math.min(requested, ATOM_FIELD_MOMENT))
              }}
              aria-label="Resolution phase"
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
              if (frame.observer.act === 0) resolve()
              else setResolutionPhase((phase) => Math.min(ATOM_FIELD_MOMENT, phase + 1))
            }}
          >
            <span>One resolution</span>
            <kbd>Space</kbd>
          </button>
          <button className="reset-action" type="button" onClick={resetPlayback}>
            Reset
          </button>
        </div>
      </header>

      <OperatorResolutionStage
        moment={resolutionPhase}
        isPlaying={isPlaying}
        onMomentChange={(moment) => {
          setIsPlaying(false)
          setResolutionPhase(moment)
          setTargetMoment(moment)
        }}
        onTogglePlay={() => {
          if (isPlaying) {
            setIsPlaying(false)
            return
          }
          if (resolutionPhase === ATOM_FIELD_MOMENT) {
            setResolutionPhase(0)
          }
          setTargetMoment(ATOM_FIELD_MOMENT)
          setIsPlaying(true)
        }}
      />
      <details className="technical-breakdown">
        <summary>
          <span>COMPLETE TECHNICAL BREAKDOWN</span>
          <small>Open every derivation, observer view, force path, lineage, and causal ledger</small>
        </summary>
      <EverythingBreakdown
        frame={frame}
        isPlaying={isPlaying}
        resolutionPhase={resolutionPhase}
        onEnter={enter}
        onOutward={outward}
        onSelect={selectRelation}
        onTogglePlay={() => setIsPlaying((playing) => !playing)}
      />
      <ProgressiveObserverResolution frame={frame} isPlaying={isPlaying} />
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
                  <details className="resolution-address">
                    <summary>Resolution address</summary>
                    <dl>
                      <div><dt>Root</dt><dd>{node.resolution.root}</dd></div>
                      <div><dt>Input</dt><dd>{node.resolution.input}</dd></div>
                      <div><dt>Operation</dt><dd>{node.resolution.operation}</dd></div>
                      <div><dt>Output</dt><dd>{node.resolution.output}</dd></div>
                      <div><dt>Grain</dt><dd>{node.resolution.grain}</dd></div>
                      <div><dt>Moment</dt><dd>{node.resolution.moment}</dd></div>
                      <div><dt>Evidence</dt><dd>{node.resolution.evidence}</dd></div>
                      <div><dt>Closure</dt><dd>{node.resolution.closure}</dd></div>
                    </dl>
                  </details>
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
          <PotentialFlowResolution frame={frame} isPlaying={isPlaying} />
          <FirstActParticleResolution isPlaying={isPlaying} />
          <AtomInvariantSearch />
          <RecursiveLineageResolution />
          <ThoughtResolutionPanel />
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
      </details>
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
