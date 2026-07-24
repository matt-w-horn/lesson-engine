// Main-thread handle on the Pyodide worker: request/response correlation,
// per-run timeout with terminate + eager respawn, and a warmup() that loads
// Pyodide while the learner is still reading prose.
import { signal } from "@preact/signals";
import type { CheckResult, RunOutcome, WireCheck } from "../grading";

/** Injected at build time from the installed pyodide package's version. */
declare const __PYODIDE_VERSION__: string;

// "failed" is terminal-until-retried: init gave up (fatal error, or repeated
// timeouts hit the respawn cap). It differs from "cold" so the UI can say
// "failed — reload" instead of an eternal "Loading Python…".
export type RuntimeStatus = "cold" | "loading" | "ready" | "restarting" | "failed";
export const runtimeStatus = signal<RuntimeStatus>("cold");

interface Pending {
  resolve: (v: any) => void;
  reject: (e: Error) => void;
  timer: ReturnType<typeof setTimeout> | null;
}

class TimeoutError extends Error {}

interface WorkerResult {
  ok: boolean;
  stdout: string;
  error: { message: string; traceback: string } | null;
  figures: string[];
  checks: WireCheck[];
  evaluated: boolean;
}

class PyRuntime {
  private worker: Worker | null = null;
  private pending = new Map<number, Pending>();
  private nextId = 1;
  private readyPromise: Promise<void> | null = null;
  /** Respawns since the last successful init — caps the crash/retry loop. */
  private respawnsSinceReady = 0;
  private indexURL = "";
  private defaultPackages: string[] = [];
  private timeoutMs = 20_000;

  configure(cfg: { defaultPackages: string[]; timeoutMs: number }): void {
    // Same-origin, always: the interpreter, its wasm, and every package wheel
    // are vendored under public/pyodide by scripts/vendor-pyodide.mjs, so no
    // third party ever serves executable code to a learner. The version comes
    // from the installed npm package (see vite.config.ts), which keeps the
    // path unique per release and therefore safe to cache immutably.
    this.indexURL = `/pyodide/v${__PYODIDE_VERSION__}/`;
    this.defaultPackages = cfg.defaultPackages;
    this.timeoutMs = cfg.timeoutMs;
  }

  warmup(): Promise<void> {
    if (this.readyPromise) return this.readyPromise;
    // cold/failed mean nothing usable was ever up: this is a (re)load, not a
    // restart. Only the eager respawn path arrives here as "restarting".
    runtimeStatus.value =
      runtimeStatus.value === "restarting" ? "restarting" : "loading";
    this.worker = new Worker(new URL("./worker.ts", import.meta.url), {
      type: "module",
    });
    this.worker.onmessage = (e) => this.onMessage(e.data);
    this.worker.onerror = (e) => {
      // A worker-level fault (script/WASM failure) leaves the worker
      // unusable: fail everything pending and rebuild immediately rather
      // than letting the next run discover it via a 20s timeout.
      this.failAll(new Error(`worker error: ${e.message}`));
      this.respawn();
    };
    const ready = this.request<void>(
      {
        type: "init",
        indexURL: this.indexURL,
        packages: this.defaultPackages,
      },
      // Pyodide + numpy cold download can be slow; give init extra room.
      Math.max(this.timeoutMs * 6, 120_000),
    ).then(() => {
      this.respawnsSinceReady = 0;
      runtimeStatus.value = "ready";
    });
    this.readyPromise = ready;
    ready.catch(() => {
      // Only reset if OUR promise is still installed — a respawn may have
      // already replaced it, and clobbering the fresh one spawns a
      // duplicate worker on the next warmup().
      if (this.readyPromise === ready) {
        runtimeStatus.value = "failed";
        this.readyPromise = null;
      }
    });
    return ready;
  }

  async run(code: string, packages: string[]): Promise<RunOutcome> {
    return this.exec({ type: "run", code, packages });
  }

  async grade(
    code: string,
    gradeCode: string,
    packages: string[],
  ): Promise<RunOutcome> {
    return this.exec({ type: "grade", code, gradeCode, packages });
  }

  async format(
    code: string,
  ): Promise<{ ok: boolean; formatted?: string; error?: string }> {
    await this.warmup();
    // The first format micropip-installs black (a few seconds); give it room
    // well beyond a normal run so a slow link does not time out and respawn.
    return this.request(
      { type: "format", code },
      Math.max(this.timeoutMs * 3, 60_000),
    );
  }

  private async exec(msg: Record<string, unknown>): Promise<RunOutcome> {
    await this.warmup();
    const raw = await this.request<WorkerResult>(msg, this.timeoutMs);
    const checks: CheckResult[] = raw.checks.map((c) => ({
      ...c,
      evaluated: raw.evaluated,
    }));
    return {
      ok: raw.ok,
      stdout: raw.stdout,
      error: raw.error,
      figures: raw.figures,
      checks,
    };
  }

  private request<T>(
    msg: Record<string, unknown>,
    timeoutMs: number,
  ): Promise<T> {
    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => this.onTimeout(id), timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.worker!.postMessage({ id, ...msg });
    });
  }

  private onMessage(data: any): void {
    const p = this.pending.get(data.id);
    if (!p) return;
    this.pending.delete(data.id);
    if (p.timer) clearTimeout(p.timer);
    if (data.type === "fatal") {
      p.reject(new Error(data.message));
    } else {
      p.resolve(data.type === "ready" ? undefined : data);
    }
  }

  private onTimeout(id: number): void {
    const p = this.pending.get(id);
    if (!p) return;
    this.pending.delete(id);
    p.reject(
      new TimeoutError(
        "Run timed out — Python was restarted; the next run reloads packages.",
      ),
    );
    this.respawn();
  }

  private failAll(err: Error): void {
    for (const [, p] of this.pending) {
      if (p.timer) clearTimeout(p.timer);
      p.reject(err);
    }
    this.pending.clear();
  }

  private respawn(): void {
    this.worker?.terminate();
    this.worker = null;
    this.failAll(new TimeoutError("Python runtime restarted."));
    this.readyPromise = null;
    // If init itself keeps timing out (CDN unreachable or hung), an eager
    // respawn would loop forever, re-downloading Pyodide with no backoff.
    // Give up after a few consecutive failures; the next lesson navigation
    // calls warmup() and tries again (Run can't — it is disabled while
    // Python isn't ready).
    if (++this.respawnsSinceReady >= 3) {
      runtimeStatus.value = "failed";
      return;
    }
    runtimeStatus.value = "restarting";
    // Eager background respawn so the reload cost hides behind the message.
    void this.warmup().catch(() => {});
  }
}

export const pyRuntime = new PyRuntime();
