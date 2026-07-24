// THE grading module: combines a Python run + deterministic checks + the
// optional invisible AI verdict into one LessonResult, per the decision table
// in the plan. combineResult is pure and is the main unit-test target.
import type {
  AiGrading,
  GradeRequest,
  GradeResponse,
  LessonType,
  Score,
} from "./schemas";

/** One check row as produced by the worker (snippets.py.ts builds it). */
export interface WireCheck {
  name: string;
  passed: boolean;
  message: string;
  hidden: boolean;
}

export interface CheckResult extends WireCheck {
  evaluated: boolean; // false when the learner code failed to run
}

/** Per-type completion policy: which types complete on a successful Run. */
export function completesOnRun(type: LessonType): boolean {
  return type === "read_run";
}

export interface RunOutcome {
  ok: boolean;
  stdout: string;
  figures: string[]; // base64 PNGs
  error: { message: string; traceback: string } | null;
  checks: CheckResult[];
}

export type AiStatus = "pass" | "fail" | "error" | "skipped";

export interface LessonResult {
  ran: boolean;
  runtimeError: { message: string; traceback: string } | null;
  checks: CheckResult[];
  score: Score;
  ai: { mode: AiGrading["mode"]; status: AiStatus } | null;
  passed: boolean;
  /** true when an augment lesson passed only because the grader was unreachable */
  aiSkipped: boolean;
  /** true when a replace lesson could not be graded (offline) — retryable */
  aiUnavailable: boolean;
  /** why the grader call failed, when it did — drives the learner-facing message */
  aiErrorKind?: "not_configured" | "unavailable";
  stdout: string;
  figures: string[];
}

export function combineResult(
  run: RunOutcome,
  ai: { mode: AiGrading["mode"]; status: AiStatus } | null,
): LessonResult {
  const total = run.checks.length;
  const passedCount = run.ok
    ? run.checks.filter((c) => c.passed).length
    : 0; // code that fails to run scores zero
  const base = {
    ran: run.ok,
    runtimeError: run.error,
    checks: run.checks,
    score: { passed: passedCount, total },
    ai,
    stdout: run.stdout,
    figures: run.figures,
    aiSkipped: false,
    aiUnavailable: false,
  };

  if (!run.ok) return { ...base, passed: false };

  const deterministicPass = run.checks.every((c) => c.passed);
  if (!deterministicPass) return { ...base, passed: false }; // AI never overrides a deterministic failure

  if (!ai) return { ...base, passed: true };

  if (ai.mode === "augment") {
    switch (ai.status) {
      case "pass":
        return { ...base, passed: true };
      case "fail":
        return { ...base, passed: false };
      // Grader unreachable: deterministic signal exists, accept degraded.
      case "error":
      case "skipped":
        return { ...base, passed: true, aiSkipped: true };
    }
  }
  // replace: the AI check is the whole grade; no deterministic fallback.
  switch (ai.status) {
    case "pass":
      return { ...base, passed: true };
    case "fail":
      return { ...base, passed: false };
    case "error":
    case "skipped":
      return { ...base, passed: false, aiUnavailable: true };
  }
}

// ---- orchestration ----

export interface GradeDeps {
  runGrade: () => Promise<RunOutcome>;
  callAi: (req: GradeRequest) => Promise<GradeResponse>;
}

export async function gradeLesson(
  opts: {
    lessonId: string;
    title: string;
    type: GradeRequest["context"]["type"];
    code: string;
    entryPoint?: string;
    ai?: AiGrading;
  },
  deps: GradeDeps,
): Promise<LessonResult> {
  const run = await deps.runGrade();
  const declaredAi = opts.ai ?? null;
  if (!declaredAi) return combineResult(run, null);

  const deterministicPass = run.ok && run.checks.every((c) => c.passed);
  // AI runs only when there is nothing deterministic left to fail.
  if (!run.ok || !deterministicPass) {
    return combineResult(run, { mode: declaredAi.mode, status: "skipped" });
  }

  let status: AiStatus;
  let errorKind: LessonResult["aiErrorKind"];
  try {
    const res = await deps.callAi({
      lessonId: opts.lessonId,
      mode: declaredAi.mode,
      criteria: declaredAi.criteria,
      entryPoint: opts.entryPoint,
      code: opts.code,
      context: { title: opts.title, type: opts.type },
      deterministic: {
        passed: run.checks.filter((c) => c.passed).length,
        total: run.checks.length,
      },
    });
    status = res.ok ? res.verdict : "error";
    if (!res.ok) {
      errorKind =
        res.error === "grader_not_configured" ? "not_configured" : "unavailable";
    }
  } catch {
    status = "error";
    errorKind = "unavailable";
  }
  const result = combineResult(run, { mode: declaredAi.mode, status });
  if (status === "error") result.aiErrorKind = errorKind;
  return result;
}

// ---- AI client (the one server call) ----

export async function callGraderApi(req: GradeRequest): Promise<GradeResponse> {
  const controller = new AbortController();
  // Bounded so grading never hangs on a dead server; 20s (plan-recorded
  // revision) leaves room for a slow Opus verdict without stalling the loop.
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const res = await fetch("/api/grade", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(req),
      signal: controller.signal,
    });
    if (!res.ok) {
      // Preserve the server's permanent-vs-transient distinction.
      const body = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      return { ok: false, error: body?.error ?? `http_${res.status}` };
    }
    return (await res.json()) as GradeResponse;
  } finally {
    clearTimeout(timer);
  }
}
