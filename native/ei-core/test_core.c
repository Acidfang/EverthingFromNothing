#include "ei_core.h"
#include <assert.h>
#include <stdio.h>
#include <string.h>

typedef struct { unsigned calls, wait; uint8_t mode, changed; } fixture;
static ei_address address(uint8_t n) { ei_address a; assert(ei_address_set(&a, &n, 1)); return a; }
static ei_io read_record(void *raw, const ei_address *at, ei_record *out) {
  fixture *f = raw; uint8_t value = (uint8_t)(at->bytes[0] + f->changed);
  ++f->calls; if (f->wait) { --f->wait; return EI_IO_WAIT; }
  if (f->mode == 4) return EI_IO_ERROR;
  out->source = *at; out->source_revision = f->changed;
  assert(ei_value_set(&out->value, &value, 1));
  if (f->mode == 5) out->value.length = EI_VALUE_BYTES + 1;
  return EI_IO_OK;
}
static ei_io next_edge(void *raw, const ei_address *at, uint16_t cursor, ei_edge_return *out) {
  fixture *f = raw; uint8_t from = at->bytes[0], target = 0, relation = EI_RELATED;
  ++f->calls; if (f->wait) { --f->wait; return EI_IO_WAIT; }
  if (f->mode == 3) return EI_IO_END;
  if (f->mode == 2) { target = (uint8_t)(cursor + 2); if (cursor > EI_MAX_NODES) return EI_IO_END; }
  else if (from == 1 && cursor < 2) { target = (uint8_t)(cursor + 2); relation = cursor ? EI_RELATED : EI_ADJACENT; }
  else if (from == 2 && cursor == 0) target = 1;
  else if (from == 3 && cursor == 0) target = 2;
  else return EI_IO_END;
  out->target = address(target); out->relation = relation; out->source = *at; out->source_revision = f->changed;
  return EI_IO_OK;
}
static ei_provider provider(fixture *f) { ei_provider p = { f, read_record, next_edge }; return p; }
static void fresh(ei_state *s) { ei_address owner = address(99), root = address(1); assert(ei_init(s, &owner, &root) == EI_PROGRESS); }
static ei_status finish(ei_state *s, ei_provider *p, uint16_t budget) {
  unsigned loops = 0; ei_status result;
  do { result = ei_step(s, p, budget); assert(++loops < 100); } while (result == EI_PROGRESS);
  return result;
}
static void test_exact_addresses(void) {
  const uint8_t raw[] = { 'a', 0, 'b' }; ei_address a, b; ei_value v;
  assert(ei_address_set(&a, raw, 3)); assert(ei_address_set(&b, raw, 1)); assert(!ei_address_equal(&a, &b));
  assert(ei_address_set(&a, a.bytes, a.length) && a.bytes[0] == 'a' && a.bytes[2] == 'b');
  assert(!ei_address_set(&a, raw, 0)); assert(ei_value_set(&v, NULL, 0));
}
static void test_cycle_and_slicing(void) {
  ei_state one, sliced; fixture f1 = {0}, f2 = {0}; ei_provider p1 = provider(&f1), p2 = provider(&f2); uint8_t i;
  fresh(&one); fresh(&sliced); assert(finish(&one, &p1, 100) == EI_COMPLETE); assert(finish(&sliced, &p2, 1) == EI_COMPLETE);
  assert(!memcmp(&one, &sliced, sizeof one)); assert(one.node_count == 3 && one.edge_count == 4 && one.receipt_count == 7);
  assert(f1.calls == 10 && f2.calls == 10); assert(one.owner.bytes[0] == 99 && one.nodes[0].address.bytes[0] == 1);
  for (i = 0; i < one.receipt_count; ++i) { const ei_receipt *r = &one.receipts[i]; assert(r->sequence == (uint32_t)i + 1 && r->parent_sequence == i); assert(ei_address_equal(&r->user_root, &one.nodes[0].address)); assert(!r->value_different); }
  { ei_occurrence_address at; assert(ei_occurrence_at(&one, 3, &at)); assert(ei_read_occurrence(&one, &at) == &one.receipts[2]); at.owner = address(100); assert(!ei_read_occurrence(&one, &at)); assert(!ei_occurrence_at(&one, 8, &at)); }
  assert(ei_step(&one, &p1, 100) == EI_COMPLETE && f1.calls == 10);
}
static void test_wait_and_errors(void) {
  ei_state s, before; fixture f = {0}; ei_provider p = provider(&f); fresh(&s); before = s;
  f.wait = 1; assert(ei_step(&s, &p, 5) == EI_WAIT); assert(!memcmp(&s, &before, sizeof s));
  assert(ei_step(&s, &p, 0) == EI_PROGRESS && f.calls == 1);
  f.mode = 4; assert(ei_step(&s, &p, 1) == EI_PROVIDER_ERROR); assert(!memcmp(&s, &before, sizeof s));
  f.mode = 5; assert(ei_step(&s, &p, 1) == EI_BAD_INPUT); assert(!memcmp(&s, &before, sizeof s));
  f.mode = 0; assert(ei_step(&s, &p, 1) == EI_PROGRESS); before = s; f.wait = 1;
  assert(ei_step(&s, &p, 1) == EI_WAIT && !memcmp(&s, &before, sizeof s));
  assert(finish(&s, &p, 1) == EI_COMPLETE);
}
static void test_revisit_and_occurrences(void) {
  ei_state s; fixture f = {0}; ei_provider p = provider(&f); ei_address root = address(1); unsigned i;
  f.mode = 3; fresh(&s); assert(finish(&s, &p, 1) == EI_COMPLETE && s.receipt_count == 1);
  assert(ei_revisit(&s, &root) == EI_PROGRESS); assert(finish(&s, &p, 1) == EI_COMPLETE);
  assert(s.receipt_count == 2 && s.receipts[1].had_before && !s.receipts[1].value_different);
  f.changed = 1; assert(ei_revisit(&s, &root) == EI_PROGRESS); assert(finish(&s, &p, 1) == EI_COMPLETE);
  assert(s.receipt_count == 3 && s.receipts[2].value_different && s.receipts[2].before.bytes[0] == 1 && s.receipts[2].after.bytes[0] == 2);
  for (i = 3; i < EI_MAX_RECEIPTS; ++i) { assert(ei_revisit(&s, &root) == EI_PROGRESS); assert(finish(&s, &p, 2) == EI_COMPLETE); }
  assert(ei_revisit(&s, &root) == EI_PROGRESS);
  { ei_state before = s; assert(ei_step(&s, &p, 1) == EI_RECEIPT_CAPACITY); assert(!memcmp(&s, &before, sizeof s)); assert(!ei_complete(&s)); }
}
static void test_capacity_and_corruption(void) {
  ei_state s, before; fixture f = {0}; ei_provider p = provider(&f); f.mode = 2; fresh(&s);
  assert(finish(&s, &p, 1) == EI_NODE_CAPACITY); assert(s.node_count == EI_MAX_NODES && s.nodes[0].cursor == EI_MAX_NODES - 1);
  before = s; assert(ei_step(&s, &p, 1) == EI_NODE_CAPACITY && !memcmp(&s, &before, sizeof s)); assert(!ei_complete(&s));
  s.nodes[1].address = s.nodes[0].address; assert(ei_step(&s, &p, 1) == EI_BAD_INPUT);
}
int main(void) {
  test_exact_addresses(); test_cycle_and_slicing(); test_wait_and_errors(); test_revisit_and_occurrences(); test_capacity_and_corruption();
  printf("{\"status\":\"passed\",\"groups\":5,\"state_bytes\":%zu,\"node_bytes\":%zu,\"receipt_bytes\":%zu,\"profile\":{\"nodes\":%u,\"edges\":%u,\"occurrences\":%u}}\n", sizeof(ei_state), sizeof(ei_node), sizeof(ei_receipt), EI_MAX_NODES, EI_MAX_EDGES, EI_MAX_RECEIPTS);
  return 0;
}
