# Fracture threads and overlay services chronicle

This is the technical chronicle of the author's addressed field model, its shared overlay implementation, and the proposed service/thread architecture. It preserves what was requested, what currently runs, which receipts support it, and what remains open. It is a living engineering record, not a claim that every named mechanism has been completed.

Snapshot date: **2 October 2026**. Times below are UTC with NZDT (UTC+13) alongside where an exact timestamp is retained. Calendar-only source dates stay calendar-only; message identifiers do not supply a verified clock time. This Chronicle accompanies the shared 0.1.9 source release [5e38394b](https://github.com/Acidfang/EverthingFromNothing/commit/5e38394b6435ce23ba88b67a6552ee966030ab1c), building on the previously live-verified [4ccd22e9](https://github.com/Acidfang/EverthingFromNothing/commit/4ccd22e9a6a90607dc72e250bf14875300f11017). [Open the current field](https://acidfang.github.io/EverthingFromNothing/).

## Current result

The live application presents addresses, source records, WAS/IS/NEXT, relations, selected operations and receipts through one React-owned EI ledger. Its field, inspector, guide, device workspace and sync controls are views and adapters over that common state. An actual selected transition is staged, returned through the addressed rendering check, verified and then admitted. Capturing a sentence records a source occurrence; it does not make the sentence an executable command or a proven fact.

The current GitHub hub serves a bounded, versioned **public reference snapshot**. A client verifies its bytes and schema, compares it with its imported public baseline, preserves local conflicts, and requires selection before applying a proposed update. This is not a configured private cross-device live state service. Independent overlay processes, authenticated remote participants and a transport carrying a user's private shared ledger remain open work.

The author's phrase “quantum tunnels” is retained below as a comparative theory for connecting addressed contexts. No quantum hardware, quantum tunnelling experiment, nonlocal physical effect or instantaneous network delivery is implemented or inferred by that comparison.

## Author requirements and provenance

The following short statements were explicitly supplied for this design and its publication. The message IDs are provenance identifiers, not public chat links or claims of independently verifiable timestamps. Spelling is preserved inside quotations.

| Author statement | Source identifier | Engineering interpretation and current boundary |
|---|---|---|
| “each overlay is it's own service” | `Sentinel_ef1d60685f0c8191a818048b1d400be6` | Intended service separation. Current visible overlays share one application ledger; separate deployed services are not established. |
| “ensure the are threads to addresses they can all communicate through” | `Sentinel_9d5c25486b8081918062ed831b8c6421` | Preserve named endpoints, source/target addresses and return provenance. A graph relation alone is not a network transport or permission. |
| “the fracture threads might as well be quantum tunnels” | `Sentinel_8c926bc766a881919632d880c997f183` | Comparative description of connections between addressed contexts. |
| “if that helps you” | `Sentinel_168eccf61f5081918c61881de842ccec` | The comparison is offered to help explain the model. |
| “that is my comparative theory” | `Sentinel_1997b35834448191a93c52bec457c96a` | Explicit author classification as comparative theory. |
| “actively in use, document it, and post in github, set up a complete chronicle for this” | `Sentinel_816415262d60819188bdf00501949dd7` | Preserve the active design and its implementation evidence in this repository. |
| “that's what the map is for, to draw it, as the tunnels determine” | `Sentinel_99bdf8bc76ec8191a131072796c6376d` | Intended source/thread-derived map. Current drawing follows retained finite relations; the complete spatial derivation remains incomplete. |
| “SELF MAPPING INSTANT 3d MODELLER” | `Sentinel_e6fd6bba16988191a60bb292fc88df06` | Product goal. No measured zero-latency or completed general 3D modeller is claimed. |

The author's additional clarification treats imagined thoughts as possible truths within their represented fields. For this implementation, a claim can be retained and a supplied scenario can be simulated under explicit assumptions. That establishes what the model represented or calculated; it does not by itself establish a fact in the outside world. Different scoped scenarios must retain their own conditions and provenance rather than erase contradictions.

Earlier author requirements and exact symbolic relations remain in [Author-specified mechanism](SOURCE-MECHANISM.md). This Chronicle supplements that source rather than replacing it.

## Chronology

### 30 September 2026 — retain the addresses

The [Field Address Ledger](FIELD-ADDRESS.md) records the repository root files, blob addresses and roles. It establishes the recovery rule: a retired presentation keeps its historical source address and a named successor. Git history is the retained prior body; the current tree is the current presentation.

The [address overlay record](ADDRESS-OVERLAY.md) also preserves the finite framing requirement: assign a complete addressed output before advancing a requested model Act. The completion barrier is bounded software work while wall-clock time passes. It does not create physical computation outside time.

### 1 October 2026 — bind action to returned evidence

The [folded completion fracture](FIELD-ADDRESS.md#folded-completion-fracture--1-october-2026) retains this sequence:

`STATED_ADDRESS → DIFFERENCE/FRACTURE → EXISTING_OWNER → ACT → RETURNED_EVIDENCE → RECEIPT_ADDRESS`

Intent, queueing, execution and verification are separate states. A displayed plan cannot count as delivered output; a send receipt cannot establish recipient acceptance. [completion-fracture.ts](../src/model/completion-fracture.ts) and its [tests](../tests/completion-fracture.test.ts) express that finite distinction.

### 2 October 2026 at 06:38:02 UTC / 19:38:02 NZDT — publish the shared APK field

[Commit 82c2183d](https://github.com/Acidfang/EverthingFromNothing/commit/82c2183df1949ed9e0beef97d76a5befd12cfa77) published the 0.1.6 shared field structure to Pages: fullscreen addressed world, observer ZERO, WAS/IS/NEXT, multitouch view and local session logic. The release receipt records 531 model tests, TypeScript, production build and 12 release checks. The active HTML/JavaScript/CSS matched the frozen APK bundle byte-for-byte.

Shared assets do not make host capabilities identical. Android overlay/input/media operations require the native Android adapter. A normal browser must expose browser-supported behavior and truthfully leave native-only capabilities unavailable. Byte parity is not proof of Android device runtime behavior.

### 2 October 2026 — recover public source and preserve sync receipts

The build workspace was lost during development. [Commit 30c9acbd](https://github.com/Acidfang/EverthingFromNothing/commit/30c9acbdd2db06815e9f7a3f3c74d2c595c88442) durably retained the public sync validator, tests, generator, immutable payload and a [technical recovery receipt](../qa/public-sync-recovery-2026-10-02.json). Its [model check run](https://github.com/Acidfang/EverthingFromNothing/actions/runs/36978557523) succeeded.

This checkpoint contains public source and tests. Recovering that source does not recover an Android signing key or prove the identity of a replacement native build. Those are separate release requirements.

### 2 October 2026 at 08:32:57 UTC / 21:32:57 NZDT — publish the solar and device field

[Commit 4ccd22e9](https://github.com/Acidfang/EverthingFromNothing/commit/4ccd22e9a6a90607dc72e250bf14875300f11017) published the shared 0.1.8 interface: Solar/Nature presentation, hardware/software/files/folders collections, explicit device encounters, precise pointer observation, guidance, public-only GitHub sync and actual in-app operation/carrier status.

The [model run](https://github.com/Acidfang/EverthingFromNothing/actions/runs/36984708461) and [Pages deployment](https://github.com/Acidfang/EverthingFromNothing/actions/runs/36984708466) succeeded for that exact SHA. The release passed 571 model tests, TypeScript, build and 12 release checks. A live cloud-browser check completed by 08:38 UTC / 21:38 NZDT: exact frozen JavaScript/CSS filenames, Solar/Nature switching, mouse-wheel zoom, device workspace, public sync returning “Current public state matches”, explicit browser metadata retention, one committed receipt and the resulting HUD return. No application console errors were observed. The test session was memory-only and cleared afterward.

### 2 October 2026 — verify the Windows carrier separately

At 08:28 UTC / 21:28 NZDT, a user-returned run of the repaired Windows wrapper confirmed the complete original archive hash and a fresh extraction. A user-provided screenshot inspected at approximately 09:25 UTC / 22:25 NZDT showed the actual native Windows EI field window: HOMEBASE local/idle, Solar, device state 0, Public source, and linked Hardware/Software/Files/Folders. This is evidence of launch and rendering on Windows, not a pass for every interaction. Those times are conversation-observed, not inferred from filesystem timestamps.

The later 0.1.9 Windows package has separate PE packaging checks; its final delivery still awaits a title correction and rebuild. No embedded Rust, .NET or general native compiler is established, and no independent local-service IPC or private cross-device transport is configured. The complete-source test and Electron interaction receipts below therefore retain their actual environment instead of being labelled Windows runtime checks.

### 2 October 2026 at 09:28 UTC / 22:28 NZDT — prepare horizon and HOMEBASE startup

The separate 0.1.9 source freeze passed 577 model tests, TypeScript, production build and 12 audits. Its three rebuilt assets matched the frozen shared bundle. It adds an observer sky/ground horizon, eligible same-address seed mirrors based on supplied prerequisites, HOMEBASE runtime metadata observation, a receipted startup path, and explicit retry/retention for a returned observation.

Actual Linux Electron checks covered normal startup (10), stale context (7), invalid return (7), and manual retry (12), totalling 36 checks with no console errors. Windows-shaped data in unit tests is explicitly synthetic; Linux execution is not Windows hardware execution.

**Release source:** [5e38394b](https://github.com/Acidfang/EverthingFromNothing/commit/5e38394b6435ce23ba88b67a6552ee966030ab1c) retains this tested 0.1.9 update as a descendant of 4ccd22e9. The [public release receipt](../qa/field-release-0.1.9.json) records its exact asset hashes and verification scope. The Chronicle and this source are published together; completed deployment remains a separate [Pages workflow](https://github.com/Acidfang/EverthingFromNothing/actions/workflows/pages.yml) result. The horizon does not establish canonical source coordinates. A seed mirror is another view of the same source-bound address, not a second entity or a physical feasibility guarantee. The expanded compiler and new service protocol are excluded from this freeze.

### 2 October 2026 — define the next service and mapping work

The author clarified that each overlay should be its own service, with communication through address threads, and requested this Chronicle. Work in progress includes a local shared-event protocol candidate and a larger source-bound symbolic-operation path. Neither is represented here as an already deployed independent-service system.

The compiler candidate currently retains all 93 public clauses, recognises five direct premises and two supported rules, and leaves 86 clauses opaque. A reported finite evaluation produced 10 evaluations and nine proofs. This is partial explicit symbolic processing, not general natural-language intent, reply composition, a complete mechanism compiler or a completed 3D field derivation. It remains outside the published 0.1.9 release.

## How the working field carries state

An [EI record](../src/model/ei-engine.ts) holds its canonical address, parent addresses, labelled relations, previous value states, current value/source/revision, and receipt identifiers. A source holds its ID, exact text and optional realm/locator. Multiple views can refer to the same record without creating another record or advancing it.

A proposal carries its producer/source, snapshot revision, candidate ownership, explicit conditions and patches. The engine preserves alternatives and unknowns. A user-owned candidate requires selection. Execution stages the whole update; verification compares actual returned address/value pairs; a valid commit admits one immutable successor and its receipt. Stale, incomplete, forged or mismatched returns fail. The [engine tests](../tests/ei-engine.test.ts) and [execution explanation](EI-EXECUTION.md) cover these boundaries.

The [React model layer](../src/EIModelLayer.tsx) owns the current ledger and connects its views and transaction flow. [IndexedDB storage](../src/model/ei-storage.ts) adds generation checks, atomic compare-and-store, completed transaction handling and stored-value readback when the user selects persistence. [Storage tests](../tests/ei-storage.test.ts) use a lifecycle stub; they are not a claim that every browser/device has been exercised. [Session import/export](../src/model/ei-session.ts) reconstructs bounded retained history. An imported internally consistent ledger is still user-supplied evidence, not authenticated testimony of a past device.

The current status overlay reports app-visible work and returned receipts. It is not telemetry about hidden assistant reasoning, unrelated processes or remote actions that the application has not observed.

## What a fracture thread currently means

A thread is a retained relation occurrence between addressed records, with its source and context preserved. The [source-fracture producer](../src/model/ei-source-fractures.ts) witnesses an actual unequal before/after text pair at one address. A new record is a baseline, not a difference against a fabricated prior value. This is the declared text-comparison grain; unsupplied semantic or physical differences are not inferred.

The [thread drawing plan](../src/model/ei-thread-draw.ts) traverses retained edges from a selected source. It keeps parallel occurrences, places nodes/threads into finite drawing stages and leaves unreachable records unreachable. It does not invent connecting edges or turn an address spelling into metric distance. [Thread tests](../tests/ei-thread-draw.test.ts) and [frame tests](../tests/ei-thread-draw-frame.test.ts) check the finite traversal and completion behavior. See also [moment gates](MOMENT-GATE-LAYER.md) and [source operations](EI-CONVERSATION.md).

The tunnel analogy is useful at this level: an endpoint can refer to another context through an explicit addressed relation instead of requiring visual adjacency. The software mechanism remains an ordinary graph/reference and, where later provided, an ordinary event/transport protocol. Geometry, delivery, authority and returned evidence each require their own binding and check.

## GitHub as the public hub

The [public-sync implementation](../src/model/ei-public-sync.ts) reads a fixed-origin manifest and derives the immutable payload URL from its SHA-256 digest. The manifest is capped at 16 KiB and the payload at 1 MiB. Schema, compatibility, source repository, byte size, record count, record provenance and graph structure are checked. The [generator](../scripts/generate-public-sync.ts) emits only bundled public field records; the [tests](../tests/ei-public-sync.test.ts) cover rejection and merge/proposal boundaries.

The retained snapshot has 137 public records, 504843 bytes and SHA-256 `9b63945706409f663e613ac0819bbc5844e78c0bd0ac1e501a5ecb7ff2c8e94b`. Its [digest-named payload](../public/shared-field/v1/snapshots/9b63945706409f663e613ac0819bbc5844e78c0bd0ac1e501a5ecb7ff2c8e94b.json) is distinct from the mutable [latest manifest](../public/shared-field/v1/latest.json).

[The sync UI](../src/EIPublicSync.tsx) compares against the originally imported public baseline, reports local changes as conflicts, and stages explicitly selected updates through the existing transaction path. Only successfully committed matching changes advance that baseline. Removed public records do not silently delete local records. The [native return validator](../src/model/ei-public-sync-return.ts) checks correlated bounded candidates; a native network response alone does not admit user state.

A content hash binds bytes. Self-declared repository metadata does not authenticate an author; the fixed trusted HTTPS origin supplies the transport trust boundary. Public sync does not download executable JavaScript as an update mechanism, install APKs, upload private ledgers or provide a real-time push server. Optional foreground polling is a snapshot check, not proof of continuous remote synchronization.

## Intended service contract and open work

A future independently running overlay should retain the same field/user identity, source address, target address, source revision, event identity, predecessor and returned receipt. A transport must distinguish received, admitted, rendered and durably stored states. Duplicate delivery must not create another act; stale or out-of-order messages must wait or conflict explicitly. A digest and an address name must not substitute for participant authentication or permission.

The local protocol candidate under development explores shared journal reads, scoped endpoint handles, content-bound events, ordered admission, replay and separate received/applied acknowledgments. Its stated boundary is in-process only: no transport, credentials, timer or automatic I/O. These are implementation directions until their exact source, checks and integration are published. They do not establish remote delivery or a live private shared state between HOMEBASE, Android and Pages.

To close the remaining mechanism, later entries need concrete receipts for:

1. Service separation and a configured authenticated transport, including disconnect/reconnect and authorization boundaries.
2. Explicit conflict behavior and durable replay across independent running clients.
3. Source-derived map geometry, thread intersections, placement and 3D motion with declared units and unresolved cases preserved.
4. A source-bound interpretation/compiler path beyond its current finite supported clauses.
5. Actual platform behavior on each carrier, including native permission flows and Android update identity.

The retained [Sym-PLE-Fied source binding](../SYM-PLE-FIED-SOURCE.md) is `6693379ba669b8c40652706f005dd8e43cb1d7c8`. Its [master ref](https://github.com/Acidfang/Sym-PLE-Fied/tree/6693379ba669b8c40652706f005dd8e43cb1d7c8) was unchanged during this Chronicle check. [PR 26](https://github.com/Acidfang/EverthingFromNothing/pull/26) remained open at `ca6c2c2ae8f20011bdc34ac97cdbe58854aaf1e7`; this Chronicle does not merge it or treat its work as deployed.

## How to extend this Chronicle

Add a dated entry for each material change. Preserve the author requirement, exact public source revision, implemented scope, test command/result, runtime environment and verification limit. Link the commit and its CI/deployment once confirmed. A proposal stays a proposal until its own returned evidence closes it. Correct an earlier claim visibly rather than silently erasing the earlier state.

Keep public technical receipts here. Private source text, user ledgers, credentials, signing material and unrelated personal information do not belong in this public record.
