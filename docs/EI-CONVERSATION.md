# Conversation over addressed EI state

The conversation is the entry point. Its messages, returned replies, source links,
Differences and receipts live in the same ledger that the map and moment gates
inspect. The source ledger is supporting memory, not a replacement for replying.

Every complete turn proposes two independently addressed records: the exact user
input and the returned reply. The response context contains retained conversation,
source records, their relations and receipts. The UI renders both staged values,
reads their actual text back, verifies the whole transaction, and completes any
selected browser-local write before admitting the returned turn. A response's
capture/readback verification does not establish the truth of its contents.

## Implemented response scope

The local responder resolves explicit source lookup, exact text comparison and
relation traversal. It also recognizes a bounded set of ordinary-language
questions about retained messages and lexical changes. Each result carries its
actual source addresses. These parser forms are interface choices, not claims
that the model has derived the meaning of arbitrary language.

Unsupported messages are retained as context and receive an explicitly unresolved
response. There is no automatic assertion that an unfamiliar message has no
Difference, that its intent was understood, or that a generated claim is verified.
No external action is executed from message text.

An optional inference adapter contract can receive the retained context and return
text with provider/model/request provenance. No provider is connected by this
change. Adapter output remains generated, unverified content; it cannot select
operations or mutate the ledger directly. Cancellation and stale context prevent
an unadmitted response from becoming current state.

## Boundaries

The static GitHub page currently has no language-model backend, credentials or
paid service. A complete open-ended chatbot requires a real tested inference
implementation or a more capable source-defined interpreter. The conversation
interface and its finite local operations do not satisfy that requirement alone.

Session export and opt-in browser storage retain the same addressed ledger.
Entered content is not sent to a service by the local responder. Existing
unencrypted local-storage disclosures still apply. The previous selected-kernel
model and its unresolved geometric/indexed-moment bindings remain separate.

## Relation derivation and self-check scope

The source mechanism is the selected implementation direction. Controlled queries
compose actual addressed relation labels; they do not assign conventional
semantics to arbitrary labels or invent a missing edge. An explicit finite path
sequence can be evaluated across grains while retaining every returned path.
Filtering applies declared text predicates to supplied candidates and preserves
unresolved branches.

A self-check binds the originating ledger and normalized query, reconstructs the
derivation from retained premises, and compares the returned paths and values.
It reports a mismatch instead of admitting a forged proof or changed source
snapshot. The scope is internal consistency with the captured graph, not external
truth or a proof that every possible meaning has been derived.

The visible parser forms and diagram positions remain presentation choices.
Unknown intent is retained for further resolution; it is not silently converted
into a command, a verified result, or a selected continuation.
