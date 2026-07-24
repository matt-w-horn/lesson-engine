import { useEffect, useState } from "preact/hooks";
import { usePath } from "./App";
import { useApp } from "./App";
import { href } from "../router";
import { progress, progressKey, unitRollup } from "../progress";
import { findCourse, findUnit, loadLesson, type LoadedLesson } from "../content";
import { ProgressBar } from "./ProgressBar";
import { StageMarker, STAGE_LABEL, STAGE_HINT } from "./Ladder";
import { count } from "./format";

export function UnitPage({
  pathId,
  courseId,
  unitId,
}: {
  pathId: string;
  courseId: string;
  unitId: string;
}) {
  const { config } = useApp();
  const path = usePath(pathId);
  const manifest = path?.manifest;
  const course = manifest && findCourse(manifest, courseId);
  const unit = manifest && findUnit(manifest, courseId, unitId);
  const [lessons, setLessons] = useState<Map<string, LoadedLesson>>(new Map());

  useEffect(() => {
    setLessons(new Map());
    if (!unit) return;
    let alive = true;
    // Per-lesson resolution: rows fill in as each lesson arrives instead of
    // blocking the whole list on the slowest fetch.
    for (const id of unit.lessons) {
      void loadLesson(pathId, id)
        .then((l) => {
          if (alive) setLessons((prev) => new Map(prev).set(id, l));
        })
        .catch(() => {}); // row falls back to its id; LessonPage surfaces the error
    }
    return () => {
      alive = false;
    };
    // Unit ids are only unique per course (and courses per path) — key on all.
  }, [pathId, courseId, unitId]);

  if (!path) return <p>Unknown path.</p>;
  if (!course || !unit) return <p>Unknown unit.</p>;
  const state = progress.value;
  const r = unitRollup(manifest!, courseId, unitId, state);

  const minutesFor = (id: string): number | null => {
    const l = lessons.get(id);
    if (!l) return null;
    return (
      l.frontmatter.est_minutes ??
      config.est_minutes_by_type[l.frontmatter.type]
    );
  };
  const totalMinutes = unit.lessons.reduce(
    (sum, id) => sum + (minutesFor(id) ?? 0),
    0,
  );

  return (
    <div>
      <h1>{unit.title}</h1>
      <div class="rollup-line">
        <ProgressBar percent={r.percent} />
        <span>
          {count(unit.lessons.length, "practice")}
          {totalMinutes > 0 ? ` · ~${Math.round(totalMinutes)} min` : ""} ·{" "}
          {r.done} done
        </span>
      </div>
      <ol class="lesson-list">
        {unit.lessons.map((id) => {
          const l = lessons.get(id);
          const done = Boolean(
            state.lessons[progressKey(pathId, id)]?.completedAt,
          );
          const mins = minutesFor(id);
          return (
            <li key={id}>
              <a
                class={`lesson-row${done ? " done" : ""}`}
                href={href.lesson(pathId, id)}
                title={l && STAGE_HINT[l.frontmatter.type]}
              >
                {l ? (
                  <StageMarker type={l.frontmatter.type} />
                ) : (
                  <span class="stage-marker pending" style={{ "--fill": "0%" }} />
                )}
                <span class="lesson-title">{l?.frontmatter.title ?? id}</span>
                {l && (
                  <span class="type-chip">{STAGE_LABEL[l.frontmatter.type]}</span>
                )}
                {mins != null && <span class="lesson-mins">~{mins} min</span>}
                <span class="lesson-check">{done ? "✓" : ""}</span>
              </a>
            </li>
          );
        })}
      </ol>
      {unit.lessons.length >= 4 && (
        <p class="ladder-note">
          One idea, drilled {count(unit.lessons.length, "way")} — the marker
          empties as the scaffold comes down.
        </p>
      )}
    </div>
  );
}
