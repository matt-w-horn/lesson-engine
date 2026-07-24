import { describe, expect, it } from "vitest";
import {
  combineResult,
  gradeLesson,
  type CheckResult,
  type RunOutcome,
} from "../src/grading";
import type { GradeRequest, GradeResponse } from "../src/schemas";

const check = (passed: boolean, hidden = false): CheckResult => ({
  name: "c",
  passed,
  message: "m",
  hidden,
  evaluated: true,
});

const okRun = (checks: CheckResult[]): RunOutcome => ({
  ok: true,
  stdout: "",
  figures: [],
  error: null,
  checks,
});

const failedRun = (checks: CheckResult[]): RunOutcome => ({
  ok: false,
  stdout: "",
  figures: [],
  error: { message: "SyntaxError", traceback: "tb" },
  checks: checks.map((c) => ({ ...c, passed: false, evaluated: false })),
});

describe("combineResult decision table", () => {
  it("code that fails to run scores zero with the error surfaced", () => {
    const r = combineResult(failedRun([check(true), check(true)]), null);
    expect(r.passed).toBe(false);
    expect(r.score).toEqual({ passed: 0, total: 2 });
    expect(r.runtimeError?.message).toBe("SyntaxError");
  });

  it("a deterministic failure fails, hidden checks count toward the score", () => {
    const r = combineResult(okRun([check(true), check(false, true)]), null);
    expect(r.passed).toBe(false);
    expect(r.score).toEqual({ passed: 1, total: 2 });
  });

  it("all deterministic pass, no AI -> pass", () => {
    const r = combineResult(okRun([check(true), check(true)]), null);
    expect(r.passed).toBe(true);
  });

  it("augment: AI fail overrides a deterministic pass", () => {
    const r = combineResult(okRun([check(true)]), {
      mode: "augment",
      status: "fail",
    });
    expect(r.passed).toBe(false);
  });

  it("augment: AI error degrades to accept with aiSkipped", () => {
    const r = combineResult(okRun([check(true)]), {
      mode: "augment",
      status: "error",
    });
    expect(r.passed).toBe(true);
    expect(r.aiSkipped).toBe(true);
  });

  it("replace: AI is the whole grade", () => {
    expect(
      combineResult(okRun([]), { mode: "replace", status: "pass" }).passed,
    ).toBe(true);
    expect(
      combineResult(okRun([]), { mode: "replace", status: "fail" }).passed,
    ).toBe(false);
  });

  it("replace: AI error is retryable, not a pass", () => {
    const r = combineResult(okRun([]), { mode: "replace", status: "error" });
    expect(r.passed).toBe(false);
    expect(r.aiUnavailable).toBe(true);
  });

  it("replace: a run failure is still a hard zero (AI never overrides)", () => {
    const r = combineResult(failedRun([]), {
      mode: "replace",
      status: "skipped",
    });
    expect(r.passed).toBe(false);
  });
});

describe("gradeLesson orchestration", () => {
  const base = {
    lessonId: "x",
    title: "X",
    type: "write" as const,
    code: "code",
  };

  it("never calls the AI when a deterministic check fails", async () => {
    let called = 0;
    const r = await gradeLesson(
      { ...base, ai: { mode: "augment", criteria: "c" } },
      {
        runGrade: async () => okRun([check(false)]),
        callAi: async () => {
          called++;
          return { ok: true, verdict: "pass" };
        },
      },
    );
    expect(called).toBe(0);
    expect(r.passed).toBe(false);
  });

  it("calls the AI with the deterministic score when all checks pass", async () => {
    let seen: GradeRequest | null = null;
    const r = await gradeLesson(
      { ...base, ai: { mode: "augment", criteria: "no hardcoding" } },
      {
        runGrade: async () => okRun([check(true), check(true, true)]),
        callAi: async (req) => {
          seen = req;
          return { ok: true, verdict: "fail" };
        },
      },
    );
    expect(seen!.deterministic).toEqual({ passed: 2, total: 2 });
    expect(seen!.criteria).toBe("no hardcoding");
    expect(r.passed).toBe(false);
    expect(r.ai).toEqual({ mode: "augment", status: "fail" });
  });

  it("a thrown AI call degrades augment lessons instead of failing them", async () => {
    const r = await gradeLesson(
      { ...base, ai: { mode: "augment", criteria: "c" } },
      {
        runGrade: async () => okRun([check(true)]),
        callAi: async () => {
          throw new Error("network down");
        },
      },
    );
    expect(r.passed).toBe(true);
    expect(r.aiSkipped).toBe(true);
  });

  it("a non-ok grader response leaves replace lessons incomplete", async () => {
    const offline: GradeResponse = { ok: false, error: "anthropic_unavailable" };
    const r = await gradeLesson(
      { ...base, ai: { mode: "replace", criteria: "c" } },
      {
        runGrade: async () => okRun([]),
        callAi: async () => offline,
      },
    );
    expect(r.passed).toBe(false);
    expect(r.aiUnavailable).toBe(true);
  });
});
