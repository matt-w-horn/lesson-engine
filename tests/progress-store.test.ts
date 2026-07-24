import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  progressFilePath,
  readProgress,
  writeProgress,
} from "../server/progress-store";
import type { Progress } from "../src/schemas";

// Every case runs against a throwaway data dir — the point of the
// LESSON_ENGINE_DATA_DIR override.
let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "lesson-engine-progress-"));
  process.env.LESSON_ENGINE_DATA_DIR = dir;
});

afterEach(() => {
  delete process.env.LESSON_ENGINE_DATA_DIR;
});

const lesson = (completedAt: string): Progress["lessons"][string] => ({
  attempts: 1,
  completedAt,
});

const DONE = "2026-07-22T00:00:00.000Z";

describe("readProgress", () => {
  it("reports no data rather than an error before anything is written", async () => {
    expect(await readProgress()).toEqual({ ok: true, progress: null });
  });

  it("round-trips a written blob", async () => {
    const state: Progress = { v: 1, lessons: { "p/a": lesson(DONE) } };
    expect(await writeProgress(state)).toEqual({ ok: true });
    expect(await readProgress()).toEqual({ ok: true, progress: state });
  });

  it("preserves an unreadable file and reports no data, so the client reseeds", async () => {
    await writeFile(progressFilePath(), "not json", "utf8");

    expect(await readProgress()).toEqual({ ok: true, progress: null });

    const backups = (await readdir(dir)).filter((f) =>
      f.startsWith("progress.corrupt-"),
    );
    expect(backups).toHaveLength(1);
    expect(await readFile(join(dir, backups[0]), "utf8")).toBe("not json");
  });
});

describe("writeProgress", () => {
  it("rejects a body that is not valid progress, leaving the file untouched", async () => {
    const good: Progress = { v: 1, lessons: { "p/a": lesson(DONE) } };
    await writeProgress(good);

    expect(await writeProgress({ nope: true })).toEqual({
      ok: false,
      error: "bad_request",
    });
    expect(await readProgress()).toEqual({ ok: true, progress: good });
  });

  it("merges rather than replaces, so a stale writer cannot erase a completion", async () => {
    await writeProgress({ v: 1, lessons: { "p/a": lesson(DONE) } });
    // A writer that only knows about lesson B — as a second tab would be.
    await writeProgress({ v: 1, lessons: { "p/b": { attempts: 4 } } });

    const res = await readProgress();
    if (!res.ok || !res.progress) throw new Error("expected progress on disk");
    expect(res.progress.lessons["p/a"].completedAt).toBe(DONE);
    expect(res.progress.lessons["p/b"].attempts).toBe(4);
  });

  it("keeps the file valid under concurrent writes and leaves no temp litter", async () => {
    await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        writeProgress({ v: 1, lessons: { [`p/l${i}`]: { attempts: i } } }),
      ),
    );

    const raw = await readFile(progressFilePath(), "utf8");
    const parsed = JSON.parse(raw) as Progress; // must not be truncated
    // Union semantics mean every concurrent write survives.
    expect(Object.keys(parsed.lessons)).toHaveLength(20);

    const leftovers = (await readdir(dir)).filter((f) => f.includes(".tmp-"));
    expect(leftovers).toEqual([]);
  });

  it("writes the file owner-only", async () => {
    await writeProgress({ v: 1, lessons: {} });
    const mode = (await stat(progressFilePath())).mode & 0o777;
    expect(mode).toBe(0o600);
  });
});
