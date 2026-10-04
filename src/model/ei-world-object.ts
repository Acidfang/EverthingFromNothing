import {projectInDirection} from './directional-view.ts'
/**
 * An authored nature-themed skin over a retained address. These meshes are
 * presentation, never supplied source geometry, coordinates, or new EI state.
 * Only actual part count decides whether the object has a branching form.
 */
export interface EIWorldEntity {
  readonly address: string
  readonly revision: number
  readonly sourceId: string
  readonly value: unknown
  readonly partCount: number
  readonly root: boolean
}
export interface EIWorldVertex { readonly x: number; readonly y: number; readonly z: number }
export interface EIWorldFace {
  readonly vertices: readonly number[]
  readonly fill: string
  readonly role: 'ground' | 'body' | 'crown' | 'part-cluster' | 'decoration'
  /** Count summarized by this entire cluster, not a new part identity. */
  readonly cluster?: number
}
export type EIWorldPresentation = 'nature' | 'solar'
export type EIWorldForm = 'branching-tree' | 'tree-doorhouse' | 'lanternstone' | 'leaf-book' | 'solar-star' | 'ringed-planet' | 'planet'
export const EI_WORLD_MAPPING_SCOPE = 'authored-nature-presentation-of-retained-address' as const

const palettes = [
  { bark: '#ba6b43', leaf: '#6fc482', bloom: '#ffd779', stone: '#a88bc7', glow: '#ffe89b' },
  { bark: '#b77564', leaf: '#70bcae', bloom: '#f4a7a9', stone: '#829cca', glow: '#fff1b1' },
  { bark: '#9e754b', leaf: '#a1c878', bloom: '#e5a9d0', stone: '#b193ba', glow: '#ffe2a0' },
] as const

function sourceHash(sourceId: string) {
  let hash = 2166136261
  for (let index = 0; index < sourceId.length; index++) hash = Math.imul(hash ^ sourceId.charCodeAt(index), 16777619)
  return hash >>> 0
}

function deriveEINatureObject(entity: EIWorldEntity) {
  if (!Number.isSafeInteger(entity.partCount) || entity.partCount < 0) throw new Error('World appearance needs a nonnegative actual part count')
  if (!Number.isSafeInteger(entity.revision) || entity.revision < 0) throw new Error('World appearance needs a retained revision')
  const hash = sourceHash(entity.sourceId), palette = palettes[hash % palettes.length]
  const container = entity.partCount > 0
  const form: EIWorldForm = container ? (hash % 2 ? 'tree-doorhouse' : 'branching-tree') : (hash % 2 ? 'leaf-book' : 'lanternstone')
  const vertices: EIWorldVertex[] = [], faces: EIWorldFace[] = []
  const vertex = (x: number, y: number, z: number) => { vertices.push({ x, y, z }); return vertices.length - 1 }
  const face = (indices: number[], fill: string, role: EIWorldFace['role'], cluster?: number) => faces.push({ vertices: indices, fill, role, ...(cluster === undefined ? {} : { cluster }) })

  /** Closed elliptical frustum with true front, side, back, and end faces. */
  function rings(cx: number, cz: number, levels: readonly [number, number, number][], fill: string, role: EIWorldFace['role'], sides = 7, cluster?: number) {
    const rows = levels.map(([y, rx, rz]) => Array.from({ length: sides }, (_, i) => {
      const angle = i * Math.PI * 2 / sides
      return vertex(cx + Math.cos(angle) * rx, y, cz + Math.sin(angle) * rz)
    }))
    face([...rows[0]].reverse(), fill, role, cluster)
    for (let row = 1; row < rows.length; row++) for (let i = 0; i < sides; i++) face([rows[row - 1][i], rows[row - 1][(i + 1) % sides], rows[row][(i + 1) % sides], rows[row][i]], fill, role, cluster)
    face([...rows[rows.length - 1]], fill, role, cluster)
  }

  function branch(a: EIWorldVertex, b: EIWorldVertex, radius: number, cluster: number) {
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, length = Math.hypot(dx, dy, dz)
    const ux = dx / length, uy = dy / length, uz = dz / length
    const horizontal = Math.hypot(ux, uz)
    const vx = horizontal > 0 ? -uz / horizontal : 1, vz = horizontal > 0 ? ux / horizontal : 0
    const wx = uy * vz, wy = uz * vx - ux * vz, wz = -uy * vx
    const rows = [a, b].map((p, row) => Array.from({ length: 5 }, (_, i) => {
      const angle = i * Math.PI * 2 / 5, r = radius * (row ? .58 : 1)
      return vertex(p.x + r * (vx * Math.cos(angle) + wx * Math.sin(angle)), p.y + r * wy * Math.sin(angle), p.z + r * (vz * Math.cos(angle) + wz * Math.sin(angle)))
    }))
    face([...rows[0]].reverse(), palette.bark, 'body')
    for (let i = 0; i < 5; i++) face([rows[0][i], rows[0][(i + 1) % 5], rows[1][(i + 1) % 5], rows[1][i]], palette.bark, 'body', cluster)
    face(rows[1], palette.bark, 'body')
  }

  // A bounded number of visible clusters can summarize large real containers.
  // Their counts sum exactly to partCount; they are never synthetic addresses.
  const clusterCount = Math.min(entity.partCount, 7)
  const clusters = Array.from({ length: clusterCount }, (_, index) => ({
    index, count: Math.floor(entity.partCount / clusterCount) + (index < entity.partCount % clusterCount ? 1 : 0),
  }))
  rings(0, 0, [[-42, 18, 14], [-38, entity.root ? 29 : 25, 20], [-34, 23, 17]], '#7aaf91', 'ground')

  if (container) {
    const wide = form === 'tree-doorhouse'
    rings(0, 0, [[-35, wide ? 16 : 10, wide ? 13 : 8], [-22, wide ? 13 : 7, wide ? 11 : 6], [4, wide ? 12 : 6, wide ? 10 : 5], [24, 5, 4]], palette.bark, 'body')
    clusters.forEach(({ index }) => {
      const angle = (index / clusters.length) * Math.PI * 2 + .3
      const end = { x: Math.cos(angle) * 29, y: 9 + (index % 3) * 7, z: Math.sin(angle) * 22 }
      branch({ x: 0, y: -9 + (index % 3) * 6, z: 0 }, end, 3.4, index)
      rings(end.x, end.z, [[end.y - 6, 3, 3], [end.y, 13, 10], [end.y + 9, 10, 8], [end.y + 14, 1, 1]], index % 2 ? palette.bloom : palette.leaf, 'part-cluster', 6, index)
    })
    rings(0, 0, [[19, 10, 8], [29, 20, 15], [40, 15, 11], [49, 1, 1]], palette.leaf, 'crown')
    if (wide) {
      // A decorative arch on the tree, not an invented enter/operation affordance.
      const arch = [[-6, -34], [6, -34], [6, -20], [4, -15], [0, -13], [-4, -15], [-6, -20]]
      face(arch.map(([x, y]) => vertex(x, y, 13.4)), '#60435d', 'decoration')
      rings(4, 14, [[-25, 1.5, 1], [-23, 1.5, 1]], palette.glow, 'decoration', 5)
    }
  } else if (form === 'lanternstone') {
    rings(0, 0, [[-34, 14, 11], [-25, 21, 15], [-16, 16, 12], [-12, 9, 8]], palette.stone, 'body')
    rings(0, 0, [[-14, 5, 5], [1, 4, 4]], palette.bark, 'body', 6)
    rings(0, 0, [[-1, 8, 7], [8, 17, 13], [26, 14, 11], [32, 8, 7]], palette.glow, 'body', 6)
    rings(0, 0, [[29, 10, 8], [34, 23, 17], [42, 9, 7], [48, 1, 1]], palette.leaf, 'crown', 7)
    // Two solid leaf blades give the lantern a recognizable sprouting silhouette.
    for (const side of [-1, 1]) {
      const ids = [[side * 4, -8, 0], [side * 29, 4, 3], [side * 24, -9, 6], [side * 14, -14, 1], [side * 18, -5, -3]].map(([x, y, z]) => vertex(x, y, z))
      face([ids[0], ids[1], ids[4]], palette.leaf, 'decoration')
      face([ids[1], ids[2], ids[3], ids[4]], palette.leaf, 'decoration')
      face([ids[3], ids[0], ids[4]], palette.leaf, 'decoration')
      face([ids[0], ids[3], ids[2], ids[1]], palette.leaf, 'decoration')
    }
  } else {
    rings(0, 0, [[-34, 14, 11], [-26, 18, 13], [-20, 11, 9]], palette.stone, 'body')
    // An open book made from thick folded leaves, with a solid central spine.
    for (const side of [-1, 1]) {
      const ids = [[0, -16, 13], [side * 34, -3, 13], [side * 29, 34, -5], [0, 23, -5], [0, -20, 10], [side * 34, -7, 10], [side * 29, 30, -8], [0, 19, -8]].map(([x, y, z]) => vertex(x, y, z))
      face(ids.slice(0, 4), palette.glow, 'body')
      face([ids[4], ids[7], ids[6], ids[5]], palette.leaf, 'body')
      for (let i = 0; i < 4; i++) face([ids[i], ids[(i + 1) % 4], ids[4 + (i + 1) % 4], ids[4 + i]], i === 1 ? palette.glow : palette.leaf, 'body')
      // Physical page bands, not textual claims about the retained value.
      for (const y of [-4, 4, 12]) {
        face([[side * 7, y, 12 - (y + 16) * 18 / 39 + .4], [side * 26, y + 7, 12 - (y + 16) * 18 / 39 + .4], [side * 26, y + 8, 12 - (y + 16) * 18 / 39 + .4], [side * 7, y + 1, 12 - (y + 16) * 18 / 39 + .4]].map(([x, yy, z]) => vertex(x, yy, z)), palette.bloom, 'decoration')
      }
    }
    rings(0, 3, [[-22, 3, 3], [25, 3, 3]], palette.bark, 'decoration', 5)
  }

  return Object.freeze({
    kind: 'EI_AUTHORED_WORLD_OBJECT' as const, presentation: 'nature' as const,
    identity: Object.freeze({ address: entity.address, revision: entity.revision, sourceId: entity.sourceId }),
    form,
    vertices: Object.freeze(vertices.map(item => Object.freeze(item))),
    faces: Object.freeze(faces.map(item => Object.freeze({ ...item, vertices: Object.freeze(item.vertices) }))),
    mapping: Object.freeze({ scope: EI_WORLD_MAPPING_SCOPE, sourceGeometry: false as const, canonicalPosition: null,
      basis: container ? 'actual-retained-parts' as const : 'retained-value-leaf' as const,
      actualPartCount: entity.partCount, clusters: Object.freeze(clusters.map(item => Object.freeze(item))),
      formChoice: 'stable-source-id-presentation' as const, valueInterpreted: false as const, modelAdvanced: false as const }),
  })
}

/** Source identities drive membership; all celestial geometry is presentation. */
export function deriveEISolarObject(entity: EIWorldEntity) {
 if(!Number.isSafeInteger(entity.partCount)||entity.partCount<0||!Number.isSafeInteger(entity.revision)||entity.revision<0)throw new Error('Invalid retained solar entity')
 const hash=sourceHash(entity.address),form=entity.root?'solar-star' as const:entity.partCount>0?'ringed-planet' as const:'planet' as const
 const radius=entity.root?35:31,segments=16,rings=7,vertices:EIWorldVertex[]=[],faces:EIWorldFace[]=[]
 const palette=entity.root?['#ffe49a','#f6c964','#eeb346']:['#71bfc8','#84b6a4','#a3a0d3','#cfac7f','#ba91a5']
 const base=palette[entity.root?0:hash%palette.length]
 const add=(x:number,y:number,z:number)=>{vertices.push({x,y,z});return vertices.length-1}
 const top=add(0,radius,0),rows:number[][]=[]
 for(let row=1;row<=rings;row++){const phi=Math.PI*row/(rings+1);rows.push(Array.from({length:segments},(_,i)=>{const theta=i*Math.PI*2/segments;return add(radius*Math.sin(phi)*Math.cos(theta),radius*Math.cos(phi),radius*Math.sin(phi)*Math.sin(theta))}))}
 const bottom=add(0,-radius,0)
 const face=(indices:number[],fill=base,role:EIWorldFace['role']='body')=>faces.push({vertices:indices,fill,role})
 for(let i=0;i<segments;i++){const next=(i+1)%segments;face([top,rows[0][next],rows[0][i]]);for(let row=1;row<rings;row++)face([rows[row-1][i],rows[row-1][next],rows[row][next],rows[row][i]],entity.root?palette[row%3]:base);face([bottom,rows[rings-1][i],rows[rings-1][next]])}
 if(form==='ringed-planet'){
  const ringRows=[42,56].map(r=>Array.from({length:32},(_,i)=>{const theta=i*Math.PI*2/32;return add(Math.cos(theta)*r,Math.sin(theta)*r*.22,Math.sin(theta)*r*.9755)}))
  for(let i=0;i<32;i++)face([ringRows[0][i],ringRows[1][i],ringRows[1][(i+1)%32],ringRows[0][(i+1)%32]],'#d9c899','decoration')
 }
 if(form==='solar-star')for(let i=0;i<16;i++){const a=i*Math.PI*2/16,b=a+.12;face([add(Math.cos(a-.12)*38,0,Math.sin(a-.12)*38),add(Math.cos(a)*49,0,Math.sin(a)*49),add(Math.cos(b)*38,0,Math.sin(b)*38)],'#e9c666','decoration')}
 return Object.freeze({kind:'EI_AUTHORED_WORLD_OBJECT' as const,presentation:'solar' as const,identity:Object.freeze({address:entity.address,revision:entity.revision,sourceId:entity.sourceId}),form,vertices:Object.freeze(vertices.map(v=>Object.freeze(v))),faces:Object.freeze(faces.map(f=>Object.freeze({...f,vertices:Object.freeze(f.vertices)}))),mapping:Object.freeze({scope:'authored-solar-presentation-of-retained-address' as const,sourceGeometry:false as const,canonicalPosition:null,basis:entity.partCount>0?'actual-retained-parts' as const:'retained-value-leaf' as const,actualPartCount:entity.partCount,clusters:Object.freeze([] as {count:number}[]),formChoice:'stable-address-presentation' as const,valueInterpreted:false as const,modelAdvanced:false as const})})
}
export function deriveEIWorldObject(entity:EIWorldEntity,presentation:EIWorldPresentation='nature') {if(presentation==='nature')return deriveEINatureObject(entity);if(presentation==='solar')return deriveEISolarObject(entity);throw new Error('Unknown world presentation')}

export type EIWorldObject = ReturnType<typeof deriveEIWorldObject>

/** Orthographic observer projection. Depth order changes; identity never does. */
export function projectEIWorldObject(entityOrObject: EIWorldEntity | EIWorldObject, yaw: number, pitch: number, presentation:EIWorldPresentation='nature') {
  if (!Number.isFinite(yaw) || !Number.isFinite(pitch)) throw new Error('Invalid observer basis')
  const object = 'vertices' in entityOrObject ? entityOrObject : deriveEIWorldObject(entityOrObject,presentation)
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch)
  const points = object.vertices.map(point => {
    const x = point.x * cy - point.z * sy, z = point.x * sy + point.z * cy
    const projected=projectInDirection({x,y:point.y*cp-z*sp,z:point.y*sp+z*cp},0)
    return Object.freeze({x:projected.x,y:-projected.y,z:projected.depth})
  })
  const projectedFaces = object.faces.map((face, index) => {
    const polygon = face.vertices.map(i => points[i])
    const path = polygon.map((point, i) => `${i ? 'L' : 'M'}${point.x.toFixed(3)} ${point.y.toFixed(3)}`).join('') + 'Z'
    const [a, b, c] = polygon
    const ux = b.x - a.x, uy = b.y - a.y, uz = b.z - a.z, vx = c.x - a.x, vy = c.y - a.y, vz = c.z - a.z
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx
    const normalLength = Math.hypot(nx, ny, nz)
    const light = normalLength > 0 ? .78 + .22 * Math.abs((-.3 * nx - .7 * ny + .6 * nz) / normalLength) : 1
    const rgb = [1, 3, 5].map(at => Math.min(255, Math.round(parseInt(face.fill.slice(at, at + 2), 16) * light)).toString(16).padStart(2, '0')).join('')
    return Object.freeze({ index, path, points: polygon.map(point => `${point.x},${point.y}`).join(' '), fill: `#${rgb}`, depth: polygon.reduce((sum, point) => sum + point.z, 0) / polygon.length, role: face.role, ...(face.cluster === undefined ? {} : { cluster: face.cluster }) })
  }).sort((a, b) => a.depth - b.depth || a.index - b.index)
  return Object.freeze({
    identity: object.identity, form: object.form, mapping: object.mapping,
    scope: object.mapping.scope, projectionLineage:'src/model/directional-view.ts#projectInDirection', observerDirection:0, faces: Object.freeze(projectedFaces), path: projectedFaces.map(face => face.path).join(''),
    vertices: Object.freeze(points),
    bounds: Object.freeze({ left: Math.min(...points.map(point => point.x)), right: Math.max(...points.map(point => point.x)), top: Math.min(...points.map(point => point.y)), bottom: Math.max(...points.map(point => point.y)) }),
  })
}
