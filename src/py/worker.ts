// Web Worker that hosts Pyodide. Each run executes in a fresh namespace;
// stdout, exceptions, figures, and check results are shipped back as one
// structured message. Terminated (and respawned by runtime.ts) on timeout.
/// <reference lib="webworker" />
import { PY_HELPERS, PY_INIT } from "./snippets.py";
import type { WireCheck } from "../grading";

interface InitMsg {
  id: number;
  type: "init";
  indexURL: string;
  packages: string[];
}
interface RunMsg {
  id: number;
  type: "run" | "grade";
  code: string;
  gradeCode?: string;
  packages: string[];
}
interface FormatMsg {
  id: number;
  type: "format";
  code: string;
}
type InMsg = InitMsg | RunMsg | FormatMsg;

type RawCheck = Omit<WireCheck, "passed"> & { passed?: boolean };

let pyodide: any = null;
let savedIndexURL = "";
let blackReady = false;
// Helper callables bound ONCE at init (a fresh PyProxy per run would leak).
let fnCaptureFigures: any = null;
let fnDiscardFigures: any = null;
let fnDescribeChecks: any = null;
let fnRunChecks: any = null;
let fnFlushStreams: any = null;
let fnFormatCode: any = null;

async function ensurePyodide(indexURL: string, packages: string[]) {
  if (!pyodide) {
    if (!indexURL) throw new Error("worker not initialized (no indexURL)");
    savedIndexURL = indexURL;
    const mod = await import(/* @vite-ignore */ `${indexURL}pyodide.mjs`);
    pyodide = await mod.loadPyodide({ indexURL });
    pyodide.runPython(PY_INIT);
    const helpers = pyodide.toPy({ __name__: "__helpers__" });
    pyodide.runPython(PY_HELPERS, { globals: helpers });
    fnCaptureFigures = helpers.get("_capture_figures");
    fnDiscardFigures = helpers.get("_discard_figures");
    fnDescribeChecks = helpers.get("_describe_checks");
    fnRunChecks = helpers.get("_run_checks");
    fnFlushStreams = helpers.get("_flush_streams");
    fnFormatCode = helpers.get("_format_code");
  }
  if (packages.length > 0) {
    await pyodide.loadPackage(packages, {
      messageCallback: () => {},
      errorCallback: () => {},
    });
  }
}

async function ensureBlack() {
  if (blackReady) return;
  // black is a PyPI package rather than part of the Pyodide distribution, so
  // it is vendored as wheels alongside the interpreter and installed from
  // there — micropip must never reach PyPI while a learner is working. The
  // manifest names them because the filenames carry versions; deps:false is
  // correct because the vendor step already resolved the dependency set.
  const manifest: string[] = await fetch(`${savedIndexURL}wheels/wheels.json`)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
    .catch(() => {
      throw new Error(
        "the formatter is not installed — run `npm run vendor:pyodide`",
      );
    });
  await pyodide.loadPackage("micropip");
  const micropip = pyodide.pyimport("micropip");
  try {
    await micropip.install(
      manifest.map((file) => `${savedIndexURL}wheels/${file}`),
      { deps: false },
    );
  } finally {
    micropip.destroy();
  }
  blackReady = true;
}

function trimTraceback(raw: string): string {
  const idx = raw.indexOf('File "<exec>"');
  if (idx === -1) return raw;
  const lineStart = raw.lastIndexOf("\n", idx);
  return (
    "Traceback (most recent call last):\n" + raw.slice(lineStart + 1)
  ).trimEnd();
}

function lastErrorLine(raw: string): string {
  const lines = raw.trimEnd().split("\n");
  return lines[lines.length - 1] ?? "Error";
}

self.onmessage = async (e: MessageEvent<InMsg>) => {
  const msg = e.data;
  try {
    if (msg.type === "init") {
      await ensurePyodide(msg.indexURL, msg.packages);
      self.postMessage({ id: msg.id, type: "ready" });
      return;
    }

    if (msg.type === "format") {
      await ensurePyodide(savedIndexURL, []);
      await ensureBlack();
      // _format_code returns {ok, formatted} or {ok:false, error} as JSON — a
      // learner syntax error is data, not a thrown exception.
      const res = JSON.parse(fnFormatCode(msg.code));
      self.postMessage({ id: msg.id, type: "format", ...res });
      return;
    }

    await ensurePyodide(savedIndexURL, msg.packages);

    // Capture raw bytes rather than pyodide's `batched` line callback. Batched
    // mode only emits on a newline, so `print(..., end="")` left a partial
    // line in its buffer: lost from this run, then prepended to the next one's
    // output. Writing through a decoder keeps every byte the program produced,
    // newline-terminated or not.
    const decoder = new TextDecoder();
    let out = "";
    const sink = {
      write: (buf: Uint8Array): number => {
        out += decoder.decode(buf, { stream: true });
        return buf.length;
      },
    };
    pyodide.setStdout(sink);
    pyodide.setStderr(sink);

    const ns = pyodide.toPy({ __name__: "__main__" });
    let error: { message: string; traceback: string } | null = null;
    try {
      pyodide.runPython(msg.code, { globals: ns });
    } catch (err: any) {
      const raw = String(err?.message ?? err);
      error = { message: lastErrorLine(raw), traceback: trimTraceback(raw) };
    }

    let figures: string[] = [];
    if (!error) {
      try {
        figures = JSON.parse(fnCaptureFigures());
      } catch {
        figures = [];
      }
    } else {
      // Close any figures the failed run left open, or they'd appear as
      // phantom images attached to the next successful run.
      try {
        fnDiscardFigures();
      } catch {
        /* nothing to discard */
      }
    }

    let checks: RawCheck[] = [];
    if (msg.type === "grade" && msg.gradeCode) {
      try {
        if (error) {
          // Learner code failed: report the check roster, none evaluated.
          checks = JSON.parse(fnDescribeChecks(msg.gradeCode));
          checks = checks.map((c) => ({ ...c, passed: false }));
        } else {
          checks = JSON.parse(fnRunChecks(msg.gradeCode, ns));
        }
      } catch (err: any) {
        // grade.py itself is broken — an authoring error, surface loudly.
        const raw = String(err?.message ?? err);
        error = error ?? {
          message: `grade.py error: ${lastErrorLine(raw)}`,
          traceback: trimTraceback(raw),
        };
      }
    }

    // Last Python of the run: push anything still held in Python's own
    // TextIOWrapper down to the sink above, so a trailing
    // print(..., end="") lands in THIS run's stdout.
    try {
      fnFlushStreams();
    } catch {
      /* a broken stream must not sink an otherwise good run */
    }
    out += decoder.decode(); // flush a split multi-byte character, if any

    ns.destroy();
    self.postMessage({
      id: msg.id,
      type: "result",
      ok: error === null,
      stdout: out.replace(/\n$/, ""), // the console adds its own trailing space

      error,
      figures,
      checks,
      evaluated: error === null,
    });
  } catch (err: any) {
    self.postMessage({
      id: msg.id,
      type: "fatal",
      message: String(err?.message ?? err),
    });
  }
};
