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

## Complete transform ancestry

The force totals do not replace their inputs. Each Face retains all 36 ordered
transform records, producing `6 x 36 = 216` preserved steps for the particle:

```text
WAS[n] -> ROTATE AND RESOLVE -> IS[n]
IS[n]  = WAS[n+1]
```

Every record stores its Face address, moment, causal phase, parent identifier,
next identifier, complete WAS vector, complete IS vector, transfer vector,
change-in-transfer vector, and created force components. The three causal
phases each preserve twelve transforms:

```text
1..12   DIRECTION ALLOWED
13..24  FACE PRESENTED
25..36  ADDRESS RESOLVED
```

The interface can select any of the six Face paths and any individual
transform without reconstructing it from the final particle. The result is
therefore an inspectable transformation history, not an endpoint-only trace.

## Infinitesimal axis distinction

The rotational axis is not identified with the cube origin. Each Face path
retains a symbolic offset:

```text
axis origin = cube origin + epsilon U
epsilon = 0...01
```

`U` is the locally derived perpendicular direction for that Face. Epsilon is
not replaced with a floating-point approximation. It belongs to the first
cube-to-axis handoff and remains constant along the path, so it cancels from
later second differences. The renderer exaggerates the separation only to
make the otherwise infinitesimal distinction visible.

## Spiral while spiralling

The child grain is not resolved around a stationary parent address. Its local
spiral is composed with the parent ME's still-changing carrier spiral:

```text
total(t,s) = parentSpiral(t) + (1/2) childSpiral(s,t) + epsilon U
```

The child path retains equal outward and return components. Their exact
superposition is displayed as a standing spiral:

```text
out(s,t) + return(s,t) = 2 A(s) cos(2 pi s) cos(2 pi t)
```

The standing nodes remain fixed relative to the moving parent carrier while
the amplitude changes through the Act. The renderer therefore shows a spiral
resolving inside a spiral, rather than two unrelated rotations.

## Recursive grain playback

The modeller treats a spiral as a completed transform path, not as an isolated
shape. At grain `g`, playback begins when the parent state has resolved enough
to hand the same act inward:

`G(g + 1) complete -> G(g) starts`

The grain stops after its 36th moment, when its own spiral is complete. That
completion is simultaneously the condition that allows the next inward grain:

`G(g) @ 36 -> G(g - 1) @ 1`

An animation may omit grain images to keep a long recursive descent watchable.
If the skip is `s`, displayed frames are separated by `s + 1` grains. This is
only a rendering choice: every intermediate handoff remains in the causal
count, the final requested grain is always rendered, and its `CAME FROM` value
still names the immediately preceding causal grain.
