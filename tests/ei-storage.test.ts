import test from 'node:test'
import assert from 'node:assert/strict'
import { createEILocalStorage, EIStorageError, EI_STORAGE_DATABASE, EI_STORAGE_STORE } from '../src/model/ei-storage.ts'
import type { EIStoredState, EIStorageErrorCode } from '../src/model/ei-storage.ts'

const envelope = (revision = 0, value = 'captured', root = 'source:synthetic'): EIStoredState => ({ root, revision, json: JSON.stringify({ value }) })
const rejectsWith = (code: EIStorageErrorCode) => (error: unknown) => error instanceof EIStorageError && error.code === code

/**
 * Explicitly a lifecycle/contract stub, NOT fake-indexeddb or a browser test.
 * It serializes transactions, stages writes, and controls completion/abort so
 * tests can distinguish request success from a committed transaction. Browser
 * IndexedDB locking, disk persistence, and reload behavior need browser QA.
 */
function idbContractStub(initial?: unknown) {
  let saved = structuredClone(initial)
  let storeExists = initial !== undefined
  const calls: { action: string; name?: string; key?: unknown; mode?: string; durability?: string }[] = []
  const transactions: any[] = []
  const held: (() => void)[] = []
  let heldWaiter: (() => void) | undefined
  const faults = {
    open: false, blocked: false, transaction: false, put: false,
    readback: false, mismatch: false, corruptReadback: false,
    abortAtCompletion: false, holdCompletion: false,
  }
  const makeRequest = (): any => ({ result: undefined, error: null, onsuccess: null, onerror: null })
  const startNext = () => { if (transactions.length) queueMicrotask(() => transactions[0]?.start()) }
  function newTransaction(mode: string) {
    const operations: (() => void)[] = []
    let staged: unknown
    let started = false
    let ended = false
    let reads = 0
    const tx: any = {
      error: null, oncomplete: null, onabort: null, onerror: null,
      objectStore(name: string) {
        calls.push({ action: 'objectStore', name })
        assert.equal(name, EI_STORAGE_STORE)
        return {
          get(key: unknown) {
            calls.push({ action: 'get', key })
            const request = makeRequest()
            const readNumber = ++reads
            operations.push(() => {
              if (readNumber > 1 && faults.readback) {
                request.error = new DOMException('read failed', 'UnknownError')
                request.onerror?.()
              } else {
                request.result = structuredClone(readNumber > 1 && faults.corruptReadback ? null : readNumber > 1 && faults.mismatch ? envelope(999, 'wrong') : staged)
                request.onsuccess?.()
              }
            })
            return request
          },
          put(value: unknown, key: unknown) {
            calls.push({ action: 'put', key })
            assert.equal(mode, 'readwrite')
            const request = makeRequest()
            const captured = structuredClone(value)
            operations.push(() => {
              if (faults.put) {
                request.error = new DOMException('quota reached', 'QuotaExceededError')
                request.onerror?.()
              } else {
                staged = captured
                request.result = key
                request.onsuccess?.()
              }
            })
            return request
          },
        }
      },
      abort() {
        if (ended) throw new DOMException('finished', 'InvalidStateError')
        ended = true
        tx.error = new DOMException('aborted', 'AbortError')
        queueMicrotask(() => { tx.onabort?.(); finish() })
      },
      start() {
        if (started || ended) return
        started = true
        staged = structuredClone(saved)
        queueMicrotask(step)
      },
    }
    function finish() {
      assert.equal(transactions.shift(), tx)
      startNext()
    }
    function complete() {
      if (ended) return
      if (faults.abortAtCompletion) { tx.abort(); return }
      ended = true
      if (mode === 'readwrite') saved = structuredClone(staged)
      tx.oncomplete?.()
      finish()
    }
    function step() {
      if (ended) return
      const operation = operations.shift()
      if (operation) { operation(); if (!ended) queueMicrotask(step); return }
      if (faults.holdCompletion) { held.push(complete); heldWaiter?.(); heldWaiter = undefined }
      else complete()
    }
    transactions.push(tx)
    if (transactions.length === 1) startNext()
    return tx
  }
  const factory = {
    open(name: string, version: number) {
      calls.push({ action: 'open', name })
      assert.equal(name, EI_STORAGE_DATABASE)
      assert.equal(version, 1)
      const request = makeRequest()
      let upgradeAborted = false
      request.transaction = { abort: () => { upgradeAborted = true } }
      request.result = {
        onversionchange: null,
        objectStoreNames: { contains: (name: string) => storeExists && name === EI_STORAGE_STORE },
        createObjectStore(name: string) { calls.push({ action: 'createObjectStore', name }); storeExists = true },
        transaction(name: string, mode: string, options?: { durability: string }) {
          calls.push({ action: 'transaction', name, mode, durability: options?.durability })
          assert.equal(name, EI_STORAGE_STORE)
          if (faults.transaction) throw new DOMException('access denied', 'SecurityError')
          return newTransaction(mode)
        },
        close() { calls.push({ action: 'close' }) },
      }
      queueMicrotask(() => {
        if (faults.open) { request.error = new DOMException('access denied', 'SecurityError'); request.onerror?.(); return }
        if (faults.blocked) request.onblocked?.()
        if (!storeExists) request.onupgradeneeded?.()
        if (upgradeAborted) { request.error = new DOMException('aborted', 'AbortError'); request.onerror?.(); return }
        request.onsuccess?.()
      })
      return request
    },
  } as unknown as IDBFactory
  return {
    factory, calls, faults,
    stored: () => structuredClone(saved),
    held: () => held.length ? Promise.resolve() : new Promise<void>(resolve => { heldWaiter = resolve }),
    complete: () => { assert.ok(held.length); held.shift()!() },
  }
}

test('construction has no I/O; explicit load initializes only the dedicated database and store', async () => {
  const h = idbContractStub()
  const storage = createEILocalStorage({ indexedDB: h.factory })
  assert.equal(h.calls.length, 0)
  assert.equal(await storage.load(), null)
  assert.deepEqual(h.calls.filter(c => c.action === 'createObjectStore'), [{ action: 'createObjectStore', name: EI_STORAGE_STORE }])
  assert.equal(h.calls.filter(c => c.action === 'put').length, 0)
  assert.equal(h.calls.at(-1)?.action, 'close')
})

test('initial import, actual stored readback, later storage generation, and recovery from a new adapter', async () => {
  const h = idbContractStub()
  const storage = createEILocalStorage({ indexedDB: h.factory })
  const imported = envelope(4)
  const result = await storage.compareAndStore(null, imported)
  assert.deepEqual(result, imported)
  assert.notEqual(result, imported)
  assert.ok(Object.isFrozen(result))
  assert.deepEqual(h.calls.filter(c => c.action === 'get').map(c => c.key), ['active', 'active'])
  assert.equal(h.calls.find(c => c.action === 'transaction')?.durability, 'strict')
  const next = { ...envelope(5), json: JSON.stringify({ ledger: { revision: 0 }, pending: { id: 'choice' }, attempts: ['rejected'] }) }
  await storage.compareAndStore(4, next)
  assert.deepEqual(await createEILocalStorage({ indexedDB: h.factory }).load(), next)
})

test('put and readback success cannot advance the caller before transaction completion', async () => {
  const prior = envelope()
  const h = idbContractStub(prior)
  h.faults.holdCompletion = true
  const storage = createEILocalStorage({ indexedDB: h.factory })
  let displayed = prior
  let completed = false
  const writing = storage.compareAndStore(0, envelope(1, 'next')).then(actual => { displayed = actual; completed = true })
  await h.held()
  assert.equal(h.calls.filter(c => c.action === 'get').length, 2)
  assert.equal(completed, false)
  assert.deepEqual(displayed, prior)
  assert.deepEqual(h.stored(), prior)
  h.complete()
  await writing
  assert.deepEqual(displayed, envelope(1, 'next'))
})

test('exact retries read existing bytes without another put; conflicting duplicates and stale writes reject', async () => {
  const h = idbContractStub()
  const storage = createEILocalStorage({ indexedDB: h.factory })
  await storage.compareAndStore(null, envelope())
  await storage.compareAndStore(null, envelope())
  await storage.compareAndStore(0, envelope(1, 'one'))
  await storage.compareAndStore(0, envelope(1, 'one'))
  assert.equal(h.calls.filter(c => c.action === 'put').length, 2)
  for (const [expected, next] of [[0, envelope(1, 'conflict')], [1, envelope(1, 'changed')], [0, envelope(2)], [null, envelope(2)], [1, envelope(3)]] as const) {
    await assert.rejects(storage.compareAndStore(expected, next), rejectsWith('revision-conflict'))
  }
  assert.deepEqual(h.stored(), envelope(1, 'one'))
})

test('an occupied database cannot be overwritten by another source root', async () => {
  const prior = envelope()
  const h = idbContractStub(prior)
  const storage = createEILocalStorage({ indexedDB: h.factory })
  await assert.rejects(storage.compareAndStore(0, envelope(1, 'other', 'another:root')), rejectsWith('root-conflict'))
  await assert.rejects(storage.compareAndStore(null, envelope(0, 'other', 'another:root')), rejectsWith('root-conflict'))
  assert.deepEqual(h.stored(), prior)
  assert.equal(h.calls.filter(c => c.action === 'put').length, 0)
})

test('competing adapters can produce only one changed value from the same generation', async () => {
  const h = idbContractStub(envelope())
  const a = createEILocalStorage({ indexedDB: h.factory })
  const b = createEILocalStorage({ indexedDB: h.factory })
  const results = await Promise.allSettled([a.compareAndStore(0, envelope(1, 'a')), b.compareAndStore(0, envelope(1, 'b'))])
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1)
  const rejected = results.find(r => r.status === 'rejected') as PromiseRejectedResult
  assert.ok(rejectsWith('revision-conflict')(rejected.reason))
  assert.deepEqual(await b.load(), envelope(1, 'a'))
})

test('quota, readback error/mismatch, malformed readback, and final abort preserve the prior display and stored state', async () => {
  for (const fault of ['put', 'readback', 'mismatch', 'corruptReadback', 'abortAtCompletion'] as const) {
    const prior = envelope()
    const h = idbContractStub(prior)
    h.faults[fault] = true
    const storage = createEILocalStorage({ indexedDB: h.factory })
    let displayed = prior
    await assert.rejects(storage.compareAndStore(0, envelope(1, 'next')).then(actual => { displayed = actual }), rejectsWith(fault === 'mismatch' || fault === 'corruptReadback' ? 'readback-mismatch' : 'storage-failed'))
    assert.deepEqual(h.stored(), prior, fault)
    assert.deepEqual(displayed, prior, fault)
    assert.equal(h.calls.at(-1)?.action, 'close', fault)
    h.faults[fault] = false
    assert.deepEqual(await storage.load(), prior)
  }
})

test('unavailable, denied, blocked, and unsupported transactions reject without a write', async () => {
  await assert.rejects(createEILocalStorage({ indexedDB: null }).load(), rejectsWith('unavailable'))
  for (const fault of ['open', 'blocked', 'transaction'] as const) {
    const h = idbContractStub()
    h.faults[fault] = true
    await assert.rejects(createEILocalStorage({ indexedDB: h.factory }).compareAndStore(null, envelope()), rejectsWith(fault === 'blocked' ? 'blocked' : 'storage-failed'))
    assert.equal(h.calls.filter(c => c.action === 'put').length, 0)
    assert.equal(h.stored(), undefined)
  }
})

test('corrupt existing data is rejected without repair or replacement', async () => {
  for (const corrupt of [null, 'garbage', { ...envelope(), revision: -1 }, { ...envelope(), json: '{' }, { ...envelope(), extra: true }]) {
    const h = idbContractStub(corrupt)
    const storage = createEILocalStorage({ indexedDB: h.factory })
    await assert.rejects(storage.load(), rejectsWith('invalid-state'))
    await assert.rejects(storage.compareAndStore(null, envelope()), rejectsWith('invalid-state'))
    assert.deepEqual(h.stored(), corrupt)
    assert.equal(h.calls.filter(c => c.action === 'put').length, 0)
  }
})

test('invalid/bounded inputs reject before opening; queued input is captured immutably', async () => {
  const h = idbContractStub()
  const storage = createEILocalStorage({ indexedDB: h.factory })
  const invalid: unknown[] = [
    null, { ...envelope(), root: '' }, { ...envelope(), root: 'x'.repeat(257) },
    { ...envelope(), revision: NaN }, { ...envelope(), revision: Number.MAX_SAFE_INTEGER + 1 },
    { ...envelope(), json: 'null' }, { ...envelope(), json: '[]' }, { ...envelope(), json: '{' },
    { ...envelope(), json: JSON.stringify({ text: 'é'.repeat(524288) }) }, { ...envelope(), extra: true },
  ]
  for (const item of invalid) await assert.rejects(storage.compareAndStore(null, item as EIStoredState), rejectsWith('invalid-state'))
  await assert.rejects(storage.compareAndStore(-1, envelope()), rejectsWith('invalid-state'))
  assert.equal(h.calls.length, 0)
  const mutable = { ...envelope() }
  const pending = storage.compareAndStore(null, mutable)
  mutable.json = '{"value":"mutated after call"}'
  assert.deepEqual(await pending, envelope())
  assert.deepEqual(h.stored(), envelope())
})
