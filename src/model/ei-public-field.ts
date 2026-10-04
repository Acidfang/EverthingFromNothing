/** Public inventory records, not a new ontology, geometry, or executed model Act. */
import inventory from '../../docs/FRACTURE-FIELD-INVENTORY.json' with { type: 'json' }
import type { EISeedRecord } from './ei-engine.ts'
import { inventoryRelationGrains } from './relation-grain.ts'

export const EI_PUBLIC_FIELD_SOURCE = Object.freeze({
  path: 'docs/FRACTURE-FIELD-INVENTORY.json',
  sourceRevision: inventory.source_revision,
  nodeCount: inventory.binary_relation_order.nodes.length,
  entryCount: inventory.entries.length,
  relationCount: inventory.binary_relation_order.relations.length,
  addressScope: 'The model/ prefix is a presentation namespace; binary strings remain selected inventory locators, not canonical source addresses.',
  revisionScope: 'sourceRevision is the revision recorded by the inventory; this adapter does not assert a new inspection or verification of that revision.',
})

/** An implementation-issued presentation address. Existence is established by the returned records. */
export function eiPublicFieldAddress(id: string): string { return `model/${id}` }

/**
 * One seed record per actual inventory node and one outgoing relation per row.
 * A source payload preserves the exact node, entry, and indexed outgoing rows.
 * Entry parents mean retained support/dependency, never geometric or temporal
 * causation. SELECTED document membership stays a relation, not a new parent.
 * Inventory WAS/IS/NEXT statements stay source text; EI history is not invented.
 */
export function createEIPublicFieldRecords(): readonly EISeedRecord[] {
  const graph = inventory.binary_relation_order
  const rows = inventoryRelationGrains(inventory) // Checks distinct nodes and every endpoint.
  const nodes = new Map(graph.nodes.map(node => [node.id, node]))
  const entries = new Map(inventory.entries.map((entry, index) => [entry.id, { entry, index }]))
  if (entries.size !== inventory.entries.length) throw new Error('Duplicate public inventory entry')
  for (const entry of inventory.entries) {
    const node = nodes.get(entry.id)
    if (!node || node.kind !== 'field-entry' || node.status !== entry.status || node.inventory_binary_address !== entry.inventory_binary_address) throw new Error(`Public entry/node binding differs at ${entry.id}`)
    if (entry.parents.some(parent => !nodes.has(parent))) throw new Error(`Unbound public dependency at ${entry.id}`)
  }
  const byLeft = new Map<string, number[]>()
  graph.relations.forEach((row, index) => {
    if (row.left_address !== nodes.get(row.left)!.inventory_binary_address || row.right_address !== nodes.get(row.right)!.inventory_binary_address) throw new Error(`Public relation locator differs at row ${index}`)
    byLeft.set(row.left, [...(byLeft.get(row.left) ?? []), index])
  })
  const { nodes: _nodes, relations: _relations, ...orderStatements } = graph
  return Object.freeze(graph.nodes.map((node, index): EISeedRecord => {
    const retained = entries.get(node.id), outgoing = byLeft.get(node.id) ?? []
    if (node.kind === 'field-entry' && !retained) throw new Error(`Public node has no retained entry: ${node.id}`)
    const pointer = `/binary_relation_order/nodes/${index}`
    const sourceRows = outgoing.map(rowIndex => ({ pointer: rows[rowIndex].source.pointer, row: graph.relations[rowIndex] }))
    const payload = {
      source_revision: inventory.source_revision,
      node,
      ...(retained ? { entry_pointer: `/entries/${retained.index}`, entry: retained.entry } : {}),
      outgoing_relations: sourceRows,
      ...(node.kind === 'inventory-boundary' ? { inventory_statements: {
        title: inventory.title, version: inventory.version, scope: inventory.scope,
        semantic_rule: inventory.semantic_rule, retained_binary_relations: inventory.retained_binary_relations,
        binary_relation_order: orderStatements,
      } } : {}),
    }
    const lines = [
      node.label,
      `Claim status: ${node.status}`,
      `Selected inventory locator (not canonical or geometric): ${JSON.stringify(node.inventory_binary_address)}`,
      `Source: ${EI_PUBLIC_FIELD_SOURCE.path}#${retained ? `/entries/${retained.index}` : pointer}`,
    ]
    if (retained) {
      const entry = retained.entry
      lines.push(
        `IS — retained source statement: ${entry.state_frame.IS.established_statement}`,
        `NEXT — open remainder: ${entry.state_frame.NEXT.open_remainder}`,
        ...(entry.gap === entry.state_frame.NEXT.open_remainder ? [] : [`Separate retained gap: ${entry.gap}`]),
      )
    } else if (node.kind === 'inventory-boundary') {
      lines.push(inventory.scope, inventory.semantic_rule, graph.meaning, graph.temporal_scope)
    } else {
      lines.push('SELECTED document grouping only. Membership does not establish geometric containment, a source primitive, or a causal parent.')
    }
    // The display summary is deliberately small. Full WAS/IS/NEXT statements,
    // every outgoing row and all source/status evidence remain in source.text.
    return Object.freeze({
      address: eiPublicFieldAddress(node.id),
      value: lines.join('\n'),
      source: Object.freeze({
        id: `public-inventory:${inventory.source_revision}#${pointer}`,
        text: JSON.stringify(payload),
        realm: 'public-repository-inventory',
        locator: JSON.stringify({ path: EI_PUBLIC_FIELD_SOURCE.path, source_revision: inventory.source_revision, pointer,
          ...(retained ? { entry_pointer: `/entries/${retained.index}` } : {}), address_scope: 'selected-inventory-presentation' }),
      }),
      parents: Object.freeze((retained?.entry.parents ?? []).map(eiPublicFieldAddress)),
      relations: Object.freeze(outgoing.map(rowIndex => Object.freeze({ relation: graph.relations[rowIndex].relation, address: eiPublicFieldAddress(graph.relations[rowIndex].right) }))),
    })
  }))
}
