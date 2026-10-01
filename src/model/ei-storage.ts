/**
 * Opt-in, unencrypted browser-local storage for a single EI session.
 * Importing/constructing this adapter performs no I/O. Each explicit operation
 * uses only this database/store; it never reads another vault or localStorage.
 * A completed strict IndexedDB transaction is the persistence boundary, not a
 * promise of permanent retention: browser data can still be cleared or evicted.
 */
export const EI_STORAGE_DATABASE = 'efn-ei-local-v1'
export const EI_STORAGE_STORE = 'ledger'
const ACTIVE_KEY = 'active'
const MAX_JSON_BYTES = 1_048_576

/** revision is a storage generation, independent of the model's revision. */
export type EIStoredState = Readonly<{ root: string; revision: number; json: string }>
export type EIStorageErrorCode = 'unavailable' | 'invalid-state' | 'root-conflict' | 'revision-conflict' | 'readback-mismatch' | 'storage-failed' | 'blocked'

export class EIStorageError extends Error {
  readonly code: EIStorageErrorCode
  constructor(code: EIStorageErrorCode, message: string, cause?: unknown) {
    super(`EI storage: ${message}`, cause === undefined ? undefined : { cause })
    this.name = 'EIStorageError'
    this.code = code
  }
}

export interface EILocalStorage {
  load(): Promise<EIStoredState | null>
  compareAndStore(expectedRevision: number | null, next: EIStoredState): Promise<EIStoredState>
}

function invalid(message: string): never { throw new EIStorageError('invalid-state', message) }
function state(value: unknown): EIStoredState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid('the stored envelope must be an object')
  const item = value as Record<string, unknown>
  const keys = Object.keys(item)
  if (keys.length !== 3 || !['root', 'revision', 'json'].every(key => Object.hasOwn(item, key))) invalid('the stored envelope has unexpected fields')
  if (typeof item.root !== 'string' || !item.root.trim() || item.root.length > 256) invalid('root must be nonempty text of at most 256 code units')
  if (!Number.isSafeInteger(item.revision) || (item.revision as number) < 0) invalid('revision must be a nonnegative safe integer')
  if (typeof item.json !== 'string' || item.json.length > MAX_JSON_BYTES || new TextEncoder().encode(item.json).length > MAX_JSON_BYTES) invalid('JSON must be text of at most 1 MiB')
  let parsed: unknown
  try { parsed = JSON.parse(item.json) } catch { invalid('the envelope contains malformed JSON') }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) invalid('JSON must encode an object')
  // Copy before async work so callers cannot change a queued write in place.
  return Object.freeze({ root: item.root, revision: item.revision as number, json: item.json })
}
function same(a: EIStoredState, b: EIStoredState): boolean { return a.root === b.root && a.revision === b.revision && a.json === b.json }
function failure(cause: unknown): EIStorageError {
  return cause instanceof EIStorageError ? cause : new EIStorageError('storage-failed', 'the transaction failed; reload before retrying', cause)
}

function openDatabase(factory: IDBFactory | null | undefined): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!factory) { reject(new EIStorageError('unavailable', 'IndexedDB is unavailable in this browser')); return }
    let request: IDBOpenDBRequest
    try { request = factory.open(EI_STORAGE_DATABASE, 1) } catch (error) { reject(failure(error)); return }
    let settled = false
    const rejectOpen = (error: unknown): void => { if (!settled) { settled = true; reject(failure(error)) } }
    request.onblocked = () => rejectOpen(new EIStorageError('blocked', 'another tab is blocking the local database; close it and retry'))
    request.onerror = () => rejectOpen(request.error)
    request.onupgradeneeded = () => {
      if (settled) { request.transaction?.abort(); return }
      try {
        if (!request.result.objectStoreNames.contains(EI_STORAGE_STORE)) request.result.createObjectStore(EI_STORAGE_STORE)
      } catch (error) {
        rejectOpen(error)
        request.transaction?.abort()
      }
    }
    request.onsuccess = () => {
      if (settled) { request.result.close(); return }
      settled = true
      const database = request.result
      database.onversionchange = () => database.close()
      resolve(database)
    }
  })
}

/**
 * Inject a factory only for isolated tests. No database opens until load/save.
 * JSON content is opaque to this adapter; validate the recovered model/envelope
 * with its own parser before displaying it or preparing another transaction.
 */
export function createEILocalStorage(options: Readonly<{ indexedDB?: IDBFactory | null }> = {}): EILocalStorage {
  const getFactory = (): IDBFactory | null | undefined => Object.hasOwn(options, 'indexedDB') ? options.indexedDB : globalThis.indexedDB

  async function transaction(mode: IDBTransactionMode, next?: EIStoredState, expectedRevision?: number | null): Promise<EIStoredState | null> {
    const database = await openDatabase(getFactory())
    try {
      return await new Promise<EIStoredState | null>((resolve, reject) => {
        let tx: IDBTransaction
        try {
          // Do not silently fall back to relaxed durability if unsupported.
          tx = mode === 'readwrite'
            ? database.transaction(EI_STORAGE_STORE, mode, { durability: 'strict' })
            : database.transaction(EI_STORAGE_STORE, mode)
        } catch (error) { reject(failure(error)); return }
        let result: EIStoredState | null = null
        let resultReady = false
        let transactionFailure: EIStorageError | undefined
        const abort = (error: unknown): void => {
          transactionFailure ??= failure(error)
          try { tx.abort() } catch { reject(transactionFailure) }
        }
        tx.onerror = () => { transactionFailure ??= failure(tx.error) }
        tx.onabort = () => reject(transactionFailure ?? failure(tx.error))
        tx.oncomplete = () => {
          if (transactionFailure) reject(transactionFailure)
          else if (!resultReady) reject(new EIStorageError('readback-mismatch', 'the transaction completed without a stored-value readback'))
          else resolve(result)
        }
        try {
          const store = tx.objectStore(EI_STORAGE_STORE)
          const read = store.get(ACTIVE_KEY)
          read.onerror = () => abort(read.error)
          read.onsuccess = () => {
            try {
              const current = read.result === undefined ? null : state(read.result)
              if (!next) { result = current; resultReady = true; return }
              if (current && current.root !== next.root) throw new EIStorageError('root-conflict', 'another source root already owns this local session')
              // Exact duplicate retries cannot alter state, even if the caller
              // missed completion of its previous successful transaction.
              if (current && same(current, next)) { result = current; resultReady = true; return }
              if (current === null ? expectedRevision !== null : expectedRevision !== current.revision || next.revision !== current.revision + 1) {
                throw new EIStorageError('revision-conflict', 'the local session changed; reload before preparing another write')
              }
              const write = store.put(next, ACTIVE_KEY)
              write.onerror = () => abort(write.error)
              write.onsuccess = () => {
                try {
                  // Read the value from the store, never echo the input/put key.
                  // A mismatch aborts this same transaction before it commits.
                  const readback = store.get(ACTIVE_KEY)
                  readback.onerror = () => abort(readback.error)
                  readback.onsuccess = () => {
                    try {
                      let actual: EIStoredState
                      try { actual = state(readback.result) } catch (error) {
                        throw new EIStorageError('readback-mismatch', 'the saved envelope could not be read back', error)
                      }
                      if (!same(actual, next)) throw new EIStorageError('readback-mismatch', 'the saved envelope did not match its readback')
                      result = actual
                      resultReady = true
                    } catch (error) { abort(error) }
                  }
                } catch (error) { abort(error) }
              }
            } catch (error) { abort(error) }
          }
        } catch (error) { abort(error) }
      })
    } finally { database.close() }
  }

  return Object.freeze({
    load: () => transaction('readonly'),
    compareAndStore: async (expectedRevision: number | null, next: EIStoredState) => {
      if (expectedRevision !== null && (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0)) invalid('expected revision must be null or a nonnegative safe integer')
      const captured = state(next)
      return (await transaction('readwrite', captured, expectedRevision))!
    },
  })
}
