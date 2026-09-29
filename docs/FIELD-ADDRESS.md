# Field Address Ledger

This ledger preserves the address of repository grains independently of whether they remain on the live presentation surface.

## Rule

A live file may be consolidated, superseded, or retired only after its address is retained here.

```text
grain address = repository + path + blob SHA + role + successor
retired grain != lost grain
output of an earlier frame remains recoverable provenance for later frames
```

Git history is the retained body. The live tree is the current landscape.

## Root snapshot — 30 September 2026

| Original address | Blob SHA | State | Role / successor |
|---|---|---|---|
| `.gitattributes` | `a39c46042c2dcdb3219a4c879903299d3815b680` | ACTIVE/REVIEW | Repository root grain |
| `.gitignore` | `f68d4db363c662ede596eb03d7c8d9eca8390543` | ACTIVE/REVIEW | Repository root grain |
| `ACT-AND-EFFECT.md` | `18a52c3567949f15defee4a4444fa9beabab28de` | ACTIVE/REVIEW | Repository root grain |
| `ATOM-SEARCH.md` | `b9f79568d2df483e06c99b89a5aefe42aec7f37e` | ACTIVE/REVIEW | Repository root grain |
| `COMMERCIAL-USE.md` | `b08ae601b8086172a58e0d4d2087745d25de0947` | ACTIVE/REVIEW | Repository root grain |
| `CONTRIBUTING.md` | `d462cc61f3555338d5ad3a48351269395c0a03b8` | ACTIVE/REVIEW | Repository root grain |
| `FIRST-ACT-PARTICLE.md` | `70b30426ca3a7538eb36bf390ff988a5990337d8` | ACTIVE/REVIEW | Repository root grain |
| `LICENSE` | `dcd5b83d7fa46817a2e9d0321c2a8e7f1e5fb4bf` | ACTIVE/REVIEW | Repository root grain |
| `LIMITATIONS.md` | `c5c9a20fb5e12c3c993eae59d0687a56241a0d32` | ACTIVE/REVIEW | Repository root grain |
| `POTENTIAL-FLOW.md` | `8dbca4f7715408452085af6ee4f969ceca89d4aa` | ACTIVE/REVIEW | Repository root grain |
| `README.md` | `9c96ccc6d86b48f4373d1634ec2259b0cc9f3236` | ACTIVE/REVIEW | Repository root grain |
| `SECURITY.md` | `a46129e789c1d71992e0edad063332a171e23bc3` | ACTIVE/REVIEW | Repository root grain |
| `SIX-FACE-RESOLUTION.md` | `e2f2dab31ce26720c81264de1165673a766499f7` | ACTIVE/REVIEW | Repository root grain |
| `SPEC.md` | `7f54848238dcee14215076917d56fb26583d9cbe` | ACTIVE/REVIEW | Repository root grain |
| `SYM-PLE-FIED-SOURCE.md` | `21c3138bf6f60f48a68f2844a545814ebc019158` | ACTIVE/REVIEW | Repository root grain |
| `THEORY.md` | `ad60f64956021bfecb79b2f989bd98b8d99dfe57` | ACTIVE/REVIEW | Repository root grain |
| `THOUGHT-RESOLUTION.md` | `f45fd4d0de5ff28e87f40ddccf85ae23edac9dd9` | ACTIVE/REVIEW | Repository root grain |
| `index.html` | `3f024bd97e1c008ac8ee75b73762cf17937b6875` | ACTIVE/REVIEW | Repository root grain |
| `package.json` | `563fc9864fb6a7d70b3b90e3c2ec7253edbb3da3` | ACTIVE/REVIEW | Repository root grain |
| `pnpm-lock.yaml` | `122aa6c949183a080e36b9e4c71edc988408f8fd` | ACTIVE/REVIEW | Repository root grain |
| `pnpm-workspace.yaml` | `03cbbe526762abd86b0ee27e1819bd1529494f5c` | ACTIVE/REVIEW | Repository root grain |
| `tsconfig.app.json` | `46735b44db63a884164c0c62850ccb5b13a811fb` | ACTIVE/REVIEW | Repository root grain |
| `tsconfig.json` | `426eda2be1b042c95058043d7937404527e90384` | ACTIVE/REVIEW | Repository root grain |
| `vite.config.ts` | `1de390a8c6717d3e1be88775cf889a8806e7c45a` | ACTIVE/REVIEW | Repository root grain |

## Canonical live structure

- `README.md` — public entry point and navigation.
- `THEORY.md` — concise model boundary.
- `SPEC.md` — executable/public contract.
- `src/model/` — executable model.
- `tests/` — receipts and invariants.
- `schema/` — exported state contracts.
- `qa/` — verification receipts.
- `docs/` — canonical explanatory landscape and retained field addresses.
- Historical projections may be retired from the live root only after their blob address and successor are recorded here.

## Time directions

```text
WAS  = evidence-constrained reconstruction from retained addresses and receipts
IS   = populated current field / landmark
CAN BE = forward reachable field, preserving branches and uncertainty
```

Rewind is therefore not invented certainty: it is the best reconstruction supported by retained provenance. Fast-forward is not a prediction promoted to fact: it is the set of reachable successor grains filtered by current state.

## Retirement protocol

1. Record the current path and blob SHA.
2. Record what the grain contributed.
3. Record the canonical successor address.
4. Remove it from the live surface only if its information is represented by the successor.
5. Preserve Git history as the exact prior receipt.
