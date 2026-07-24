// Per-lesson state persisted in localStorage; every rollup (unit/course/path
// percentages, EP totals) is derived at render time — no duplicated bookkeeping.
import { signal } from "@preact/signals";
import { ZodError } from "zod";
import {
  ProgressGetResponseSchema,
  ProgressSchema,
  type LessonProgress,
  type Manifest,
  type Progress,
  type ProgressGetResponse,
  type ProgressPutResponse,
  type Score,
} from "./schemas";
import { betterScore, mergeProgress } from "./progress-merge";
import { findCourse, findUnit } from "./content";

const STORAGE_KEY = "lesson-engine.v1";

// Test environments (vitest, node) have no localStorage.
const storage: Pick<Storage, "getItem" | "setItem"> =
  typeof localStorage !== "undefined"
    ? localStorage
    : (() => {
        const m = new Map<string, string>();
        return {
          getItem: (k: string) => m.get(k) ?? null,
          setItem: (k: string, v: string) => void m.set(k, v),
        };
      })();

function loadInitial(): Progress {
  const raw = storage.getItem(STORAGE_KEY);
  if (raw !== null) {
    try {
      return ProgressSchema.parse(JSON.parse(raw));
    } catch {
      // Unreadable or wrong version: back it up and start fresh.
      storage.setItem(`${STORAGE_KEY}.backup-${Date.now()}`, raw);
    }
  }
  return { v: 1, lessons: {} };
}

export const progress = signal<Progress>(loadInitial());

function writeLocal(state: Progress): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// ---- durable server mirror ----
//
// localStorage stays the fast, synchronous source of truth — the signal above
// is still seeded before first paint. The server keeps a copy on disk so that
// clearing the browser cache no longer loses everything. Everything below is
// best-effort: with no server (a statically served build, or offline) the app
// behaves exactly as it did before.

/**
 * The same environment test the storage shim uses. node/vitest has neither
 * localStorage nor a same-origin server, so sync is inert there and the unit
 * tests need no network stubbing.
 */
const canSync = typeof localStorage !== "undefined";
/** Set only when the route is proven absent — never on a transient 5xx. */
let syncDisabled = false;

export interface ProgressTransport {
  get: () => Promise<ProgressGetResponse>;
  put: (state: Progress) => Promise<ProgressPutResponse>;
}

// 5s, unlike the grader's 20s: a local disk write is never slow, and a short
// bound stops a dead server stacking up aborts during draft autosave.
async function withTimeout(
  run: (signal: AbortSignal) => Promise<Response>,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5_000);
  try {
    return await run(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

const fetchTransport: ProgressTransport = {
  async get() {
    const res = await withTimeout((signal) => fetch("/api/progress", { signal }));
    // Validated, not trusted: a generic static host answers this path with
    // index.html and a 200, which must read as "no server", never as data.
    return ProgressGetResponseSchema.parse(await res.json());
  },
  async put(state) {
    const res = await withTimeout((signal) =>
      fetch("/api/progress", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(state),
        signal,
      }),
    );
    return (await res.json()) as ProgressPutResponse;
  },
};

/** Swappable so tests can drive sync without a network. */
export const progressTransport: { current: ProgressTransport } = {
  current: fetchTransport,
};

// A completion should land almost at once; draft autosave is a hot path and can
// wait. Either way each PUT carries the whole document, so coalescing away the
// intermediate states loses nothing.
const SYNC_DELAY = { urgent: 250, draft: 2000 } as const;

let syncTimer: ReturnType<typeof setTimeout> | null = null;
let syncDeadline = 0;
let inFlight = false;
let dirty = false;

function scheduleServerSync(kind: keyof typeof SYNC_DELAY): void {
  if (!canSync || syncDisabled) return;
  if (inFlight) {
    dirty = true;
    return;
  }
  const at = Date.now() + SYNC_DELAY[kind];
  // An armed timer is only ever shortened, so a draft can never delay a
  // completion that is already waiting to go out.
  if (syncTimer && at >= syncDeadline) return;
  if (syncTimer) clearTimeout(syncTimer);
  syncDeadline = at;
  syncTimer = setTimeout(() => void flushServerSync(), SYNC_DELAY[kind]);
}

async function flushServerSync(): Promise<void> {
  if (!canSync || syncDisabled) return;
  if (syncTimer) {
    clearTimeout(syncTimer);
    syncTimer = null;
  }
  if (inFlight) {
    dirty = true;
    return;
  }
  inFlight = true;
  dirty = false;
  try {
    // Snapshot at fire time — updateLessonCode mutates the value in place.
    const res = await progressTransport.current.put(progress.value);
    if (!res.ok) console.warn("[progress] server write failed:", res.error);
  } catch (err) {
    // Transient: localStorage already holds the state, so nothing is lost and
    // the next mutation (or the next boot) re-pushes it.
    console.warn("[progress] could not reach the progress store:", err);
  } finally {
    inFlight = false;
    if (dirty) {
      dirty = false;
      scheduleServerSync("draft");
    }
  }
}

/**
 * Fold the server's copy into ours. Fire-and-forget from boot: never throws,
 * never blocks first paint, never surfaces an error to the UI.
 */
export async function hydrateFromServer(): Promise<void> {
  if (!canSync) return;
  let res: ProgressGetResponse;
  try {
    res = await progressTransport.current.get();
  } catch (err) {
    // Disable only when the route is PROVEN absent: a static host answers
    // this path with index.html (JSON SyntaxError) or some other shape
    // (ZodError). A network failure or timeout is transient — the server may
    // just be restarting — so sync stays armed and the next mutation retries.
    if (err instanceof ZodError || err instanceof SyntaxError) {
      syncDisabled = true;
    }
    return;
  }
  if (!res.ok) {
    console.warn("[progress] server read failed:", res.error);
    return;
  }
  // Read progress.value AFTER the round trip: updateLessonCode mutates it in
  // place, so a draft typed while this was in flight must not be dropped.
  // mergeProgress also canonicalises key order, so compare like with like.
  const canonical = mergeProgress(progress.value, progress.value);
  const merged = res.progress
    ? mergeProgress(progress.value, res.progress)
    : canonical;
  if (JSON.stringify(merged) !== JSON.stringify(canonical)) {
    progress.value = merged; // one signal write — rollups re-render once
    writeLocal(merged);
  }
  // Unconditional: seeds a missing file and heals a stale one.
  void flushServerSync();
}

function persist(next: Progress): void {
  progress.value = next;
  writeLocal(next);
  scheduleServerSync("urgent");
}

/** Lesson ids are unique per path, not globally — records are path-scoped. */
export function progressKey(pathId: string, lessonId: string): string {
  return `${pathId}/${lessonId}`;
}

export function getLessonProgress(
  pathId: string,
  lessonId: string,
): LessonProgress {
  return progress.value.lessons[progressKey(pathId, lessonId)] ?? { attempts: 0 };
}

export function updateLessonProgress(
  pathId: string,
  lessonId: string,
  patch: Partial<LessonProgress>,
): void {
  const cur = getLessonProgress(pathId, lessonId);
  persist({
    ...progress.value,
    lessons: {
      ...progress.value.lessons,
      [progressKey(pathId, lessonId)]: { ...cur, ...patch },
    },
  });
}

/**
 * Autosave the draft code WITHOUT reassigning the progress signal: draft text
 * affects neither EP nor completion, and a signal write here would re-render
 * the whole app (header rollups included) on every debounced keystroke-save.
 */
export function updateLessonCode(
  pathId: string,
  lessonId: string,
  code: string,
): void {
  const state = progress.value;
  const key = progressKey(pathId, lessonId);
  const cur = state.lessons[key] ?? { attempts: 0 };
  state.lessons[key] = { ...cur, code };
  writeLocal(state);
  scheduleServerSync("draft");
}

/** Record a graded attempt; completion is set only on first pass. */
export function recordAttempt(
  pathId: string,
  lessonId: string,
  passed: boolean,
  score: Score | null,
  aiSkipped: boolean,
): void {
  const cur = getLessonProgress(pathId, lessonId);
  // Shared with the merge so "better" is defined exactly once.
  const best = betterScore(cur.bestScore, score ?? undefined);
  updateLessonProgress(pathId, lessonId, {
    attempts: cur.attempts + 1,
    bestScore: best ?? undefined,
    completedAt:
      cur.completedAt ?? (passed ? new Date().toISOString() : undefined),
    aiSkipped: cur.completedAt ? cur.aiSkipped : passed ? aiSkipped : undefined,
  });
}

// ---- derived rollups (pure; unit-tested) ----

export interface Rollup {
  done: number;
  total: number;
  percent: number; // 0..100, rounded
}

// Rollups derive the path scope from the manifest itself (manifest.path.id),
// so their signatures stay one-manifest-in like the lookup helpers.
function rollup(pathId: string, lessonIds: string[], state: Progress): Rollup {
  const done = lessonIds.filter(
    (id) => state.lessons[progressKey(pathId, id)]?.completedAt,
  ).length;
  const total = lessonIds.length;
  return { done, total, percent: total ? Math.round((100 * done) / total) : 0 };
}

export function unitRollup(
  manifest: Manifest,
  courseId: string,
  unitId: string,
  state: Progress,
): Rollup {
  return rollup(
    manifest.path.id,
    findUnit(manifest, courseId, unitId)?.lessons ?? [],
    state,
  );
}

export function courseRollup(
  manifest: Manifest,
  courseId: string,
  state: Progress,
): Rollup {
  const course = findCourse(manifest, courseId);
  return rollup(
    manifest.path.id,
    course?.units.flatMap((u) => u.lessons) ?? [],
    state,
  );
}

export function pathRollup(manifest: Manifest, state: Progress): Rollup {
  return rollup(
    manifest.path.id,
    manifest.path.courses.flatMap((c) => c.units.flatMap((u) => u.lessons)),
    state,
  );
}

/** EP across every path on the shelf. */
export function totalEp(
  manifests: Manifest[],
  state: Progress,
  epPerLesson: number,
): number {
  return manifests.reduce(
    (sum, m) => sum + pathRollup(m, state).done * epPerLesson,
    0,
  );
}
