// HOMEBASE discovery wire v1. Metadata only. Canvas admission still requires engine readback.
export type HomebaseDiscoveryScope={requestId:string;address:string;revision:number}
export type HomebaseDiscoveryRequest=HomebaseDiscoveryScope & (
 | {action:'start';kind:'system'|'folder'}
 | {action:'next';scanId:string;cursor:number}
 | {action:'cancel';scanId:string}
)
export type HomebaseDiscoveryObservation={
 key:string;parentKey:string|null;
 kind:'platform'|'runtime'|'cpu'|'memory'|'display'|'firmware'|'kernel'|'os'|'feature'|'sensor'|'permission'|'software'|'folder'|'file';
 label:string;metadata:Record<string,unknown>;
 source:'node-os'|'electron-runtime'|'electron-screen'|'windows-cim'|'windows-uninstall-registry'|'selected-root-filesystem'|'browser-api'|'android-os-api';
 observedAt:string;
}
export type HomebaseDiscoveryBatch=HomebaseDiscoveryScope & {
 schema:'field.homebase.discovery.v1'|'ei.provider.discovery.v1';scanId:string;kind:'system'|'folder';
 status:'running'|'complete'|'limited'|'cancelled'|'unavailable'|'failed';
 sequence:number;nextCursor:number|null;startedAt:string;observedAt:string;
 platform:string;root:{key:string;label:string}|null;
 observations:HomebaseDiscoveryObservation[];
 progress:{visited:number;returned:number;skipped:number;queued:number};
 limits:{batchSize:16;maxEntries:1024;maxDepth:6;maxSeconds:120};
 diagnostics:Array<{code:string;count:number}>;
 contentRead:false;credentialsRead:false;externalUpload:false;applied:false;
}
// POST https://homebase.local/EverthingFromNothing/__native/homebase-discovery.json
// Exact origin and JSON request, no renderer-supplied paths. start-folder opens a
// native folder chooser; canceling it returns cancelled. Start yields sequence0.
// next cursor must equal previous nextCursor; an identical prior cursor replays
// its exact batch. Scope stays the original start scope through all batches.
// The native scan owns no ledger mutation. New observations are retained only
// by the UI's source-bound propose/render/readback flow. Preserve earlier scans.
// Keys are stable metadata identities; root keys hash a selected canonical path,
// which is never returned. Relative paths are present for selected-root entries.
// Enumerate only selected roots. No file reads, symlink/junction traversal,
// known credentials folders, dot-prefixed descendants, or external upload. Selection is
// session-scoped and must be repeated for the next scan. No saved grants.
// System metadata can be partial; diagnostics report unavailable providers.
// Windows software is installed-program registry metadata, not exhaustive apps.
// Absence in a bounded/current scan is not proof of deletion.
