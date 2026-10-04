#!/bin/sh
set -eu
: "${ZIG:=zig}"
: "${ZIG_GLOBAL_CACHE_DIR:=/tmp/ei-zig-global-cache}"
: "${ZIG_LOCAL_CACHE_DIR:=/tmp/ei-zig-local-cache}"
export ZIG_GLOBAL_CACHE_DIR ZIG_LOCAL_CACHE_DIR
"$ZIG" cc -target wasm32-freestanding -Oz -fno-builtin -nostdlib \
 -I native/ei-core/wasm/include -DEI_MAX_NODES=64 -DEI_MAX_EDGES=128 -DEI_MAX_RECEIPTS=255 \
 native/ei-core/ei_core.c native/ei-core/wasm/memory.c native/ei-core/wasm/bridge.c \
 -Wl,--no-entry -Wl,-z,stack-size=16384 -Wl,--export=ei_bridge_reset \
 -Wl,--export=ei_bridge_record -Wl,--export=ei_bridge_link -Wl,--export=ei_bridge_init \
 -Wl,--export=ei_bridge_step -Wl,--export=ei_bridge_receipts -Wl,--export=ei_bridge_field \
 -Wl,--export=ei_bridge_state_bytes -Wl,--initial-memory=65536 -Wl,--max-memory=65536 \
 -o native/ei-core/wasm/ei-core.wasm
python3 native/ei-core/wasm/record-build.py
