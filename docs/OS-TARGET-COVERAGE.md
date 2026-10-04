# Deterministic operating-system target

Retained user source:

- Sentinel_e573c54bb0208191a4fd794742a5c57e: “the overlay is intended to also be a complete OS”
- Sentinel_b4f5524520188191a8f02acf24f8cb7f: “using deterministic state logic”

This is the target, not the completion status of 0.1.14. The current application remains hosted by a browser, Electron or Android. It does not replace their kernels.

| Subsystem | Implemented boundary | Remaining dependency or gap |
| --- | --- | --- |
| Addressed state and transitions | Pinned source revision, explicit proposed change, returned checks and append-only engine history | General authored semantic rules and whole-model completeness remain open |
| Execution | Fixed compiled C/WASM library, bounded jobs and deterministic source-order admission | Host process execution, memory isolation and instruction scheduling; no bare-metal boot or general program loader |
| Recursive work | Same child-frame/occurrence contract, cycle-safe supplied-link traversal | Full external work-queue reclamation and unrestricted logical spool continuation |
| Parallel scheduling | Two workers per transport, explicit failures and bounded native queues | Host timing/thread scheduling is external; no claim that physical completion order is predetermined |
| Storage | Verified opt-in IndexedDB source pages and serialized local sessions | Host filesystem/browser quota and crash durability; no general filesystem or virtual-memory subsystem |
| Device I/O | Explicit platform observations/capture through scoped adapters | Host drivers, firmware interfaces and permission grants; unexposed devices remain unknown |
| Communications | Local view events and fixed public snapshot checks | Authenticated private remote user-state transport and OS networking stack |
| Authority | Source-bound selection plus platform permission checks | User identities, general capability security and OS-wide isolation remain host responsibilities |
| Display/input | Addressed scene, modeler output/readback and explicit UI input | Host display/input/audio/window services; no replacement compositor or physical device drivers |
| Build/runtime | Hosted authored-rule compiler slice and reproducible packaged C library | Full self-hosted compiler, loader and runtime are not established |

Deterministic replay means the same retained rule version and complete addressed input frame yield the specified same outputs. External time, device returns, errors and user choices are inputs when observed; they must not be silently reread during historical replay. Current logical snapshots do not claim simultaneous physical measurements or a prediction of host scheduling. Undefined rules remain unresolved. Imported receipts establish retained history, not independent external truth.

The current release continues the same shared assets and explicit carrier adapters. No new privileges, OS installation, boot modification or security-boundary removal is implied by this target.
