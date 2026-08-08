# Code style for lesson Python

Every line of lesson code is teaching material — learners imitate what they
see far more than what prose tells them, so starter code, reference
solutions, *and grader code* model the style you want them to absorb.
Baseline is distilled PEP 8, with sophistication set by the course plan's
**Python axis** — not by the learner's domain level. Beginner-to-the-topic
does not mean beginner-to-Python: a Python-fluent audience gets idiomatic
code (comprehensions, `math.prod`, dataclasses where natural) and zero
explanation of syntax it owns, while the *domain* content still starts from
worked numbers. Explaining Python the entry knowledge already licenses is
expertise reversal — it costs attention and patronizes.

## Names carry the model

- **Full words, snake_case**: `valid_readings`, `monthly_rate` — never
  `vr`, `mr`, or `temp`. The one sanctioned exception: a symbol the lesson
  itself defined in math ties code to notation — `r` for the rate, `n` for
  the count, *after* the prose introduced them. A name the prose never
  defined is an undefined term; the chain invariant applies to identifiers.
- **Constants in UPPER_SNAKE_CASE** when a value is a fixed given of the
  scenario (`SENSOR_LIMIT = 30.0`); plain snake_case when the learner is
  meant to change it (`years = 1  # <- raise this until the balance
  doubles`). The casing itself signals "touch this / don't".
- **Units live next to numbers**, in a comment or the name:
  `interval = 5.0   # seconds between readings`. Every magic number gets a
  name or a comment; no bare `41` whose origin the learner must
  reconstruct.
- Same name for the same thing across the whole unit — rung to rung, prose
  to code to check messages. Renaming between lessons forces re-learning.

## Structure stays inside the learner's declared Python

- **Only constructs the ledger licenses** — the course plan's Python axis
  plus this lesson's `assumes`. When the axis says "loops and functions",
  the reference solution does not flex a comprehension or
  `functools.reduce`; when it says "fluent", write the idiomatic form and
  skip the hand-holding. Either way, endorsed alternatives can be *named in
  the spec or AI criteria* (e.g. "a loop, `sum()`, or `np.sum` are all
  acceptable") without appearing in shipped code.
- **Simplest structure that carries the idea.** Classes, dataclasses, and
  generators appear when the spec genuinely needs them *and* the Python
  axis licenses them — never as decoration. Whatever the audience's
  fluency, abstraction the idea doesn't require competes with the idea for
  attention; an expert audience deserves *clean* code, not *clever* code.
- **One idea per line.** No chained clevernesses; intermediate values get
  named (`trimmed = readings[1:4]` then `total = sum(trimmed)` — the two
  names *are* the concepts). Short lines, 4-space indents, blank line
  between setup / computation / output.
- **Docstrings are the spec**: every function the learner completes or
  writes keeps a one-line docstring stating its contract ("Return the
  difference between the day's highest and lowest reading."). Comments
  explain *why* or mark the learner's target — never narrate what a line
  obviously does.

## Output teaches too

- Print labeled, unit-carrying results the prose can refer to:
  `print(f"trimmed total  {total:5.1f} degrees over {len(trimmed)} readings")`.
  The learner should be able to read the output alone and re-tell the
  lesson's claim.
- Floats: format to a stated precision (`:.2f`); never print raw
  floating-point noise the learner must mentally round.
- matplotlib: create the figure and stop — the engine captures it (AGG
  backend, no `plt.show()`). Label axes with units; a plot without labeled
  axes is a vague sentence.

## Grader code holds the same bar

Checks are read by the author-after-next; helper functions in `grade.py` get
real names (`_edge_case`, `_boundary`), comments only for the traps
(`bool(...) not 'is True': numpy comparisons return numpy.bool_`). A sloppy
grader eventually grades wrongly — and it's the file future lesson authors
copy first.
