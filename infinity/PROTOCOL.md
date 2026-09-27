# Infinity Protocol — Whole-Carried Routing Contract

## Invariant

Every operation carries the declared Whole. An addressed item is never detached from its causal context for processing.

```text
Whole + addressed Difference -> selected channel -> resolved Whole
```

The selected relation may change. The surrounding declared field, address, ancestry, provenance and frontier remain available as the envelope that identifies what the relation belongs to.

## Routing centre

The centre exposes three distinct channels. They are not a compulsory pipeline.

- `FILTER` — use when the Whole contains an addressed Difference requiring filtering. Carry the Whole and the filter subject through this channel.
- `ISOLATE` — use when the Whole contains an addressed Difference requiring isolation. Carry the Whole and the isolation subject through this channel.
- `RECONSTRUCT` — use when the Whole contains an addressed Difference requiring reconstruction. Carry the Whole and the reconstruction subject through this channel.
- No applicable Difference — `DO NOTHING -> MOVE ON`.

The required operation selects direction. The payload and its Whole travel together through that direction.

## Whole envelope

A provider/client exchange must retain enough state to identify the complete declared boundary:

- selected centre/address
- finite query radius / Grain boundary
- returned field state
- `WAS`, `IS`, and available `NEXT`
- inward/outward Grain relations
- six spatial Face relations
- expandable frontier
- causal ancestry and provenance
- selected Difference and requested channel
- receipt/result of the operation

Presentations consume this envelope. They must not silently fetch missing causal relations while rendering.

## Atomic resolution

A resolution reads one immutable Whole snapshot. Addressed relations may be calculated independently or concurrently, but local evaluation order does not create causal chronology. The resolved Whole is committed together.

```text
snapshot(Whole)
  -> address Difference
  -> FILTER | ISOLATE | RECONSTRUCT | DO NOTHING
  -> resolve addressed relation while retaining Whole
  -> commit resolved Whole
  -> receipt
```

## Provider rule

GitHub is the source/filter for the published protocol and static provider surface. GitHub Pages may publish the protocol, manifests, client, addresses and provider contract. Persistent/live workers are external services that consume and return Whole envelopes through the same contract; the static page must not pretend to be a persistent compute server.

## Compatibility with the First Act Explorer

This contract does not replace the existing kernel. It constrains how Infinity clients/providers use it:

1. `queryField` declares and returns the finite field boundary before presentation.
2. Frontier relations remain frontier until explicitly included by a later query.
3. Grain navigation rebases a complete Whole rather than cropping an item from its context.
4. Tick resolution reads an immutable snapshot and commits the next field together.
5. Provenance remains attached to generated relations.

The Infinity interface is therefore a presentation/provider layer over the existing mechanism, not a second causal mechanism.
