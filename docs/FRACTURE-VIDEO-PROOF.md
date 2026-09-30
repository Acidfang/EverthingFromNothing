# Added video pattern in the existing fracture map

This adds requested video content at the existing `scene` container, locator `01100111`. It reads existing source-address, WAS / IS / NEXT, frame, delta-update, render-boundary and receipt records. Original map entries, source relations, container definitions and the world's Act are unchanged. The advancing tick belongs only to the added output pattern.

This is a bounded video-path proof using existing source records, not a replacement spatial model or a semantic comic generator. No fixed world lattice, synthetic metric world or new map topology is added. Layout, colors, resolution and playback timing are output-format choices.

## Reproduce

Requires Node 24+, Python 3 with Pillow and NumPy, FFmpeg/FFprobe, and DejaVu Sans under `/usr/share/fonts/truetype/dejavu`. No API, paid service or credentials are used.

```
mkdir -p output
node plan.mjs
python render.py
node test-proof.mjs
node transport.mjs > output/encode-report.json
node transport.mjs --replay > output/replay-report.json
node --experimental-strip-types --test tests/video-pattern.test.ts
ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=codec_name,width,height,r_frame_rate,nb_read_frames,duration -of json output/fracture-proof.mp4
ffmpeg -v error -i output/fracture-proof.mp4 -f null -
```

## Source → added pattern → frame → return

1. `pattern-layer.ts` attaches a separate record to an existing container ID and validates every referenced source ID. It does not insert nodes, mutate container definitions or change map topology.
2. `video-pattern.ts` reads actual records and causal parents from the retained inventory. `pattern-adapter.mjs` supplies those records to the offline output path. The selected display order is not asserted as a new causal/world transition rule.
3. `plan.mjs` retains exact source hashes and every read-only input record. WAS/IS/NEXT describe the added presentation pattern; each source record also retains its own original state frame.
4. `render.py` records drawing operations, compares tile signatures with the retained prior frame, and rasterizes only dirty tiles. Unchanged tiles carry forward. Exact pixel Difference limits writes even inside dirty tiles. An independent full-render oracle checks equality but does not supply output pixels.
5. `transport.mjs` retains the actual output buffer. It writes only changed pixels and verifies unchanged reuse during complete addressed coverage. Incomplete, unpresented or cancelled receipts cannot advance the output pattern's logical tick. Wall-clock time is not stopped.
6. Every output tick has exactly one encoded frame: ticks 0–7, displayed 1.5 seconds each. No committed tick is skipped, no duplicate presentation frames are added, and no unframed final tick is committed.
7. Each receipt retains map-derived content, changed/reused counts, full coverage, actual raw RGB SHA-256 and a linked receipt hash. Replay re-derives the pattern from the original map, reconstructs all delta frames and compares every receipt. The returned MP4 is separately probed and fully decoded.

## Verified

- Original map/container records remain byte/structure identical
- Pattern target and all source IDs already exist
- Displayed content and causal parents equal the existing records
- 8 logical pattern ticks → 8 encoded frames; 1280×720; 12 seconds
- 7,372,800 covered pixels: 1,107,877 changed writes + 6,264,923 verified reused pixels
- Identical-input test: 0 rasterized tiles, 0 pixel writes, 921,600 bit-identical reused pixels
- Every reconstructed delta frame equals its independent full-render baseline
- Independent pattern/raw-frame/receipt-chain replay matches
- 6 focused adapter tests and 2 repository pattern tests pass; TypeScript check passes
- FFprobe confirms frame count/duration/codec; full decode succeeds; decoded sample inspected

Fonts/platform versions can affect raster hashes across machines. Same-environment replay is verified; cross-platform pixel identity is not claimed. H.264 is lossy, so decoded RGB is not claimed equal to raw input hashes.

The webpage verification button checks the unchanged map hash, derived source pattern, stored receipt chain and exact MP4 hash. It does not rerender raw pixels in the browser; use the downloaded source for that. Hashes establish identity and consistency, not independent certification.

## Scope and license

The requested addition is a separate pattern in existing containers. It neither solves nor replaces canonical geometry, physical laws, the existing map, or general visual generation. Different requested content can use this same output/receipt path without redefining the container.

Technical source: Acidfang/EverthingFromNothing. Exact file hashes are retained in the plan. Source excerpts and the repository's PolyForm Noncommercial license are included; no private correspondence, credentials or synthetic replacement-world module is included. Respect the license and any separate permissions from its owner.
