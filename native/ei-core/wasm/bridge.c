#include "../ei_core.h"
#include <string.h>
/* Source addresses and exact values are interned by the boundary adapter.
 * Handles are lossless lookup references, not hashes or semantic operators. */
#define INPUTS 64
#define LINKS 128
static ei_state state;
static struct {ei_address address;ei_record record;} inputs[INPUTS];
static struct {uint32_t from;ei_edge_return edge;} links[LINKS];
static uint8_t count,link_count,sealed;
static ei_address address(uint32_t n){ei_address a;uint8_t bytes[4]={(uint8_t)n,(uint8_t)(n>>8),(uint8_t)(n>>16),(uint8_t)(n>>24)};ei_address_set(&a,bytes,4);return a;}
static uint32_t number(const ei_address *a){return a->length==4?(uint32_t)a->bytes[0]|((uint32_t)a->bytes[1]<<8)|((uint32_t)a->bytes[2]<<16)|((uint32_t)a->bytes[3]<<24):0;}
static uint32_t value(const ei_value *v){return v->length==4?(uint32_t)v->bytes[0]|((uint32_t)v->bytes[1]<<8)|((uint32_t)v->bytes[2]<<16)|((uint32_t)v->bytes[3]<<24):0;}
static ei_io read(void *context,const ei_address *a,ei_record *out){(void)context;for(uint8_t i=0;i<count;i++)if(ei_address_equal(a,&inputs[i].address)){*out=inputs[i].record;return EI_IO_OK;}return EI_IO_WAIT;}
static ei_io next(void *context,const ei_address *a,uint16_t cursor,ei_edge_return *out){(void)context;uint16_t at=0;uint32_t from=number(a);for(uint8_t i=0;i<link_count;i++)if(links[i].from==from){if(at++==cursor){*out=links[i].edge;return EI_IO_OK;}}return EI_IO_END;}
int ei_bridge_reset(void){memset(&state,0,sizeof(state));memset(inputs,0,sizeof(inputs));memset(links,0,sizeof(links));count=link_count=sealed=0;return 1;}
int ei_bridge_record(uint32_t at,uint32_t content,uint32_t source,uint32_t revision){if(sealed||!at||!content||!source||count==INPUTS)return 0;for(uint8_t i=0;i<count;i++)if(number(&inputs[i].address)==at)return 0;inputs[count].address=address(at);inputs[count].record.source=address(source);inputs[count].record.source_revision=revision;ei_address v=address(content);ei_value_set(&inputs[count].record.value,v.bytes,v.length);count++;return 1;}
int ei_bridge_link(uint32_t from,uint32_t to,uint32_t source,uint32_t revision,uint32_t kind){if(sealed||!from||!to||!source||link_count==LINKS||(kind!=EI_ADJACENT&&kind!=EI_RELATED))return 0;links[link_count].from=from;links[link_count].edge.target=address(to);links[link_count].edge.source=address(source);links[link_count].edge.source_revision=revision;links[link_count].edge.relation=(uint8_t)kind;link_count++;return 1;}
int ei_bridge_init(uint32_t owner,uint32_t root){if(sealed||!owner||!root)return EI_BAD_INPUT;sealed=1;ei_address o=address(owner),r=address(root);return ei_init(&state,&o,&r);}
int ei_bridge_step(uint32_t budget){if(!sealed||budget>1024)return EI_BAD_INPUT;ei_provider p={0,read,next};return ei_step(&state,&p,(uint16_t)budget);}
uint32_t ei_bridge_receipts(void){return state.receipt_count;}
uint32_t ei_bridge_field(uint32_t i,uint32_t field){if(i>=state.receipt_count)return 0;const ei_receipt *r=&state.receipts[i];switch(field){case 0:return r->sequence;case 1:return r->parent_sequence;case 2:return number(&r->user_root);case 3:return number(&r->source);case 4:return r->source_revision;case 5:return number(&state.nodes[r->node].address);case 6:return number(&state.nodes[r->target].address);case 7:return r->kind;case 8:return r->relation;case 9:return r->had_before;case 10:return r->value_different;case 11:return value(&r->before);case 12:return value(&r->after);default:return 0;}}
uint32_t ei_bridge_state_bytes(void){return sizeof(state);}
