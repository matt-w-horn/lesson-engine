// The durable copy of learner progress. The browser keeps localStorage as its
// fast local cache; this file is what survives a cleared cache. Framework-free
// (like server/grade.ts) so the Hono server and the Vite dev middleware can
// share one implementation.
//
// Security posture, deliberately boring: the API takes no path, id, or filename
// from the client — there is exactly one file and it is resolved here. Traversal
// is not mitigated, it is impossible. Everything written is validated against
// ProgressSchema first, capped in size, and swapped in atomically.
import { mkdir, open, readFile, rename, unlink } from "node:fs/promises";
import { join } from "node:path";
import {
  ProgressSchema,
  type ProgressGetResponse,
  type ProgressPutResponse,
} from "../src/schemas";
import { mergeProgress } from "../src/progress-merge";
import { dataDir } from "./data-dir";

/** Generous for a text-only blob; a runaway autosaved draft cannot fill a disk. */
const MAX_BYTES = 2 * 1024 * 1024;

export function progressFilePath(): string {
  return join(dataDir(), "progress.json");
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function readProgress(): Promise<ProgressGetResponse> {
  const file = progressFilePath();
  let raw: string;
  try {
    raw = await readFile(file, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return { ok: true, progress: null }; // no file yet is not an error
    }
    console.error("[progress] read failed:", err);
    return { ok: false, error: "read_failed" };
  }

  const parsed = ProgressSchema.safeParse(parseJson(raw));
  if (!parsed.success) {
    // Unreadable, or written by a newer version. Preserve it and report "no
    // data" so the client reseeds from localStorage — the same backup-and-reset
    // policy loadInitial() uses for a corrupt localStorage blob. Never delete.
    const backup = join(dataDir(), `progress.corrupt-${Date.now()}.json`);
    await rename(file, backup).catch((err) =>
      console.error("[progress] could not back up unreadable file:", err),
    );
    console.error(`[progress] unreadable file preserved at ${backup}`);
    return { ok: true, progress: null };
  }
  return { ok: true, progress: parsed.data };
}

// Writes run one at a time: two concurrent PUTs must not interleave their
// temp-file creation and rename.
let queue: Promise<unknown> = Promise.resolve();
let tmpCounter = 0;

function serialize<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export async function writeProgress(body: unknown): Promise<ProgressPutResponse> {
  const parsed = ProgressSchema.safeParse(body);
  if (!parsed.success) return { ok: false, error: "bad_request" };
  const incoming = parsed.data;

  return serialize(async () => {
    const current = await readProgress();
    // Monotonic merge, so a stale second tab (or a future second device) can
    // never erase a completion already on disk. `code` still comes from the
    // incoming payload — the client owns the draft it is actively editing.
    const next =
      current.ok && current.progress
        ? mergeProgress(incoming, current.progress)
        : incoming;

    const json = JSON.stringify(next);
    if (Buffer.byteLength(json, "utf8") > MAX_BYTES) {
      return { ok: false, error: "too_large" };
    }

    const dir = dataDir();
    const file = join(dir, "progress.json");
    const tmp = join(dir, `.progress.json.tmp-${process.pid}-${tmpCounter++}`);
    try {
      await mkdir(dir, { recursive: true, mode: 0o700 });
      const fh = await open(tmp, "w", 0o600);
      try {
        await fh.writeFile(json, "utf8");
        await fh.sync(); // durable before the swap
      } finally {
        await fh.close();
      }
      await rename(tmp, file); // same directory, so the swap is atomic
      return { ok: true };
    } catch (err) {
      console.error("[progress] write failed:", err);
      await unlink(tmp).catch(() => {});
      return { ok: false, error: "write_failed" };
    }
  });
}
