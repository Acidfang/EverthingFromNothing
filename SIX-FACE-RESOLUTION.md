# Six-Face Resolution

## Primitive sequence

The observer sequence begins:

```text
0  NOTHING
1  ME
2  NOT ME
3  OTHER OBSERVER
```

`NOT ME` is a relation from one observer address. `OTHER OBSERVER` is another
independently centred `ME`.

Two observers are the smallest configuration that can resolve a difference
between views. A cube, however, has six Faces. Its complete same-distance
observation therefore uses six observer addresses:

```text
(-X, +X, -Y, +Y, -Z, +Z)
```

All six observe the same generated field during the same shared tick. Their
distance from the field centre is identical.

## What this allows

For a field `X`, shared moment `t`, and face observers `O_f`:

```text
V_f = Resolve(O_f, X, t)
```

Each view is computed separately. A Difference hidden behind a nearer
Difference on the same exact ray is not received by that observer.

The six views allow every generated address to be classified by its visibility
count:

```text
visibility(x) = number of face observers that receive x
```

with:

```text
0 <= visibility(x) <= 6
```

This preserves:

- what at least one observer receives;
- what every observer receives;
- what only particular observers receive;
- what remains interior to all six received surfaces.

No view is designated as the privileged view.

## What the allowance provides

The combined resolution is not an average and it is not only the unanimous
intersection.

```text
combined =
  union of received Differences
  + visibility multiplicity
  + preserved unreceived interior
```

The union reconstructs the observable envelope. Visibility multiplicity records
how the same address relates to different observer positions. The preserved
interior prevents absence from a received view being converted into
nonexistence.

The six-face operation can expose generated symmetry, enclosure, occlusion,
surface and centre relations that no one view contains.

It does not assign an external physical identity to a pattern. An atom-like
pattern must first be generated, remain stable under observer exchange, recur
across grain or moment, and provide a declared comparison rule before it can be
compared with an observed atom.

## Executable rule

The web modeller implements this operation in
`src/model/observation.ts::observeFromSixFaces`.

For every moment:

1. Determine the complete current field.
2. Place six observers on the coordinate Faces at one radius.
3. Resolve exact ray occlusion independently for every observer.
4. Count how many observers receive every field address.
5. Present the derivation progressively from one observer through six.
6. At each stage, keep every possible Face combination as a separate result.
7. At the two-observer stage, display all 15 distinct Face pairs.
8. Display the selected views and their combined classifications.
9. Retain the complete generated field, including addresses hidden from all
   six observers.
10. During playback, recompute every selected Face view and merged state from
    the same shared moment before rendering that frame.

This makes the modeller distinguish **what exists in the generated whole** from
**what a particular ME can receive**.

## Required cube symmetry

Every observer subset carries its complete Face identity, complement, number of
opposing pairs, and visibility histogram.

The stage sizes are:

```text
1, 6, 15, 20, 15, 6, 1
```

and complement symmetry maps:

```text
k Faces <-> 6-k Faces
```

At the two-Face stage the cube requires two geometric classes:

```text
3 opposing pairs
12 perpendicular pairs
```

At the three-Face stage it requires:

```text
8 one-Face-per-axis corner selections
12 selections containing one opposing pair
```

These classes are properties of the cube formalization. Relationships between
their generated signatures and currently named physical observations are
external comparisons, not prerequisites for the calculation.
