/** Frozen native wire contract, field.android.encounters.v1 (2026-10-02).
 * GET secure local origin /EverthingFromNothing/__native/encounters.json
 * Every request: requestId [A-Za-z0-9._:-]{1,128}, op, address (1..256 no controls),
 * revision (nonnegative JS-safe integer). Total URL <=4096 UTF-16 code units.
 * list-children requires encounterId. cancel requires targetRequestId.
 * status with target requires target's original address/revision. status without target
 * returns the active action only when its exact address/revision match; otherwise unavailable.
 * Every non-status ID binds exact parameters for this process; max64 actions, final slot reserved
 * for cancel. Capacity refuses fresh IDs; no replay-protection eviction. New process resets IDs.
 * Extra/duplicate query parameters and irrelevant encounterId/targetRequestId are rejected.
 */
export type EncounterState = 'pending' | 'returned' | 'cancelled' | 'unavailable' | 'failed';
export type EncounterOp = 'software' | 'pick-file' | 'pick-folder' | 'list-children' | 'status' | 'cancel';
export interface EncounterEnvelope {
  schema: 'field.android.encounters.v1'; requestId: string | null; state: EncounterState; code: string;
  foreground: boolean; activeRequestId: string | null; action: EncounterAction | null; handleLifetime: 'native_process_session';
}
export interface EncounterAction {
  requestId: string; op: Exclude<EncounterOp, 'status'>; address: string; revision: number;
  encounterId: string | null; targetRequestId: string | null; state: EncounterState;
  stage: 'queued' | 'picking' | 'querying' | 'complete'; code: string;
  result: SoftwareResult | DocumentResult | ChildrenResult | CancellationResult | null;
}
export interface SoftwarePackage {
  state: 'returned' | 'unavailable';
  code: 'package-metadata-returned' | 'package-metadata-unavailable' | 'webview-provider-unavailable';
  packageName: string | null; versionName: string | null; versionCode: number | null; diagnostics: string[];
}
export interface SoftwareResult {
  observationId: string; kind: 'software'; evidenceKind: 'android_package_metadata_return';
  scope: 'this_app_and_current_webview_provider'; ownApp: SoftwarePackage; webViewProvider: SoftwarePackage;
  diagnostics: string[]; contentRead: false; contentSha256: null;
}
export interface DocumentMetadata {
  observationId: string; kind: 'file' | 'folder' | 'unknown'; evidenceKind: 'document_provider_metadata_return';
  encounterId: string; parentEncounterId: string | null;
  displayName: string | null; mimeType: string | null; sizeBytes: number | null;
  lastModifiedMs: number | null; providerFlags: number | null; providerAuthority: string | null;
  diagnostics: string[]; contentRead: false; contentSha256: null; accessLifetime: 'transient_provider_grant';
  handleLifetime: 'native_process_session'; persistedGrantTaken: false;
}
export interface DocumentResult extends DocumentMetadata { coverage: 'selected_item_only'; truncated: boolean; providerLoading: boolean; }
export interface ChildrenResult {
  observationId: string; kind: 'children'; evidenceKind: 'document_provider_metadata_return';
  encounterId: string; parentEncounterId: string | null; children: DocumentMetadata[];
  coverage: 'direct_children_only'; truncated: boolean; providerLoading: boolean; diagnostics: string[];
  contentRead: false; contentSha256: null; accessLifetime: 'transient_provider_grant';
  handleLifetime: 'native_process_session'; persistedGrantTaken: false;
}
export interface CancellationResult { kind: 'cancellation'; targetRequestId: string; pickerMayRemainOpen: boolean; }
/* Display name max512 code units, MIME/authority max256. Overlarge metadata omitted with diagnostic;
 * no synthesized fallback names. kind follows provider MIME; missing/invalid MIME => unknown.
 * Folder MIME: vnd.android.document/directory. pick-file does not query flags/lastModified (null).
 * Numeric values null unless safe nonnegative integer; provider unknown modified0 => null.
 * Children <=64, at most65 rows examined with lookahead; no recursion. Total envelope <=128KiB UTF-8.
 * Returned state is an observation, not completeness; inspect diagnostics/truncated/providerLoading.
 * Handles enc-UUID are opaque process-memory capabilities, not URIs/canonical document identity.
 * list-children may use a live folder handle at a new field scope and preserves that exact scope.
 * Imports/reloads do not recreate native handles. App UI closure does not promise grant expiry.
 * EXTRA_LOCAL_ONLY=true is a picker hint; providers may use their network. No persisted grants/content.
 */
