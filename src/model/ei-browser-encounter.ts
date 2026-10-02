import type {EIDeviceEncounter} from './ei-device-field.ts'
/** Exact browser File metadata only. No content read, upload or semantic claim. */
export function describeEIBrowserFiles(files:readonly Pick<File,'name'|'size'|'type'|'lastModified'|'webkitRelativePath'>[],scope:{address:string;revision:number},batchId:string,folder=false):EIDeviceEncounter[]{
 if(!/^[A-Za-z0-9._:-]{1,80}$/.test(batchId)||!Number.isSafeInteger(scope.revision)||scope.revision<0)throw new Error('Invalid encounter source')
 if(files.length>64)throw new Error('Select at most 64 file entries for one encounter; no entries were retained')
 const roots=new Set(files.map(file=>file.webkitRelativePath.split('/')[0]).filter(Boolean))
 if(folder&&(roots.size!==1||files.some(file=>!file.webkitRelativePath.includes('/'))))throw new Error('Directory selection did not provide one consistent root')
 const folderId=`${batchId}:folder`,selectionAddress=folder?`device/folders/${encodeURIComponent(folderId)}`:undefined
 const entries:EIDeviceEncounter[]=files.map((file,index)=>{
  if(!file.name||!Number.isSafeInteger(file.size)||file.size<0||!Number.isSafeInteger(file.lastModified)||file.lastModified<0)throw new Error('Invalid browser file metadata')
  const relativePath=folder?file.webkitRelativePath:null
  const descriptor={name:file.name,sizeBytes:file.size,mimeType:file.type||null,lastModifiedMs:file.lastModified,relativePath,kind:'file',coverage:folder?'selected-directory-file-entry':'selected-file',contentRead:false,contentSha256:null,access:'browser-selection-memory-only'}
  return {id:`${batchId}:${index}`,kind:'files',label:file.name,sourceText:JSON.stringify(descriptor),realm:'browser-explicit-file-metadata',locator:JSON.stringify({batchId,index,folderSelection:folder}),producer:{...scope},...(selectionAddress?{selectionAddress}:{})}
 })
 if(folder){const name=[...roots][0];entries.unshift({id:folderId,kind:'folders',label:name,sourceText:JSON.stringify({name,coverage:'browser-selected-file-paths-only',fileEntryCount:files.length,emptyDirectoriesObserved:false,contentRead:false}),realm:'browser-explicit-directory-selection',locator:JSON.stringify({batchId}),producer:{...scope}})}
 return entries
}
