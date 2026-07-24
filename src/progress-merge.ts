// Merging two progress snapshots — used when the browser hydrates from the
// server's copy, and again when the server folds an incoming write into the
// file already on disk. Deliberately free of `@preact/signals` and `./content`
// so `server/` can import it; `src/progress.ts` cannot be imported server-side.
//
// Every field except `code` is monotonic: a completion is never lost and a
// counter never goes backwards. That makes the merge idempotent, commutative
// and associative — merging in any order, any number of times, lands on the
// same result — which is what makes it safe to run on every boot and on every
// write, and what lets two devices converge without coordinating.
import type { LessonProgress, Progress, Score } from "./schemas";

/**
 * The better of two scores: higher passed/total ratio wins, ties broken by the
 * higher absolute `passed`. `Math.max(1, total)` guards a zero-check lesson.
 */
export function betterScore(a?: Score, b?: Score): Score | undefined {
  if (!a) return b;
  if (!b) return a;
  const ra = a.passed / Math.max(1, a.total);
  const rb = b.passed / Math.max(1, b.total);
  if (ra !== rb) return ra > rb ? a : b;
  return b.passed > a.passed ? b : a;
}

/** The earlier of two ISO timestamps — the real first pass. */
function earlier(a?: string, b?: string): string | undefined {
  if (!a) return b;
  if (!b) return a;
  const ta = Date.parse(a);
  const tb = Date.parse(b);
  // Both sides come from `new Date().toISOString()`, so lexicographic order
  // already matches chronological order; only fall back to it if parsing fails.
  if (Number.isNaN(ta) || Number.isNaN(tb)) return a < b ? a : b;
  return ta <= tb ? a : b;
}

/**
 * `aiSkipped` describes the completion event, so it travels with whichever
 * `completedAt` won (cf. `recordAttempt` in progress.ts). When both sides carry
 * the same timestamp, "skipped" survives only if both agree: a genuinely
 * AI-verified completion must never be downgraded, and AND stays commutative.
 */
function mergeAiSkipped(
  local: LessonProgress,
  server: LessonProgress,
  completedAt: string | undefined,
): boolean | undefined {
  if (completedAt === undefined) return undefined;
  if (local.completedAt === undefined) return server.aiSkipped;
  if (server.completedAt === undefined) return local.aiSkipped;
  if (local.completedAt !== server.completedAt) {
    return completedAt === local.completedAt ? local.aiSkipped : server.aiSkipped;
  }
  if (local.aiSkipped === undefined && server.aiSkipped === undefined) {
    return undefined;
  }
  return (local.aiSkipped ?? false) && (server.aiSkipped ?? false);
}

/**
 * Field-wise merge of one lesson's record. A missing side is treated as a fresh
 * record, so this doubles as the "only one side has it" case — and every result
 * is built through the same shape, keeping the output canonical.
 */
export function mergeLessonProgress(
  local: LessonProgress | undefined,
  server: LessonProgress | undefined,
): LessonProgress {
  const l = local ?? { attempts: 0 };
  const s = server ?? { attempts: 0 };
  const completedAt = earlier(l.completedAt, s.completedAt);
  return {
    attempts: Math.max(l.attempts, s.attempts),
    completedAt,
    bestScore: betterScore(l.bestScore, s.bestScore),
    aiSkipped: mergeAiSkipped(l, s, completedAt),
    // The one non-monotonic field. The local draft is what the learner is
    // editing right now, so it wins; the server's copy only resurfaces when
    // there is no local one — exactly the cache-clear recovery case.
    code: l.code ?? s.code,
  };
}

/**
 * Union of both snapshots' lessons. Keys are sorted so the result is canonical:
 * the on-disk file stays diff-friendly, and two merges can be compared by their
 * serialized form without key order producing a phantom difference.
 */
export function mergeProgress(local: Progress, server: Progress): Progress {
  const keys = [
    ...new Set([...Object.keys(local.lessons), ...Object.keys(server.lessons)]),
  ].sort();
  const lessons: Record<string, LessonProgress> = {};
  for (const key of keys) {
    lessons[key] = mergeLessonProgress(local.lessons[key], server.lessons[key]);
  }
  return { v: 1, lessons };
}
