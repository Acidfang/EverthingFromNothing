#ifndef EI_CORE_H
#define EI_CORE_H
#include <stdint.h>

/* Chosen storage profile, not canonical source geometry or unlimited storage. */
#ifndef EI_ADDRESS_BYTES
#define EI_ADDRESS_BYTES 16u
#endif
#ifndef EI_VALUE_BYTES
#define EI_VALUE_BYTES 16u
#endif
#ifndef EI_MAX_NODES
#define EI_MAX_NODES 8u
#endif
#ifndef EI_MAX_EDGES
#define EI_MAX_EDGES 16u
#endif
#ifndef EI_MAX_RECEIPTS
#define EI_MAX_RECEIPTS 8u
#endif
#if EI_MAX_NODES < 1 || EI_MAX_NODES > 255 || EI_MAX_EDGES < 1 || EI_MAX_EDGES > 255 || EI_MAX_RECEIPTS < 1 || EI_MAX_RECEIPTS > 255 || EI_ADDRESS_BYTES < 1 || EI_ADDRESS_BYTES > 255 || EI_VALUE_BYTES < 1 || EI_VALUE_BYTES > 255
#error "Profile capacities must fit the selected one-byte count ABI"
#endif
#define EI_NO_NODE 255u

typedef struct { uint8_t length; uint8_t bytes[EI_ADDRESS_BYTES]; } ei_address;
typedef struct { uint8_t length; uint8_t bytes[EI_VALUE_BYTES]; } ei_value;
typedef struct { ei_value value; ei_address source; uint32_t source_revision; } ei_record;
/* These tags distinguish provider-declared edge kinds; neither implies a
 * geometric neighbour, execution permission, or inferred semantic relation. */
typedef enum { EI_ADJACENT = 1, EI_RELATED = 2 } ei_relation;
typedef struct {
  ei_address target, source;
  uint32_t source_revision;
  uint8_t relation;
} ei_edge_return;
typedef enum { EI_IO_OK, EI_IO_END, EI_IO_WAIT, EI_IO_ERROR } ei_io;
typedef ei_io (*ei_read_fn)(void *, const ei_address *, ei_record *);
/* The adapter must enumerate a stable selected snapshot: a cursor retry must
 * return the same item or WAIT/error. Each item supplies its own provenance. */
typedef ei_io (*ei_next_fn)(void *, const ei_address *, uint16_t, ei_edge_return *);
typedef struct { void *context; ei_read_fn read; ei_next_fn next; } ei_provider;
typedef enum { EI_NEED_RECORD, EI_NEED_EDGES, EI_NODE_DONE } ei_phase;
typedef struct {
  ei_address address;
  ei_record record;
  uint16_t cursor;
  uint8_t phase;
  uint8_t retained;
} ei_node;
typedef struct { uint8_t from, to, relation; } ei_edge;
typedef struct {
  uint32_t sequence;
  uint32_t parent_sequence;
  uint32_t source_revision;
  ei_address user_root;
  ei_address source;
  ei_value before, after;
  uint8_t node, target, relation, kind, had_before, value_different;
} ei_receipt;
enum { EI_RECORD_STEP = 1, EI_EDGE_STEP = 2 };
/* One caller-owned whole: root is nodes[0], every node/edge/receipt is retained
 * inside this state, and owner identifies the user this whole is addressed to. */
typedef struct {
  ei_address owner;
  ei_node nodes[EI_MAX_NODES];
  ei_edge edges[EI_MAX_EDGES];
  ei_receipt receipts[EI_MAX_RECEIPTS];
  uint32_t revision;
  uint8_t node_count, edge_count, receipt_count;
} ei_state;
/* An occurrence address is distinct from its target. Sequence zero names the
 * containing root; positive sequences name retained child-root occurrences. */
typedef struct { ei_address owner, root; uint32_t sequence; } ei_occurrence_address;
typedef enum {
  EI_PROGRESS, EI_COMPLETE, EI_WAIT,
  EI_NODE_CAPACITY, EI_EDGE_CAPACITY, EI_RECEIPT_CAPACITY,
  EI_BAD_INPUT, EI_PROVIDER_ERROR, EI_CURSOR_OVERFLOW, EI_REVISION_OVERFLOW
} ei_status;

int ei_address_set(ei_address *, const uint8_t *, uint8_t);
int ei_value_set(ei_value *, const uint8_t *, uint8_t);
int ei_address_equal(const ei_address *, const ei_address *);
uint8_t ei_find(const ei_state *, const ei_address *);
ei_status ei_init(ei_state *, const ei_address *owner, const ei_address *root);
/* budget counts actual provider calls. WAIT and capacity leave the pending
 * node/cursor intact; no returned item is silently dropped or called complete. */
ei_status ei_step(ei_state *, const ei_provider *, uint16_t budget);
/* Explicitly refresh a completed address. Old receipts/edges remain retained;
 * absence from a later enumeration does not invent a deletion. */
ei_status ei_revisit(ei_state *, const ei_address *);
int ei_complete(const ei_state *);
int ei_occurrence_at(const ei_state *, uint32_t, ei_occurrence_address *);
const ei_receipt *ei_read_occurrence(const ei_state *, const ei_occurrence_address *);
const char *ei_status_name(ei_status);
#endif
