import { usePath } from "./App";
import { href } from "../router";
import { progress, courseRollup, unitRollup } from "../progress";
import { findCourse } from "../content";
import { ProgressBar } from "./ProgressBar";
import { count } from "./format";

export function CoursePage({
  pathId,
  courseId,
}: {
  pathId: string;
  courseId: string;
}) {
  const path = usePath(pathId);
  if (!path) return <p>Unknown path.</p>;
  const { manifest } = path;
  const course = findCourse(manifest, courseId);
  if (!course) return <p>Unknown course.</p>;
  const state = progress.value;
  const r = courseRollup(manifest, courseId, state);
  return (
    <div>
      <h1>{course.title}</h1>
      <div class="rollup-line">
        <ProgressBar percent={r.percent} />
        <span>
          {r.done}/{r.total} lessons · {r.percent}%
        </span>
      </div>
      <ul class="card-list">
        {course.units.map((unit, i) => {
          const ur = unitRollup(manifest, courseId, unit.id, state);
          return (
            <li key={unit.id}>
              <a class="card" href={href.unit(pathId, courseId, unit.id)}>
                <div class="eyebrow">Unit {i + 1}</div>
                <div class="card-title">{unit.title}</div>
                <div class="card-meta">
                  {count(unit.lessons.length, "practice")}
                </div>
                <ProgressBar percent={ur.percent} />
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
