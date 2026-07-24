---
name: course-design
description: Design one lesson-engine course within a path — audience, entry/exit knowledge (including what it inherits from earlier courses), unit decomposition, dependency ordering, and the course plan (knowledge ledger) every later layer depends on. Use whenever a new course is being planned, a course is being restructured or reordered, units are being added or merged, or someone asks "what should this course cover" / "outline course N" for lesson-engine. Requires the path plan from path-build's path-design phase; do this BEFORE designing units or writing lessons — those skills consume this one's output.
---

# Course design — from source material to a teachable sequence

A course turns source material (a paper, a book chapter, docs, the author's
own expertise) into a dependency-ordered sequence of units, each teaching
exactly one idea. The output is not lessons; it is the **course plan** at
`<data-dir>/plans/<path-id>/<course-id>.md` plus the course's block in
`<data-dir>/content/paths/<path-id>/manifest.yaml`, at the position the path
plan assigns. (`<data-dir>` is `$LESSON_ENGINE_DATA_DIR`, default
`~/.lesson-engine`.) Read `path-build` first if you haven't — it defines the
path plan, the ledger, and the chain invariant this skill creates. If
`<data-dir>/plans/<path-id>/path.md` does not exist, stop and run
path-build's path-design phase first — a course outside the path plan has no
place in the order and no entry knowledge to inherit.

## Step 1 — pin the audience and the entry knowledge

Write down, in the course plan, who the learner is and the **entry
knowledge** — as **two independent axes**, because Python fluency and domain
knowledge do not travel together. A working data analyst fluent in Python may
be new to the course's subject; a subject expert may be new to NumPy. For
course 1 the entry knowledge IS the path plan's entry knowledge; for a later
course, start from the path entry knowledge and **materialize the
inheritance**: copy every entry this course relies on from earlier courses'
exit knowledge into this plan, marked `(inherited: <course-id>)`, so no
downstream layer ever looks across courses. Declare each axis explicitly:

- **Python:** the constructs and libraries usable without explanation —
  "fluent: functions, comprehensions, classes, f-strings; has not used NumPy".
- **Domain:** the concepts and notation usable without teaching —
  "high-school algebra; reads a balance sheet daily; has not seen present-value
  notation".

Be concrete, not "intermediate". Every downstream known-new decision resolves
against these lists, so vagueness here becomes undefined-term bugs later — and
the axes control different dials: the Python axis sets how sophisticated
lesson *code* may be (see lesson-write's code-style reference), the domain
axis sets how much the *prose* must scaffold. Calibrate each independently:
explaining what the learner already owns is not harmless padding — it costs
attention and reads as condescension (the expertise-reversal effect: support
that helps novices measurably hurts the already-fluent).

If the audience is genuinely unknown, ask the user; do not guess. One question
here is cheaper than reviewing twenty lessons against the wrong baseline.

One pattern worth reusing here (course ordering itself — e.g. a review course
first — is path-build's call): **just-in-time interspersal**. Small
prerequisite pieces (one identity, one NumPy call) can be taught inside the
unit that first needs them rather than escalated to the path level. Prefer
interspersal when the piece is used once; ask path-build for a review course
when it recurs across courses. The prerequisite gradient should unlock depth,
not gate entry.

## Step 2 — extract the teachable claims

Read the source material and list every *operational* claim a learner could
practice: a formula they can compute, an inequality they can check, a
procedure they can run, a failure mode they can reproduce. Skip claims that
can only be admired, not practiced — this engine teaches by doing (retrieval
practice), so a claim with no computable exercise has no home here. Note next
to each claim the real-world scenario it lives in (a data-cleaning job, a
budget review, a malformed input file); near-transfer to the learner's actual
work is what makes practice stick. Where the source is ambiguous or a claim
looks wrong, ask the author — they vouch for the material, and every
downstream lesson inherits an error recorded here.

## Step 3 — cluster into units of one idea

Group the claims so each unit drills **one idea** several ways. "One idea" is
the size a learner can hold while five successive practice types poke at it —
a single formula, one rule with its boundary cases, one procedure. If a
unit's description needs "and", split it. Units read best at 5–7 lessons —
core ideas deserve the full ladder, minor ones can run shorter (see
unit-design). The range is a guideline, not a gate; a unit that genuinely
needs 4 or 8 is fine, but past 8 the "one idea" is usually two.

## Step 4 — order by dependency, then write the ledger

Topologically order units so every unit's inputs are taught before it (the
known-new contract at course scale; Mayer calls the same move pretraining —
teach the parts before the mechanism that uses them). When two orders are
both valid, put the more concrete unit first: learners anchor abstractions to
computations they have already run.

Then write the ledger skeleton in the course plan — for each unit, in order:

```markdown
## Unit: <id> — <title>
**Idea:** <one sentence>
**Scenario:** <the running real-world example this unit lives in>
**Assumes:** <entry knowledge or earlier units' teaches — list them>
**Teaches:** <capabilities the learner gains, as "can compute/check/explain X">
```

Audit the chain right here: walk the units in order and confirm every
`assumes` entry traces to entry knowledge or an earlier `teaches`. Fixing an
ordering bug now costs a cut-and-paste; after lessons are written it costs a
rewrite.

**Exit knowledge** (the union of all `teaches`) goes at the top of the plan.
Compare it against what the course promised to deliver — a gap means a
missing unit, an excess means scope creep to cut.

## Step 5 — manifest and validation

Add the course block to `<data-dir>/content/paths/<path-id>/manifest.yaml`,
at the position the path plan's course order assigns (ids kebab-case; array
order IS the order learners see). Lesson ids follow `<unit>-<type>`
(`slicing-debug`). Listing planned lessons whose directories don't exist yet
will fail `npx tsx scripts/validate.ts` — either add manifest entries as
lessons land, or create the directories in the same pass. Hand each unit to
`unit-design` next.
