/** Proposed next-iteration wire contract. Not part of immutable HOMEBASE 0.1.8. */
export interface HomebaseCapabilities {
 schema:'field.homebase.capabilities.v1';
 requestId:string;
 address:string;
 revision:number;
 observationId:string;
 observedAt:string; // local system clock ISO8601, not independent attestation
 state:'returned'|'unavailable';
 code:'native-metadata-returned'|'native-metadata-unavailable';
 provenance:'actual-running-process-and-os-api';
 foreground:boolean;
 platform:{os:string;osType:string;osRelease:string;architecture:string}|null;
 runtime:{application:'HOMEBASE';applicationVersion:string;electron:string;chromium:string;node:string};
 cpu:{logicalCount:number;models:Array<{model:string;logicalCount:number}>;truncated:boolean}|null;
 memory:{totalBytes:number;freeBytesAtObservation:number}|null;
 displays:{units:'device-independent-pixels';items:Array<{index:number;primary:boolean;width:number;height:number;workAreaWidth:number;workAreaHeight:number;scaleFactor:number;rotation:number;refreshHz:number|null}>;truncated:boolean}|null;
 diagnostics:Array<{field:'platform'|'cpu'|'memory'|'displays';code:'unavailable'|'bounded'|'partial'}>;
 contentRead:false;
 personalFilesEnumerated:false;
 userIdentityRead:false;
 geographicLocationRead:false;
 credentialsRead:false;
 applied:false;
}
/** GET https://homebase.local/EverthingFromNothing/__native/homebase-capabilities.json
 * Exactly requestId, address, revision query keys, no duplicates; GET only; local renderer
 * initiator origin must be https://homebase.local. ID [A-Za-z0-9._:-]{1,128}; address 1..256
 * without controls; revision nonnegative JS-safe integer; request URL <=4096.
 * Native response <=32KiB. CPU models <=16, displays <=8, strings <=160; limits explicitly
 * diagnosed. OS and architecture come from the actual process. Linux smoke tests report Linux.
 * No usernames, hostname, home path, serial numbers, MAC/IP/network inventory, installed-app
 * crawl, file contents, personal files, microphone, camera, screen pixels or location.
 * The read requires no settings changes or elevated access. Module initializes only after
 * app ready, and the user-requested first-launch shared UI may read once without a new prompt.
 * Result is an observation descriptor; admission/receipting remains with the shared EI core.
 */
