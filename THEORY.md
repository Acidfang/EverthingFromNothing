# Model Boundary

The executable begins with:

```text
WAS -> no represented Difference
IS  -> one represented Difference at the relative origin
```

Its current update is:

\[
X_{k+1}=X_{k-1}\oplus\partial X_k,
\]

where \(\partial\) presents every current Difference across six selected Face
relations and \(\oplus\) is the selected GF(2) Same/Different algebra. The
recurrence is exactly reversible:

\[
X_{k-1}=X_{k+1}\oplus\partial X_k.
\]

| Status | Meaning |
|---|---|
| `GIVEN` | Explicit starting statement |
| `DERIVED` | Follows from declared parents |
| `SELECTED` | Formal choice making the model executable |
| `GENERATED` | Calculated output of the executable kernel |
| `UNRESOLVED` | Interpretation not derived by the kernel |

The six-Face coordinates and GF(2) algebra are selected. Their uniqueness has
not been derived from NOTHING. Their outputs are generated results, not
automatic physical identifications.

## Shared tick

One tick reads a complete immutable `WAS/IS` pair, calculates every addressed
result, and commits the next field together. Iteration order does not create
chronology inside the tick.

The same surface interaction has two relational descriptions: `ACT` relative
to its source and `EFFECT` relative to its receiver. These are not separate
algorithms or independent engine states. The executable calculates the
same-grain ACT/EFFECT resolution; recursion remains available by applying the
same rule at another addressed grain. The full dependency argument is in
[`ACT-AND-EFFECT.md`](ACT-AND-EFFECT.md).

## Whole fields

At completed level \(n\):

\[
W_n=
\bigcup_{f\in\{\pm e_x,\pm e_y,\pm e_z\}}
\left(2^{n-1}f+W_{n-1}\right).
\]

Entering one child translates its complete support to the observer origin; it
does not crop a neighborhood.

Six children each present six outward relations:

\[
36\text{ presentations}
\rightarrow19\text{ addressed relations}
\rightarrow13\text{ Same}+6\text{ Difference}.
\]

The normalized signature is identical through every tested completed level.

## Unbounded recursive access

The explorer calculates compatible finite queries:

\[
Q_0\subset Q_1\subset Q_2\subset\cdots
\]

Every frontier remains expandable through inward grain, outward grain, six
spatial Faces, `WAS`, and `NEXT`. A finite calculation is never presented as a
boundary of the model.

Recursive access is not an input to the same-grain recurrence. The current
grain's generated formation is calculated without hidden recursive state.
