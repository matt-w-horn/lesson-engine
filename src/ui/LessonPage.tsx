// THE lesson renderer — one component serves all five practice types; only
// the starter code, grading config, and per-type completion policy differ.
// Layout follows the doing-first principle: context (predict + prose) on one
// side, the permanent work surface (the workbench: editor, run, console) on
// the other.
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { useApp, usePath } from "./App";
import { href } from "../router";
import { findUnit, loadLesson, type LoadedLesson } from "../content";
import { renderProse, renderMermaidIn } from "../markdown";
import { pyRuntime, runtimeStatus } from "../py/runtime";
import {
  callGraderApi,
  completesOnRun,
  gradeLesson,
  type LessonResult,
  type RunOutcome,
} from "../grading";
import {
  getLessonProgress,
  progress,
  progressKey,
  recordAttempt,
  updateLessonCode,
  updateLessonProgress,
} from "../progress";
import { Editor, type EditorHandle } from "./Editor";
import {
  chordAria,
  chordHint,
  chordLabel,
  inEditor,
  inTextField,
  matchChord,
  type ChordId,
} from "./keys";
import { ShortcutsOverlay } from "./ShortcutsOverlay";
import { OutputPanel } from "./OutputPanel";
import { Results } from "./Results";
import { STAGE_LABEL } from "./Ladder";
import { ConfettiBurst } from "./Confetti";
import { prefersReducedMotion } from "./motion";
import { AUTO_ADVANCE_MS, shouldAutoAdvance } from "./advance";

type RunView = Pick<RunOutcome, "stdout" | "error" | "figures">;

export function LessonPage({
  pathId,
  lessonId,
}: {
  pathId: string;
  lessonId: string;
}) {
  const { config } = useApp();
  const path = usePath(pathId);
  const manifest = path?.manifest;
  const index = path?.index;
  const [lesson, setLesson] = useState<LoadedLesson | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // False until the first Run/Submit of this visit: the console region is
  // not rendered at all before then, so the editor keeps the space. The
  // per-lesson remount (keyed route) resets it for the next lesson.
  const [hasRun, setHasRun] = useState(false);
  const [runView, setRunView] = useState<RunView | null>(null);
  const [result, setResult] = useState<LessonResult | null>(null);
  const [showKeys, setShowKeys] = useState(false);
  // First-completion celebration: burst is the one-shot confetti canvas;
  // justCompleted stays true for the rest of the visit so the ✓ draws itself
  // on arrival. A lesson that mounts already complete stays quiet, as do
  // re-runs.
  const [burst, setBurst] = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);
  const completed = Boolean(
    progress.value.lessons[progressKey(pathId, lessonId)]?.completedAt,
  );
  const wasCompleted = useRef(completed);
  useEffect(() => {
    if (completed && !wasCompleted.current) {
      setJustCompleted(true);
      if (!prefersReducedMotion()) setBurst(true);
    }
    wasCompleted.current = completed;
  }, [completed]);
  const doneRef = useRef<HTMLSpanElement>(null);
  // Auto-advance: armed by the submission that first completes the lesson;
  // any keydown or pointerdown while armed means "I want to stay" and
  // cancels it. Clicking or Enter-ing Next itself still navigates — the
  // cancel fires first, then the link activation proceeds as normal.
  const [autoNext, setAutoNext] = useState(false);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextBtn = useRef<HTMLAnchorElement>(null);
  const cancelAutoAdvance = () => {
    if (advanceTimer.current !== null) {
      clearTimeout(advanceTimer.current);
      advanceTimer.current = null;
    }
    setAutoNext(false);
  };
  useEffect(() => {
    if (!autoNext) return;
    const cancel = () => cancelAutoAdvance();
    window.addEventListener("keydown", cancel, true);
    window.addEventListener("pointerdown", cancel, true);
    return () => {
      window.removeEventListener("keydown", cancel, true);
      window.removeEventListener("pointerdown", cancel, true);
    };
  }, [autoNext]);
  useEffect(
    () => () => {
      if (advanceTimer.current !== null) clearTimeout(advanceTimer.current);
    },
    [],
  );
  const editor = useRef<EditorHandle>(null);
  const proseRef = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingCode = useRef<string | null>(null);
  // The keydown listener below mounts once, but what Run does changes with
  // every lesson and with busy/ready state, so it dispatches through this ref.
  // An entry left undefined means the chord is unavailable right now, which is
  // how the handlers stay in step with the buttons' disabled attribute.
  const chordActions = useRef<Partial<Record<ChordId, () => void>>>({});

  const flushPendingSave = () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = null;
    if (pendingCode.current !== null) {
      updateLessonCode(pathId, lessonId, pendingCode.current);
      pendingCode.current = null;
    }
  };

  const dropPendingSave = () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = null;
    pendingCode.current = null;
  };

  useEffect(() => {
    let alive = true;
    loadLesson(pathId, lessonId)
      .then((l) => alive && setLesson(l))
      .catch((e) => alive && setLoadError(String(e?.message ?? e)));
    void pyRuntime.warmup().catch(() => {});
    return () => {
      alive = false;
      // Persist (not drop) any edit made in the last debounce window.
      flushPendingSave();
    };
  }, [pathId, lessonId]);

  const ref = index?.byLesson.get(lessonId);
  const unit = manifest && ref && findUnit(manifest, ref.courseId, ref.unitId);

  // Page-level chords, for when focus is outside the editor. Mounted once for
  // the component's life; the editor's own keymap serves focus inside it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      // Auto-repeat would machine-gun Alt+Arrow through several lessons per
      // second; every chord here is a discrete action, so only the first
      // keydown of a hold counts.
      if (e.repeat) return;
      // A chord typed in the editor already arrived through the CodeMirror
      // keymap. Handling it here as well would run the lesson twice.
      if (inEditor(e.target)) return;
      const chord = matchChord(e);
      if (!chord) return;
      if (chord === "help" && inTextField(e.target)) return;
      const fn = chordActions.current[chord];
      if (!fn) return;
      e.preventDefault();
      fn();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const proseHtml = useMemo(
    () => (lesson ? renderProse(lesson.prose, lesson.baseUrl) : ""),
    [lesson],
  );
  useEffect(() => {
    if (proseRef.current) void renderMermaidIn(proseRef.current);
  }, [proseHtml]);

  // Cleared on every render, then refilled below once the lesson is in hand.
  // Between a hash change and the new lesson resolving, the entries would
  // otherwise still describe the PREVIOUS lesson, so a chord pressed in that
  // window would run its code or jump to its neighbours.
  chordActions.current = { help: () => setShowKeys(true) };

  if (!path) return <p class="boot-error">Unknown path.</p>;
  if (loadError) return <p class="boot-error">Failed to load lesson: {loadError}</p>;
  if (!lesson) return <p class="muted">Loading lesson…</p>;

  const fm = lesson.frontmatter;
  const saved = getLessonProgress(pathId, lessonId);
  const packages = [
    ...new Set([...config.default_packages, ...(fm.packages ?? [])]),
  ];
  const status = runtimeStatus.value;
  const pythonReady = status === "ready";
  const mins = fm.est_minutes ?? config.est_minutes_by_type[fm.type];
  const pos = unit ? unit.lessons.indexOf(lessonId) : -1;

  const onDocChanged = (code: string) => {
    pendingCode.current = code;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(flushPendingSave, 1000);
  };

  const doRun = async () => {
    setBusy(true);
    setHasRun(true);
    setResult(null);
    try {
      const out = await pyRuntime.run(editor.current!.getValue(), packages);
      setRunView(out);
      if (completesOnRun(fm.type) && out.ok && !completed) {
        recordAttempt(pathId, lessonId, true, null, false);
      }
    } catch (e: any) {
      setRunView({
        stdout: "",
        figures: [],
        error: { message: String(e?.message ?? e), traceback: "" },
      });
    } finally {
      setBusy(false);
    }
  };

  const doGrade = async () => {
    setBusy(true);
    setHasRun(true);
    setRunView(null);
    try {
      const code = editor.current!.getValue();
      const res = await gradeLesson(
        {
          lessonId,
          title: fm.title,
          type: fm.type,
          code,
          entryPoint: fm.entry_point,
          ai: fm.grading?.ai,
        },
        {
          runGrade: () => pyRuntime.grade(code, lesson.gradeCode, packages),
          callAi: callGraderApi,
        },
      );
      setResult(res);
      if (!res.aiUnavailable) {
        recordAttempt(pathId, lessonId, res.passed, res.score, res.aiSkipped);
        if (res.passed && ref?.nextId) {
          // Enter should now mean "go on": hand focus to the Next link. It
          // only becomes focusable once this pass has rendered (a locked
          // Next carries no href), so wait a frame before reaching for it.
          requestAnimationFrame(() => nextBtn.current?.focus());
          if (
            shouldAutoAdvance({
              passed: res.passed,
              alreadyCompleted: completed, // as of the submission, not the record
              type: fm.type,
              nextId: ref.nextId,
            })
          ) {
            const nextId = ref.nextId;
            setAutoNext(true);
            advanceTimer.current = setTimeout(() => {
              advanceTimer.current = null;
              setAutoNext(false);
              go(nextId);
            }, AUTO_ADVANCE_MS);
          }
        }
      }
    } catch (e: any) {
      setRunView({
        stdout: "",
        figures: [],
        error: { message: String(e?.message ?? e), traceback: "" },
      });
    } finally {
      setBusy(false);
    }
  };

  const doFormat = async () => {
    setBusy(true);
    try {
      const code = editor.current!.getValue();
      const res = await pyRuntime.format(code);
      if (res.ok && typeof res.formatted === "string") {
        // Apply only while the doc still matches the snapshot that was sent:
        // the first format micropip-installs black (seconds), the editor
        // stays live meanwhile, and an unconditional write would discard
        // anything typed during the wait. Skip the write too when black
        // changed nothing, so already-tidy code gets no needless history
        // entry or cursor jump.
        if (res.formatted !== code && editor.current?.getValue() === code)
          editor.current.setValue(res.formatted);
        setRunView(null);
      } else {
        // The console region only renders once hasRun is set; without it a
        // pre-first-run format error would be set and never shown.
        setHasRun(true);
        setRunView({
          stdout: "",
          figures: [],
          error: {
            message: "Can't format: fix the syntax error first.",
            traceback: res.error ?? "",
          },
        });
      }
    } catch (e: any) {
      setHasRun(true);
      setRunView({
        stdout: "",
        figures: [],
        error: { message: String(e?.message ?? e), traceback: "" },
      });
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    editor.current?.setValue(lesson.starter);
    // setValue fires onDocChanged; cancel that scheduled save so the explicit
    // write below sticks. The starter is SAVED as the draft rather than the
    // record being cleared: the server merge keeps a draft that only one side
    // has (code: local ?? server), so a cleared field would resurrect the old
    // draft from disk on the next boot.
    dropPendingSave();
    updateLessonProgress(pathId, lessonId, { code: lesson.starter });
  };

  const gradeable = fm.type !== "read_run";
  const canWork = !busy && pythonReady;
  // Exactly one backlit button per screen, and the light travels: the
  // required action glows (Run on read_run lessons, Submit otherwise) until
  // the lesson is passed, then it hands off to Next. Passed with no next
  // lesson leaves nothing lit — there is nothing left to do here.
  const lit: "run" | "submit" | "next" | null = completed
    ? ref?.nextId
      ? "next"
      : null
    : gradeable
      ? "submit"
      : "run";
  // Forward is earned: a lesson opens the next one only once it is complete,
  // so nobody advances past practice they haven't done. Back is always
  // available, and the unit page still lists every lesson.
  const nextLocked = Boolean(ref?.nextId) && !completed;
  // One definition of "available right now" per action, shared by the page
  // chords and the editor keymap so the two can't disagree; undefined means
  // the chord does nothing, matching the buttons' disabled attribute.
  const runAction = canWork ? () => void doRun() : undefined;
  const submitAction = canWork && gradeable ? () => void doGrade() : undefined;
  const formatAction = canWork ? () => void doFormat() : undefined;
  const go = (id: string) => {
    location.hash = href.lesson(pathId, id);
  };
  // Rebuilt every render, so the guards here match what the buttons show. A
  // keymap has no disabled state: without these, holding the run chord during
  // a run would queue a second one.
  chordActions.current = {
    run: runAction,
    submit: submitAction,
    format: formatAction,
    prev: ref?.prevId ? () => go(ref.prevId!) : undefined,
    next: ref?.nextId && !nextLocked ? () => go(ref.nextId!) : undefined,
    help: () => setShowKeys(true),
  };

  const output: RunView | null = result
    ? {
        stdout: result.stdout,
        error: result.runtimeError,
        figures: result.figures,
      }
    : runView;

  const statusText = pythonReady
    ? "Python ready"
    : status === "restarting"
      ? "Python restarting…"
      : status === "failed"
        ? "Python failed to load — reload the page to retry"
        : "Loading Python…";
  // The light says the same thing the text does: steady green when ready,
  // rust when the runtime gave up, breathing amber while it is still coming.
  const dotState = pythonReady ? "ready" : status === "failed" ? "failed" : "busy";

  return (
    <div class="lesson">
      <div class="lesson-context">
        <header class="lesson-head">
          <h1>{fm.title}</h1>
          <span class="lesson-meta">
            {pos >= 0 && `${pos + 1} of ${unit!.lessons.length} · `}
            {STAGE_LABEL[fm.type]} · ~{mins} min
            {completed && (
              <span class="done-badge" ref={doneRef}>
                {" · "}
                <svg
                  class={`check-draw${justCompleted ? " fresh" : ""}`}
                  viewBox="0 0 16 16"
                  aria-hidden="true"
                >
                  <path d="M2.8 8.6l3.3 3.3 7.1-7.4" />
                </svg>{" "}
                +{config.ep_per_lesson} EP
              </span>
            )}
          </span>
        </header>
        {fm.predict && !completed && (
          <div class="predict-box">
            <span class="predict-label">Before you run it</span>
            {fm.predict}
          </div>
        )}
        <div
          class="prose"
          ref={proseRef}
          // Rendered from our own markdown files (html disabled in markdown-it).
          dangerouslySetInnerHTML={{ __html: proseHtml }}
        />
      </div>

      <div class="lesson-action">
        <div class="workbench">
          <div class="workbench-head">
            <span class={`status-dot ${dotState}`} />
            <span>{statusText}</span>
            <button class="btn btn-quiet" onClick={reset} disabled={busy}>
              Reset code
            </button>
            <button
              class="btn btn-quiet"
              onClick={doFormat}
              disabled={busy || !pythonReady}
              title={chordHint("format")}
              aria-keyshortcuts={chordAria("format")}
            >
              Format
            </button>
          </div>
          <Editor
            ref={editor}
            initial={saved.code ?? lesson.starter}
            onDocChanged={onDocChanged}
            onRun={runAction}
            onSubmit={submitAction}
            onFormat={formatAction}
          />
          <div class="workbench-actions">
            <button
              class={`btn${lit === "run" ? " btn-primary" : ""}`}
              onClick={doRun}
              disabled={busy || !pythonReady}
              title={chordHint("run")}
              aria-keyshortcuts={chordAria("run")}
            >
              {busy ? "Working…" : "Run"}
              <kbd class="btn-kbd">{chordLabel("run")}</kbd>
            </button>
            {gradeable && (
              <button
                class={`btn${lit === "submit" ? " btn-primary" : ""}`}
                onClick={doGrade}
                disabled={busy || !pythonReady}
                title={chordHint("submit")}
                aria-keyshortcuts={chordAria("submit")}
              >
                Submit
                <kbd class="btn-kbd">{chordLabel("submit")}</kbd>
              </button>
            )}
            <span class="nav-spacer" />
            {ref?.prevId && (
              <a
                class="btn btn-quiet"
                href={href.lesson(pathId, ref.prevId)}
                title={chordHint("prev")}
                aria-keyshortcuts={chordAria("prev")}
              >
                ← Back
              </a>
            )}
            {ref?.nextId && (
              <a
                ref={nextBtn}
                class={`btn${lit === "next" ? " btn-primary" : ""}${autoNext ? " counting" : ""}`}
                // No href while locked: that alone makes the link inert to
                // click, Enter, and the focus ring, the way a disabled
                // button is.
                href={nextLocked ? undefined : href.lesson(pathId, ref.nextId)}
                aria-disabled={nextLocked ? "true" : undefined}
                title={
                  nextLocked
                    ? `Finish this lesson to open the next one${gradeable ? " (Submit)" : " (Run)"}.`
                    : autoNext
                      ? "Advancing in a moment. Press any key to stay."
                      : chordHint("next")
                }
                aria-keyshortcuts={nextLocked ? undefined : chordAria("next")}
              >
                {autoNext && (
                  <span
                    class="btn-sweep"
                    aria-hidden="true"
                    style={{ animationDuration: `${AUTO_ADVANCE_MS}ms` }}
                  />
                )}
                <span class="btn-label">Next →</span>
                {autoNext && <span class="btn-auto">auto</span>}
              </a>
            )}
          </div>
          {/* Results and console share one scroll region. Separately they
              each claimed their own slice of a fixed-height column, and
              together they overflowed it — which the workbench's
              overflow:hidden turned into silently clipped output. The whole
              region stays unrendered until the first Run/Submit, so a fresh
              lesson gives all of this height to the editor. */}
          {hasRun && (
            <div class="workbench-output">
              {result && (
                <Results
                  result={result}
                  lessonId={lessonId}
                  failHint={fm.grading?.ai?.fail_hint}
                />
              )}
              <OutputPanel
                stdout={output?.stdout ?? ""}
                error={output?.error ?? null}
                figures={output?.figures ?? []}
                waiting={busy && !output}
              />
            </div>
          )}
        </div>
      </div>
      {burst && (
        <ConfettiBurst
          anchor={() => doneRef.current}
          onDone={() => setBurst(false)}
        />
      )}
      {showKeys && <ShortcutsOverlay onClose={() => setShowKeys(false)} />}
    </div>
  );
}
