"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
function fail$1(reason) {
  throw Error(`EI binary machine: ${reason}`);
}
function checkEIData(value) {
  let visits = 0;
  const active = /* @__PURE__ */ new Set();
  const visit = (v, depth) => {
    if (++visits > 25e4 || depth > 20) fail$1("data bound");
    if (v === null || v === void 0 || typeof v === "boolean") return;
    if (typeof v === "string") {
      if (v.length > 2e6) fail$1("text bound");
      return;
    }
    if (typeof v === "number") {
      if (!Number.isFinite(v)) fail$1("non-finite data");
      return;
    }
    if (typeof v !== "object") fail$1("non-data value");
    const object = v, array = Array.isArray(v), keys = Reflect.ownKeys(object), prototype = Object.getPrototypeOf(object);
    if (prototype !== (array ? Array.prototype : Object.prototype) && (!array && prototype !== null || array)) fail$1("non-data prototype");
    if (active.has(object)) fail$1("cyclic data");
    active.add(object);
    if (array) {
      if (keys.length !== v.length + 1) fail$1("non-data array");
      for (let i = 0; i < v.length; i++) {
        const d = Object.getOwnPropertyDescriptor(v, String(i));
        if (!d || !("value" in d)) fail$1("sparse or accessor array");
        visit(d.value, depth + 1);
      }
    } else for (const key of keys) {
      const d = Object.getOwnPropertyDescriptor(object, key);
      if (typeof key !== "string" || !("value" in d)) fail$1("accessor or symbolic data");
      visit(d.value, depth + 1);
    }
    active.delete(object);
  };
  visit(value, 0);
}
const EI_CORE_WASM_SHA256 = "9281d287649f165a047fe2c38b8896719ce3e7f9ae2c03a4cad4740081e18349";
const EI_CORE_WASM_BASE64 = "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";
const EI_MECHANISM_LIMITS = Object.freeze({ records: 64, links: 128, jobs: 64, parallelism: 2, sourceBytes: 1048576, returnBytes: 1048576, steps: 128, budget: 32 });
const seal = /* @__PURE__ */ new WeakSet(), results = /* @__PURE__ */ new WeakSet(), encoder = new TextEncoder();
const freeze = (v) => {
  if (v && typeof v === "object" && !Object.isFrozen(v)) {
    Object.values(v).forEach(freeze);
    Object.freeze(v);
  }
  return v;
};
function fail(s) {
  throw Error(`EI mechanism: ${s}`);
}
const fields = (v, names) => {
  if (!v || typeof v !== "object" || Object.keys(v).sort().join(",") !== names) fail("unknown or missing scripted field");
};
const text = (v, max = 4096) => typeof v === "string" && v.length > 0 && v.length <= max;
const revision = (v) => Number.isInteger(v) && v >= 0 && v <= 4294967295;
const eiMechanismDigest = async (raw) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(raw))), (n) => n.toString(16).padStart(2, "0")).join("");
async function createEIMechanismFrame(input) {
  checkEIData(input);
  fields(input, "records,sourceAddress,sourceId,sourceRevision,userRoot");
  if (!text(input.userRoot) || !text(input.sourceAddress) || !text(input.sourceId) || !revision(input.sourceRevision) || !Array.isArray(input.records) || !input.records.length || input.records.length > EI_MECHANISM_LIMITS.records) fail("invalid or excessive pinned frame");
  const addresses = /* @__PURE__ */ new Set();
  let edges = 0;
  for (const r of input.records) {
    fields(r, "address,links,revision,sourceId,value");
    if (!text(r.address) || addresses.has(r.address) || typeof r.value !== "string" || r.value.length > 32768 || !text(r.sourceId) || !revision(r.revision) || !Array.isArray(r.links)) fail("invalid source record");
    addresses.add(r.address);
    for (const e of r.links) {
      fields(e, "address,relation,revision,sourceId");
      if (!text(e.address) || !["adjacent", "related"].includes(e.relation) || !text(e.sourceId) || !revision(e.revision)) fail("invalid declared link");
      if (++edges > EI_MECHANISM_LIMITS.links) fail("link capacity");
    }
  }
  if (!addresses.has(input.sourceAddress)) fail("source root is absent");
  const data = { format: "ei-mechanism-frame/v1", userRoot: input.userRoot, sourceAddress: input.sourceAddress, sourceRevision: input.sourceRevision, sourceId: input.sourceId, records: input.records.map((r) => ({ ...r, links: r.links.map((e) => ({ ...e })) })) }, raw = JSON.stringify(data);
  if (encoder.encode(raw).length > EI_MECHANISM_LIMITS.sourceBytes) fail("source frame byte capacity");
  const frame = freeze({ ...data, digest: await eiMechanismDigest(raw) });
  seal.add(frame);
  return frame;
}
async function restoreEIMechanismFrame(raw) {
  checkEIData(raw);
  fields(raw, "digest,format,records,sourceAddress,sourceId,sourceRevision,userRoot");
  const { format, digest, ...input } = raw;
  const frame = await createEIMechanismFrame(input);
  if (JSON.stringify(frame) !== JSON.stringify(raw)) fail("frame differs from exact pinned source");
  return frame;
}
function deriveEIMechanismJobs(frame) {
  if (!seal.has(frame)) fail("unvalidated frame");
  const records = new Map(frame.records.map((r) => [r.address, r])), seen = /* @__PURE__ */ new Set(), jobs = [], unresolved = [];
  const visit = (address, parentAddress, depth) => {
    if (seen.has(address)) return;
    seen.add(address);
    if (!records.has(address)) {
      unresolved.push(address);
      return;
    }
    if (jobs.length >= EI_MECHANISM_LIMITS.jobs) {
      unresolved.push(address);
      return;
    }
    jobs.push(freeze({ address, parentAddress, depth }));
    for (const edge of records.get(address).links) visit(edge.address, address, depth + 1);
  };
  visit(frame.sourceAddress, null, 0);
  for (const r of frame.records) if (!seen.has(r.address)) unresolved.push(r.address);
  return freeze({ jobs, unresolved });
}
let modulePromise = null;
async function module$1() {
  return modulePromise ??= (async () => {
    const bytes = Uint8Array.from(atob(EI_CORE_WASM_BASE64), (c) => c.charCodeAt(0)), digest = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), (n) => n.toString(16).padStart(2, "0")).join("");
    if (digest !== EI_CORE_WASM_SHA256) fail("compiled core bytes changed");
    const m = await WebAssembly.compile(bytes);
    if (WebAssembly.Module.imports(m).length) fail("unexpected core host imports");
    return m;
  })();
}
const statuses = ["progress", "complete", "waiting", "node-capacity", "edge-capacity", "occurrence-capacity", "invalid-input", "provider-error", "cursor-overflow", "revision-overflow"];
async function executeEIMechanismJob(frame, job) {
  if (!seal.has(frame)) fail("unvalidated frame");
  checkEIData(job);
  const declared = deriveEIMechanismJobs(frame).jobs.find((j) => j.address === job.address);
  if (!declared || JSON.stringify(declared) !== JSON.stringify(job)) fail("job is not an addressed child of this frame");
  const e = (await WebAssembly.instantiate(await module$1())).exports;
  if (e.memory.buffer.byteLength !== 65536) fail("unexpected core memory profile");
  e.ei_bridge_reset();
  const entries = [], ids = /* @__PURE__ */ new Map(), intern = (kind, value) => {
    const key = JSON.stringify([kind, value]);
    let n = ids.get(key);
    if (n === void 0) {
      n = entries.push({ kind, value });
      ids.set(key, n);
    }
    return n;
  }, lookup = (id, kind) => {
    if (!id || id > entries.length || entries[id - 1].kind !== kind) fail("unbound or wrong-kind core return");
    return entries[id - 1].value;
  };
  for (const r of frame.records) if (!e.ei_bridge_record(intern("address", r.address), intern("value", r.value), intern("source", r.sourceId), r.revision)) fail("core input capacity");
  for (const r of frame.records) for (const link of r.links) if (!e.ei_bridge_link(intern("address", r.address), intern("address", link.address), intern("source", link.sourceId), link.revision, link.relation === "adjacent" ? 1 : 2)) fail("core link capacity");
  const initialized = e.ei_bridge_init(intern("address", frame.userRoot), intern("address", job.address));
  if (initialized !== 0) fail("core initialization rejected");
  let status = 0, steps = 0;
  while (status === 0 && steps++ < EI_MECHANISM_LIMITS.steps) status = e.ei_bridge_step(EI_MECHANISM_LIMITS.budget);
  const occurrences = [];
  for (let i = 0; i < e.ei_bridge_receipts(); i++) {
    const f = (n) => e.ei_bridge_field(i, n) >>> 0, kind = f(7) === 1 ? "record" : "edge";
    occurrences.push(freeze({ sequence: f(0), parentSequence: f(1), userRoot: frame.userRoot, rootAddress: lookup(f(2), "address"), address: lookup(f(5), "address"), targetAddress: kind === "edge" ? lookup(f(6), "address") : null, sourceId: lookup(f(3), "source"), revision: f(4), kind, relation: kind === "edge" ? f(8) === 1 ? "adjacent" : "related" : null, hadBefore: !!f(9), valueDifferent: !!f(10), before: f(9) ? lookup(f(11), "value") : null, after: kind === "record" ? lookup(f(12), "value") : null }));
  }
  const returned = freeze({ format: "ei-mechanism-return/v1", userRoot: frame.userRoot, frameDigest: frame.digest, job: { ...job }, kernelSha256: EI_CORE_WASM_SHA256, status: status === 0 ? "budget" : statuses[status] ?? "invalid-status", occurrences, executionAuthority: false });
  if (encoder.encode(JSON.stringify(returned)).length > EI_MECHANISM_LIMITS.returnBytes) fail("child return byte capacity");
  validateEIMechanismReturn(frame, job, returned);
  return returned;
}
function validateEIMechanismReturn(frame, job, r) {
  checkEIData(r);
  fields(r, "executionAuthority,format,frameDigest,job,kernelSha256,occurrences,status,userRoot");
  if (!seal.has(frame) || r.format !== "ei-mechanism-return/v1" || r.userRoot !== frame.userRoot || r.frameDigest !== frame.digest || r.kernelSha256 !== EI_CORE_WASM_SHA256 || JSON.stringify(r.job) !== JSON.stringify(job) || r.executionAuthority !== false || !Array.isArray(r.occurrences) || r.occurrences.length > 255 || !["budget", ...statuses].includes(r.status)) fail("mismatched mechanism return");
  const records = new Map(frame.records.map((record) => [record.address, record])), read = /* @__PURE__ */ new Set(), edges = /* @__PURE__ */ new Set();
  for (const [i, o] of r.occurrences.entries()) {
    fields(o, "address,after,before,hadBefore,kind,parentSequence,relation,revision,rootAddress,sequence,sourceId,targetAddress,userRoot,valueDifferent");
    if (o.sequence !== i + 1 || o.parentSequence !== i || o.userRoot !== frame.userRoot || o.rootAddress !== job.address || o.hadBefore !== false || o.valueDifferent !== false || o.before !== null) fail("invalid child occurrence lineage");
    const source = records.get(o.address);
    if (!source) fail("return has no source");
    if (o.kind === "record") {
      if (o.targetAddress !== null || o.relation !== null || o.sourceId !== source.sourceId || o.revision !== source.revision || o.after !== source.value || read.has(o.address)) fail("record return differs from pinned source");
      read.add(o.address);
    } else if (o.kind === "edge") {
      const edge = source.links.find((e) => e.address === o.targetAddress && e.relation === o.relation && e.sourceId === o.sourceId && e.revision === o.revision);
      if (!edge || o.after !== null) fail("edge return differs from declared source");
      edges.add(JSON.stringify([o.address, o.targetAddress, o.relation]));
    } else fail("unknown occurrence kind");
  }
  if (r.status === "complete") {
    const seen = /* @__PURE__ */ new Set(), visit = (address) => {
      if (seen.has(address)) return;
      seen.add(address);
      const source = records.get(address);
      if (!source || !read.has(address)) fail("incomplete source coverage");
      for (const edge of source.links) {
        if (!edges.has(JSON.stringify([address, edge.address, edge.relation]))) fail("missing declared link return");
        visit(edge.address);
      }
    };
    visit(job.address);
  }
  return r;
}
async function runEIMechanism(frame, options = {}) {
  if (!seal.has(frame)) fail("unvalidated frame");
  const plan = deriveEIMechanismJobs(frame), maximum = options.parallelism ?? 1;
  if (!Number.isInteger(maximum) || maximum < 1 || maximum > EI_MECHANISM_LIMITS.parallelism) fail("parallel worker bound");
  const runner = options.runner ?? executeEIMechanismJob, returns = new Array(plan.jobs.length), failures = [];
  let next = 0, inFlight = 0, observed = 0, returnedBytes = 0;
  await Promise.all(Array.from({ length: Math.min(maximum, plan.jobs.length) }, async () => {
    while (next < plan.jobs.length) {
      const index = next++, job = plan.jobs[index];
      inFlight++;
      observed = Math.max(observed, inFlight);
      try {
        const r = await runner(frame, job);
        validateEIMechanismReturn(frame, job, r);
        const size = encoder.encode(JSON.stringify(r)).length;
        if (returnedBytes + size > EI_MECHANISM_LIMITS.returnBytes) fail("frame return byte capacity");
        returnedBytes += size;
        returns[index] = freeze(r);
      } catch (reason) {
        failures.push({ job, error: reason instanceof Error ? reason.message : String(reason) });
      } finally {
        inFlight--;
      }
    }
  }));
  const result = freeze({ format: "ei-mechanism-result/v1", frame, returns: returns.filter(Boolean), failures: failures.sort((a, b) => plan.jobs.indexOf(a.job) - plan.jobs.indexOf(b.job)), unresolved: plan.unresolved, complete: failures.length === 0 && plan.unresolved.length === 0 && returns.every((r) => r.status === "complete"), transport: { mode: options.mode ?? "serial", maximumInFlight: observed }, executionAuthority: false });
  results.add(result);
  return result;
}
function createEIMechanismTransport(factory) {
  let closed = false, sequence = 0, ready = null;
  const workers = [], idle = [], waiting = [], pending = /* @__PURE__ */ new Map();
  const startups = /* @__PURE__ */ new Set();
  const close = () => {
    closed = true;
    for (const reject of startups) reject();
    startups.clear();
    for (const w of workers) w.terminate();
    for (const p of pending.values()) {
      clearTimeout(p.timer);
      p.reject(Error("Mechanism environment closed"));
    }
    pending.clear();
    for (const waiter of waiting) waiter.reject(Error("Mechanism environment closed"));
    waiting.length = 0;
    idle.length = 0;
  };
  const initialize = () => ready ??= (async () => {
    if (!factory) return null;
    try {
      for (let i = 0; i < 2; i++) {
        if (closed) throw Error("Mechanism environment closed");
        const worker = factory();
        workers.push(worker);
        await new Promise((resolve, reject) => {
          const finish = (error) => {
            clearTimeout(timer);
            startups.delete(cancel);
            error ? reject(error) : resolve();
          }, cancel = () => finish(Error("Mechanism environment closed")), timer = setTimeout(() => finish(Error("Worker startup unavailable")), 3e3);
          startups.add(cancel);
          worker.onmessage = (e) => {
            if (e.data?.ready === true && ["dedicated-worker", "node-worker-thread"].includes(e.data.environment) && e.data.externalEffects === false) finish();
          };
          worker.onerror = () => finish(Error("Worker startup failed"));
        });
        worker.onmessage = (e) => {
          const item = pending.get(e.data?.id);
          if (!item) return;
          pending.delete(e.data.id);
          clearTimeout(item.timer);
          e.data.error ? item.reject(Error(String(e.data.error))) : item.resolve(e.data.returned);
        };
        worker.onerror = () => close();
        idle.push(worker);
      }
      return workers;
    } catch {
      for (const w of workers) w.terminate();
      workers.length = 0;
      return null;
    }
  })();
  return Object.freeze({ close, inspect: () => Object.freeze({ closed, workers: workers.length, pending: pending.size }), async run(frame) {
    if (closed) throw Error("Mechanism environment closed");
    const pool = await initialize();
    if (closed) throw Error("Mechanism environment closed");
    if (!pool) return runEIMechanism(frame);
    const acquire = () => closed ? Promise.reject(Error("Mechanism environment closed")) : idle.length ? Promise.resolve(idle.shift()) : new Promise((resolve, reject) => waiting.push({ resolve, reject }));
    const release = (worker) => {
      if (closed) return;
      const next = waiting.shift();
      if (next) next.resolve(worker);
      else idle.push(worker);
    };
    return runEIMechanism(frame, { parallelism: 2, mode: "workers", runner: async (f, job) => {
      const worker = await acquire(), id = `job/${++sequence}`;
      try {
        const returned = await new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            pending.delete(id);
            reject(Error("Mechanism job exceeded its return deadline"));
            close();
          }, 5e3);
          pending.set(id, { resolve, reject, timer });
          worker.postMessage({ id, frame: f, job });
        });
        validateEIMechanismReturn(f, job, returned);
        return returned;
      } finally {
        release(worker);
      }
    } });
  } });
}
exports.createEIMechanismTransport = createEIMechanismTransport;
exports.executeEIMechanismJob = executeEIMechanismJob;
exports.restoreEIMechanismFrame = restoreEIMechanismFrame;
