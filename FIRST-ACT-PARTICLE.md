# Particle from One Act

## Derivation

The executable derivation begins with one First Difference:

```text
IS = {(0,0,0)}
```

One Act creates one presentation through each of the six Faces:

```text
(+X, -X, +Y, -Y, +Z, -Z)
```

The resolved current-grain field therefore contains six distinct addresses:

```text
1 First Difference
-> 6 Face presentations
-> 6-address field
```

## Six observer views

Six observers are placed at equal radius, one normal to each cube Face.

Each observer receives five addresses:

```text
5:5:5:5:5:5
```

No single observer contains the complete six-address field. The address on the
far side of the observer axis is hidden by the nearer opposite presentation.

The union of all six independently preserved views contains exactly the
generated six-address field:

```text
merge(V-X, V+X, V-Y, V+Y, V-Z, V+Z)
= complete 6-address field
```

The merge is audited against the generated field by exact address equality.

## Model definition

```text
particle =
  complete merged six-Face presentation
  produced from the First Difference by one Act
```

The later `5 -> 1 -> 5` model atom is a chronological closure. The particle is
the complete spatial presentation at a moment; the atom is the recurring
resolution that reforms a particle-equivalent presentation through time.

## Between-moment force calculation

The rendered transport path and calculator use one shared normalized helix.
One Face distance is `1`, one Act contains one rotation, the maximum spiral
radius is `1/6`, and the display resolves the Act into `36 = 6 x 6`
calculation moments:

```text
p(t) = tA + (1/6)sin(pi t)[U cos(2 pi t) + V sin(2 pi t)]
```

`A` is the selected Face axis. `U` and `V` are perpendicular unit directions
around that axis. At each finite moment:

```text
transfer[n]          = p[n] - p[n-1]
changeInTransfer[n]  = transfer[n] - transfer[n-1]
resultant[n]         = |changeInTransfer[n]|
sixFaceResultant[n]  = 6 x resultant[n]
```

The change vector is projected onto the local axis, inward radial direction,
and rotational tangent. The model therefore exposes outward transfer, inward
turning, rotational change, axial change, the per-Face resultant, and the
simultaneous six-Face total at every intermediate moment.

These values are dimensionless model-force components. They are not SI forces:
the derivation introduces neither measured mass nor an external physical
constant.
