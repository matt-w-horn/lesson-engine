---
name: lesson-review
description: Adversarial review of finished lesson-engine lessons — the quality gate before content ships, analogous to code-review. Use whenever a lesson (lesson.md + grade.py) is written or revised and needs checking, when asked to "review the lessons", "check the unit", "audit course content", or before marking any content milestone done. Runs mechanical gates (validator, starter behavior, reference solution vs grader), then audits the knowledge chain, pedagogy, prose, code style, and grader integrity. Report findings; fix only when asked.
---

# Lesson review — the gate before content ships

Review like a skeptical colleague who did not write the lesson: your job is
to find where it fails a real learner, not to admire it. Work through the
gates in order — mechanical first, because a lesson that fails them isn't
ready for judgment calls — and report findings ranked by severity with
file:line.

Inputs: the lesson directory
(`<data-dir>/content/paths/<path-id>/lessons/<lesson-id>/`, where
`<data-dir>` is `$LESSON_ENGINE_DATA_DIR`, default `~/.lesson-engine`), its
ledger row in `<data-dir>/plans/<path-id>/<course-id>.md`, and the
lesson-write references (`writing-craft.md`, `code-style.md`,
`grader-patterns.md`) — the review checks are those rules read as audits.

## Gate 1 — mechanical (run these, don't eyeball them)

1. `npx tsx scripts/validate.ts` from the engine repo — no errors or new
   warnings for the reviewed lessons.
2. `python3 .claude/skills/lesson-review/scripts/qa_check.py <lesson-dir>...`
   — the advisory style pass (task-first shape, sentence length, dashes,
   teasers, grader-message tone). It always exits 0: its output is
   suggestions to weigh with judgment, not failures. Carry forward the ones
   that would slow a learner; drop the ones the lesson earns.
3. **Execute the grader locally** with plain `python3` (numpy installed).
   The harness mirrors the engine's Pyodide contract:

   ```python
   def _close(a, b, tol=1e-9): return abs(a - b) < tol
   def _raises(fn, *args, exc=ValueError):
       try: fn(*args)
       except exc: return True
       except Exception: return False
       return False

   learner_ns = {}
   exec(open("starter.py").read(), learner_ns)      # or solution.py

   grader_ns = {"_close": _close, "_raises": _raises}
   exec(open("grade.py").read(), grader_ns)
   for c in grader_ns["CHECKS"]:
       try: passed = bool(c["fn"](learner_ns))
       except Exception: passed = False
       print(("PASS" if passed else "FAIL"), c["name"], "(hidden)" if c["hidden"] else "")
   ```

   (Extract `starter.py` from the lesson's single ` ```python starter `
   fence; write `solution.py` from the ledger row's reference solution.)
4. Verdicts required:
   - **read_run**: starter runs clean, output readable as prose claims it;
     `CHECKS` is `[]`.
   - **explore/complete/debug**: starter runs without crashing and fails ≥1
     **visible** check. A gradeable lesson with an empty `CHECKS` list and
     no AI grading is a severity-high finding — Submit would pass any code
     that runs.
   - **write**: reference solution defines `entry_point`; starter stub runs.
   - **Reference solution passes every check, hidden included.** If a
     natural numpy variant exists, run it too (the `numpy.bool_`/`is True`
     trap).
5. Frontmatter `id` = directory name; `packages` covers every import; no
   `plt.show()`; runtime under the 20 s budget with margin.
6. Unit shape: units read best at 5–7 lessons. Outside that range is a
   note to raise, not a failure — but past 8, question whether the unit's
   "one idea" is really one.

## Gate 2 — knowledge-chain audit (the known-new contract, enforced)

Walk the prose, starter, check messages, and `predict` line by line. Every
term, math symbol, Python construct, and library call is either (a) in the
course plan's entry knowledge — on the right axis: Python fluency and domain
knowledge are declared separately — (b) in an earlier lesson's `teaches`, or
(c) introduced here by the full protocol: anchored to something known,
defined at first use, bold, then used with that exact name everywhere after.
Entries marked `(inherited: <course-id>)` are legitimate anchors; spot-check
each one the lesson leans on against the named course's exit knowledge in
`<data-dir>/plans/<path-id>/<course-id>.md` — an inherited entry that course
never taught is a finding against the course plan, not the lesson.

Flag as findings: a term used before its introduction (even one appearing
casually in a check message); synonym drift ("window" becoming "span"); a
symbol without name-and-unit; a Python construct the ledger never licensed;
and the inverse failure — paragraphs explaining what the declared audience
already owns (expertise reversal is a finding, not a bonus).

## Gate 3 — pedagogy audit

- **One idea:** the lesson teaches exactly its ledger row's `teaches`;
  anything extra is scope creep (finding), anything missing is a gap.
- **Task-first honesty:** the `:::task` says what to do without motivation
  or explanation; a debug task states symptom and success condition, never
  the change; a predict lesson's task contains no digits (the learner is
  supposed to commit to the number); no lecture paragraphs trail the
  starter fence.
- **Type honesty:** the support level matches the rung — a "complete"
  lesson whose gaps are trivial is a read_run in disguise; a "debug" bug
  that's a typo rather than a misconception teaches proofreading, not the
  model.
- **Predict quality** (read_run/explore): answerable from the prose alone,
  settled unambiguously by the run, and committing (asks for a number or
  direction, not "think about…").
- **Struggle is productive:** check messages and `fail_hint` coach without
  revealing (grader-patterns voice); prose sanity anchors give
  triangulation points, not the fix. A hint that contains the answer is a
  finding; so is a bare "wrong" that coaches nothing.
- **Numbers agree everywhere:** prose, starter, output, checks, and ledger
  tell one number-story; any mismatch is severity-high (it makes the
  checks gaslight the learner).

## Gate 4 — prose and code audits

Prose (writing-craft as a checklist): known-before-new within sentences;
active voice; concrete numbers over vague claims; no noun strings, double
negatives, or wind-up openers; deliberate repetition of the key claim kept,
filler cut; every paragraph changes what the learner predicts, types, or
checks; no claim the checks don't earn ("always", "exactly", "guarantees").

Code (code-style as a checklist): full-word snake_case names (or
prose-defined symbols), constants cased as constants, units beside numbers,
one idea per line, docstrings-as-spec on learner-facing functions, labeled
`print` output, simplest structure the idea needs, grader code held to the
same bar.

## Gate 5 — grader integrity (attack it)

Write the cheats and run them through the harness: hardcoded outputs, the
canonical misconception (the off-by-one, the swapped operands), boundary
`<=` where the spec says `<`, an explore answer typed without running the
model, an explore "solution" that edits the pinned scenario variables
instead of the knob. Each must fail a check or be named in the AI
`criteria`. Also check: visible checks readable top-to-bottom as a to-do
list; explore lessons carry the visible `scenario_pinned` check; hidden
checks only for prose-pinned edges or consistency traps (≤2); `criteria`
enumerates legitimate implementations so correct variety isn't vetoed;
`fail_hint` in hint voice; no `is True`/`is False` comparisons anywhere in
`grade.py` (numpy's `bool_` breaks them — `bool(...)` is the fix).

## Report format

```
## lesson-review: <id>
Verdict: SHIP | FIX (n findings)

1. [high|med|low] <file>:<line> — <what fails a learner, one sentence>
   Fix: <the smallest change that resolves it>
```

Severity: **high** = learner gets stuck or graded wrongly (chain violation,
number mismatch, gameable/leaky grader, starter misbehavior, empty CHECKS on
a gradeable type); **med** = drag (hint leaks, type dishonesty, style
violations that mislead); **low** = polish, including advisory-checklist
observations worth keeping. Findings only — apply fixes when the caller
asks, then re-run every gate the fix could touch (a prose fix can break the
number-story; a grader fix can break the reference solution).
