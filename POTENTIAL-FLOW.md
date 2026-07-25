# Potential Flow Resolution

## What it is

For every active Difference in `IS`, the selected cube formalization creates six
Face presentations:

```text
source -> (+X, -X, +Y, -Y, +Z, -Z)
```

The potential analyser preserves the source, target, and Face direction of
every presentation. At each target it calculates:

- incoming presentation count;
- opposing Face pairs;
- net directional remainder;
- retained Difference from `WAS`;
- the exact `WILL BE` state produced by the declared resolution rule.

`WILL BE` is calculated without committing the next shared moment.

## What it allows

During playback:

```text
WAS -> IS -> WILL BE
```

When the clock advances:

```text
prior WILL BE = new IS
```

The model then calculates a new potential field from that new `IS`.

This exposes the exact address-flow quantities used by the model:

```text
presentations
addressed potential
convergence excess
opposing pairs
directional remainder
WILL BE Differences
```

These are dimensionless model counts. “Fluid” describes the continuing
resolution and directional presentation of potential inside the model; it does
not import measured-fluid units or an external material identity.
