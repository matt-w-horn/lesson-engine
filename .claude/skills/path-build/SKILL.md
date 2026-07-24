---
name: path-build
description: End-to-end workflow for producing lesson-engine content — an entire path (the Path > Course > Unit > Lesson hierarchy) from source material (a paper, a book chapter, documentation, or the author's own expertise) to reviewed, validator-clean lessons. Use whenever the task is to generate, extend, or overhaul lesson-engine content — "build a path", "author a course on X", "turn this paper/book into lessons", "add a unit on Y", "write the lessons for Z" — even when only one layer is mentioned, because every layer's output feeds the next. This skill owns path design and sequences the four layer skills (course-design, unit-design, lesson-write, lesson-review); read it first to know which one to enter.
---

# Path build — the end-to-end pipeline

Produce content for the lesson-engine app: a **path**, the ordered set of
courses a learner works through. The engine serves any number of paths, each a
self-contained folder — building one never touches another. Path design lives
in this file; every layer below it has its own skill with the details. This
file owns the sequence, the shared invariants, and the definition of done.

```
source material ──► path design ──► course-design ──► unit-design ──► lesson-write ──► lesson-review
                    (this file:     (one course       (one unit =     (one lesson =    (adversarial
                     courses +       plan + ledger)    a ladder)       two files)       review, loops
                     ordering)                                                          back to fix)
```

Enter at the layer the task names, but check the layer above exists first: a
lesson without a unit ladder row has no objective to hit, a unit without a
course ledger has no way to know what the learner already knows, and a course
outside the path plan has no place in the order.

## Where everything lives

Authored content lives in the **engine data dir**: `$LESSON_ENGINE_DATA_DIR`
if set, otherwise `~/.lesson-engine`. Call it `<data-dir>`:

- `<data-dir>/content/config.yaml` — engine-global settings (app title,
  default packages, per-type time estimates, run timeout).
- `<data-dir>/content/paths.yaml` — the shelf: which paths exist, in order.
- `<data-dir>/content/paths/<path-id>/manifest.yaml` — the path's structure
  (courses > units > lesson ids).
- `<data-dir>/content/paths/<path-id>/lessons/<lesson-id>/` — one directory
  per lesson holding `lesson.md` and `grade.py`.
- `<data-dir>/plans/<path-id>/` — the design ledgers this pipeline writes:
  `path.md` plus one plan per course. Working documents, not served content.

The app serves the data dir live: edit a file, reload the browser, see the
change. `npx tsx scripts/validate.ts` (run from the engine repo) checks the
data-dir content structurally — schemas, manifest integrity, one starter
fence per lesson, a `CHECKS` list per grader.

## Source material

Every path starts from material the author vouches for: a paper, a book
chapter, official docs, or their own working expertise. The engine teaches by
doing — every lesson runs Python in the browser and grades the result — so
the material must yield things a learner can *compute*: formulas, procedures,
checks, reproducible failure modes. Material that can only be admired, not
practiced, has no home here. The pipeline never asks the learner to trust the
skills' knowledge of the subject; it asks the author to vouch for the claims
the ledger records. When a claim in the source is ambiguous or looks wrong,
ask the author rather than paper over it — every downstream lesson inherits
the error.

## Path design — the courses and the knowledge hand-off

The path plan lives at `<data-dir>/plans/<path-id>/path.md`. Producing it:

1. **Pin the path.** Kebab-case id, title, the audience, and the **path entry
   knowledge** on two independent axes — Python and domain (course-design
   Step 1 has the axis discipline). This is the only knowledge that arrives
   from outside; everything else must be taught by some course in the path.
2. **Decompose into courses.** One line of scope per course plus a sketch of
   its planned exit knowledge. A course is a promise-sized unit: "after this
   course the learner can …".
3. **Order the courses** — array order IS the order learners see. When the
   path needs math or library fluency (NumPy, algebra) that the audience
   lacks, make course 1 a review course taught through the same practice
   ladder; later courses then inherit its exit knowledge instead of
   re-teaching it.
4. **Register the path with the engine:** create
   `<data-dir>/content/paths/<path-id>/manifest.yaml` holding the `path:`
   root (id, title, courses added as they are designed) and append the id to
   `<data-dir>/content/paths.yaml`.

**The knowledge hand-off.** Course 1's entry knowledge IS the path entry
knowledge. Every later course's entry knowledge = the path entry knowledge
plus what it inherits from earlier courses' exit knowledge — and inheritance
is **materialized**: course-design copies each inherited entry into that
course's own plan, marked `(inherited: <course-id>)`. Downstream layers never
look across courses; lesson-review spot-checks the markers against the named
course's exit knowledge.

## The knowledge ledger — the spine of everything

Every layer reads and writes one artifact per course: the **course plan** at
`<data-dir>/plans/<path-id>/<course-id>.md`. It records the audience and
their **entry knowledge** (what the learner knows before lesson one), and per
lesson, two lists:

- `assumes:` — every concept, term, symbol, and Python construct the lesson
  uses without teaching it
- `teaches:` — what the learner can do after passing that they could not
  before (this is the lesson's objective, stated as a capability)

**The chain invariant:** everything in a lesson's `assumes` must appear in the
course's entry knowledge or in some earlier lesson's `teaches`. This is the
whole mechanism behind "map every new idea to something known first" — it
makes the known-new contract checkable instead of aspirational. Path design
bounds what entry knowledge may contain, course-design creates the ledger,
unit-design refines it to per-lesson rows, lesson-write consumes a row, and
lesson-review audits the finished lesson against it.

## Shared constraints (all layers)

- All lesson code is **Python**, executed in-browser by Pyodide. Importable
  packages are exactly the engine allowlist in `src/schemas.ts`
  (`PYODIDE_PACKAGES`: numpy, scipy, sympy, matplotlib). No network, no
  files, 20-second run timeout (`config.yaml`).
- Content is data: a lesson is a directory holding `lesson.md` and
  `grade.py`; structure lives only in the path's `manifest.yaml` and the
  shelf order in `paths.yaml`. Engine code never changes to add content.
- Run `npx tsx scripts/validate.ts` after touching any content file.

## Definition of done (per lesson)

A lesson ships only when all of these hold — lesson-review verifies them:

1. Validator passes with no errors for it.
2. The starter code behaves per its type (a read_run starter runs clean
   as-is; a graded type's starter fails at least one visible check).
3. A written-out reference solution passes every check, including hidden ones.
4. The chain invariant holds: no term, symbol, or construct appears before
   the ledger says the learner has it.
5. Review found no unresolved findings. The quality checklist in
   lesson-write's `references/writing-craft.md` is advisory — weigh its
   suggestions, don't treat them as pass/fail — but a lesson that ignores
   most of it usually reads like it.

## Sequence for a full path build

1. **Path design** (above) — the path plan, the manifest skeleton, the shelf
   entry in `paths.yaml`.
2. For each course, **in path order** (later courses inherit from earlier
   ones, so order is not a preference):
   1. **course-design** — the course plan, with inherited entry knowledge
      materialized.
   2. For each unit, **unit-design** — the ladder and per-lesson ledger rows.
   3. For each lesson, **lesson-write** — `lesson.md` + `grade.py` + a
      reference solution kept in the course plan under the lesson's row.
   4. **lesson-review** each lesson (batch by unit is fine). Fix and
      re-review until findings are clear. Review is not optional — the
      writer's blind spots are exactly what it exists to catch, so never
      skip it because the lesson "looks right".
3. `npx tsx scripts/validate.ts`, then load each new unit in the browser and
   play through it once end to end.

Work in path order, then ledger order — later lessons and later courses
legitimately depend on earlier ones existing, and writing out of order is how
undefined-term bugs get in.

## Executing the lesson layer (steps 2.3–2.4) — the unit loop

Run the lesson layer one unit at a time (a unit is one scenario drilled up
the ladder, so its lessons share vocabulary and numbers — writing them
together is what keeps the continuity coherent):

1. **Inspect before writing** (makes re-runs safe): for each lesson of the
   unit — complete and conforming to its row → leave it; present but broken
   → repair only what fails; missing → write it (lesson-write).
2. Write in ladder order, one scenario across all rungs: same names, same
   numbers evolving exactly as the rows specify. Write each lesson short
   from the first draft — trimming an overlong draft later costs more than
   writing tight, because editing anchors on the existing length.
3. **lesson-review** the unit; fix; re-review until findings clear.
4. Record each reference solution in the course plan under its lesson row.

After a course's last unit: a **course-wide consistency sweep** — the drift
that accumulates across units even with one author: (a) terminology and
notation, one name per concept everywhere; (b) recurring scenario names and
numbers identical where the ledger says they recur, cross-references point
only at real earlier lessons; (c) code style uniform (same variable names for
the same quantity, same starter-fence and print conventions, check-message
tone); (d) prose voice per writing-craft (person, present tense, active
voice, predict phrasing by type); (e) vocabulary consolidated — when two
lessons name the same thing differently, pick one name and propagate it.
Never change grading behavior during the sweep — re-run any edited lesson's
grader against its reference solution to prove nothing broke.
