import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  parseEILedgerSource as parse, compileEILedgerProgram as compile,
  renderEILedgerDocument, inspectEILedgerDependencies, readEILedgerClause,
  EI_LEDGER_LIMITS, type EILedgerAst, type EILedgerQuery,
} from '../src/model/ei-ledger-language.ts'
import { AUTHORED_COMPARE_CLAUSE as RULE, AUTHORED_IDENTITY_CLAUSE as IDENTITY,
  type ComparisonSource, type ComparisonProgramScope } from '../src/model/source-bound-comparison.ts'

const source = (text: string, overrides: Partial<ComparisonSource> = {}): ComparisonSource => ({
  recordAddress: 'source/authored', sourceId: 'retained-authored-source', revision: 0,
  frameId: 'explicit-authored-frame', text, ...overrides,
})
const node = (ast: EILedgerAst, exact: string, occurrence = 0) => {
  const result = ast.clauses.filter(clause => clause.source.exact === exact)[occurrence]
  assert.ok(result, `missing ${exact}`); return result
}
const query = (ast: EILedgerAst, left: string, right: string, rule = RULE): EILedgerQuery => ({ rule: node(ast, rule).source, left, right })
const scope = (...sources: ComparisonSource[]): ComparisonProgramScope => ({ id: 'explicit-test-program',
  sources: sources.map(({ recordAddress, sourceId, revision, frameId }) => ({ recordAddress, sourceId, revision, frameId })),
})
const inventory = JSON.parse(readFileSync(new URL('../docs/FRACTURE-FIELD-INVENTORY.json', import.meta.url), 'utf8'))
const retained: string[] = inventory.retained_binary_relations
const inventorySource = source(JSON.stringify({ inventory_statements: { retained_binary_relations: retained } }), {
  recordAddress: 'model/inventory-root', sourceId: `public-inventory:${inventory.source_revision}`, frameId: 'public-inventory-frame',
  provenance: { realm: 'public-repository-inventory', locator: JSON.stringify({ path: 'docs/FRACTURE-FIELD-INVENTORY.json', source_revision: inventory.source_revision }) },
})
const pointers = retained.map((_, index) => `/inventory_statements/retained_binary_relations/${index}`)

test('all 93 public clauses roundtrip with exact JSON pointers, provenance and unsupported syntax', () => {
  assert.equal(retained.length, 93)
  const ast = parse(inventorySource, { pointers })
  assert.equal(ast.clauses.length, 93)
  assert.deepEqual(ast.documents.map(renderEILedgerDocument), retained)
  assert.equal(ast.source.text, inventorySource.text)
  assert.deepEqual(ast.source.provenance, inventorySource.provenance)
  assert.deepEqual(ast.clauses.map(clause => clause.source.exact), retained)
  for (const [index, clause] of ast.clauses.entries()) {
    assert.equal(clause.source.pointer, pointers[index]); assert.equal(clause.source.start, 0)
    assert.equal(clause.source.end, retained[index].length); assert.equal(clause.source.revision, 0)
    assert.equal(clause.source.sourceId, inventorySource.sourceId)
    assert.equal(readEILedgerClause(ast, clause.source).id, clause.id)
  }
  const compiled = compile([ast])
  assert.equal(compiled.executionAuthority, false)
  assert.equal(ast.clauses.filter(clause => clause.syntax.kind === 'comparison-rule').length, 2)
  assert.ok(compiled.opaqueClauses.length > 70)
  assert.equal(compiled.asts[0].clauses.length, 93)
  assert.equal(compiled.evaluations.some(evaluation => evaluation.result.query.left === 'U₀'), false)
  const u = compiled.evaluations.filter(evaluation => evaluation.result.query.left === 'U')
  assert.equal(u.length, 2); assert.ok(u.every(evaluation => evaluation.result.proofs.length === 1))
})

test('lexer keeps Unicode, unknown punctuation, duplicates, separators and UTF-16 spans losslessly', () => {
  const raw = `  🧭Ω ;\n?≠⊥ ; a≡b;;a≡b; ${RULE}  ;\n`, ast = parse(source(raw))
  assert.equal(renderEILedgerDocument(ast.documents[0]), raw)
  assert.equal(ast.clauses.length, 5)
  const compass = ast.documents[0].tokens.find(token => token.source.exact === '🧭')!
  assert.equal(compass.source.end - compass.source.start, 2)
  for (const token of ast.documents[0].tokens) assert.equal(raw.slice(token.source.start, token.source.end), token.source.exact)
  assert.notEqual(node(ast, 'a≡b').id, node(ast, 'a≡b', 1).id)
  const result = compile([ast], { queries: [query(ast, 'a', 'b'), query(ast, '?', '⊥')] })
  assert.equal(result.evaluations[0].result.proofs.length, 2)
  assert.equal(result.evaluations[1].result.status, 'known-difference')
  assert.deepEqual(result.evaluations[1].result.proofs[0].conclusion,
    { kind: 'transition', from: { operator: 'Δ', left: '?', right: '⊥' }, to: 'L' })
})

test('JSON array duplicate clauses keep distinct source addresses and escaped pointers roundtrip', () => {
  const ast = parse(source(JSON.stringify({ 'a/b~c': ['a≡b', 'a≡b', RULE] })), {
    pointers: ['/a~1b~0c/0', '/a~1b~0c/1', '/a~1b~0c/2'],
  })
  assert.notEqual(node(ast, 'a≡b').id, node(ast, 'a≡b', 1).id)
  assert.equal(compile([ast]).evaluations[0].result.proofs.length, 2)
  assert.throws(() => parse(ast.source, { pointers: ['/a~2b'] }), /pointer/)
  assert.throws(() => parse(ast.source, { pointers: ['/a~1b~0c/01'] }), /pointer/)
  assert.throws(() => parse(ast.source, { pointers: ['/a~1b~0c'] }), /source string/)
})

test('conditional antecedents and arbitrary implications remain whole opaque clauses, never facts', () => {
  const ast = parse(source(`x⇒a≡b;a≡b?c⋈d:Δcd→L;${RULE}`))
  assert.equal(ast.clauses.filter(clause => clause.syntax.kind === 'direct-comparison').length, 0)
  const result = compile([ast], { queries: [query(ast, 'a', 'b')] })
  assert.equal(result.evaluations[0].result.status, 'unresolved')
  assert.deepEqual(result.evaluations[0].result.proofs, [])
  const nested = { ...node(ast, 'x⇒a≡b').source, start: 2, exact: 'a≡b' }
  assert.throws(() => readEILedgerClause(ast, nested), /complete semicolon-delimited clause/)
})

test('standalone identity rule has no nonidentity consequence and cannot resolve a conflict', () => {
  const ast = parse(source(`a≡b;c≠d;x≡y;x≠y;${IDENTITY}`))
  const result = compile([ast])
  assert.equal(result.evaluations.length, 3)
  const [identity, difference, conflict] = result.evaluations.map(evaluation => evaluation.result)
  assert.equal(identity.status, 'known-identity'); assert.equal(identity.proofs.length, 1)
  assert.equal(difference.status, 'known-difference'); assert.deepEqual(difference.proofs, [])
  assert.equal(conflict.conflict, true); assert.equal(conflict.status, 'unresolved')
  assert.equal(conflict.identityWitnesses.length, 1); assert.equal(conflict.differenceWitnesses.length, 1)
  assert.deepEqual(conflict.proofs, [])
})

test('no reflexivity, symmetry, transitivity, source aliasing or unsupported intent semantics are invented', () => {
  const ast = parse(source(`U₀≡R;R≡S;Iᵁ(U₀,Ω);${RULE}`))
  const result = compile([ast], { queries: [query(ast, 'U₀', 'U₀'), query(ast, 'R', 'U₀'), query(ast, 'U₀', 'S'), query(ast, 'U', 'R')] })
  assert.ok(result.evaluations.every(evaluation => evaluation.result.status === 'unresolved'))
  assert.equal(node(ast, 'Iᵁ(U₀,Ω)').syntax.kind, 'opaque')
})

test('missing → present → conflicting premises create new evaluations without rewriting old proofs', () => {
  const missing = parse(source(RULE)), present = parse(source(`a≡b;${RULE}`, { revision: 1 })), conflict = parse(source(`a≡b;a≠b;${RULE}`, { revision: 2 }))
  const first = compile([missing], { queries: [query(missing, 'a', 'b')] })
  const firstJson = JSON.stringify(first)
  assert.equal(first.evaluations[0].result.status, 'unresolved')
  assert.equal(first.evaluations[0].dependencies.sources.length, 1)
  assert.equal(first.evaluations[0].dependencies.clauses.length, 1)
  assert.deepEqual(first.evaluations[0].dependencies.witnessSet, { kind: 'ordered-direct-premises', left: 'a', right: 'b' })
  const changed = inspectEILedgerDependencies(first, [present.source])
  assert.equal(changed.status, 'stale'); assert.equal(changed.changes[0].reason, 'changed-revision')
  assert.deepEqual(changed.affectedEvaluationIds, [first.evaluations[0].id])
  const second = compile([present], { queries: [query(present, 'a', 'b')] }), secondJson = JSON.stringify(second)
  assert.equal(second.evaluations[0].result.status, 'known-identity')
  const third = compile([conflict], { queries: [query(conflict, 'a', 'b')] })
  assert.equal(third.evaluations[0].result.conflict, true); assert.deepEqual(third.evaluations[0].result.proofs, [])
  assert.equal(JSON.stringify(first), firstJson); assert.equal(JSON.stringify(second), secondJson)
  assert.ok(Object.isFrozen(second.evaluations[0].result.proofs[0].premise.source))
  assert.equal(inspectEILedgerDependencies(second, [present.source]).status, 'current')
})

test('stale source spans, revisions, syntax, bindings and AST selections reject before proof creation', () => {
  const ast = parse(source(`a≡b;${RULE}`))
  for (const mutate of [
    (copy: any) => { copy.source.revision++ },
    (copy: any) => { copy.clauses[0].source.start++ },
    (copy: any) => { copy.clauses[0].source.exact = 'a≠b' },
    (copy: any) => { copy.clauses[0].syntax.operator = '≠' },
    (copy: any) => { copy.documents[0].tokens[0].source.end++ },
    (copy: any) => { copy.clauses.pop() },
  ]) {
    const copy = structuredClone(ast); mutate(copy)
    assert.throws(() => compile([copy]), /AST differs/)
  }
  assert.throws(() => compile([ast], { queries: [{ ...query(ast, 'a', 'b'), rule: { ...node(ast, RULE).source, revision: 9 } }] }), /missing, stale/)
  assert.throws(() => compile([ast], { programScope: { id: 'stale', sources: [{ ...scope(ast.source).sources[0], revision: 9 }] } }), /stale or missing/)
  assert.throws(() => compile([ast, ast]), /ambiguous source/)
  assert.equal(inspectEILedgerDependencies(compile([ast]), [{ ...ast.source, text: ast.source.text + ';a≠b' }]).changes[0].reason, 'changed-source-text')
})

test('a cross-record program must explicitly bind both exact source snapshots, even in the same frame', () => {
  const law = parse(source(RULE)), evidence = parse(source('a≡b', { recordAddress: 'source/evidence', sourceId: 'other-evidence' }))
  const unbound = compile([law, evidence], { queries: [query(law, 'a', 'b')] })
  assert.equal(unbound.evaluations[0].result.status, 'unresolved')
  assert.equal(unbound.evaluations[0].dependencies.sources.length, 1)
  const bound = compile([law, evidence], { programScope: scope(law.source, evidence.source), queries: [query(law, 'a', 'b')] })
  assert.equal(bound.evaluations[0].result.status, 'known-identity')
  assert.equal(bound.evaluations[0].dependencies.sources.length, 2)
  assert.equal(bound.evaluations[0].result.proofs[0].premise.source.recordAddress, 'source/evidence')
  const differentFrame = parse({ ...evidence.source, frameId: 'separate-authored-frame' })
  assert.equal(compile([law, differentFrame], { programScope: scope(law.source, differentFrame.source) }).evaluations[0].result.status, 'known-identity')
  const omitted = compile([law, evidence], { programScope: scope(law.source), queries: [query(law, 'a', 'b')] })
  assert.equal(omitted.evaluations[0].result.status, 'unresolved')
  assert.throws(() => compile([law, evidence], { programScope: scope(evidence.source), queries: [query(law, 'a', 'b')] }), /outside explicit/)
})

test('cross-source negative witnesses preserve conflict and scope changes require new evaluation', () => {
  const law = parse(source(`a≡b;${RULE}`)), other = parse(source('a≠b', { recordAddress: 'source/negative', sourceId: 'negative', frameId: 'other-frame' }))
  const old = compile([law, other]), oldJson = JSON.stringify(old)
  assert.equal(old.evaluations[0].result.status, 'known-identity')
  const bound = compile([law, other], { programScope: scope(law.source, other.source) })
  assert.equal(bound.evaluations[0].result.conflict, true); assert.deepEqual(bound.evaluations[0].result.proofs, [])
  assert.equal(JSON.stringify(old), oldJson)
})

test('cycles remain bounded direct witnesses and arbitrary implication cycles stay opaque', () => {
  const ast = parse(source(`a≡b;b≡a;a⇒b;b⇒a;${RULE}`))
  const result = compile([ast])
  assert.equal(result.evaluations.length, 2)
  assert.equal(result.opaqueClauses.length, 2)
  assert.ok(result.evaluations.every(evaluation => evaluation.result.proofs.length === 1))
  assert.throws(() => compile([ast], { limits: { maxWork: 1 } }), /work bound exceeded/)
  assert.throws(() => compile([ast], { limits: { maxEvaluations: 1 } }), /evaluation bound exceeded/)
  assert.throws(() => parse(source('a;b'), { limits: { maxClauses: 1 } }), /clause bound exceeded/)
  assert.throws(() => parse(source('a≡b'), { limits: { maxTokens: 1 } }), /token bound exceeded/)
  assert.throws(() => parse(source('abc'), { limits: { maxSourceUtf16: 2 } }), /source UTF-16/)
  assert.throws(() => parse(source('abc'), { limits: { maxSelectedUtf16: 2 } }), /selected UTF-16/)
  assert.throws(() => parse(source('a'), { limits: { maxWork: EI_LEDGER_LIMITS.maxWork + 1 } }), /invalid maxWork/)
  const recursive: any = structuredClone(ast); recursive.loop = recursive
  assert.throws(() => compile([recursive]))
})

test('compiling deserialized and shallow-frozen ASTs neither mutates caller data nor shares writable proof state', () => {
  const mutable = structuredClone(parse(source(`a≡b;${RULE}`)))
  Object.freeze(mutable)
  const result = compile([mutable]), before = JSON.stringify(result)
  assert.equal(Object.isFrozen(mutable.source), false)
  ;(mutable.source as any).text = 'changed source'
  ;(mutable.clauses[0].source as any).exact = 'changed premise'
  assert.equal(JSON.stringify(result), before)
  assert.ok(Object.isFrozen(result.asts[0].source))
})

test('non-data AST behavior cannot hide conflicting witnesses or forge clause kinds', () => {
  const canonical = parse(source(`${RULE};a≡b;a≠b`)), altered: any = structuredClone(canonical)
  altered.clauses.pop()
  altered.clauses.toJSON = () => canonical.clauses
  assert.throws(() => compile([altered]), /plain data/)
  const getter: any = structuredClone(canonical)
  Object.defineProperty(getter.clauses[1], 'syntax', { get: () => ({ kind: 'comparison-rule', mode: 'identity-only' }) })
  assert.throws(() => compile([getter]), /plain data/)
  const forged: any = structuredClone(canonical)
  forged.clauses[1].syntax = { kind: 'comparison-rule', mode: 'identity-only' }
  assert.throws(() => readEILedgerClause(forged, canonical.clauses[1].source), /AST differs/)
  assert.equal(compile([canonical]).evaluations[0].result.conflict, true)
})

test('JSON decoding is shared across selected pointers and compiled evaluations', () => {
  const strings = ['a≡b', 'c≠d', RULE, IDENTITY, ...Array(100).fill('')]
  const retainedSource = source(JSON.stringify({ padding: 'x'.repeat(1_000_000), strings }))
  const originalParse = JSON.parse
  let decodedSources = 0
  JSON.parse = ((text: string, ...args: any[]) => {
    if (text === retainedSource.text) decodedSources++
    return (originalParse as any)(text, ...args)
  }) as typeof JSON.parse
  try {
    const ast = parse(retainedSource, { pointers: strings.map((_, index) => `/strings/${index}`) })
    const compiled = compile([ast])
    assert.equal(compiled.evaluations.length, 4)
    assert.equal(decodedSources, 2) // one parser snapshot, one shared evaluator
  } finally { JSON.parse = originalParse }
})

test('source bindings make historical evaluation IDs distinguish changed premise revisions', () => {
  const law = parse(source(RULE)), firstEvidence = parse(source('a≡b', { recordAddress: 'source/evidence', sourceId: 'evidence' }))
  const nextEvidence = parse({ ...firstEvidence.source, revision: 1, text: 'a≠b' })
  const first = compile([law, firstEvidence], { programScope: scope(law.source, firstEvidence.source) })
  const next = compile([law, nextEvidence], { programScope: scope(law.source, nextEvidence.source) })
  assert.notEqual(first.evaluations[0].id, next.evaluations[0].id)
  assert.equal(first.evaluations[0].result.status, 'known-identity')
  assert.equal(next.evaluations[0].result.status, 'known-difference')
})

test('selector length and aggregate selection bounds include empty JSON string targets', () => {
  const key = 'x'.repeat(5000), largePointer = source(JSON.stringify({ [key]: '' }))
  assert.throws(() => parse(largePointer, { pointers: [`/${key}`] }), /excessive JSON pointer/)
  const smaller = source(JSON.stringify({ 'xxxxxxxx': ['', '', ''] }))
  assert.throws(() => parse(smaller, { pointers: ['/xxxxxxxx/0', '/xxxxxxxx/1', '/xxxxxxxx/2'], limits: { maxSelectedUtf16: 25 } }), /selected UTF-16 bound exceeded/)
})

test('provenance is bounded plain data and cannot conceal changes through toJSON', () => {
  const hostile: any = { realm: 'original', toJSON: () => ({ realm: 'same' }) }
  assert.throws(() => parse(source(RULE, { provenance: hostile })), /plain data|invalid source provenance/)
  const ast = parse(source(`a≡b;${RULE}`, { provenance: { realm: 'original', locator: 'original-path' } }))
  const compiled = compile([ast])
  assert.equal(inspectEILedgerDependencies(compiled, [{ ...ast.source, provenance: hostile }]).changes[0].reason, 'changed-provenance')
  assert.equal(inspectEILedgerDependencies(compiled, [{ ...ast.source, provenance: { realm: 'altered', locator: 'original-path' } }]).changes[0].reason, 'changed-provenance')
  assert.throws(() => parse(source(RULE, { provenance: { realm: 'x'.repeat(4097) } })), /invalid source provenance/)
  const invalidScope: any = scope(ast.source); invalidScope.toJSON = () => ({})
  assert.throws(() => compile([ast], { programScope: invalidScope }), /plain data/)
})
