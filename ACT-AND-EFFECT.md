# ACT and EFFECT: Why One Grain Is Enough

## The distinction the reader must perform

Read these two statements separately:

```text
The source presents a Difference.
The receiver resolves that Difference.
```

The first statement describes an **ACT**. The second describes an **EFFECT**.
They refer to the same surface interaction from opposite relational positions.

The distinction does not require two substances, two algorithms, or two
independent clocks. It requires two participants in one relation:

```text
source --presents Difference--> receiver
   ACT                           EFFECT
```

An ACT is what the interaction is relative to its source. An EFFECT is what
the same interaction is relative to its receiver. When the receiver later
presents what remains, it occupies the ACT position in another relation.

ACT and EFFECT are therefore roles. They are not permanent identities.

## What this distinction allows

This section states only what the ACT/EFFECT distinction makes available.
What those allowances provide is kept separate below.

### 1. It allows one interaction to have two valid descriptions

The source can truthfully describe an outward presentation while the receiver
can truthfully describe an inward resolution. Neither description requires the
other to be false.

Formally, for source \(s\), receiver \(r\), and presented Difference \(d\):

\[
\operatorname{ACT}(s,r,d)
\equiv
\operatorname{EFFECT}(r,s,d).
\]

The equality is relational. It does not say that \(s\) and \(r\) are the same
field. It says that the ACT and EFFECT descriptions identify one interaction.

### 2. It allows EFFECT without adding another executable primitive

The receiver's EFFECT is the resolution of the presented ACT under the same
declared relation. The model does not need an independent “effect force” or a
second update rule.

The current executable update is:

\[
X_{k+1}=X_{k-1}\oplus\partial X_k.
\]

Here:

- \(X_{k-1}\) is the retained `WAS` field;
- \(X_k\) is the complete `IS` field;
- \(\partial X_k\) is every ACT presented across the selected Faces;
- \(\oplus\) resolves those presentations with retained Difference;
- \(X_{k+1}\) is what remains after every addressed result is committed.

The presentations are ACT relative to their sources. Their Same/Different
resolutions are EFFECT relative to their addressed receivers. Both descriptions
refer to one evaluation of the recurrence.

### 3. It allows a complete immediate resolution inside one shared tick

A tick freezes the whole `WAS/IS` pair before calculating any addressed result.
Every presentation is calculated from that same snapshot. Every result is then
committed together.

This allows many causal resolutions inside one tick without inventing a private
chronology from loop order:

```text
frozen WAS/IS
    -> all ACT presentations
    -> all EFFECT resolutions
    -> one complete committed field
```

The individual calculations are causal content of the moment. Their order in
computer memory is not model time.

### 4. It allows causal IMMEDIATE and causal AFTER to remain distinct

`IMMEDIATE` names everything resolved from the frozen state inside the current
tick. `AFTER` names the complete result once it is available as retained input
to another tick.

```text
IMMEDIATE:
  presentations and resolutions within the shared tick

AFTER:
  the complete committed result available to the next tick
```

`AFTER` is not a third interaction plane. It is the boundary crossing where a
completed EFFECT can occupy an ACT role in a following relation.

### 5. It allows Ripple without requiring recursive state

Repeated ticks propagate Difference through peer addresses in the current
grain. That is the executable Ripple:

\[
X_0 \rightarrow X_1 \rightarrow X_2 \rightarrow \cdots
\]

The recurrence needs only the two adjacent same-grain snapshots required by its
reversible update. It does not read a child grain, a parent grain, or a hidden
recursive field.

### 6. It allows recursion by reusing the same operation

Any generated field can be treated as a whole. Entering that whole changes the
observer's grain address. It does not add another term to the recurrence.

If \(R\) denotes the same declared resolution rule, then:

\[
R_g = R_{g-1} = R_{g-2} = \cdots
\]

means that the rule is reusable at each addressed grain. It does **not** mean
that the calculation at grain \(g\) requires every inner calculation to be
performed first.

Recursion is therefore available as repeated application:

```text
apply R at grain g
enter a generated whole
apply R at grain g-1
```

It is not supplied as a separate cause of the first application.

### 7. It allows Ripple moment and Recursive moment without combining them

The two names answer different questions:

- **Ripple moment:** what does the rule resolve across the observer's current
  grain?
- **Recursive moment:** what is resolved when the same rule is addressed at
  another grain?

The current modeller executes the Ripple moment. Grain navigation makes a
Recursive moment queryable. Recursive depth is an address of application, not
an extra clock required by the Ripple calculation.

### 8. It allows a minimal dependency proof

The executable output can be inspected by its actual inputs. For one tick:

\[
X_{k+1}=F(X_{k-1},X_k,\text{Faces},\oplus).
\]

There is no recursive-grain state in the function signature. The generated
field, reversible ledger, detected formations, and model-energy counts are all
calculated without one.

Therefore:

1. the same-grain output exists in the executable;
2. every executable dependency is declared;
3. recursive state is absent from those dependencies;
4. recursive state is not required to generate that output.

This does not prove that physical reality has no recursive structure. It proves
the narrower and testable statement that this model's same-grain ACT does not
need recursive state in order to produce its generated formation.

## What those allowances provide

This section describes what becomes possible because of the allowances above.

### 1. A smaller causal chain

The executable beginning can remain:

```text
NOTHING
-> FIRST DIFFERENCE
-> ACT
-> same-grain ACT/EFFECT resolution
-> generated field
```

Recursion is not inserted before the generated field. It is something the
generated field allows once that field can be addressed as a whole.

### 2. No duplicated mechanism

If EFFECT required a second algorithm, the model would need to explain why its
output agrees with the ACT algorithm. Treating ACT and EFFECT as relational
views of one surface interaction removes that duplication.

### 3. A precise meaning for the modeller's field detections

At each moment, the modeller can count:

- active Differences;
- Differences that appeared;
- Differences that were retained;
- Differences that resolved;
- causally connected fields;
- exposed boundary Faces;
- total transition activity.

These are results of the same-grain ACT/EFFECT resolution. The detector does
not need to simulate an infinite hierarchy to report them.

### 4. A precise boundary for “energy”

The modeller currently reports three exact, dimensionless model quantities:

```text
Difference energy = active Differences
Transition energy = appeared + resolved Differences
Boundary energy   = exposed Faces
```

They describe activity inside the selected executable model. No physical unit
or external identity is assigned. A recursive calculation could produce the
same categories at another grain, but it is not required to define the current
grain's counts.

### 5. A cleaner account of time

The shared tick belongs to the observer's current grain. It groups all
immediate ACT/EFFECT resolutions calculated from one frozen state.

```text
tick k:
  complete same-grain immediate resolution

tick k+1:
  prior completed result is now available as WAS
```

Ripple time is the succession of these committed same-grain states. Recursive
position identifies where the same operation is inspected. The engine does not
need to turn recursive depth into additional elapsed time.

### 6. A test for unnecessary assumptions

Whenever a proposed primitive is added, the model can ask:

```text
Does the generated result fail without this input?
```

The existing modeller answers that question for recursive state: the field
still forms, reverses, partitions, and exposes its causal ledger without it.
Adding recursion as a required input would therefore add machinery without
explaining an existing dependency.

### 7. A controlled path to deeper models

The result does not prohibit a later recursive view. It specifies how to add
one without changing the beginning:

1. retain the same kernel;
2. change the addressed grain;
3. apply the same rule;
4. compare the generated structures;
5. do not invent cross-grain coupling unless it is explicitly defined and
   tested.

This preserves the difference between:

```text
recursion is allowed
```

and:

```text
recursion was required to generate the first field
```

The current executable supports the first statement and demonstrates that the
second is unnecessary for its generated same-grain results.

## Compact statement

> The modeller calculates one ACT in one grain. ACT and EFFECT are the source
> and receiver descriptions of the same surface interaction. A complete tick
> resolves every immediate relation from one frozen state and commits one
> AFTER field. Repeating that update creates the Ripple. Applying the same rule
> at another grain creates a recursive view, but recursive state is not an
> input required to generate the current grain's field.

