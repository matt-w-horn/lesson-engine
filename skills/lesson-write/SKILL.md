---
name: lesson-write
description: Write one lesson-engine lesson — the lesson.md (frontmatter, task, explanation, starter code) and grade.py (deterministic checks, optional AI criteria) pair — to the engine's exact file contract and the course plan's ledger row. Use whenever writing or substantially revising lesson content, starter code, predict prompts, check messages, or graders for lesson-engine, including "write the X lesson", "add a debug lesson", "fix this lesson's wording", "the grader for X is wrong". Read references/writing-craft.md before writing any prose and references/grader-patterns.md before writing any grade.py.
---

# Lesson write — one lesson, two files

A lesson is a directory
`<data-dir>/content/paths/<path-id>/lessons/<lesson-id>/` holding `lesson.md`
and `grade.py` (`<data-dir>` is `$LESSON_ENGINE_DATA_DIR`, default
`~/.lesson-engine`). Its input is one ledger row from the course plan
(`<data-dir>/plans/<path-id>/<course-id>.md`): objective, assumes, teaches,
scenario beat, predict idea. If no row exists, stop and run unit-design
first — a lesson without a row has no defined audience knowledge to write
against. The app serves the data dir live: save, reload the browser, see the
lesson.

Three reference files carry the craft; read them at the point of need:
- **`references/writing-craft.md`** — the lesson shape, the quality
  checklist, the known-new contract, term introduction, what "concise" means
  when repetition is pedagogical. Read before writing prose.
- **`references/code-style.md`** — how lesson Python must read (distilled
  PEP 8 for learners: full-word names, constants, units-in-comments,
  constructs limited to the ledger's `assumes`). Read before writing any
  starter or reference solution — learners imitate the code more than the
  prose.
- **`references/grader-patterns.md`** — CHECKS anatomy, hint-message voice,
  hidden checks, AI criteria that resist hardcoding. Read before writing
  grade.py.

## The file contract (the validator enforces most of this)

`lesson.md` = YAML frontmatter + markdown body + **exactly one** fenced block
tagged ` ```python starter ` (the code the editor opens with). The schema
(`src/schemas.ts`, strict — unknown keys fail validation):

| Field | Required | Notes |
|---|---|---|
| `id` | yes | kebab-case, must equal the directory name |
| `title` | yes | learner-facing; name the payoff, not the topic ("Trim the noise with one slice", not "Slicing practice") |
| `type` | yes | `read_run` \| `explore` \| `complete` \| `debug` \| `write` |
| `predict` | no | the commit-before-running question; expected for read_run and explore |
| `packages` | no | extra Pyodide packages beyond config's `default_packages`; allowlist: numpy, scipy, sympy, matplotlib |
| `entry_point` | no | function name, for write lessons graded through a function |
| `est_minutes` | no | only when the type default in config.yaml is wrong for this lesson |
| `grading.ai` | no | `{mode: augment\|replace, criteria, fail_hint}` — see grader-patterns |

The body is the **task-first shape**: a `:::task` container (what to do —
short, imperative, no explanation), then a `:::why <label>` container holding
the whole explanation, then the starter fence. The engine renders the task as
an always-visible card and the why as a collapsed disclosure, so the learner
meets the task and the code before any prose. Write this shape from the
first draft — prose drafted lecture-first (paragraphs of build-up, then the
code, then interpretation) does not survive conversion; it has to be
rewritten, not rearranged. `references/writing-craft.md` §0 has the rules per
container, including the debug rule (symptom and success condition, never
the fix) and the predict rule (no digits in the task); §1 is the advisory
quality checklist to write against from the first draft.

Markdown supports KaTeX math (`$...$`, `$$...$$`) and ` ```mermaid `
diagrams (use one for any system with more than two boxes — a diagram is
cheaper to parse than a paragraph of topology). Raw HTML is disabled;
`:::task` and `:::why` are the only containers. Never wrap math in backticks
— `` `$x$` `` renders the TeX source at the learner.

`grade.py` defines a top-level `CHECKS` list; each check's `fn` receives the
learner's namespace dict after their code ran. Helpers `_close(a, b,
tol=1e-9)` and `_raises(fn, *args, exc=ValueError)` are injected — use them,
never redefine them. Full anatomy and patterns:
`references/grader-patterns.md`.

Runtime constraints the code must live within: Pyodide in a worker — no
network, no filesystem, 20 s timeout, matplotlib renders to captured PNGs
(never call `plt.show()`; just create the figure).

## Per-type recipes

**read_run** — a worked example. The starter must run clean *exactly as
shipped*, because a successful Run completes the lesson (the engine's
`completesOnRun` policy). `CHECKS = []` is correct here — there is nothing
to submit. The why-block builds the idea from the ledger's `assumes`; the
starter demonstrates it with printed, labeled numbers. `predict` is
near-mandatory: ask for a number or a direction, so running the code
confirms or corrects a commitment — that gap is where the learning happens.

**explore** — the starter is a working model with one variable marked for
the learner to change (`# <- raise this until the check passes`). The task
must have a checkable target (a maximal value, a threshold crossing). Grade
the learner's final namespace: the target variable's value, a visible
`scenario_pinned` check that the fixed scenario variables are unchanged
(otherwise editing the scenario instead of the knob "solves" the lesson),
plus a hidden consistency check on a derived quantity so typing the answer
without running the model still fails.

**complete** — working code with 1–3 `...` gaps at exactly the load-bearing
lines; everything incidental is written for them. Keep docstrings on the
gapped functions — they are the spec. Prose states the task and pins edge
cases ("an empty list means there is nothing to trim; return it unchanged").
Checks: the gapped behavior on the scenario's numbers, plus an edge case
visible and one hidden.

**debug** — shipped code contains one seeded bug that reproduces a
*realistic misconception* (believing a slice includes its end index is a
real learner error; a misspelled variable is a typo — typos teach
proofreading, misconception-bugs teach the model). Prose frames the symptom:
observed-vs-expected output, plus sanity anchors (small cases with known
answers) so the learner can triangulate. The starter must run without
crashing — the bug is wrong output, not a syntax error. Checks target the
anchors.

**write** — a spec and an empty (or signature-only) starter. The spec pins
the callable name (put it in `entry_point`), argument meanings with units,
return shape ("a dict with exactly these keys"), and edge cases as behavior
("an empty list raises ValueError"). Deterministic checks cover the spec's
cases plus hidden boundary and empty cases; `grading.ai` (mode `augment`)
catches what tests can't — hardcoded outputs, special-cased inputs. Close
the prose with what the built thing is *for* ("run it on the numbers from
the last three lessons").

## Order of work

1. Read the ledger row, and the lesson.md of the rung above (its vocabulary
   is your known baseline — reuse its exact terms and numbers).
2. Write the **reference solution** first, into the row. It forces the spec
   to be precise before any prose exists, and review needs it.
3. Write `grade.py` against the reference solution (grader-patterns).
4. Write the starter by removing exactly the support this rung withholds.
5. Write the prose last (writing-craft), then the `predict` and title.
6. Self-check before handing to lesson-review:
   - `npx tsx scripts/validate.ts` from the engine repo — clean.
   - Run the starter with plain `python3`: read_run runs clean; other types
     run (or, for write, define the stub) and fail ≥1 visible check.
   - Run the reference solution against `grade.py` — every check passes,
     hidden included (harness snippet: see lesson-review's SKILL.md).
   - Every term the lesson uses traces to the row's `assumes` or is
     introduced by the term protocol in writing-craft.
   - Walk the quality checklist (writing-craft §1) — it is advisory, but
     each item earned its place by failing in practice. Optionally run
     `python3 .claude/skills/lesson-review/scripts/qa_check.py <lesson-dir>`
     for a mechanical read of the same list; treat its output as
     suggestions.

Never mark the lesson done without a lesson-review pass — self-checks catch
mechanical breakage, not blind spots.
