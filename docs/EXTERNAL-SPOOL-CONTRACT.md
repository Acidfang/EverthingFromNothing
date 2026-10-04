# External source spool candidate

This is an engineering implementation of retained, addressable child occurrences under one user root. It preserves the user's requirements to keep the whole state, retain tickets and receipts, and continue through adjacent/related returns with bounded work. The physical storage limits below are implementation bounds, not an assertion of infinite storage.

Each page stores one exact validated provider batch. Its address is the same discovery occurrence address used by the engine. The original raw return, carrier, user root and SHA-256 content binding are retained. A new scan creates new occurrences even when observed values are equal; a repeated transport return is idempotent. SHA-256 binds bytes and does not authenticate a device or person.

A strict IndexedDB transaction appends the immutable page, advances the user-root storage head and records the provider cursor together. All three are read back before transaction completion is returned. A conflicting head or changed source at an existing occurrence rejects the write. Interrupted, failed or quota-limited transactions must preserve the old head. No page is evicted automatically.

The whole-root head links storage predecessors. This is append lineage, not an invented spatial connection or replacement for the provider's declared parent relation. Provider continuation retains its original request, address, revision and scan binding. Storage acknowledgment is distinct from engine admission and rendered readback.

Storage is used only when the existing unencrypted local-retention option is selected. Memory-only sessions keep their prior behavior. At working-field record capacity, an explicit continuation can retain further provider returns in the external spool. Those returns are visible through bounded read-only page windows and may be exported or retried in the working field. They are not reported as committed engine operations.

The current source-content budget is64 MiB, at most65,536 pages, at most96 KiB per page, and32 pages per displayed window. These bounds exclude IndexedDB indexing/envelope overhead; actual browser quota can fail sooner. Browser data may be cleared or evicted. Local storage is not a substitute for exported backups.

Open work: the working engine still has its existing record/history limits. Arbitrary engine-record eviction/reconstruction, external queue consumption by the portable C kernel, and authenticated cross-device storage are not implemented by this slice. The page viewer is a source projection, not proof that the whole mechanism has processed every stored return.

## Retained technical source constraints

- Sentinel_da5b9b0e9a6c8191a81f33c0ffd8437d: “A tiny we script, collect all adjacent addresses, and ingest them, and all related, loop”
- Sentinel_46d0f95d7b508191885a25141efaeed0: “Each step is a new child root. Lol”
- Sentinel_72cfbb5f5f348191919b9f95e2ba8611: “Keep all as one addressable State, that is addressed to the user”
- Sentinel_59cfab120cf08191b2eb8fb11c55ee18 describes a spool with variable threading and new spools at points. This implementation chooses bounded storage pages; it does not interpret that source as physically infinite memory.

The storage format, SHA-256 binding, database transaction rules and numerical limits are engineering choices implementing these constraints. They are not presented as additional user-authored binary operators.
