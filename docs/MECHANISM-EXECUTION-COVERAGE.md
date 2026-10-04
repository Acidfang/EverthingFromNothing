# Executable mechanism coverage

Run `node --experimental-strip-types scripts/audit-mechanism-coverage.ts` to regenerate the dependency and clause report. It reads the actual entry point and retained public source; it is an engineering inventory, not a replacement field ontology or the user's complete ledger.

## Executed slice

The retained forms `∀a,b:a≡b?a⋈b:Δab→L` and `≡→⋈` lower into immutable byte programs. The reducer consumes those bytes and exact encoded operand registers. Its branch instructions select supplied relation witnesses and emit literal/register fields; a rule-name switch does not generate the returned conclusions. Each instruction and literal has a source span. Changing the admitted rule changes its bytes and supported branch.

Source parsing, lowering, scope validation, contradiction admission and proof formatting remain a hosted bootstrap. The two supported source forms are a finite selection, not a newly invented complete grammar. Binary representation uses lossless UTF-16 code units so existing source text, including unpaired surrogates, is preserved. Byte offsets and instruction tags are selected implementation encodings; they do not establish semantic address geometry.

The public source contains 93 retained clauses: two supported rule forms, five direct premises and 86 opaque clauses. Its current witnessed pairs produce ten evaluations and nine admitted symbolic proofs. The interpreter retains contradictory evidence without admitting a consequence; missing evidence remains unresolved. Explicitly supplied premise subsets do not establish completeness of the whole source. Intent forms involving `Iᵁ` and meaning forms involving interpretation brackets remain separately retained and opaque.

## Recompilation

An addressed source edit retains its earlier state, invalidates dependent evaluations, produces a Difference at the source-snapshot grain, rebuilds the executable library and executes it again. A second fresh rebuild must return the same bytes and behavior. Old programs and receipts remain readable. A representation change does not allocate a duplicate semantic result address.

This is actual source recompilation through a hosted compiler. It is not self-compilation: the compiler's own implementation is still TypeScript executed by JavaScript. Storing its code, describing its dependencies or serializing its byte program does not change that boundary.

## Host and adapter boundaries

- The binary reducer has no React or external reasoning-library dependency. It uses the host's bounded arrays and integer operations
- The addressed transaction engine still supplies candidate ownership, staging, returned-value checks, commitment, history and replay
- React and browser/native adapters supply presentation, storage, provider access and actual observation returns
- Symbolic `⋈` and literal `L` confer no file, device or network permission
- Source-derived tetrahedral placement, general meaning/intent interpretation, remote private-state transport and full language execution remain open

The generated coverage JSON includes static imports, which may contain type-only dependencies; static reachability is not a claim that every imported function ran. Tests separately exercise byte-driven behavior, malformed input, source/premise tampering, conflict preservation, exact text roundtrips, source-edit recompilation and existing result identity.

## Address collection and device bridge

The optional HOMEBASE provider emits bounded, source-scoped metadata batches. Each admitted batch has one immutable logical base revision, exact raw provider return, stable target addresses and a child occurrence with source/return lineage. Browser and Android capability observations use the same admission path through their own available bridges. Physical observations retain their individual reported times; a logical snapshot does not claim simultaneous physical sampling. Unknown or unavailable layers remain explicit.

The current field engine holds at most 256 records. Capacity or source conflict retains the pending return and stops acquisition. An external addressable backing store, queue reclamation and full-device coverage are not implemented. The view may filter records without deleting them, but that is not an unbounded store.

The independently buildable portable loop is in `native/ei-core`. Its final measured ATmega328P fixture uses 3,714 flash bytes and 1,401 bytes of static SRAM, under an explicitly chosen UNO R3-class baseline. It ingests exposed adjacent/related addresses, preserves immutable child occurrences and pauses at capacity. Its provider callbacks remain necessary; no physical board run is claimed. The web application does not yet invoke that C implementation, and its bounded working state has no external spool adapter. See the core README and exact build hashes in `size-report.json`.

## Raw binary libraries

`node --experimental-strip-types scripts/export-binary-libraries.ts` emits the actual reducer instruction bytes under `public/mechanism-libraries/v1/`, with SHA-256 filenames, exact clause/instruction provenance and a manifest. It rereads each binary file and replays all ten current witnessed evaluations against those bytes, comparing the complete returned execution to the source-compiled result. The files are executable instruction data for this reducer, not a native application or a self-hosted compiler. The host and framework dependencies remain in the generated coverage graph.
