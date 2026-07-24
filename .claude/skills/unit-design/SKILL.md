---
name: unit-design
description: Turn one course-plan unit into the lesson-engine practice ladder — choosing which of the five practice types (read_run, explore, complete, debug, write) the unit gets, and writing the per-lesson objectives and assumes/teaches rows that lesson-write consumes. Use whenever designing or revising a unit, deciding how many lessons an idea needs, sequencing practice types, or asked "plan the lessons for X" / "what practices should this unit have". Requires the course plan from course-design; produces the rows lesson-write needs.
---

# Unit design — one idea, drilled up the ladder

A unit takes the single idea the course plan assigned it and drills it through
a fixed sequence of practice types with **support fading each step**. The
learner meets the idea inside a worked example, then loses one piece of
scaffolding per lesson until they build the thing alone. This is the
worked-example effect operationalized: novices learn more from studying and
varying a solution than from unaided problem-solving, and the fade is what
turns that studied solution into independent skill.

The output is a set of per-lesson rows appended to the unit's section of
`<data-dir>/plans/<path-id>/<course-id>.md` (`<data-dir>` is
`$LESSON_ENGINE_DATA_DIR`, default `~/.lesson-engine`), plus the unit's
lesson list in the path's `manifest.yaml`. A row's `assumes` may trace to
inherited entry knowledge (entries marked `(inherited: <course-id>)` in the
course plan) — those count as known exactly like native entry knowledge.

## The ladder, and why each rung exists

The order is fixed: **read_run → explore → complete → debug → write**.

| Type | The learner… | Support | Why this rung |
|---|---|---|---|
| `read_run` | reads a worked example and runs it unchanged | full | Worked examples cut cognitive load before any problem-solving (Sweller); the `predict` prompt makes even reading retrieval, not consumption |
| `explore` | changes one variable, hunts for a target value | code given | Guided variation — the learner manipulates the model before owning its code; builds the parameter intuition later rungs assume |
| `complete` | fills `...` gaps in otherwise-working code | structure given | Completion problems focus effort on exactly the load-bearing lines; assembling given parts beats writing from scratch at this stage (the Parsons-problem result), which is why complete comes **before** debug |
| `debug` | finds and fixes a seeded, realistic bug | broken whole given | Diagnosis is its own skill and requires holding the correct model firmly enough to spot its violation — that firmness comes from the rungs above |
| `write` | builds the function from a spec | spec only | Independent performance, the point of the whole ladder; graded deterministically plus an invisible AI structural check |

All five rungs drill the **same** idea — the types differ in support, not in
content. Repetition across varied practice is the mechanism, not a redundancy
to optimize away.

## Choosing the rungs

- A **core idea** (load-bearing for later units) gets the full five-rung
  ladder, possibly with a second lesson at one rung. Units read best at 5–7
  lessons; more than 7 usually means the "one idea" is actually two — go
  back to course-design and split.
- A **supporting idea** (used later but not central) can run a partial
  ladder, taken from the bottom: read_run → explore, or read_run → explore →
  complete. Never skip read_run — every idea gets a worked example first —
  and never jump to write without complete and debug before it; that hole in
  the fade is where learners fall through.
- Estimated minutes come from `config.yaml` (`est_minutes_by_type`) unless a
  lesson genuinely differs; the unit total should stay a single sitting
  (~30–40 min). If it doesn't, cut a rung from a supporting idea rather than
  rushing the core one.

## One scenario per unit

Pick one concrete scenario from the course plan and keep it through every
rung — same variable names, same numbers evolving, same situation. The
learner then spends working memory on the idea, not on re-orienting to a new
story five times (coherence, and the known-new contract applied to context).
Numbers should be small, checkable by eye, and reused. Example: a unit on
list slicing might live entirely in one sensor log — `readings = [3, 12, 14,
15, 2]`, where the first and last values are warm-up and cool-down noise —
and every rung trims, sums, or validates that same list.

## Write the per-lesson rows

For each lesson, append to the unit's section in the course plan:

```markdown
### <unit>-<type> — "<title>"
- objective: after passing, the learner can <one capability, one sentence>
- assumes: <terms/constructs used but not taught — each must trace to entry
  knowledge or an earlier teaches>
- teaches: <what this lesson adds — usually one item; two is the ceiling>
- predict: <for read_run/explore: the question the learner answers before
  running — a number or direction they must commit to>
- scenario beat: <what happens in the running scenario this lesson>
- reference solution: <sketch or full code — lesson-write finalizes it>
```

Rules that keep the rows honest:

- **One `teaches` item per lesson.** The lesson types differ in *support*,
  not in content — all five rungs teach the same unit idea from new angles. A
  rung that introduces a genuinely new concept mid-ladder is a design smell;
  move the concept to its own unit or teach it in the read_run.
- **`assumes` is exhaustive.** Every function, symbol, and term the starter
  code or prose will use goes in the list — including Python constructs
  (`enumerate`, f-string format specs) and notation ($\Sigma$, subscripts).
  lesson-review will hunt for anything used-but-unlisted, so listing it now
  is cheaper.
- **Objectives are capabilities, not topics.** "Can trim a list to its valid
  middle with one slice" grades itself; "understands slicing" doesn't.

Then update the unit's `lessons:` array in the path's manifest
(`<data-dir>/content/paths/<path-id>/manifest.yaml`; order = ladder order)
and hand each row to `lesson-write`.
