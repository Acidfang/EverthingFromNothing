/** Recovered bounded native wire contract. Revalidation required before build. */
export interface PublicSyncCandidate {
  manifestText: string; payloadText: string; manifestSha256: string; payloadSha256: string;
  payloadBytes: number; recordCount: number; release: string;
  sourceRepository: 'Acidfang/EverthingFromNothing'; compatibility: 'public-field-records-v1';
  verifiedTransport: 'https-fixed-origin'; applied: false;
}
export interface PublicSyncAction {
  requestId:string; op:'check'; address:string; revision:number;
  state:'pending'|'returned'|'unavailable'|'failed';
  stage:'queued'|'fetching-manifest'|'fetching-payload'|'complete'; code:string;
  candidate:PublicSyncCandidate|null;
}
export interface PublicSyncEnvelope {
  schema:'field.android.public-sync.v1'; requestId:string|null;
  state:'pending'|'returned'|'unavailable'|'failed'; code:string;
  foreground:boolean; activeRequestId:string|null; action:PublicSyncAction|null;
  lastGood:{requestId:string,address:string,revision:number,payloadSha256:string,release:string}|null;
  applied:false;
}
/* Local GET /EverthingFromNothing/__native/sync.json; requestId [A-Za-z0-9._:-]{1,128},
 * op check|status,address1..256 without controls,revision safe nonnegative integer.
 * Status additionally requires targetRequestId and exact original scope. URL<=4096;
 * exact query fields, no duplicates. Native never starts network by itself.
 * Fixed public latest.json and digest-derived snapshots/{sha}.json under
 * https://acidfang.github.io/EverthingFromNothing/shared-field/v1/ . Manifest<=16KiB;
 * payload<=1MiB, records1..256. Strict UTF8/JSON/size/hash, 200-only, no redirects or
 * supplied URLs, no credentials/private data. Native returns candidate only, web
 * validates each typed record/graph and explicitly admits changes; last good retained.
 * Four raw results retained with replay tombstones up to1024 check IDs per process.
 * Minimum10s between started checks; one in-flight. UI automatic foreground mode is
 * opt-in and at least15min apart; no background daemon or automatic merge.
 */
