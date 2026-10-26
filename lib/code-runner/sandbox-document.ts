import {
  LOAD_TIMEOUT_MS,
  OUTPUT_LIMIT_WITH_OVERFLOW_SENTINEL,
  PYODIDE_URL,
  RUN_TIMEOUT_MS,
} from "./protocol";
import { DETAIL_LIMIT } from "./run-state";

const FLUSH_INTERVAL_MS = 50;
const COMPILE_SNIPPETS = "'unsafe-eval'";
const COMPILE_PYODIDE_WASM = "'wasm-unsafe-eval'";
const PYODIDE_FROM_MEMORY = "blob:";

export function sandboxPolicy(nonce: string): string {
  return [
    "default-src 'none'",
    `script-src 'nonce-${nonce}' ${COMPILE_SNIPPETS} ${COMPILE_PYODIDE_WASM} ${PYODIDE_FROM_MEMORY}`,
    "worker-src blob:",
    `connect-src ${PYODIDE_URL}`,
    "base-uri 'none'",
    "form-action 'none'",
  ].join("; ");
}

export const WORKER_SCRIPT = String.raw`(() => {
"use strict";
const OUTPUT_LIMIT_WITH_OVERFLOW_SENTINEL = ${OUTPUT_LIMIT_WITH_OVERFLOW_SENTINEL};
const DETAIL_LIMIT = ${DETAIL_LIMIT};
const MAX_ITEMS = 100;
const MAX_DEPTH = 2;
const post = self.postMessage.bind(self);
const nativeSetTimeout = self.setTimeout.bind(self);
const nativeClearTimeout = self.clearTimeout.bind(self);
const nativeSetInterval = self.setInterval.bind(self);
const nativeReject = Promise.reject.bind(Promise);
const nativeFinally = Promise.prototype.finally;
const NativePromise = Promise;
const IDLE = Symbol("idle");
for (let scope = self; scope; scope = Object.getPrototypeOf(scope)) {
  Reflect.deleteProperty(scope, "postMessage");
}
Reflect.deleteProperty(self, "Worker");

let budget = 0;
let finished = true;

function write(stream, text) {
  if (finished || budget <= 0 || text === "") return;
  const kept = text.slice(0, budget);
  budget -= kept.length;
  post({ type: "output", stream, text: kept });
}

const NO_NETWORK = "This sandbox has no network access.";

function refuseNetwork() {
  throw new TypeError(NO_NETWORK);
}

function begin() {
  budget = OUTPUT_LIMIT_WITH_OVERFLOW_SENTINEL;
  finished = false;
  self.fetch = () => Promise.reject(new TypeError(NO_NETWORK));
  for (const name of ["XMLHttpRequest", "WebSocket", "EventSource", "importScripts"]) {
    self[name] = refuseNetwork;
  }
}

function exit(status, detail) {
  if (finished) return;
  finished = true;
  post({ type: "exit", exit: status, detail: detail === undefined ? null : String(detail).slice(0, DETAIL_LIMIT) });
}

function quote(text) {
  return "'" + text.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\n/g, "\\n") + "'";
}

function list(open, close, items, total) {
  if (total > items.length) items.push("... " + (total - items.length) + " more items");
  return items.length === 0 ? open + close : open + " " + items.join(", ") + " " + close;
}

function inspect(value, depth, seen) {
  if (typeof value === "string") return depth === 0 ? value : quote(value);
  if (typeof value === "bigint") return value + "n";
  if (typeof value === "symbol") return value.toString();
  if (typeof value === "function") {
    const name = value.name || "(anonymous)";
    return /^class\b/.test(Function.prototype.toString.call(value)) ? "[class " + name + "]" : "[Function: " + name + "]";
  }
  if (typeof value !== "object" || value === null) return String(value);
  if (value instanceof Error) return describe(value);
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? "Invalid Date" : value.toISOString();
  if (value instanceof RegExp) return String(value);
  if (seen.has(value)) return "[Circular]";
  if (depth > MAX_DEPTH) return Array.isArray(value) ? "[Array]" : "[Object]";
  seen.add(value);
  try {
    const nested = (item) => inspect(item, depth + 1, seen);
    if (Array.isArray(value)) return list("[", "]", value.slice(0, MAX_ITEMS).map(nested), value.length);
    if (ArrayBuffer.isView(value) && typeof value.length === "number") {
      return list(value.constructor.name + "(" + value.length + ") [", "]", Array.from(value.slice(0, MAX_ITEMS), nested), value.length);
    }
    if (value instanceof Map) {
      const entries = Array.from(value).slice(0, MAX_ITEMS).map(([key, item]) => nested(key) + " => " + nested(item));
      return list("Map(" + value.size + ") {", "}", entries, value.size);
    }
    if (value instanceof Set) return list("Set(" + value.size + ") {", "}", Array.from(value).slice(0, MAX_ITEMS).map(nested), value.size);
    const keys = Object.keys(value);
    const name = Object.getPrototypeOf(value)?.constructor?.name;
    const entries = keys.slice(0, MAX_ITEMS).map((key) => (/^[A-Za-z_$][\w$]*$/.test(key) ? key : quote(key)) + ": " + nested(value[key]));
    return list((name && name !== "Object" ? name + " " : "") + "{", "}", entries, keys.length);
  } finally {
    seen.delete(value);
  }
}

function substitute(token, value) {
  if (token === "%s") return typeof value === "string" ? value : inspect(value, 1, new Set());
  if (token === "%d" || token === "%i") return typeof value === "bigint" ? value + "n" : String(token === "%i" ? Math.trunc(Number(value)) : Number(value));
  if (token === "%f") return String(Number.parseFloat(value));
  if (token === "%j") return JSON.stringify(value);
  if (token === "%c") return "";
  return inspect(value, 1, new Set());
}

function format(values) {
  try {
    let rest = values;
    let head = [];
    if (typeof values[0] === "string" && values.length > 1 && values[0].includes("%")) {
      let next = 1;
      head = [values[0].replace(/%[sdifjoOc%]/g, (token) => (token === "%%" ? "%" : next < values.length ? substitute(token, values[next++]) : token))];
      rest = values.slice(next);
    }
    return head.concat(rest.map((value) => inspect(value, 0, new Set()))).join(" ");
  } catch (error) {
    return values.map(String).join(" ");
  }
}

function describe(error) {
  if (!(error instanceof Error)) return inspect(error, 1, new Set());
  const where = /<anonymous>:(\d+):(\d+)/.exec(error.stack || "");
  return error.name + ": " + error.message + (where ? "\n    at line " + (Number(where[1]) - 2) + ":" + where[2] : "");
}

self.addEventListener("error", (event) => {
  event.preventDefault();
  const error = event.error;
  exit("error", error === null || error === undefined ? event.message : "Uncaught " + describe(error));
});

self.addEventListener("unhandledrejection", (event) => {
  event.preventDefault();
  if (event.reason === IDLE) {
    event.stopImmediatePropagation();
    exit("done");
    return;
  }
  exit("error", "Uncaught (in promise) " + describe(event.reason));
});

self.addEventListener("securitypolicyviolation", (event) => {
  write("stderr", "The sandbox blocked " + (event.blockedURI || event.effectiveDirective) + ". " + NO_NETWORK + "\n");
});

async function runJavaScript(code) {
  begin();
  const timers = new Set();
  let pending = 0;
  let mainSettled = false;
  const idle = () => mainSettled && timers.size === 0 && pending === 0;
  // Browsers report each unhandled rejection in a task queued after the
  // microtasks that caused it, from a source that may run after timers. A
  // rejection made once the microtasks drain is reported from that same
  // source after every earlier one, so its report can safely mean "done".
  const settleIfIdle = () => {
    if (!idle()) return;
    nativeSetTimeout(() => {
      if (idle()) nativeReject(IDLE);
    }, 0);
  };
  // Host work resolves from tasks the worker cannot see, so the run counts
  // these APIs the way it counts timers. Other sources, such as MessageChannel
  // or FileReader, end with the run unless the program awaits them. The
  // program gets the derived promise, so a rejection it handles stays handled
  // and one it ignores is still reported.
  const track = (result) => {
    if (!(result instanceof NativePromise)) return result;
    pending += 1;
    return nativeFinally.call(result, () => {
      pending -= 1;
      settleIfIdle();
    });
  };
  const counted = (owner, names) => {
    for (const name of names) {
      const original = owner && owner[name];
      if (typeof original === "function") {
        owner[name] = function (...args) {
          return track(original.apply(this, args));
        };
      }
    }
  };
  counted(self.SubtleCrypto && SubtleCrypto.prototype, ["encrypt", "decrypt", "sign", "verify", "digest", "generateKey", "deriveKey", "deriveBits", "importKey", "exportKey", "wrapKey", "unwrapKey"]);
  counted(WebAssembly, ["compile", "instantiate", "compileStreaming", "instantiateStreaming"]);
  counted(Blob.prototype, ["text", "arrayBuffer", "bytes"]);
  counted(Response.prototype, ["text", "json", "arrayBuffer", "blob", "formData", "bytes"]);
  // WebKit reports a throw from compiled code as "Script error." with no
  // error object, so a timer reports its own.
  const call = (callback, args) => {
    try {
      callback(...args);
    } catch (error) {
      exit("error", "Uncaught " + describe(error));
    }
  };
  self.setTimeout = (callback, delay, ...args) => {
    const id = nativeSetTimeout(() => {
      timers.delete(id);
      call(callback, args);
      settleIfIdle();
    }, delay);
    timers.add(id);
    return id;
  };
  self.setInterval = (callback, delay, ...args) => {
    const id = nativeSetInterval(() => call(callback, args), delay);
    timers.add(id);
    return id;
  };
  self.close = () => exit("done");
  self.clearTimeout = self.clearInterval = (id) => {
    if (!timers.delete(id)) return;
    nativeClearTimeout(id);
    settleIfIdle();
  };
  const toStdout = (...values) => write("stdout", format(values) + "\n");
  const toStderr = (...values) => write("stderr", format(values) + "\n");
  for (const name of ["log", "info", "debug", "dir", "table"]) console[name] = toStdout;
  for (const name of ["error", "warn", "trace"]) console[name] = toStderr;
  console.assert = (condition, ...values) => {
    if (!condition) toStderr("Assertion failed" + (values.length > 0 ? ":" : ""), ...values);
  };
  try {
    const AsyncFunction = (async () => {}).constructor;
    await new AsyncFunction(code)();
  } catch (error) {
    exit("error", "Uncaught " + describe(error));
    return;
  }
  mainSettled = true;
  settleIfIdle();
}

let pyodide = null;
let flushPython = () => {};

function sink(stream) {
  const decoder = new TextDecoder();
  const options = {
    isatty: true,
    write: (bytes) => {
      write(stream, decoder.decode(bytes, { stream: true }));
      return bytes.length;
    },
  };
  return [options, () => write(stream, decoder.decode())];
}

async function bootPython({ indexURL, loaderUrl, moduleUrl, lock, wasm, stdlib }) {
  try {
    const files = new Map([
      [indexURL + "pyodide.asm.wasm", [wasm, "application/wasm"]],
      [indexURL + "python_stdlib.zip", [stdlib, "application/zip"]],
    ]);
    const networkFetch = self.fetch.bind(self);
    self.fetch = (input, init) => {
      const file = files.get(typeof input === "string" ? input : String(input && input.url ? input.url : input));
      return file ? Promise.resolve(new Response(file[0], { headers: { "content-type": file[1] } })) : networkFetch(input, init);
    };
    importScripts(loaderUrl);
    const { default: createPyodideModule } = await import(moduleUrl);
    pyodide = await self.loadPyodide({ indexURL, lockFileContents: lock, createPyodideModule });
    const [stdoutOptions, flushStdout] = sink("stdout");
    const [stderrOptions, flushStderr] = sink("stderr");
    pyodide.setStdout(stdoutOptions);
    pyodide.setStderr(stderrOptions);
    pyodide.setStdin({ stdin: () => null });
    pyodide.runPython("def _cut():\n    import socket\n    def refuse(*args, **kwargs):\n        raise OSError(" + JSON.stringify(NO_NETWORK) + ")\n    socket.create_connection = socket.socket.connect = refuse\n_cut()\ndel _cut");
    flushPython = () => {
      try {
        pyodide.runPython("import sys\nsys.stdout.flush()\nsys.stderr.flush()");
      } catch (error) {}
      flushStdout();
      flushStderr();
    };
    post({ type: "ready" });
  } catch (error) {
    post({ type: "load-failed", detail: "Could not load Python. " + describe(error) });
  }
}

function trimTraceback(text) {
  const lines = text.replace(/\n+$/, "").split("\n");
  const first = lines.findIndex((line) => line.startsWith('  File "<snippet>"'));
  return lines[0].startsWith("Traceback") && first > 1 ? [lines[0]].concat(lines.slice(first)).join("\n") : lines.join("\n");
}

function missingModuleDetail(text) {
  const lines = text.split("\n");
  const at = lines.findLastIndex((line) => line.startsWith("ModuleNotFoundError:"));
  const name = at === -1 ? undefined : /'([^']+)'/.exec(lines[at])?.[1];
  if (name === undefined) return text;
  return lines.slice(0, at).concat("ModuleNotFoundError: No module named '" + name + "'. Packages aren't available in this sandbox.").join("\n");
}

// CPython exits with 0 for None and with the number for an int, which
// includes the bools. Any other value is printed, and the exit code is 1.
const EXIT_CODES = new Map([[undefined, "0"], ["None", "0"], ["False", "0"], ["True", "1"]]);

function systemExitDetail(text) {
  const value = /^SystemExit(?:: (.*))?$/.exec(text.trim().split("\n").pop() || "")?.[1];
  const code = EXIT_CODES.get(value) ?? value;
  if (code === "0") return null;
  return /^-?\d+$/.test(code) ? "Exited with code " + code : code;
}

async function runPython(code) {
  begin();
  try {
    await pyodide.runPythonAsync(code, { filename: "<snippet>" });
    flushPython();
    exit("done");
  } catch (error) {
    flushPython();
    const text = error instanceof Error ? error.message : String(error);
    if (error && error.type === "SystemExit") {
      const detail = systemExitDetail(text);
      if (detail === null) exit("done");
      else exit("error", detail);
      return;
    }
    const traceback = trimTraceback(text);
    exit("error", error && error.type === "ModuleNotFoundError" ? missingModuleDetail(traceback) : traceback);
  }
}

const RUNS = new Map([["javascript", runJavaScript], ["python", runPython]]);

self.addEventListener("message", ({ data }) => {
  if (data.type === "boot") bootPython(data);
  else if (data.type === "run") RUNS.get(data.runtime)(data.code);
});
})();`;

const PYODIDE_FILES = [
  "pyodide.js",
  "pyodide.asm.mjs",
  "pyodide.asm.wasm",
  "python_stdlib.zip",
  "pyodide-lock.json",
];

function frameScript(parentOrigin: string): string {
  const literal = (value: unknown) =>
    JSON.stringify(value).replace(/</g, "\\u003c");
  return `(() => {
"use strict";
const PARENT_ORIGIN = ${literal(parentOrigin)};
const PYODIDE_URL = ${literal(PYODIDE_URL)};
const PYODIDE_FILES = ${literal(PYODIDE_FILES)};
const RUN_TIMEOUT_MS = ${RUN_TIMEOUT_MS};
const LOAD_TIMEOUT_MS = ${LOAD_TIMEOUT_MS};
const FLUSH_INTERVAL_MS = ${FLUSH_INTERVAL_MS};
const OUTPUT_LIMIT_WITH_OVERFLOW_SENTINEL = ${OUTPUT_LIMIT_WITH_OVERFLOW_SENTINEL};
const DETAIL_LIMIT = ${DETAIL_LIMIT};
const WORKER_URL = URL.createObjectURL(new Blob([${literal(WORKER_SCRIPT)}], { type: "text/javascript" }));

const runs = new Map();
const waiting = [];
let spare = null;
let assets = null;

const send = (message) => parent.postMessage(message, PARENT_ORIGIN);

function spawn(onData, onCrash) {
  const worker = new Worker(WORKER_URL);
  worker.onmessage = (event) => onData(event.data);
  worker.onerror = (event) => {
    event.preventDefault();
    onCrash(event.message || "The worker stopped unexpectedly.");
  };
  return worker;
}

function flush(runId) {
  const run = runs.get(runId);
  if (!run) return;
  clearTimeout(run.flushTimer);
  run.flushTimer = 0;
  if (run.pending.length > 0) {
    send({ type: "output", runId, chunks: run.pending });
    run.pending = [];
  }
}

function end(runId, exit, detail) {
  const run = runs.get(runId);
  if (!run) return;
  if (exit !== "stopped") flush(runId);
  runs.delete(runId);
  clearTimeout(run.timer);
  clearTimeout(run.flushTimer);
  if (run.worker) run.worker.terminate();
  const queued = waiting.indexOf(runId);
  if (queued !== -1) waiting.splice(queued, 1);
  if (exit !== "stopped") {
    send({ type: "exit", runId, exit, detail: typeof detail === "string" ? detail.slice(0, DETAIL_LIMIT) : null });
  }
}

function accept(runId, data) {
  const run = runs.get(runId);
  if (!run) return;
  const message = typeof data === "object" && data !== null ? data : {};
  if (message.type === "exit" && (message.exit === "done" || message.exit === "error")) {
    end(runId, message.exit, message.detail);
    return;
  }
  const { stream, text } = message;
  const fits = typeof text === "string" && text !== "" && text.length <= run.budget;
  if (message.type !== "output" || (stream !== "stdout" && stream !== "stderr") || !fits) {
    end(runId, "error", "The program sent a message the runner does not accept.");
    return;
  }
  run.budget -= text.length;
  const last = run.pending[run.pending.length - 1];
  if (last && last.stream === stream) last.text += text;
  else run.pending.push({ stream, text });
  if (!run.flushTimer) run.flushTimer = setTimeout(() => flush(runId), FLUSH_INTERVAL_MS);
}

function start(runId, worker, runtime) {
  const run = runs.get(runId);
  run.worker = worker;
  clearTimeout(run.timer);
  run.timer = setTimeout(() => end(runId, "timed-out"), RUN_TIMEOUT_MS);
  worker.postMessage({ type: "run", runtime, code: run.code });
  send({ type: "started", runId });
}

function startJavaScript(runId) {
  const worker = spawn(
    (data) => accept(runId, data),
    (message) => end(runId, "error", message)
  );
  start(runId, worker, "javascript");
}

function loadAssets() {
  if (!assets) {
    assets = Promise.all(
      PYODIDE_FILES.map(async (name) => {
        const response = await fetch(PYODIDE_URL + name);
        if (!response.ok) throw new Error("Could not download " + name + ".");
        return response.arrayBuffer();
      })
    ).then(([loader, module, wasm, stdlib, lock]) => ({
      loaderUrl: URL.createObjectURL(new Blob([loader], { type: "text/javascript" })),
      moduleUrl: URL.createObjectURL(new Blob([module], { type: "text/javascript" })),
      lock: JSON.parse(new TextDecoder().decode(lock)),
      wasm,
      stdlib,
    }));
    assets.catch(() => {
      assets = null;
    });
  }
  return assets;
}

function failSpare(slot, detail) {
  if (slot === null || spare !== slot) return;
  spare = null;
  slot.worker.terminate();
  for (const runId of waiting.splice(0)) end(runId, "error", detail);
}

function assign() {
  if (!spare || !spare.ready || waiting.length === 0) return;
  const slot = spare;
  spare = null;
  slot.runId = waiting.shift();
  start(slot.runId, slot.worker, "python");
  bootSpare();
}

function bootSpare() {
  if (spare) return;
  const slot = { worker: null, ready: false, runId: null };
  slot.worker = spawn(
    (data) => {
      if (slot.runId !== null) accept(slot.runId, data);
      else if (data && data.type === "ready" && spare === slot) {
        slot.ready = true;
        assign();
      } else failSpare(slot, data && typeof data.detail === "string" ? data.detail : "Python stopped while loading.");
    },
    (message) => {
      if (slot.runId !== null) end(slot.runId, "error", message);
      else failSpare(slot, message);
    }
  );
  spare = slot;
  loadAssets().then(
    (files) => {
      if (spare !== slot) return;
      const wasm = files.wasm.slice(0);
      const stdlib = files.stdlib.slice(0);
      slot.worker.postMessage(
        { type: "boot", indexURL: PYODIDE_URL, loaderUrl: files.loaderUrl, moduleUrl: files.moduleUrl, lock: files.lock, wasm, stdlib },
        [wasm, stdlib]
      );
    },
    (error) => failSpare(slot, "Could not load Python. " + error.message)
  );
}

function startPython(runId) {
  waiting.push(runId);
  bootSpare();
  if (!spare.ready) {
    send({ type: "loading", runId });
    runs.get(runId).timer = setTimeout(() => failSpare(spare, "Python took too long to load."), LOAD_TIMEOUT_MS);
  }
  assign();
}

const STARTERS = new Map([["javascript", startJavaScript], ["python", startPython]]);

addEventListener("message", (event) => {
  if (event.source !== parent || event.origin !== PARENT_ORIGIN) return;
  const message = event.data;
  if (typeof message !== "object" || message === null || typeof message.runId !== "string") return;
  if (message.type === "stop") {
    end(message.runId, "stopped");
    return;
  }
  const starter = STARTERS.get(message.runtime);
  if (message.type !== "run" || !starter || typeof message.code !== "string" || runs.has(message.runId)) return;
  runs.set(message.runId, { worker: null, timer: 0, flushTimer: 0, budget: OUTPUT_LIMIT_WITH_OVERFLOW_SENTINEL, pending: [], code: message.code });
  try {
    starter(message.runId);
  } catch (error) {
    end(message.runId, "error", "Could not start the run. " + (error && error.message ? error.message : String(error)));
  }
});

send({ type: "ready" });
})();`;
}

export function sandboxDocument({
  nonce,
  parentOrigin,
}: {
  nonce: string;
  parentOrigin: string;
}): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${sandboxPolicy(nonce)}"><meta name="referrer" content="no-referrer"></head><body><script nonce="${nonce}">${frameScript(parentOrigin)}</script></body></html>`;
}
