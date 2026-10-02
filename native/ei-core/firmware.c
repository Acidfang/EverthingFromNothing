/* Finite read-only provider fixture, not device/network discovery. The actual
 * board adapter is deliberately separate from the addressing/ingestion core. */
#include "ei_core.h"
ei_state ei_demo_state;
volatile uint8_t ei_demo_status;
static ei_io read_demo(void *context, const ei_address *at, ei_record *out) {
  (void)context;
  out->source = *at; out->source_revision = 0;
  if (!ei_value_set(&out->value, at->bytes, at->length)) return EI_IO_ERROR;
  return EI_IO_OK;
}
static ei_io next_demo(void *context, const ei_address *at, uint16_t cursor, ei_edge_return *out) {
  uint8_t target;
  (void)context;
  if (cursor) return EI_IO_END;
  target = at->bytes[0] == 1 ? 2 : 1;
  out->source = *at; out->source_revision = 0; out->relation = EI_RELATED;
  return ei_address_set(&out->target, &target, 1) ? EI_IO_OK : EI_IO_ERROR;
}
int main(void) {
  ei_address owner, root;
  ei_provider provider = {0, read_demo, next_demo};
  const uint8_t owner_byte = 99, root_byte = 1;
  ei_status status;
  if (!ei_address_set(&owner, &owner_byte, 1) || !ei_address_set(&root, &root_byte, 1)) return 1;
  status = ei_init(&ei_demo_state, &owner, &root);
  while (status == EI_PROGRESS) status = ei_step(&ei_demo_state, &provider, 1);
  ei_demo_status = (uint8_t)status;
#ifdef __AVR__
  /* Inspect ei_demo_status and ei_demo_state with a board adapter/debugger.
   * Merely compiling this loop is not a claim that it ran on a board. */
  for (;;) {}
#else
  return status == EI_COMPLETE && ei_demo_state.node_count == 2 && ei_demo_state.edge_count == 2 && ei_demo_state.receipt_count == 4 ? 0 : 1;
#endif
}
