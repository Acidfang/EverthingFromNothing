# Executable EI grain

The existing page's **EI model** control opens an addressed local execution grain. It preserves the existing map and moment-gate views. The new grain's map, state inspector, gate, proposals and receipts all consume the same engine records.

## Using it

1. Enter a source address and exact source text. **Capture source** records an input occurrence; it does not prove the text's claims or treat it as a command.
2. Optionally select **Keep this EI ledger on this browser, unencrypted**. Otherwise the session stays in memory. Entered content is not sent to a server.
3. Select a grain, supply a proposed value and optionally another alternative or a new child address. **Filter proposed continuations** checks explicit exact-text conditions against retained state. User-owned choices require explicit selection. Unknown conditions stay unresolved.
4. Execute an admitted choice. The engine stages all affected values, the page constructs their addressed DOM output and reads the actual text back. It compares every returned address/value, then prepares one immutable successor. If local persistence was selected, IndexedDB must complete an atomic write/readback before the displayed IS changes.
5. Inspect WAS, IS, proposed NEXT, source references and returned receipts. Branching from WAS creates an explicit new child proposal and retains its historical source locator; it does not rewrite history.
6. **Restore saved local ledger** reconstructs the same committed source/history, pending choices and failure attempts after reload. Export/import preserves a bounded session file and independently replays committed transactions to check consistency.

## Executable mechanism

The retained source pipeline is READ_SOURCE → FIND_ADDRESS → SEE_DIFFERENCE → FILTER_TO_ALLOWED_CONTINUATIONS → IF_ONE_CONTINUE / IF_NONE_REST_OR_UNRESOLVED / IF_MINE_STOP_FOR_USER_SELECTION → RECORD_SELECTION → CONTINUE. The browser implementation supports source capture, addressed lookup, exact text comparison, explicit candidate filtering/selection, bounded local updates/child creation, readback, receipt return and reconstruction.

The open relation vocabulary is retained as addressed data. The implementation does not execute arbitrary input text, invent meanings for unknown symbols or convert it into JavaScript. Its supported effect is a local addressed-text update; an external action requires a separate actual adapter and authorization.

Proposals retain their source, owner, conditions and patches. One admitted candidate plus an unresolved alternative is not unique. Multi-address updates commit together or leave all IS values unchanged. Repeated transaction IDs are idempotent only for the same transaction. Stale snapshots, forged verification objects, partial frames and mismatched readback fail. Parent ancestry is validated; relation cycles are traversed finitely without generating an infinite population.

The storage adapter owns only `efn-ei-local-v1`, with a storage generation distinct from the model revision. Atomic compare-and-store protects against other tabs, unrelated roots and conflicting retries. Browser-local storage is unencrypted and can be cleared or evicted; export provides a user-controlled copy. No private material is preloaded and no credentials or paid services are introduced.

## Verification boundaries

Exact text equality compares JavaScript text without normalization. Capture, rendered-value readback, stored-value readback and symbolic rule application are separate scopes. None proves a natural-language claim, external delivery, recipient acceptance, physical geometry or general intelligence. Consistent imported history is user-supplied, not authenticated evidence of a past device event.

The tetra gate projects the same addressed record's WAS/IS/available NEXT and retained parent threads. It introduces no new world centres. Infinity indices, a universal fourth-port operation and the complete geometric twist law remain unbound where no record supplies them. DOM readback is not a claim of per-pixel physical display verification.

## Tests

The engine tests cover alternatives/ownership, unknown inputs, Unicode preservation, stale snapshots, atomic multi-record updates, malformed/tampered readback, verification seals, child provenance, bounded cycles and replay. Storage contract tests explicitly use an IndexedDB lifecycle stub to exercise completed-transaction gating, quota/abort/mismatch, recovery and conflicts. Session tests cover pending choices, failed attempts, cancellation and identical save/recovery bounds. Actual browser persistence and interaction checks are reported separately after deployment.
