# Complete at 1: implementation boundary

The requested formation resolves placement, inherited twist and turn, all threads,
root-path intersections and the completed successor drawing together before 1
commits. Only SOURCE is fixed. Previous tip becomes the next centre. Actual model
intersections stitch retained root paths; screen overlap is not an intersection.

The current six-face integer/parity kernel does not derive that formation. Its
glyphs and NEXT remain a selected inspectable preview. Page Play/Advance therefore
retain the current committed state and report the unresolved formation. They no
longer claim that completing the old state's pixels completes the requested next
state. Source inventory, recorded-state navigation, containers and the additive
pattern layer remain available. This change does not deliver a twist animation.

`src/model/integrated-transition.ts` prepares immutable supplied successor records,
checks root paths and thread links, checks exact witnessed intersection centres,
retains all branch identities at junctions, and checks previous-tip/next-centre
equality. Incomplete derivation blocks framing. Complete supplied frames must be
presented before the same successor snapshot can commit once against the exact
previous snapshot. Cancellation, stale state, duplicate pixels, renderer failure
and incomplete pixels cannot commit.

This is a transaction boundary, not a geometry solver. Evidence strings are
references supplied by a future resolver, not independently verified proofs.
The pixel producer must supply its derived centre-out order; this module does not
invent it. Production currently imports only the honest unresolved boundary,
because no complete canonical resolver output is available to feed the transaction.

Tests use explicitly synthetic poses and intersections to check the transaction
mechanism. Passing those tests does not prove the requested field geometry.
Remaining dependencies are the relation-to-pose/inherited-turn derivation, full
root-thread/intersection closure, and the thread-derived centre-out pixel producer.
The retained four geometry gaps remain open. “Might/may as well be” is a proposed
state qualifier; no probability or committed equivalence is inferred.
