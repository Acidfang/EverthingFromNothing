/** Validates the existing Android scaffold metadata return; no network/access. */
export type SnapshotCheck=Readonly<{
 status:'os-metadata-return'|'unavailable'|'invalid';requestId:string;
 errors:readonly string[];featureCount:number|null;sensorMetadataCount:number|null;
 hardwareVerified:false;dataAccessGranted:false;bridgeCompleted:false;
}>
export function checkCapabilitySnapshot(value:unknown,requestId:string):SnapshotCheck{
 const errors:string[]=[]
 const obj=value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:null
 const finish=(status:SnapshotCheck['status'],featureCount:number|null=null,sensorMetadataCount:number|null=null):SnapshotCheck=>Object.freeze({status,requestId,errors:Object.freeze(errors),featureCount,sensorMetadataCount,hardwareVerified:false,dataAccessGranted:false,bridgeCompleted:false})
 if(!requestId.trim()){errors.push('request-id-empty');return finish('invalid')}
 if(!obj||obj.schema!=='field.android.capability-snapshot.v1'){errors.push('schema');return finish('invalid')}
 if(obj.state==='unavailable')return finish('unavailable')
 if(obj.requestId!==requestId)errors.push('request-correlation')
 if(obj.evidenceKind!=='os_api_return'||obj.observationScope!=='installed_app_and_os_reported_features')errors.push('observation-scope')
 for(const key of ['hardwareAttestation','rawSensorCapture','permissionsRequestedByThisCall'])if(obj[key]!==false)errors.push(key)
 if(!Number.isSafeInteger(obj.apiLevel)||Number(obj.apiLevel)<1||typeof obj.packageName!=='string'||!obj.packageName)errors.push('device-context')
 if(typeof obj.elapsedRealtimeNanos!=='number'||!Number.isFinite(obj.elapsedRealtimeNanos)||obj.elapsedRealtimeNanos<0)errors.push('os-observation-clock')
 // This is provenance for a returned OS call, not logical phase/time in the model.
 const features=obj.osReportedFeatures,sensors=obj.osReportedSensorMetadata,permissions=obj.installedManifestPermissions
 if(!Array.isArray(features))errors.push('features')
 if(!Array.isArray(sensors))errors.push('sensors')
 else for(const sensor of sensors)if(!sensor||typeof sensor!=='object'||(sensor as Record<string,unknown>).measurementTaken!==false)errors.push('sensor-measurement-promotion')
 if(!Array.isArray(permissions))errors.push('permissions')
 if(obj.permissionMetadataState!=='returned'&&obj.permissionMetadataState!=='unknown')errors.push('permission-metadata-state')
 return finish(errors.length?'invalid':'os-metadata-return',Array.isArray(features)?features.length:null,Array.isArray(sensors)?sensors.length:null)
}
