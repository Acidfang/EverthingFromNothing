#include "ei_core.h"
#include <string.h>
#include <limits.h>

static int valid_address(const ei_address *a) { return a && a->length && a->length <= EI_ADDRESS_BYTES; }
static int valid_value(const ei_value *v) { return v && v->length <= EI_VALUE_BYTES; }
int ei_address_set(ei_address *out, const uint8_t *bytes, uint8_t length) {
  if (!out || !bytes || !length || length > EI_ADDRESS_BYTES) return 0;
  memmove(out->bytes, bytes, length); out->length = length;
  memset(out->bytes + length, 0, EI_ADDRESS_BYTES - length); return 1;
}
int ei_value_set(ei_value *out, const uint8_t *bytes, uint8_t length) {
  if (!out || (length && !bytes) || length > EI_VALUE_BYTES) return 0;
  if (length) memmove(out->bytes, bytes, length);
  out->length = length; memset(out->bytes + length, 0, EI_VALUE_BYTES - length); return 1;
}
int ei_address_equal(const ei_address *a, const ei_address *b) {
  return valid_address(a) && valid_address(b) && a->length == b->length && !memcmp(a->bytes, b->bytes, a->length);
}
static int same_value(const ei_value *a, const ei_value *b) {
  return a->length == b->length && !memcmp(a->bytes, b->bytes, a->length);
}
uint8_t ei_find(const ei_state *s, const ei_address *address) {
  uint8_t i;
  if (!s || !valid_address(address) || s->node_count > EI_MAX_NODES) return EI_NO_NODE;
  for (i = 0; i < s->node_count; ++i) if (ei_address_equal(&s->nodes[i].address, address)) return i;
  return EI_NO_NODE;
}
static int valid_state(const ei_state *s) {
  uint8_t i, j;
  if (!s || !valid_address(&s->owner) || !s->node_count || s->node_count > EI_MAX_NODES || s->edge_count > EI_MAX_EDGES || s->receipt_count > EI_MAX_RECEIPTS) return 0;
  for (i = 0; i < s->node_count; ++i) {
    const ei_node *n = &s->nodes[i];
    if (!valid_address(&n->address) || n->phase > EI_NODE_DONE || n->retained > 1 || (!n->retained && n->phase != EI_NEED_RECORD)) return 0;
    if (n->retained && (!valid_value(&n->record.value) || !valid_address(&n->record.source))) return 0;
    for (j = 0; j < i; ++j) if (ei_address_equal(&n->address, &s->nodes[j].address)) return 0;
  }
  for (i = 0; i < s->edge_count; ++i) if (s->edges[i].from >= s->node_count || s->edges[i].to >= s->node_count || (s->edges[i].relation != EI_ADJACENT && s->edges[i].relation != EI_RELATED)) return 0;
  for (i = 0; i < s->receipt_count; ++i) {
    const ei_receipt *r = &s->receipts[i];
    if (r->node >= s->node_count || !valid_address(&r->source) || !valid_value(&r->before) || !valid_value(&r->after) || !ei_address_equal(&r->user_root, &s->nodes[0].address) || r->sequence != (uint32_t)i + 1 || r->parent_sequence != i || (r->kind != EI_RECORD_STEP && r->kind != EI_EDGE_STEP)) return 0;
    if (r->kind == EI_EDGE_STEP && (r->target >= s->node_count || (r->relation != EI_ADJACENT && r->relation != EI_RELATED))) return 0;
  }
  if (s->revision != s->receipt_count) return 0;
  return 1;
}
ei_status ei_init(ei_state *s, const ei_address *owner, const ei_address *root) {
  ei_address owner_copy, root_copy;
  if (!s || !valid_address(owner) || !valid_address(root)) return EI_BAD_INPUT;
  owner_copy = *owner; root_copy = *root;
  memset(s, 0, sizeof *s); s->owner = owner_copy; s->nodes[0].address = root_copy; s->node_count = 1; return EI_PROGRESS;
}
int ei_complete(const ei_state *s) {
  uint8_t i;
  if (!valid_state(s)) return 0;
  for (i = 0; i < s->node_count; ++i) if (s->nodes[i].phase != EI_NODE_DONE) return 0;
  return 1;
}
static int has_edge(const ei_state *s, uint8_t from, uint8_t to, uint8_t relation) {
  uint8_t i;
  for (i = 0; i < s->edge_count; ++i) if (s->edges[i].from == from && s->edges[i].to == to && s->edges[i].relation == relation) return 1;
  return 0;
}
ei_status ei_step(ei_state *s, const ei_provider *provider, uint16_t budget) {
  uint8_t index;
  if (!valid_state(s) || !provider || !provider->read || !provider->next) return EI_BAD_INPUT;
  while (budget) {
    ei_node *node;
    for (index = 0; index < s->node_count && s->nodes[index].phase == EI_NODE_DONE; ++index) {}
    if (index == s->node_count) return EI_COMPLETE;
    node = &s->nodes[index];
    --budget;
    if (node->phase == EI_NEED_RECORD) {
      ei_record record;
      ei_io io;
      int different;
      memset(&record, 0, sizeof record);
      io = provider->read(provider->context, &node->address, &record);
      if (io == EI_IO_WAIT) return EI_WAIT;
      if (io != EI_IO_OK) return EI_PROVIDER_ERROR;
      if (!valid_value(&record.value) || !valid_address(&record.source)) return EI_BAD_INPUT;
      different = node->retained && !same_value(&node->record.value, &record.value);
      {
        ei_receipt *receipt;
        if (s->receipt_count == EI_MAX_RECEIPTS) return EI_RECEIPT_CAPACITY;
        if (s->revision == UINT32_MAX) return EI_REVISION_OVERFLOW;
        receipt = &s->receipts[s->receipt_count];
        memset(receipt, 0, sizeof *receipt);
        receipt->sequence = s->revision + 1; receipt->parent_sequence = s->revision;
        receipt->user_root = s->nodes[0].address; receipt->node = index; receipt->kind = EI_RECORD_STEP;
        receipt->had_before = node->retained; receipt->value_different = (uint8_t)different;
        if (node->retained) receipt->before = node->record.value;
        receipt->after = record.value; receipt->source = record.source; receipt->source_revision = record.source_revision;
        ++s->receipt_count; ++s->revision;
        node->record = record; node->retained = 1;
      }
      node->phase = EI_NEED_EDGES; node->cursor = 0;
    } else {
      ei_edge_return edge;
      ei_io io;
      uint8_t target;
      int new_node, new_edge;
      memset(&edge, 0, sizeof edge);
      io = provider->next(provider->context, &node->address, node->cursor, &edge);
      if (io == EI_IO_WAIT) return EI_WAIT;
      if (io == EI_IO_END) { node->phase = EI_NODE_DONE; continue; }
      if (io != EI_IO_OK) return EI_PROVIDER_ERROR;
      if (!valid_address(&edge.target) || !valid_address(&edge.source) || (edge.relation != EI_ADJACENT && edge.relation != EI_RELATED)) return EI_BAD_INPUT;
      if (node->cursor == UINT16_MAX) return EI_CURSOR_OVERFLOW;
      target = ei_find(s, &edge.target); new_node = target == EI_NO_NODE;
      if (new_node && s->node_count == EI_MAX_NODES) return EI_NODE_CAPACITY;
      if (new_node) target = s->node_count;
      new_edge = !has_edge(s, index, target, edge.relation);
      if (new_edge && s->edge_count == EI_MAX_EDGES) return EI_EDGE_CAPACITY;
      if (s->receipt_count == EI_MAX_RECEIPTS) return EI_RECEIPT_CAPACITY;
      if (s->revision == UINT32_MAX) return EI_REVISION_OVERFLOW;
      if (new_node) { memset(&s->nodes[target], 0, sizeof s->nodes[target]); s->nodes[target].address = edge.target; ++s->node_count; }
      if (new_edge) { ei_edge *retained = &s->edges[s->edge_count++]; retained->from = index; retained->to = target; retained->relation = edge.relation; }
      {
        ei_receipt *receipt = &s->receipts[s->receipt_count++];
        memset(receipt, 0, sizeof *receipt);
        receipt->sequence = s->revision + 1; receipt->parent_sequence = s->revision;
        receipt->user_root = s->nodes[0].address; receipt->source = edge.source;
        receipt->source_revision = edge.source_revision; receipt->node = index;
        receipt->target = target; receipt->relation = edge.relation; receipt->kind = EI_EDGE_STEP;
        ++s->revision;
      }
      ++node->cursor;
    }
  }
  return ei_complete(s) ? EI_COMPLETE : EI_PROGRESS;
}
ei_status ei_revisit(ei_state *s, const ei_address *address) {
  uint8_t index;
  if (!valid_state(s)) return EI_BAD_INPUT;
  index = ei_find(s, address);
  if (index == EI_NO_NODE) return EI_BAD_INPUT;
  if (s->nodes[index].phase == EI_NODE_DONE) { s->nodes[index].phase = EI_NEED_RECORD; s->nodes[index].cursor = 0; }
  return EI_PROGRESS;
}
int ei_occurrence_at(const ei_state *s, uint32_t sequence, ei_occurrence_address *out) {
  if (!out || !valid_state(s) || sequence > s->revision) return 0;
  memset(out, 0, sizeof *out); out->owner = s->owner; out->root = s->nodes[0].address; out->sequence = sequence; return 1;
}
const ei_receipt *ei_read_occurrence(const ei_state *s, const ei_occurrence_address *address) {
  if (!address || !valid_state(s) || !ei_address_equal(&s->owner, &address->owner) || !ei_address_equal(&s->nodes[0].address, &address->root) || !address->sequence || address->sequence > s->revision) return NULL;
  return &s->receipts[address->sequence - 1];
}
const char *ei_status_name(ei_status status) {
  switch (status) {
    case EI_PROGRESS: return "progress"; case EI_COMPLETE: return "complete"; case EI_WAIT: return "wait";
    case EI_NODE_CAPACITY: return "node-capacity"; case EI_EDGE_CAPACITY: return "edge-capacity"; case EI_RECEIPT_CAPACITY: return "receipt-capacity";
    case EI_BAD_INPUT: return "bad-input"; case EI_PROVIDER_ERROR: return "provider-error"; case EI_CURSOR_OVERFLOW: return "cursor-overflow"; case EI_REVISION_OVERFLOW: return "revision-overflow";
  }
  return "invalid-status";
}
