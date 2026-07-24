# Writing craft for lessons

Lesson prose exists to enable the next action, not to be admired. The learner
reads it once, under load, with code waiting. These rules are distilled from
technical-writing practice (IEEE Professional Communication Society; Anderson,
*Technical Communication*; Kolln & Gray, *Rhetorical Grammar*; Williams,
*Style*; the Google developer style guide) and from learning research (Mayer's
multimedia principles; Sweller's cognitive load theory; Wilson, "Ten Quick
Tips for Delivering Programming Lessons", PLOS Comp Bio). They are ordered by
importance.

## 0. The task-first shape

Every lesson body is:

```
:::task
What to do. Short, imperative, at most ~40 words.
:::

:::why <short label>
The whole explanation. Collapsed by default in the UI.
:::

```python starter
...
```
```

The engine renders the task as an always-visible card and the why as a
collapsed disclosure: the learner meets the task and the code first, and
opens the explanation on demand. Consequences for how you write:

- **The task carries no motivation, history, or cause.** It says what to do
  and how the learner knows they're done. Everything else goes in the why.
- **For a debug lesson the task gives the symptom and the success
  condition, never the change.** "Change the slice end to 4" deletes the
  diagnosis the lesson exists to teach. Say "run it as shipped: the total
  is wrong; fix it until the printed total reads 41".
- **A lesson with a `predict:` prompt may not put a digit in its task.** The
  learner is being asked to commit to a value before running; a task that
  states the value deletes the exercise. The why-body may still work the
  number through.
- **Nothing after the starter fence.** Interpretation of the output belongs
  in the why, phrased so it makes sense both before and after the run
  ("`ok=True` says the config passes; `margin=100` says how much room it
  has"). Trailing lecture paragraphs are unread — the learner is already in
  the editor.

Write this shape from the first draft. Prose drafted lecture-first — build-up
paragraphs, then code, then interpretation — cannot be rearranged into it;
the sentences carry the wrong connective tissue and have to be rewritten.

## 1. The quality checklist (advisory)

These rules once ran as a hard mechanical gate; they are now advisory. Weigh
them, don't worship them — but each earned its place by making real lessons
worse when violated, so a draft that ignores several is usually a draft that
needs another pass. `lesson-review/scripts/qa_check.py` reads the same list
mechanically and reports suggestions.

- **Keep the collapsed explanation short.** Working targets by type, in
  prose words (code and math excluded): read_run ~195, explore ~210,
  complete ~195, debug ~180, write ~165. These are calibrated to the
  collapsed shape: the learner opens the why to get unstuck, not to read a
  chapter. Hit the target in the first draft — overlong drafts resist
  trimming because editing anchors on the existing length. When over,
  delete whole sentences and asides, never words here and there.
- **Paragraphs: ~80 words maximum.** A collapsed explanation that opens
  into a wall of text defeats the shape.
- **Sentences: ~28 words maximum.** Prefer far shorter. At most one
  question sentence per lesson.
- **No em (—) or en (–) dashes in learner-visible text** — lesson prose AND
  `grade.py` check messages. Dashes next to math and code are hard to read.
  Use commas, colons, parentheses, or two sentences. Define terms with a
  comma or colon: "`rate`, the monthly interest as a decimal", never
  "`rate` — the monthly interest". Parameter lists take colons. (Hyphens in
  compound words are fine.)
- **Present tense, active voice.** Passive only when the actor is unknown
  or irrelevant.
- **Address "you"; never we/our.**
- **No forward teasers**: never "next lesson", "you'll see/meet/learn",
  "coming up", "later in this course", or story-continuation framing. The
  known-new contract ends at the lesson boundary.
- **The why-body's first sentence contains a number, a code identifier, or
  a math symbol.** Open on the concrete object, not a framing. Good: "The
  slice `readings[1:4]` keeps positions 1, 2, and 3." Bad: "Slicing is one
  of Python's most useful features."
- **No sentence opens "This is/means/matters/works/helps/keeps"** without a
  noun after This ("This slice keeps…", never "This keeps…"). It bites
  hardest right after display math or a code block: the next sentence must
  name its referent.
- **One name per concept, forever.** Reuse the exact term a sibling lesson
  already uses; never reach for a synonym for elegance. Repetition of the
  right word is a feature of technical teaching. A related trap: swapping a
  term of art for a common word to sound simpler ("the caller" is not "the
  input") destroys precision without helping anyone.
- **No magic adverbs** (quietly, deeply, fundamentally, remarkably,
  arguably, profoundly); hedge adverbs (simply, merely, essentially,
  effectively, truly, genuinely, certainly) at most one, better zero.
- **No negative parallelism** ("it isn't X, it's Y"). State what a thing is.
- **read_run and explore lessons carry a `predict:` prompt.**
- **Prefer literal statements over metaphor verbs for formal objects.** "The
  maximum sits at 15" → "the maximum is 15". Metaphor verbs (sits, lands,
  lives, wants, buys) accumulate across a course into fog.

Beyond the list, avoid the AI-tell catalogue: serves-as/stands-as copula
dodges, "it's worth noting", "here's the thing", "think of it as", "let's
unpack", rhetorical self-Q&A ("The result? Devastating."), tricolon stacking,
punchy one-fragment paragraphs, listicles in prose clothing, signposted
conclusions, false ranges, and invented concept labels. Say the thing
directly, in the course's own vocabulary.

## 2. The known-new contract (the rule everything else serves)

Readers absorb a sentence by attaching its new information to something
already known — so put the known thing first, the new thing second (Kolln &
Gray). This holds at every scale:

- **Sentence:** "The slice you just ran *(known)* also accepts a step
  *(new)*" — not the reverse.
- **Paragraph:** open with the concept the previous paragraph (or lesson)
  established; end on the idea the next one will pick up.
- **Lesson:** the opening sentence stands on the ledger row's `assumes`
  only. The one `teaches` item enters after its anchor is on the table.

### The term-introduction protocol

Every new word, symbol, or API — anything not in the lesson's `assumes` —
gets all three steps, at first use, in this order:

1. **Anchor** it to something the learner already has: a prior lesson's
   term, code they just ran, or an everyday comparison. New ideas never
   arrive cold.
2. **Define** it immediately, by whichever fits (IEEE's four methods): a
   synonym, a description of what it does, a comparison, or a formal
   definition. For math symbols, always name and unit together: "$r$, the
   monthly interest rate as a decimal". For library calls, one clause on
   what it returns: "`sum(readings)` returns the total of the list's
   entries".
3. **Bold** the term at first use (signaling), then reuse *exactly that
   term* everywhere after. No elegant variation: if it's "window" in lesson
   one, it is never "span" in lesson three. Synonym drift makes the learner
   maintain a translation table; consistency makes the interface of the
   course learnable.

Introduce at most one or two new terms per lesson. Needing more means the
ladder row is overloaded — push back to unit-design rather than cramming.

The protocol applies to what is new *to this audience on this axis*. Python
fluency and domain knowledge are independent (the course plan declares each),
so a Python-fluent learner gets no anchor-and-define for `enumerate` — and a
domain expert gets none for the field's standard terms. Defining what the
reader already owns is not extra safety; it costs attention and signals the
lesson wasn't written for them (expertise reversal).

## 3. Repetition is a feature; clutter is not

Conciseness rules cut *dead* words. They never cut **deliberate repetition
of the key term and the key claim** — restating the unit's idea in each
lesson, in the same words, against a new situation, is retrieval practice
and is the point of the ladder. The test: repetition of *content* across
contexts strengthens; repetition of *filler* within a sentence pads. "A
slice's end index is exclusive" appearing in three lessons is teaching. "The
engineer considered the second monitor an unneeded luxury" is padding
("unneeded" restates "luxury") — cut it.

## 4. Word choice

- **Simple over elaborate**, comprehension is measurably faster: use → not
  utilize; begin → not commence; end → not terminate; find out → not
  ascertain.
- **Specific over vague:** "the log holds 5 readings and 2 are noise" —
  never "the data may contain some invalid values". Concrete numbers the
  learner can recompute beat every abstraction.
- **Affirmative over negative:** "keep the middle three readings", not
  "don't fail to exclude the invalid ones". Multiple negatives make the
  learner do algebra on the sentence.
- **No noun strings:** "the sensor reading validation threshold
  configuration" → "the threshold that marks a reading valid". Unstack by
  adding the verbs back.
- Technical terms the audience owns (per `assumes`) are *good* words — the
  simple-word rule replaces elaborate *general* vocabulary, not the
  domain's precise terms.

## 5. Sentences

- **Vary length with purpose:** long sentences connect ideas; short ones
  land the point.
- **Keep the action in the verb**, not buried in a nominalization: "the
  check fails", not "a failure of the check occurs". Watch for -tion/-ment
  nouns hiding what happens.
- **Prune prepositional chains and to-be verbs** where an action verb
  exists: "the list's length", not "the length of the list"; "the check
  fails", not "the check is in a failing state".
- **Transitions carry logic:** because / so / but / at the boundary — one
  at the head of a sentence tells the learner how it attaches to the last
  one.

## 6. Learning-specific principles (Mayer, Sweller, Wilson)

- **Coherence — cut the interesting-but-irrelevant.** Every aside competes
  with the one idea for working memory. History, alternatives not taken,
  and "note that also…" go in later units or nowhere.
- **Segmenting:** one idea per paragraph; 2–4 sentences typical. The prose
  column is narrow — a five-line paragraph reads as a wall.
- **Personalization:** write to "you" in a conversational register ("Raise
  `years` until the balance doubles"). Measurably better transfer than
  formal register, and it keeps instructions imperative where they belong.
- **Worked numbers before formulas:** show 2 × 2 × 2 = 8 before $2^n$. The
  general form is the *last* restatement of an idea, never the first
  (concrete → abstract is known-new again).
- **The prose serves the run.** If a paragraph doesn't change what the
  learner predicts, types, or checks, it fails the coherence test.

## 7. The revision pass (paramedic method, adapted)

After drafting, sweep once (Lanham's paramedic method):

1. Mark prepositions, forms of *be*, and nominalizations → rewrite the
   sentences where they cluster.
2. Find the actor and the action of each sentence → make them subject and
   verb.
3. Cross out: wind-up openers ("It is worth noting that…"), extra
   determiners ("basically", "pretty much", "overall"), redundant pairs
   ("peculiar in nature").
4. Then the lesson-specific sweeps:
   - every term not in `assumes` → has anchor + definition + bold at first
     use, and no synonym drift after;
   - every number in prose → matches the starter and the checks;
   - every claim → something the checks actually verify (no
     "always"/"exactly" the lesson doesn't earn);
   - the predict question → answerable from prose alone, settled by the run.
