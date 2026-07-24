// Grade results: per-check rows (hidden rows redacted), score, and the
// "requirements review" row that renders an invisible-AI failure exactly like
// another hidden check — the check texts are authored data; the header line
// is app copy varied per lesson (feedback.ts).
import type { LessonResult } from "../grading";
import { FAIL_LINES, PASS_LINES, pickLine } from "./feedback";

export function Results({
  result,
  lessonId,
  failHint,
}: {
  result: LessonResult;
  lessonId: string;
  failHint?: string;
}) {
  const { checks, score, passed, ai } = result;
  const notEvaluated = !result.ran;
  return (
    <div class={`results ${passed ? "results-pass" : "results-fail"}`}>
      <div class="results-header">
        {passed
          ? pickLine(PASS_LINES, lessonId)
          : notEvaluated
            ? "Did not run"
            : pickLine(FAIL_LINES, lessonId)}
        {score.total > 0 && (
          <span class="results-score">
            {score.passed}/{score.total} checks
          </span>
        )}
      </div>
      <ul class="check-list">
        {checks.map((c, i) => (
          <li
            key={i}
            class={`check-row ${
              notEvaluated ? "check-skip" : c.passed ? "check-pass" : "check-fail"
            }`}
          >
            <span class="check-icon">
              {notEvaluated ? "•" : c.passed ? "✓" : "✗"}
            </span>
            {c.hidden ? (
              <span class="check-text">
                Hidden check —{" "}
                {notEvaluated ? "not evaluated" : c.passed ? "passed" : "failed"}
              </span>
            ) : (
              <span class="check-text">
                {c.name.replace(/_/g, " ")}
                {notEvaluated
                  ? " — not evaluated"
                  : !c.passed && c.message
                    ? ` — ${c.message}`
                    : ""}
              </span>
            )}
          </li>
        ))}
        {ai && ai.status === "fail" && (
          <li class="check-row check-fail">
            <span class="check-icon">✗</span>
            <span class="check-text">
              Requirements review — not passed.{" "}
              {failHint ??
                "All visible checks pass, but the solution doesn't meet every requirement. Re-read the task and pay attention to how it asks you to implement it."}
            </span>
          </li>
        )}
        {ai && ai.status === "pass" && (
          <li class="check-row check-pass">
            <span class="check-icon">✓</span>
            <span class="check-text">Requirements review — passed.</span>
          </li>
        )}
      </ul>
      {result.aiSkipped && (
        <p class="results-note">
          {result.aiErrorKind === "not_configured"
            ? "Full review skipped — the grader isn't configured (set ANTHROPIC_API_KEY in lesson-engine/.env). Accepted on the visible checks."
            : "Full review unavailable right now — accepted on the visible checks."}
        </p>
      )}
      {result.aiUnavailable && (
        <p class="results-note">
          {result.aiErrorKind === "not_configured"
            ? "This lesson needs the AI grader, which isn't configured — set ANTHROPIC_API_KEY in lesson-engine/.env and restart the server."
            : "Grading is temporarily unavailable — try again in a moment."}
        </p>
      )}
    </div>
  );
}
