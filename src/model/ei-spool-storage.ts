import {EI_SPOOL_LIMITS,assertPreparedSpoolPage,emptySpoolHead,nextSpoolHead,readSpoolHead,spoolFail,spoolRoot,spoolWindow,verifyEISpoolPage,type EISpoolStorage,type EISpoolHead,type EISpoolPage,type EISpoolStoredPage,type EISpoolAppendReceipt} from './ei-spool.ts'
export const EI_SPOOL_DATABASE='efn-ei-spool-v1'
const names=['heads','pages','scans'] as const
const binding=(p:EISpoolPage)=>{const c=JSON.parse(p.content),b=JSON.parse(c.raw);return JSON.stringify([b.requestId,b.address,b.revision,b.kind,b.startedAt,b.platform,b.root?.key??null,b.root?.label??null])}
function shape(value:unknown,root:string):EISpoolStoredPage{const s=value as EISpoolStoredPage;if(!s||!s.page||s.page.userRoot!==root||!Number.isSafeInteger(s.ordinal)||s.ordinal<1||s.ordinal>EI_SPOOL_LIMITS.pages||(s.ordinal===1?s.parentAddress!==null:typeof s.parentAddress!=='string')||Object.keys(s).sort().join(',')!=='ordinal,page,parentAddress,storageHead')spoolFail('corrupt-page','stored occurrence envelope is invalid');const h=readSpoolHead(s.storageHead,root);if(h.generation!==s.ordinal||h.address!==s.page.address||h.bytes<s.page.bytes)spoolFail('corrupt-page','stored receipt head is inconsistent');return s}
function linked(current:EISpoolStoredPage,prior:EISpoolStoredPage|null){
 if(current.ordinal===1){if(prior||current.parentAddress!==null||current.storageHead.bytes!==current.page.bytes)spoolFail('corrupt-link','first occurrence does not match the root receipt')}
 else if(!prior||prior.ordinal+1!==current.ordinal||current.parentAddress!==prior.page.address||current.storageHead.bytes!==prior.storageHead.bytes+current.page.bytes)spoolFail('corrupt-link','stored predecessor or cumulative byte receipt differs')
}
function open(factory:IDBFactory|undefined|null):Promise<IDBDatabase>{return new Promise((resolve,reject)=>{if(!factory){reject(Error('EI spool: IndexedDB unavailable'));return}let done=false;const request=factory.open(EI_SPOOL_DATABASE,1);const fail=(e:unknown)=>{if(!done){done=true;reject(e)}};request.onerror=()=>fail(request.error);request.onblocked=()=>fail(Error('EI spool: another view blocks the database'));request.onupgradeneeded=()=>{if(done){request.transaction?.abort();return}const db=request.result;db.createObjectStore('heads');const pages=db.createObjectStore('pages');pages.createIndex('rootOrdinal',['page.userRoot','ordinal'],{unique:true});db.createObjectStore('scans')};request.onsuccess=()=>{if(done){request.result.close();return}done=true;const db=request.result;db.onversionchange=()=>db.close();resolve(db)}})}
/** Separate opt-in local store. Only explicit calls perform I/O. No eviction,
 * remote upload, or silent relaxed-durability fallback. Browser eviction is
 * still possible; exported backups remain the portable recovery route. */
export function createEISpoolStorage(options:{indexedDB?:IDBFactory|null;keyRange?:typeof IDBKeyRange}={}):EISpoolStorage{
 const factory=()=>Object.hasOwn(options,'indexedDB')?options.indexedDB:globalThis.indexedDB
 const range=()=>options.keyRange??globalThis.IDBKeyRange
 async function transact<T>(mode:IDBTransactionMode,work:(tx:IDBTransaction,ready:(value:T)=>void,abort:(reason:unknown)=>void)=>void):Promise<T>{const db=await open(factory());try{return await new Promise<T>((resolve,reject)=>{let tx:IDBTransaction;try{tx=mode==='readwrite'?db.transaction([...names],mode,{durability:'strict'}):db.transaction([...names],mode)}catch(e){reject(e);return}let result:T,hasResult=false,error:unknown;const abort=(e:unknown)=>{error??=e;try{tx.abort()}catch{reject(error)}};tx.onerror=()=>{error??=tx.error};tx.onabort=()=>reject(error??tx.error??Error('EI spool: transaction aborted'));tx.oncomplete=()=>hasResult&&!error?resolve(result):reject(error??Error('EI spool: missing transaction readback'));try{work(tx,value=>{result=value;hasResult=true},abort)}catch(e){abort(e)}})}finally{db.close()}}
 const get=<T>(tx:IDBTransaction,store:string,key:IDBValidKey,fn:(v:T|undefined)=>void,abort:(e:unknown)=>void)=>{const r=tx.objectStore(store).get(key);r.onerror=()=>abort(r.error);r.onsuccess=()=>{try{fn(r.result)}catch(e){abort(e)}}}
 const readVerified=async(root:string,address:string):Promise<EISpoolStoredPage|null>=>{
  spoolRoot(root);if(typeof address!=='string'||address.length>256)spoolFail('invalid-address','invalid occurrence address')
  const pair=await transact<{current:EISpoolStoredPage;prior:EISpoolStoredPage|null}|null>('readonly',(tx,ready,abort)=>get<EISpoolStoredPage>(tx,'pages',[root,address],value=>{
   if(!value){ready(null);return}const current=shape(value,root)
   if(current.ordinal===1){linked(current,null);ready({current,prior:null});return}
   const query=tx.objectStore('pages').index('rootOrdinal').get([root,current.ordinal-1]);query.onerror=()=>abort(query.error);query.onsuccess=()=>{try{const prior=shape(query.result,root);linked(current,prior);ready({current,prior})}catch(e){abort(e)}}
  },abort))
  if(!pair)return null
  if(pair.prior)await verifyEISpoolPage(pair.prior.page)
  const page=await verifyEISpoolPage(pair.current.page);if(page.address!==address)spoolFail('corrupt-page','occurrence address changed')
  return Object.freeze({...pair.current,page})
 }
 return {
  async head(root){spoolRoot(root);const h=await transact<EISpoolHead>('readonly',(tx,ready,abort)=>get(tx,'heads',root,value=>ready(readSpoolHead(value,root)),abort));if(h.address){const last=await readVerified(root,h.address);if(!last||JSON.stringify(last.storageHead)!==JSON.stringify(h))spoolFail('corrupt-head','whole-root head differs from its terminal occurrence receipt')}return h},
  async append(expected,page){
   assertPreparedSpoolPage(page);expected=readSpoolHead(expected,page.userRoot)
   return transact<EISpoolAppendReceipt>('readwrite',(tx,ready,abort)=>{
    get(tx,'heads',page.userRoot,currentValue=>{
     const current=readSpoolHead(currentValue,page.userRoot)
     const proceed=()=>get<EISpoolStoredPage>(tx,'pages',[page.userRoot,page.address],existing=>{
      if(existing){
       const stored=shape(existing,page.userRoot)
       if(JSON.stringify(stored.page)!==JSON.stringify(page))spoolFail('source-conflict','the same occurrence already retains different source bytes')
       if(stored.ordinal>current.generation)spoolFail('corrupt-head','stored occurrence exceeds its whole-root head')
       ready(Object.freeze({kind:'stored-provider-return',head:current,stored,duplicate:true,engineCommitted:false,durability:'indexeddb-transaction-complete'}));return
      }
      const next=nextSpoolHead(current,expected,page)
      get<any>(tx,'scans',[page.userRoot,page.scanKey],scan=>{
       if(scan!==undefined&&(!scan||typeof scan!=='object'||Object.keys(scan).sort().join(',')!=='address,binding,nextCursor'||typeof scan.address!=='string'||typeof scan.binding!=='string'||!(scan.nextCursor===null||Number.isSafeInteger(scan.nextCursor)&&scan.nextCursor>=0)))spoolFail('corrupt-scan','stored provider cursor is invalid')
       if(scan?(scan.nextCursor!==page.sequence||scan.binding!==binding(page)):page.sequence!==0)spoolFail('continuation-conflict','provider order or original scope changed; pending return is preserved')
       const writePage=()=>{
        const stored:EISpoolStoredPage={page,ordinal:next.generation,parentAddress:current.address,storageHead:next}
        const scanHead={address:page.address,nextCursor:page.nextCursor,binding:binding(page)}
        const writes=[tx.objectStore('pages').add(stored,[page.userRoot,page.address]),tx.objectStore('heads').put(next,page.userRoot),tx.objectStore('scans').put(scanHead,[page.userRoot,page.scanKey])]
        let completed=0
        for(const write of writes){
         write.onerror=()=>abort(write.error)
         write.onsuccess=()=>{
          if(++completed!==writes.length)return
          get<EISpoolStoredPage>(tx,'pages',[page.userRoot,page.address],actual=>{
           if(JSON.stringify(actual)!==JSON.stringify(stored))spoolFail('readback-mismatch','page readback differs; transaction is aborted')
           get(tx,'heads',page.userRoot,actualHead=>{
            if(JSON.stringify(actualHead)!==JSON.stringify(next))spoolFail('readback-mismatch','whole-root head readback differs')
            get(tx,'scans',[page.userRoot,page.scanKey],actualScan=>{
             if(JSON.stringify(actualScan)!==JSON.stringify(scanHead))spoolFail('readback-mismatch','provider continuation readback differs')
             ready(Object.freeze({kind:'stored-provider-return',head:next,stored:actual!,duplicate:false,engineCommitted:false,durability:'indexeddb-transaction-complete'}))
            },abort)
           },abort)
          },abort)
         }
        }
       }
       if(!scan)writePage()
       else get<EISpoolStoredPage>(tx,'pages',[page.userRoot,scan.address],value=>{
        const prior=shape(value,page.userRoot).page
        if(prior.address!==scan.address||prior.scanKey!==page.scanKey||prior.nextCursor!==page.sequence||binding(prior)!==binding(page))spoolFail('corrupt-scan','provider continuation differs from its retained source occurrence')
        writePage()
       },abort)
      },abort)
     },abort)
     if(current.address===null)proceed()
     else get<EISpoolStoredPage>(tx,'pages',[page.userRoot,current.address],last=>{
      const retained=shape(last,page.userRoot)
      if(JSON.stringify(retained.storageHead)!==JSON.stringify(current))spoolFail('corrupt-head','whole-root head differs from its retained occurrence receipt')
      proceed()
     },abort)
    },abort)
   })
  },
  read:readVerified,
  async window(root,after,limit=EI_SPOOL_LIMITS.pageWindow){
   spoolRoot(root);spoolWindow(after,limit);if(after>=EI_SPOOL_LIMITS.pages)return []
   const snapshot=await transact<{values:EISpoolStoredPage[];prior:EISpoolStoredPage|null}>('readonly',(tx,ready,abort)=>get(tx,'heads',root,value=>{
    const head=readSpoolHead(value,root),query=range().bound([root,after+1],[root,EI_SPOOL_LIMITS.pages]),request=tx.objectStore('pages').index('rootOrdinal').getAll(query,limit)
    request.onerror=()=>abort(request.error);request.onsuccess=()=>{try{
     const values=(request.result as unknown[]).map(v=>shape(v,root));if(values.length!==Math.min(limit,Math.max(0,head.generation-after))||values.some((v,i)=>v.ordinal!==after+i+1))spoolFail('corrupt-window','stored occurrence window has a missing or reordered page')
     const accept=(prior:EISpoolStoredPage|null)=>{let previous=prior;for(const current of values){linked(current,previous);previous=current}if(previous?.ordinal===head.generation&&JSON.stringify(previous.storageHead)!==JSON.stringify(head))spoolFail('corrupt-head','window terminal receipt differs from whole-root head');ready({values,prior})}
     if(!values.length||after===0){accept(null);return}
     const priorRequest=tx.objectStore('pages').index('rootOrdinal').get([root,after]);priorRequest.onerror=()=>abort(priorRequest.error);priorRequest.onsuccess=()=>{try{accept(shape(priorRequest.result,root))}catch(e){abort(e)}}
    }catch(e){abort(e)}}
   },abort))
   if(snapshot.prior)await verifyEISpoolPage(snapshot.prior.page)
   return Promise.all(snapshot.values.map(async value=>Object.freeze({...value,page:await verifyEISpoolPage(value.page)})))
  }
 }
}
