#include "ei_core.h"
#include <assert.h>
#include <stdio.h>
#include <string.h>
static ei_io read_record(void *context, const ei_address *at, ei_record *out) {
  (void)context; out->source = *at; out->source_revision = 0; ei_value_set(&out->value, NULL, 0); return EI_IO_OK;
}
static ei_io next_edge(void *context, const ei_address *at, uint16_t cursor, ei_edge_return *out) {
  uint8_t target = (uint8_t)(cursor + 2); (void)context;
  ei_address_set(&out->target, &target, 1); out->source = *at; out->source_revision = 0; out->relation = EI_ADJACENT; return EI_IO_OK;
}
int main(void) {
  ei_state state, before; ei_address owner, root; uint8_t one = 1; ei_status result;
  ei_provider p = {NULL, read_record, next_edge};
  ei_address_set(&owner, &one, 1); ei_address_set(&root, &one, 1); ei_init(&state, &owner, &root);
  do { result = ei_step(&state, &p, 1); } while (result == EI_PROGRESS);
  assert(result == EI_EDGE_CAPACITY && state.edge_count == EI_MAX_EDGES);
  before = state; assert(ei_step(&state, &p, 1) == EI_EDGE_CAPACITY); assert(!memcmp(&state, &before, sizeof state));
  ei_init(&state, &owner, &root); assert(ei_step(&state, &p, 1) == EI_PROGRESS); state.nodes[0].cursor = UINT16_MAX; before = state;
  assert(ei_step(&state, &p, 1) == EI_CURSOR_OVERFLOW && !memcmp(&state, &before, sizeof state));
  puts("{\"status\":\"passed\",\"groups\":2,\"profile\":\"two-edge-capacity\"}"); return 0;
}
