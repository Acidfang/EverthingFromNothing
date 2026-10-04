import { createAddressedDraw, mayAdvanceAfterDraw } from './addressed-draw.ts'
import { projectInDirection } from './directional-view.ts'
import { EI_FIELD_ACTION_GEOMETRY } from './ei-field-action.ts'
import { SHARED_TETRAHEDRON_VERTICES, SHARED_ZERO, type Point3 } from './three-tetrahedron-drawing.ts'
import type { EIWorldObject, EIWorldPresentation } from './ei-world-object.ts'

export type EIModelerPoint = Readonly<{ id: string; sourceId: string; point: Point3 }>
export type EIModelerEdge = Readonly<{ id: string; sourceId: string; from: string; to: string; boundaryFaces?: readonly string[] }>
export type EIModelerFace = Readonly<{ id: string; sourceId: string; vertices: readonly string[]; fill: string }>
export type EIModelerProvenance = Readonly<{
  geometryScope: 'authored-presentation-geometry'; blueprintSource: string
  binding: Readonly<{ address: string; revision: number; sourceId: string }>
  presentation?: EIWorldPresentation; actualPartCount: number; form: string; centreScope: 'authored-object-local-origin'
}>
export type EIModelerObject = Readonly<{
  id: string; sourceId: string; centre: EIModelerPoint
  vertices: readonly EIModelerPoint[]; edges: readonly EIModelerEdge[]
  faces?: readonly EIModelerFace[]; provenance?: EIModelerProvenance
}>
export type EIModelerDrawOptions = Readonly<{
  width: number; height: number; direction?: number; yaw?: number; pitch?: number
  showVertexMarkers?: boolean; showCentreMarker?: boolean; strokeWidth?: number
  transparentBackground?: boolean
}>
const geometrySource = 'src/model/three-tetrahedron-drawing.ts'
const edgeSource = 'src/model/ei-field-action.ts#EI_FIELD_ACTION_GEOMETRY.edges'

/** Existing source vertices, source centre and existing six binary edges only. */
export const EI_RETAINED_MODELER_OBJECT: EIModelerObject = Object.freeze({
  id: `${geometrySource}#THREE_TETRAHEDRON_DRAWING`, sourceId: geometrySource,
  centre: Object.freeze({ id: `${geometrySource}#SHARED_ZERO`, sourceId: geometrySource, point: SHARED_ZERO }),
  vertices: Object.freeze(SHARED_TETRAHEDRON_VERTICES.map((point, index) => Object.freeze({
    id: `${geometrySource}#SHARED_TETRAHEDRON_VERTICES/${index}`, sourceId: geometrySource, point,
  }))),
  edges: Object.freeze(EI_FIELD_ACTION_GEOMETRY.edges.map(([from, to], index) => Object.freeze({
    id: `${edgeSource}/${index}`, sourceId: edgeSource,
    from: `${geometrySource}#SHARED_TETRAHEDRON_VERTICES/${from}`,
    to: `${geometrySource}#SHARED_TETRAHEDRON_VERTICES/${to}`,
  }))),
})

/** Bind an already-authored mesh, without relabelling its form as source-derived. */
export function bindEIWorldObjectToModeler(object: EIWorldObject): EIModelerObject {
  const blueprintSource = 'src/model/ei-world-object.ts#deriveEIWorldObject'
  const id = `${object.identity.address}#authored-${object.presentation==='solar'?'solar':'world'}/revision/${object.identity.revision}`
  const vertices = object.vertices.map((point, index) => Object.freeze({ id: `${id}/vertices/${index}`, sourceId: blueprintSource, point }))
  const faces = object.faces.map((face, index) => Object.freeze({
    id: `${id}/faces/${index}`, sourceId: blueprintSource,
    vertices: Object.freeze(face.vertices.map(index => vertices[index].id)), fill: face.fill,
  }))
  const boundaryEdges = new Map<string, { from: string; to: string; boundaryFaces: string[] }>()
  object.faces.forEach((face, index) => face.vertices.forEach((from, corner) => {
    const to = face.vertices[(corner + 1) % face.vertices.length], key = [Math.min(from, to), Math.max(from, to)].join('-')
    const edge = boundaryEdges.get(key) ?? { from: vertices[Math.min(from, to)].id, to: vertices[Math.max(from, to)].id, boundaryFaces: [] }
    edge.boundaryFaces.push(faces[index].id); boundaryEdges.set(key, edge)
  }))
  return Object.freeze({
    id, sourceId: blueprintSource,
    centre: Object.freeze({ id: `${id}/local-origin`, sourceId: blueprintSource, point: Object.freeze({ x: 0, y: 0, z: 0 }) }),
    vertices: Object.freeze(vertices), faces: Object.freeze(faces),
    edges: Object.freeze([...boundaryEdges].map(([key, edge]) => Object.freeze({ id: `${id}/edges/${key}`, sourceId: blueprintSource, ...edge, boundaryFaces: Object.freeze(edge.boundaryFaces) }))),
    provenance: Object.freeze({ presentation:object.presentation, geometryScope: 'authored-presentation-geometry' as const, blueprintSource,
      binding: Object.freeze({ ...object.identity }), actualPartCount: object.mapping.actualPartCount,
      form: object.form, centreScope: 'authored-object-local-origin' as const }),
  })
}

type PixelPoint = Readonly<{ id: string; sourceId: string; x: number; y: number; depth: number }>
const colours = [[98, 201, 231], [133, 221, 170], [231, 181, 111], [195, 155, 231], [242, 147, 173], [150, 184, 252]] as const

/**
 * Diagnostic raster adapter for caller-supplied geometry. Observer rotations and
 * finite device-pixel fitting are presentation choices. No shape, twist or
 * state-transition law is inferred. Pixel samples are computed inside assign;
 * there is no already-rendered image to scan or copy.
 */
export function createEIModelerObjectDraw(input: EIModelerObject, options: EIModelerDrawOptions) {
  const { width, height } = options, direction = options.direction ?? 0, yaw = options.yaw ?? .29, pitch = options.pitch ?? -.17
  const draw = createAddressedDraw(width, height)
  if (width * height > 16777216) throw new Error('Diagnostic frame exceeds the finite pixel budget')
  if (![yaw, pitch].every(Number.isFinite)) throw new Error('Invalid observer rotation')
  if (options.strokeWidth !== undefined && (!Number.isFinite(options.strokeWidth) || options.strokeWidth < 0)) throw new Error('Invalid observer stroke width')
  if (!input.id || !input.sourceId || !input.centre.id || !input.centre.sourceId) throw new Error('Retained object and centre identity required')
  const copyPoint = (item: EIModelerPoint): EIModelerPoint => {
    if (!item.id || !item.sourceId || ![item.point.x, item.point.y, item.point.z].every(Number.isFinite)) throw new Error('Invalid retained source point')
    return Object.freeze({ id: item.id, sourceId: item.sourceId, point: Object.freeze({ ...item.point }) })
  }
  const centre = copyPoint(input.centre), vertices = input.vertices.map(copyPoint)
  const byId = new Map(vertices.map(vertex => [vertex.id, vertex]))
  if (byId.size !== vertices.length) throw new Error('Duplicate retained vertex identity')
  const edgeIds = new Set<string>()
  const edges = input.edges.map(edge => {
    if (!edge.id || !edge.sourceId || edgeIds.has(edge.id)) throw new Error('Invalid or duplicate retained edge identity')
    edgeIds.add(edge.id)
    if (!byId.has(edge.from) || !byId.has(edge.to)) throw new Error(`Unknown retained edge endpoint: ${edge.id}`)
    return Object.freeze({ id: edge.id, sourceId: edge.sourceId, from: edge.from, to: edge.to,
      ...(edge.boundaryFaces ? { boundaryFaces: Object.freeze([...edge.boundaryFaces]) } : {}) })
  })
  const faceIds = new Set<string>()
  const faces = (input.faces ?? []).map(face => {
    if (!face.id || !face.sourceId || faceIds.has(face.id) || face.vertices.length < 3 || !/^#[0-9a-f]{6}$/i.test(face.fill)) throw new Error('Invalid or duplicate retained face identity')
    faceIds.add(face.id)
    if (face.vertices.some(id => !byId.has(id))) throw new Error(`Unknown retained face vertex: ${face.id}`)
    return Object.freeze({ id: face.id, sourceId: face.sourceId, vertices: Object.freeze([...face.vertices]), fill: face.fill })
  })
  for (const edge of edges) if (edge.boundaryFaces?.some(id => !faceIds.has(id))) throw new Error(`Unknown retained edge boundary face: ${edge.id}`)
  const retained = Object.freeze({ id: input.id, sourceId: input.sourceId, centre, vertices: Object.freeze(vertices), edges: Object.freeze(edges), faces: Object.freeze(faces),
    ...(input.provenance ? { provenance: Object.freeze({ ...input.provenance, binding: Object.freeze({ ...input.provenance.binding }) }) } : {}) })
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch)
  const project = (point: Point3) => {
    const relative = { x: point.x - centre.point.x, y: point.y - centre.point.y, z: point.z - centre.point.z }
    const x = relative.x * cy - relative.z * sy, z = relative.x * sy + relative.z * cy
    return projectInDirection({ x, y: relative.y * cp - z * sp, z: relative.y * sp + z * cp }, direction)
  }
  const centreProjection = project(centre.point)
  const raw = vertices.map(vertex => ({ ...vertex, projection: project(vertex.point) }))
  const maxX = Math.max(.01, ...raw.map(vertex => Math.abs(vertex.projection.x)))
  const maxY = Math.max(.01, ...raw.map(vertex => Math.abs(vertex.projection.y)))
  const scale = Math.max(.01, Math.min(width * .36 / maxX, height * .36 / maxY))
  const cx = (width - 1) / 2, cyPixel = (height - 1) / 2
  const projectedVertices: readonly PixelPoint[] = Object.freeze(raw.map(vertex => Object.freeze({
    id: vertex.id, sourceId: vertex.sourceId, x: cx + vertex.projection.x * scale, y: cyPixel - vertex.projection.y * scale, depth: vertex.projection.depth,
  })))
  const projectedById = new Map(projectedVertices.map(vertex => [vertex.id, vertex]))
  const projectedEdges = Object.freeze(edges.map((edge, index) => Object.freeze({
    ...edge, index, fromPoint: projectedById.get(edge.from)!, toPoint: projectedById.get(edge.to)!,
  })))
  const projectedFaces = Object.freeze(faces.map((face, index) => Object.freeze({ ...face, index, points: Object.freeze(face.vertices.map(id => projectedById.get(id)!)) })))
  const sourcePixel = Object.freeze({ id: centre.id, sourceId: centre.sourceId, x: cx, y: cyPixel, depth: centreProjection.depth })
  const primitives = Object.freeze([
    Object.freeze({ id: centre.id, sourceId: centre.sourceId, kind: 'centre' as const }),
    ...vertices.map(vertex => Object.freeze({ id: vertex.id, sourceId: vertex.sourceId, kind: 'vertex' as const })),
    ...edges.map(edge => Object.freeze({ id: edge.id, sourceId: edge.sourceId, kind: 'edge' as const })),
    ...faces.map(face => Object.freeze({ id: face.id, sourceId: face.sourceId, kind: 'face' as const })),
  ])

  // The map contains target addresses only, not precomputed image samples.
  const total = width * height
  const targetOrder = Array.from({ length: total }, (_, index) => index).sort((a, b) => {
    const ax = a % width - cx, ay = Math.floor(a / width) - cyPixel
    const bx = b % width - cx, by = Math.floor(b / width) - cyPixel
    return ax * ax + ay * ay - bx * bx - by * by || a - b
  })
  const rgba = new Uint8ClampedArray(total * 4), assignmentCounts = new Uint8Array(total)
  const primitiveAtPixel = new Int32Array(total).fill(-1)
  let assignedTargets = 0, returned = false, checksum = 2166136261
  const orderedEdges = [...projectedEdges].sort((a, b) => a.fromPoint.depth + a.toPoint.depth - b.fromPoint.depth - b.toPoint.depth || a.index - b.index)
  const orderedVertices = projectedVertices.map((vertex, index) => ({ ...vertex, index })).sort((a, b) => a.depth - b.depth || a.index - b.index)
  const coverage = (distance: number, radius: number) => Math.max(0, Math.min(1, radius + .5 - distance))
  const radius = Math.max(.8, Math.min(width, height) / 125)
  const edgeRadius = (options.strokeWidth ?? radius * 1.3) / 2
  const edgeSamples = orderedEdges.map(edge => ({ ...edge,
    left: Math.min(edge.fromPoint.x, edge.toPoint.x) - edgeRadius - .5, right: Math.max(edge.fromPoint.x, edge.toPoint.x) + edgeRadius + .5,
    top: Math.min(edge.fromPoint.y, edge.toPoint.y) - edgeRadius - .5, bottom: Math.max(edge.fromPoint.y, edge.toPoint.y) + edgeRadius + .5,
  }))
  const faceSamples = projectedFaces.flatMap(face => {
    const [a, b, c] = face.points, ux = b.x - a.x, uy = b.y - a.y, uz = b.depth - a.depth
    const vx = c.x - a.x, vy = c.y - a.y, vz = c.depth - a.depth
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx
    if (Math.abs(nz) < 1e-12) return []
    // Convert screen-space slope to observer units before applying view lighting.
    const normalLength = Math.hypot(nx * scale, ny * scale, nz)
    const lit=Math.max(0,(-.4*nx*scale-.6*ny*scale+.7*nz)*(nz<0?-1:1)/(normalLength*Math.sqrt(1.01)))
    const lighting = input.provenance?.presentation==='solar'?(input.provenance.form==='solar-star'?.8+.2*lit:.3+.7*lit):.77 + .23 * Math.abs((-.3 * nx * scale - .7 * ny * scale + .6 * nz) / normalLength)
    return [{ ...face, depthX: -nx / nz, depthY: -ny / nz, origin: a,
      left: Math.min(...face.points.map(p => p.x)), right: Math.max(...face.points.map(p => p.x)),
      top: Math.min(...face.points.map(p => p.y)), bottom: Math.max(...face.points.map(p => p.y)),
      colour: [1, 3, 5].map(at => Math.round(parseInt(face.fill.slice(at, at + 2), 16) * lighting)),
    }]
  })
  // Screen-space candidate bins only accelerate coverage queries. They neither
  // hold image samples nor supply a model grid, geometry or transition rule.
  const binSize = 16, binColumns = Math.ceil(width / binSize), binRows = Math.ceil(height / binSize)
  function binCandidates<T extends { left: number; right: number; top: number; bottom: number }>(samples: readonly T[]) {
    const bins: T[][] = Array.from({ length: binColumns * binRows }, () => [])
    for (const sample of samples) {
      if (sample.right < 0 || sample.bottom < 0 || sample.left >= width || sample.top >= height) continue
      const left = Math.max(0, Math.floor(sample.left / binSize)), right = Math.min(binColumns - 1, Math.floor(sample.right / binSize))
      const top = Math.max(0, Math.floor(sample.top / binSize)), bottom = Math.min(binRows - 1, Math.floor(sample.bottom / binSize))
      for (let by = top; by <= bottom; by++) for (let bx = left; bx <= right; bx++) bins[by * binColumns + bx].push(sample)
    }
    return bins
  }
  const faceBins = binCandidates(faceSamples), edgeBins = binCandidates(edgeSamples)

  function constructPixel(target: number) {
    if (assignmentCounts[target] !== 0) throw new Error('Target pixel was already assigned')
    const x = target % width, y = Math.floor(target / width)
    const colour = options.transparentBackground ? [0, 0, 0] : [9, 20, 34]
    let alpha = options.transparentBackground ? 0 : 1
    let owner = -1, nearestDepth = -Infinity
    const paint = (rgb: readonly number[], amount: number, primitive: number) => {
      if (amount <= 0) return
      const nextAlpha = amount + alpha * (1 - amount)
      for (let channel = 0; channel < 3; channel++) colour[channel] = (colour[channel] * alpha * (1 - amount) + rgb[channel] * amount) / nextAlpha
      alpha = nextAlpha
      owner = primitive
    }
    const bin = Math.floor(y / binSize) * binColumns + Math.floor(x / binSize)
    for (const face of faceBins[bin]) {
      if (x < face.left || x > face.right || y < face.top || y > face.bottom) continue
      const depth = face.origin.depth + (x - face.origin.x) * face.depthX + (y - face.origin.y) * face.depthY
      if (depth < nearestDepth) continue
      let inside = false
      for (let i = 0, j = face.points.length - 1; i < face.points.length; j = i++) {
        const a = face.points[i], b = face.points[j]
        if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) inside = !inside
      }
      if (inside) { paint(face.colour, 1, 1 + vertices.length + edges.length + face.index); nearestDepth = depth }
    }
    for (const edge of edgeBins[bin]) {
      if (options.strokeWidth === 0 || x < edge.left || x > edge.right || y < edge.top || y > edge.bottom) continue
      const a = edge.fromPoint, b = edge.toPoint, dx = b.x - a.x, dy = b.y - a.y, length2 = dx * dx + dy * dy
      const t = length2 > 0 ? Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / length2)) : 0
      if (a.depth + t * (b.depth - a.depth) < nearestDepth - (edgeRadius + .5) / scale) continue
      const distance = Math.hypot(x - (a.x + t * dx), y - (a.y + t * dy))
      paint(faces.length ? [46, 68, 61] : colours[edge.index % colours.length], coverage(distance, edgeRadius), 1 + vertices.length + edge.index)
    }
    if (options.showVertexMarkers !== false) for (const vertex of orderedVertices) {
      if (vertex.depth >= nearestDepth - radius * 1.7 / scale) paint([228, 239, 250], coverage(Math.hypot(x - vertex.x, y - vertex.y), radius * 1.7), 1 + vertex.index)
    }
    if (options.showCentreMarker !== false) paint([255, 211, 108], coverage(Math.hypot(x - cx, y - cyPixel), radius * 2), 0)
    const offset = target * 4
    for (let channel = 0; channel < 3; channel++) rgba[offset + channel] = Math.round(colour[channel])
    rgba[offset + 3] = Math.round(alpha * 255)
    primitiveAtPixel[target] = owner
    assignmentCounts[target] = 1
    assignedTargets++
    checksum = Math.imul(checksum ^ target, 16777619)
    for (let channel = 0; channel < 4; channel++) checksum = Math.imul(checksum ^ rgba[offset + channel], 16777619)
  }
  const receipt = () => Object.freeze({ ...draw.receipt(), assignedTargets, returned, modelAdvanced: false as const })

  return Object.freeze({
    retained,
    projection: Object.freeze({ direction, yaw, pitch, scale, pixelsPerUnit: scale, pixelOrigin: sourcePixel, sourcePixel, vertices: projectedVertices, edges: projectedEdges, faces: projectedFaces }),
    assign(limit: number) {
      draw.assign(limit, index => constructPixel(targetOrder[index]))
      return receipt()
    },
    cancel() { draw.cancel() },
    receipt,
    /** No partial buffer can be mistaken for a completed returned draw. */
    returnBuffer() {
      if (!draw.receipt().complete || assignedTargets !== total) return null
      returned = true
      return Object.freeze({
        width, height, pixelsPerUnit: scale, pixelOrigin: sourcePixel, rgba: rgba.slice(), assignmentCounts: assignmentCounts.slice(),
        transparentBackground: options.transparentBackground ?? false,
        targetOrder: Uint32Array.from(targetOrder), primitiveAtPixel: primitiveAtPixel.slice(), primitives,
        retained, receipt: receipt(), checksum: (checksum >>> 0).toString(16).padStart(8, '0'),
        scope: 'existing-modeler-projection-and-addressed-pixel-construction' as const,
        geometryScope: input.provenance?.geometryScope ?? 'caller-supplied-retained-geometry',
        assignmentOrder: 'projected-source-centre-out' as const,
        rasterAcceleration: 'screen-space-bounding-box-bins' as const,
        geometryDerived: false as const, modelAdvanced: false as const,
        unresolved: Object.freeze(['source-law-for-new-object-shapes', 'canonical-twist-transform', 'model-state-transition'] as const),
      })
    },
    /** Existing finite-draw gate only; this adapter never advances model state. */
    mayPresentAsComplete(presented: boolean) { return returned && mayAdvanceAfterDraw(draw.receipt(), presented) },
  })
}
