# Tiny addressed ingestion core

This is a portable C implementation of the bounded loop:

1. Start with one supplied user/owner address and one supplied root address
2. Read the current target from an authorized provider
3. Retain that observation as a new child-root occurrence
4. Ask the provider for its explicit adjacent/related addresses, one cursor at a time
5. Retain each returned relation as a new occurrence and queue unseen targets
6. Continue until the selected finite provider enumeration ends, or pause with the pending work intact

The provider supplies both addresses and provenance. The core does not discover
geometric neighbours, infer semantic relations, read networks/devices, or grant
permission to do so. A provider must use a stable selected snapshot and repeat the
same item when a cursor is retried. `WAIT` and errors do not become observations.

## One whole, distinct child roots

`ei_state` is one owner-addressed whole. `nodes[0]` is its root. Stable target
addresses are distinct from immutable occurrence addresses:

`{ owner, root, sequence }`

Sequence zero refers to the containing root. Every successfully ingested record
or edge gets a new positive sequence, with the previous occurrence as its parent,
the same user-root address, and its own provider source/revision. The graph's
explicit adjacent/related links are retained separately from that chronological
parent chain. `ei_occurrence_at` and `ei_read_occurrence` resolve child roots and
reject a different owner/root.

An explicit `ei_revisit` of an equal-valued target creates a new observation with
`value_different = 0`. A changed value retains before/after bytes and sets that
flag. An initial observation has no previous value, so it does not manufacture a
Difference. Source revisions are provenance, not inferred truth. Completed
target expansion is deduplicated to prevent a cycle from expanding forever;
transport retries do not duplicate a committed cursor item.

## Small finite profile

The default working profile is 16-byte opaque addresses, 16-byte values, 8 stable
target records, 16 retained edges and 8 immutable occurrences. These are explicit
storage choices, not canonical source-address geometry and not a claim that the
whole universe contains eight nodes. Address equality is exact length plus bytes;
there is no hash equality, Unicode repair, normalization or source-symbol parser.
The host can encode a short UTF-16 string losslessly as code-unit bytes, but this
kernel does not assign that encoding semantic authority.

There is no heap allocation, recursion, clock, crystal access or unbounded loop
within a call. The caller supplies a provider-call budget. Node, edge, occurrence,
cursor and input limits return explicit statuses before changing the pending
item. No history is evicted. Re-entering the same state resumes its current
phase/cursor. Capacity therefore pauses this implementation; it never reports
that an incomplete enumeration is complete.

**External spooling is a remaining adapter boundary.** A logically extensible
history can live outside this working set. Before a window can be reclaimed, that
adapter must durably and idempotently commit the owner/root, child-root lineage,
original bytes/provenance, visited-address index, pending queue and exact cursors,
and verify the addressed return. It also needs a portable wire encoding and a
restore check. This version has no such adapter and does not claim unbounded
traversal, durable restart recovery or automatic capacity reclamation. In-memory
struct copies are useful for same-build tests, not a cross-platform file format.

## Build and verification

From this directory:

```sh
make test
make sanitize
make avr AVR_PREFIX=/path/to/avr/bin/avr-
```

Build outputs go to `/tmp/ei-native-core-build` unless `BUILD` is supplied. Tests
cover exact addresses including embedded zero bytes, cyclic/repeated targets,
one-call slicing versus a continuous run, WAIT and error retries, child-root
lookup and owner isolation, equal/changed observations, capacity preservation,
cursor overflow and malformed state. Sanitizers check address/undefined behavior;
LeakSanitizer is disabled because the test execution environment uses ptrace.
The production core allocates no heap.

`firmware.c` is a deterministic two-address cyclic provider fixture. It is neither
a hardware-discovery adapter nor a timing oscillator. The AVR target is explicitly
**ATmega328P / UNO R3 class**, chosen as a conservative baseline because the user
did not specify an Arduino model. The full public C API is linked without
dead-code stripping in the reported build.

The checked build uses 3,714 bytes of flash and 1,401 bytes of static SRAM. The
ATmega328P has 32,768 flash bytes and 2,048 SRAM bytes; the usual UNO R3 bootloader
reserves 512 flash bytes. This fixture's reviewed compiler call chain uses at most
138 stack bytes; a conservative 256-byte stack reserve leaves 391 SRAM bytes.
No interrupts or heap allocation are added by the fixture. A real provider,
Arduino framework, interrupt handlers, communication buffers or larger profile
must be compiled and budgeted again. See `size-report.json` for source hashes,
toolchain provenance, section sizes and individual compiler stack frames.

Native tests ran. The AVR binary compiled. **No physical board or AVR simulator
execution has been performed.** This establishes fit for this bounded compiled
fixture, not an on-device functional test or a fit claim for the web application.

Official references:

- [UNO R3 hardware](https://docs.arduino.cc/hardware/uno-rev3)
- [UNO R3 memory and bootloader specification](https://store.arduino.cc/collections/flying-things/products/arduino-uno-rev3)
- [Arduino package/toolchain index](https://downloads.arduino.cc/packages/package_index.json)

## Remaining mechanism boundary

The core uses C and its basic byte-copy/comparison runtime as a bootstrap. It has
no React, Node, JavaScript, JSON, network or external reasoning dependency. It
does not run the separate TypeScript rule compiler or its bytecode, infer intent
or meaning, compile itself, implement a physical crystal clock, or close the
full Fracture mechanism. Its tested contribution is the small addressed,
provenance-retaining ingestion/continuation loop.
