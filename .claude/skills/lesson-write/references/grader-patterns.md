# Grader patterns for grade.py

The grader is the lesson's contract with the learner: checks define "done",
messages do the coaching, and the hybrid design keeps grading honest —
**deterministic checks are the source of truth wherever an exact answer
exists; the AI grader only judges what tests cannot express, and it never
overrides a deterministic result** (`combineResult` in `src/grading.ts`).

## CHECKS anatomy

`grade.py` runs in a namespace where `_close(a, b, tol=1e-9)` and
`_raises(fn, *args, exc=ValueError)` are already injected — use them, never
redefine them. The file must define a top-level `CHECKS` list:

```python
CHECKS = [
    {
        "name": "slice_drops_the_noise",     # snake_case; shown with _ -> spaces
        "fn": lambda ns: ns["trimmed"] == [12, 14, 15],
        "message": "still 5 readings long? a slice keeps start through end minus one: [1:4] keeps positions 1, 2, and 3.",
        "hidden": False,
    },
]
```

- `fn` receives **the learner's namespace dict** after their whole file ran.
  Read variables (`ns["trimmed"]`) for explore lessons; call functions
  (`ns["daily_range"]([12, 14, 15])`) for complete/debug/write. An
  exception in `fn` counts as a failed check, so guard nothing — just
  index.
- A check that raises on a *missing* name also just fails; put a visible
  shape check first (e.g. `returns_the_spec_dict`) so the learner's first
  failure names the real problem instead of a cryptic cascade.
- Order checks pedagogically: shape → main scenario → secondary case →
  hidden edges. The learner reads them top to bottom as a to-do list.

### Per-type conventions

- **read_run**: `CHECKS = []`. A successful Run completes the lesson;
  there is nothing to submit.
- **Every other type needs real checks.** An empty `CHECKS` list with no AI
  grading means Submit passes any code that runs — the lesson silently
  becomes a participation trophy. If you truly cannot express a check,
  that is what `grading.ai` exists for; never ship both empty.
- **explore**: include a visible check (conventionally named
  `scenario_pinned`) that the fixed scenario variables still hold their
  shipped values. Without it, editing the scenario instead of the knob
  "solves" the lesson. Message voice: "`START_BALANCE` and `rate` are the
  fixed scenario, not knobs: only `years` is yours to change."

### The numpy bool trap

NumPy comparisons return `numpy.bool_`, not `bool`. `x is True` fails for a
correct solution that used numpy. Never compare with `is True` / `is
False` — coerce instead: `bool(ns["passed"])`. For floats always
`_close(...)`, never `==` (except on ints).

## Visible messages are hints, not answers

The message shows only when the check fails, so write it as the coach's
line at exactly that moment of being stuck. The voice (productive struggle —
unblock the thinking, never do it):

- **Name the likely misconception, then point at the mechanism** — "counted
  the end index too? a slice stops one before its end". Not the fix
  ("change 3 to 4") and not bare restatement ("trimmed is wrong",
  "incorrect"). A message that just says wrong wastes the one moment the
  learner is listening.
- **Never state the expected value the learner is supposed to find.** The
  check already knows the answer; the message's job is to point at the
  *rule* that produces it.
- Anchor to numbers the learner can hand-check: "a two-reading day should
  give a range of 0 when both readings match".
- State the rule being violated when the trap is conceptual: "an empty list
  has no readings to compare: the spec says raise ValueError".
- Keep the lesson's exact vocabulary (no new terms inside a hint).
- Messages are **learner-visible text**: hold them to writing-craft's
  checklist. No em/en dashes — use a colon for the elaborating pause ("not
  there yet: each extra year compounds the whole balance"). Keep each
  message a single-line string literal so it stays greppable and renders as
  one hint.

## Hidden checks

`"hidden": True, "message": ""` — the learner sees only that a hidden check
failed. Use hidden checks for:

- **Edge cases the prose already pinned** (empty list, boundary equality) —
  the spec told them; the hidden check keeps the answer from being
  pattern-matched off the visible list.
- **Consistency traps in explore lessons** — grade a derived quantity
  alongside the visible target so typing the final answer without running
  the model still fails.

Never hide the main path — a learner failing only hidden checks should be
able to deduce which *stated* rule they missed. One or two hidden checks per
lesson is the ceiling.

## AI grading (`grading.ai` frontmatter)

Add it only when a correct-looking pass is achievable by structurally wrong
code. It is invisible to the learner until it fails, and renders as one more
check row.

- **`mode: augment`** (the default choice): deterministic checks remain the
  gate; the AI additionally vetoes structure. If the grader is offline, the
  lesson accepts on checks alone — so augment never blocks progress on
  infra.
- **`mode: replace`**: the AI verdict *is* the grade — only for code that
  cannot be executed meaningfully (an abstract interface, a design
  exercise). Offline means ungradable, so avoid replace unless execution is
  impossible.
- **`criteria`** addresses the grader model. Name the required computation
  shape and forbid the cheats concretely:

  ```yaml
  criteria: >
    daily_range must compute the result from the input list itself (max
    minus min via builtins, a loop, or numpy over the input). Fail any
    solution that hardcodes expected output values, special-cases the
    specific test inputs (e.g. `if temps == [12, 14, 15]`), or returns a
    constant regardless of input.
  ```

  Enumerate acceptable implementations (so the grader doesn't fail
  legitimate variety) and the specific fraud patterns (hardcoding, input
  special-casing, boundary laxity).
- **`fail_hint`** addresses the learner after a veto, in hint voice: what
  *kind* of thing is wrong, never the diff — "the function must derive its
  answer from the list it receives: no hardcoded results".

## Designing the check set (work from the reference solution)

1. Write the reference solution first; every check must pass against it —
   including a numpy-flavored variant if one is natural (`np.max`).
2. Then write the *adversarial* solutions: the hardcoded return, the
   canonical misconception (the off-by-one, the swapped operands), the
   boundary `<=` where the spec says `<`. Each must fail at least one check
   (or the AI criteria). If you can't write a check that kills a cheat,
   that's what `grading.ai: augment` is for.
3. Confirm the shipped starter fails at least one **visible** check (for
   graded types) — a starter that accidentally passes teaches nothing and
   awards completion for clicking Submit.
4. Keep the set small: 3–6 checks. Every check is feedback surface; twenty
   rows is noise, not rigor.
