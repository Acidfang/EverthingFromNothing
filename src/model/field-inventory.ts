/** Read-only graph queries. Inventory locators never become spatial coordinates. */
export type InventoryNode = Readonly<{id:string; label:string; kind:string; status:string; inventory_binary_address:string}>
export type InventoryRelation = Readonly<{left:string; right:string; relation:string; status:string; support:string}>
export function searchInventory(nodes:readonly InventoryNode[], query:string):readonly InventoryNode[]{
 const needle=query.trim().toLocaleLowerCase()
 return nodes.filter(node=>[node.id,node.label,node.status,node.inventory_binary_address||"ε"].some(value=>value.toLocaleLowerCase().includes(needle)))
}
export function relationsAt(relations:readonly InventoryRelation[], id:string):readonly InventoryRelation[]{
 return relations.filter(edge=>edge.left===id||edge.right===id)
}
export function validSpatialAddress(value:string):boolean{
 return /^-?\d+,-?\d+,-?\d+$/.test(value)&&value.split(",").every(part=>Number.isSafeInteger(Number(part)))
}
export function sourceHref(source:Readonly<{path:string;revision:string}>):string{
 const revision=source.revision==="introduced-with-inventory"?"main":source.revision
 return `https://github.com/Acidfang/EverthingFromNothing/blob/${encodeURIComponent(revision)}/${source.path.split("/").map(encodeURIComponent).join("/")}`
}
