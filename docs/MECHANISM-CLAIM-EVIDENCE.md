# The claim and its evidence

The user first stated **“I have scripted life”**, then refined this to **“I can script binary life.”** The latest testing direction is **“the points that make it false, but by binary relationships.”** Earlier discussion of arguing and resolving Difference is retained as history; it does not replace this latest falsification direction. The engineering checks below are supporting requirements, not additional claims attributed to the user.

The current tests challenge the implemented relations with conflicting witnesses, malformed binary programs, forged or stale provenance, interrupted returns, capacity failures and source changes. The implementation can execute two supplied symbolic rules, retain contradictory witnesses, withhold a conclusion and recompile after a source correction. These are concrete counterexample searches against the implemented slice. Finding no remaining counterexample in a finite test set does not establish the universal umbrella claim.

| Supporting requirement | Evidence and scope | State |
| --- | --- | --- |
| Retain the source before interpreting it | All 93 public clauses retain spans; 86 remain opaque. `tests/ei-ledger-language.test.ts` | Tested |
| Execute the admitted rule's binary library | Returned conclusions consume instruction bytes, with source-bound premise validation. `tests/ei-binary-library.test.ts` | Tested |
| Preserve Difference and contradictory evidence | Both identity and nonidentity witnesses block admission; missing evidence stays unresolved. `tests/ei-addressed-program.test.ts` | Tested |
| Rebuild after a source change | Actual retained source edit creates a source-snapshot fracture, invalidates dependencies and rebuilds deterministically. `tests/ei-addressed-program.test.ts` | Tested |
| Collect exposed adjacent and related addresses | Portable provider loop traverses exact returned addresses and pauses at WAIT/capacity. `native/ei-core/test_core.c` and `test_limits.c` | Host and target compilation tested; board execution untested |
| Give each admitted step a child occurrence | Previous/current values and owner/root/sequence are retained; equal values do not acquire a false value Difference. Portable core tests and `tests/ei-discovery.test.ts` | Tested at the selected record/batch grains |
| Read a consistent logical state | Proposals pin an immutable ledger revision; changed scope and conflicting source ownership reject. `tests/ei-discovery.test.ts` | Tested; physical observations are not globally simultaneous |
| Require an observed return before commitment | Existing engine readback, service-delivery and actual renderer tests distinguish pending, returned and committed states | Tested paths only; see versioned release receipt |
| Preserve a growing whole beyond a finite working window | Pending batches are retained when the current record bound is reached | External spool/backing-store continuation remains unimplemented |
| Falsify the umbrella claim through its binary relationships | Implemented invariants have adversarial tests; opaque source relations and the general meaning of binary life have no complete executable test yet | Unresolved beyond the tested slice |

## Reproduction and limits

Run `pnpm test:model`, `pnpm build`, `pnpm audit:release`, and the native core's documented make targets. Inspect the exact versioned release receipt and renderer evidence for the build being used. A total test count does not establish coverage of every statement.

Runtime tickets and returned receipts remain in the local user field and are inspectable inside the overlay. Public repository evidence contains technical fixtures and build checks, not a copy of the private runtime field. Quotas are configured bounds plus actual reported counts; no unmeasured resource use is asserted. A simulation that assumes the disputed claim is not independent evidence of that claim.

## Explicit falsification checks

These are engineering checks for the requested behavior. Each records what would fail and the bounded evidence that addresses it.

| Falsifying point | Test or retained evidence | Remaining boundary |
| --- | --- | --- |
| Same complete supplied state/input produces a different specified result | `synthetic carrier conformance preserves supplied values and parent relations with explicit provenance`; fresh source recompilation equality checks | This covers supplied finite inputs, not unobserved external state |
| A conclusion has no source path | Forged premise, stale span/revision, outside-scope and altered-byte rejection in `ei-binary-library.test.ts` | Only two authored rule forms execute |
| A child loses its parent or user root | Discovery parent-before-child and immutable step tests; portable occurrence tests | External spool persistence/reclamation is open |
| A mismatched returned state is recorded as a match | Engine and animation readback tests plus actual renderer interruption/cancellation checks | Device physical effects need their own observed returns |
| Conflict resolution erases the contrary evidence | Conflicting comparison tests return no admitted consequence; source-edit recompile preserves previous states | General semantic conflict resolution is open |
| A bridge changes supplied binary relationships | Synthetic three-carrier admission conformance preserves values and parent relations, with carrier/source provenance retained | This is shared admission conformance; actual native adapters have separate platform tests |
| Recompilation changes specified behavior without source change | Deterministic rebuild/replay tests and source snapshot equality | The compiler remains hosted |
| A hidden external choice is presented as a script-determined result | Rule execution consumes retained library bytes; unknown/contradictory premises have no admitted output; user-owned operations retain explicit selection | Host parser, provider implementation and presentation policies are declared dependencies |

Actual faults found during this release include sparse/behavior-bearing binary input acceptance, forged premise admission, mutable provenance snapshots, a selected-address/revision race, a stale PNG load binding, and discovery after failed saved-state initialization. Their fixes have focused regressions or actual renderer reproduction and retest evidence. The exact release receipt identifies which candidate passed those checks; this document does not substitute for it.

## Current local verification for 0.1.12

- 691 model tests passed. One test enumerates 768 finite witness/query combinations against the independent pre-binary interpreter; these are cases within that count, not 768 additional tests
- TypeScript, production build and 12 release audits passed
- Portable core host tests and sanitizers passed. The actual ATmega328P build uses 3,714 flash bytes and 1,401 bytes static SRAM; physical board execution remains untested
- Input ingestion, retained history, source-bound response, contradiction retention and defined source-correction/recompilation are demonstrated behaviors. Calling them life-like does not extend their measured scope or establish consciousness
- Saved/corrupt recovery fixes passed 26 real Electron checks on the corrected candidate. The final asset passed 126 renderer checks plus two observed proof-text checks. The prior candidate passed the complete 131-check discovery/recovery/capacity suite; exact hashes and scope are retained separately in the release receipt
