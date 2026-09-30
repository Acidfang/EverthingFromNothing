# Interactive address overlay

`src/main.tsx` mounts `InfinityApp`. Its inspector follows the source inventory's
actual two-endpoint SUPPORTS, CONTAINS and temporal-role relations; it does not
invent a geometric embedding for the inventory's selected binary locators.
Search symbols/terms/locators, follow either endpoint, use Back/Forward, and
inspect each entry's retained WAS sources, scoped IS, NEXT remainder and CAN BE
refinements. The spatial address selector reads the same live continuum as the
canvas, including calculated NEXT and returned arrivals; navigation alone does
not advance its shared Act.

## Framing before TIME

User drawing requirement, 30 September 2026, retains the exact tokens
`.finity1` and `.infinity2`: assign one pixel, then the next, until all addressed
pixels are drawn, before model TIME. Framing belongs inside that interval.

The implementation is a **SELECTED finite display adapter**:

1. Snapshot the current view and model; prepare the whole projected frame offscreen.
2. Assign every device-pixel index, in row-major order, into the only output
   buffer eligible for presentation. Each assignment copies that projected
   pixel's RGBA into the output; there is no post-presentation ceremonial scan.
3. Yield between bounded batches so controls remain responsive. A changed view
   queues for the next coherent frame; a resized frame is cancelled and replaced.
4. Present the complete output, return its width/height/assigned receipt, then
   and only then consume a requested or playback Act. No partial or cancelled
   receipt permits advancement. Wall-clock time still passes.

This is bounded raster construction and a logical completion barrier. It does
not establish the unresolved canonical pixel/grain embedding, infinite rendering,
physical timeless computation or all per-grain mechanisms. Tests verify each
finite pixel once, incomplete/cancelled gates and replacement completion.

## Turn and twist boundary

View dragging now reads the latest yaw/pitch rather than a stale effect closure.
All three tetrahedron presentations share geometry; arbitrary per-presentation
120-degree spatial offsets were removed. The fixed nodes show the declared
NEXT→IS, IS→WAS, WAS→NEXT role handoff after an Act. This discrete handoff is not
an implementation of an exact spatial twist or the full sequential-follow node
trajectory. Fracture cardinality, absolute coordinate basis, exact twist transform
and projection geometry remain explicitly unresolved.

## Privacy boundary

The main public overlay imports only committed technical inventory. Search and
selection are in-memory. There is no authenticated owner backend and a field
address is not an access-control credential. Do not add private user content to
source, build assets, URL parameters, screenshots or test fixtures.
