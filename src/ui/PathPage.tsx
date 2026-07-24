import { usePath } from "./App";
import { href } from "../router";
import { progress, courseRollup, pathRollup } from "../progress";
import { ProgressBar } from "./ProgressBar";
import { count } from "./format";

export function PathPage({ pathId }: { pathId: string }) {
  const path = usePath(pathId);
  if (!path) return <p>Unknown path.</p>;
  const { manifest } = path;
  const state = progress.value;
  const overall = pathRollup(manifest, state);
  return (
    <div>
      <h1>{manifest.path.title}</h1>
      <div class="rollup-line">
        <ProgressBar percent={overall.percent} />
        <span>
          {overall.done}/{overall.total} lessons · {overall.percent}%
        </span>
      </div>
      <ul class="card-list">
        {manifest.path.courses.map((course, i) => {
          const r = courseRollup(manifest, course.id, state);
          return (
            <li key={course.id}>
              <a class="card" href={href.course(pathId, course.id)}>
                <div class="eyebrow">Course {i + 1}</div>
                <div class="card-title">{course.title}</div>
                <div class="card-meta">
                  {count(course.units.length, "unit")} · {r.done}/{r.total}{" "}
                  lessons
                </div>
                <ProgressBar percent={r.percent} />
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
