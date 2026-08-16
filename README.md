# First Act Explorer

Public repository:
[Acidfang/EverthingFromNothing](https://github.com/Acidfang/EverthingFromNothing)

Public web modeller:
[acidfang.github.io/EverthingFromNothing](https://acidfang.github.io/EverthingFromNothing/)

DCA occurrence and atom modeler (work in progress):
[acidfang.github.io/EverthingFromNothing/dca-atom-modeler.html](https://acidfang.github.io/EverthingFromNothing/dca-atom-modeler.html)

The WIP model currently demonstrates sequential occurrence emergence,
fixed-Whole resolution, DCA contradiction-brain and atom boundaries, the full
118-element atomic address table, retained-spiral animation, a selectable
toroidal-spiral WIP resolution increase, the shrinking-core boundary, measured
Hydrogen reference controls, and mouse-controlled observation. Unclosed physical
mappings remain visible as work rather than being presented as completed results.

Licensed under the [PolyForm Noncommercial License 1.0.0](LICENSE). You may
use, study, modify, and redistribute the software for noncommercial purposes.
Commercial or profit-making use requires separate permission from Acidfang;
request it through the repository's
[issues](https://github.com/Acidfang/EverthingFromNothing/issues).
The intended one-time, case-specific approach is explained in
[`COMMERCIAL-USE.md`](COMMERCIAL-USE.md).

This directory contains the public executable being developed from the
Difference/Resolution research model.

The mathematical core is deliberately independent of the interface. It already
implements:

- one nonempty First-Difference seed;
- a reversible shared-tick GF(2) field update;
- complete recursively composed wholes;
- whole-preserving inward navigation;
- the exact 36-presentation to 19-relation projection;
- unbounded grain/space/chronology queries through compatible finite prefixes;
- a provenance gate separating given, derived, selected, generated and
  unresolved statements.
- one serializable explorer frame joining chronology, relative observer,
  whole-field projection, recursive frontier, selected relation and causal
  explanation without mixing Acts or grains.
- a deterministic renderer-neutral scene graph containing six child wholes,
  nineteen resolved relations and thirty-six causal presentation edges.
- selectable forward or reverse playback to an observer-chosen moment.
- per-moment causal field detection and dimensionless Difference, transition
  and boundary activity counts.

Install the declared frontend dependencies and start the graphical explorer:

```powershell
pnpm install
pnpm run dev
```

The interface supports pointer and keyboard relation selection, one shared-tick
navigation, complete-whole grain entry and outward return, recursive query
depth, and an exact causal ledger. `Space` resolves one tick;
`Shift+Space` returns to WAS; `[` and `]` change query depth.

Build the offline production bundle:

```powershell
pnpm run build
```

Run the dependency-free model tests with Node 24 or newer:

```powershell
pnpm run test:model
```

Export a complete JSON frame without a graphical interface:

```powershell
pnpm run demo -- --ticks 3 --enter-face 0 --depth 2
```

Explore interactively in the terminal:

```powershell
pnpm run explore
```

The terminal accepts `tick`, `was`, `enter`, `out`, `move`, `depth`,
`relations`, `select`, `ledger`, `why`, and `frame`. Grain and spatial
navigation retain the same shared Act.

Select a containing-grain relation and include its causal explanation:

```powershell
pnpm run demo -- --select-projection 2,0,0
```

The interpretation boundary is documented in
[`THEORY.md`](THEORY.md), the detailed
[`ACT-AND-EFFECT.md`](ACT-AND-EFFECT.md) explanation, and
the [`SIX-FACE-RESOLUTION.md`](SIX-FACE-RESOLUTION.md) observer law.
The executable observer-state interpretation of thought, learning, memory, and
causal lineage is described in [`THOUGHT-RESOLUTION.md`](THOUGHT-RESOLUTION.md).
The deterministic `WAS -> IS -> WILL BE` address-flow calculation is described
in [`POTENTIAL-FLOW.md`](POTENTIAL-FLOW.md).
The exhaustive cube-canonical search and first `5 -> 1 -> 5` closed invariant
are documented in [`ATOM-SEARCH.md`](ATOM-SEARCH.md).
The direct `1 -> 6` derivation and six-view merged model particle are documented
in [`FIRST-ACT-PARTICLE.md`](FIRST-ACT-PARTICLE.md).
Current comparison limits are stated in
[`LIMITATIONS.md`](LIMITATIONS.md).
Exported frames have a public contract in
[`schema/explorer-frame.schema.json`](schema/explorer-frame.schema.json).

The graphical surface is rendered directly from the same exact scene graph
exported by the model. Desktop and narrow-screen verification evidence is
retained in [`qa/verified.json`](qa/verified.json). The complete public behavior
and publication gates are defined in [`SPEC.md`](SPEC.md).
