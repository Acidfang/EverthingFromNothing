export type V3 = { x:number; y:number; z:number }
export type TemporalRole = "WAS" | "IS" | "NEXT"

export type FieldNode = {
  address:string
  parent:string|null
  depth:number
  position:V3
  role:TemporalRole|"ZERO"|"PROCEED"
  receipt:string
}

export type FractureField = {
  root:string
  nodes:FieldNode[]
}

// Canonical local tetrahedral directions. The field engine owns geometry;
// the renderer only projects the resulting addressed positions.
const DIRECTIONS:readonly V3[] = [
  {x:1,y:1,z:1},
  {x:-1,y:-1,z:1},
  {x:-1,y:1,z:-1},
  {x:1,y:-1,z:-1},
]
const ROLES:readonly TemporalRole[] = ["WAS","IS","NEXT"]

const add=(a:V3,b:V3,s=1):V3=>({x:a.x+b.x*s,y:a.y+b.y*s,z:a.z+b.z*s})

function fracture(parent:FieldNode,maxDepth:number,out:FieldNode[]):void {
  if(parent.depth>=maxDepth)return
  const childDepth=parent.depth+1
  const scale=2**(-childDepth)

  // Every node uses the same local rule. Three temporal children retain
  // WAS/IS/NEXT; the fourth is the direction of PROCEED.
  for(let i=0;i<4;i++){
    const role:FieldNode["role"]=i<3?ROLES[i]:"PROCEED"
    const address=`${parent.address}/${role}:${i}`
    const child:FieldNode={
      address,
      parent:parent.address,
      depth:childDepth,
      position:add(parent.position,DIRECTIONS[i],scale),
      role,
      receipt:`${parent.address}->${address}`,
    }
    out.push(child)
    fracture(child,maxDepth,out)
  }
}

export function buildFractureField(maxDepth=4):FractureField {
  const root:FieldNode={
    address:"FAMILY/NOTODUS/STATE/DEFAULT/ZERO",
    parent:null,
    depth:0,
    position:{x:0,y:0,z:0},
    role:"ZERO",
    receipt:"ROOT",
  }
  const nodes=[root]
  fracture(root,Math.max(0,Math.floor(maxDepth)),nodes)
  return{root:root.address,nodes}
}

export function verifyFractureField(field:FractureField,maxDepth:number):string[] {
  const differences:string[]=[]
  const expected=(4**(Math.max(0,Math.floor(maxDepth))+1)-1)/3
  if(field.nodes.length!==expected)differences.push(`node-count:${field.nodes.length}!=${expected}`)
  if(field.nodes[0]?.address!==field.root)differences.push("root-address")
  const addresses=new Set<string>()
  for(const node of field.nodes){
    if(addresses.has(node.address))differences.push(`duplicate:${node.address}`)
    addresses.add(node.address)
    if(node.parent&&!addresses.has(node.parent))differences.push(`parent-order:${node.address}`)
  }
  return differences
}
