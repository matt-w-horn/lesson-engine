import { useApp } from "./App";
import { href } from "../router";
import { progress, pathRollup } from "../progress";
import { ProgressBar } from "./ProgressBar";
import { count } from "./format";

// The shelf of paths. Courses inside a path are a sequence and get numbers;
// paths are a library, so their cards deliberately carry none.
export function HomePage() {
  const { config, paths } = useApp();
  const state = progress.value;
  return (
    <div>
      <h1>{config.app_title}</h1>
      {paths.length === 0 ? (
        <p class="muted">
          No paths yet. Content lives in <code>~/.lesson-engine/content/</code>:
          put each path under <code>content/paths/</code> and list its id in{" "}
          <code>content/paths.yaml</code>. A starter path is seeded there on
          first run.
        </p>
      ) : (
        <ul class="card-list">
          {paths.map(({ id, manifest }) => {
            const r = pathRollup(manifest, state);
            return (
              <li key={id}>
                <a class="card" href={href.path(id)}>
                  <div class="card-title">{manifest.path.title}</div>
                  <div class="card-meta">
                    {count(manifest.path.courses.length, "course")} · {r.done}/
                    {r.total} lessons
                  </div>
                  <ProgressBar percent={r.percent} />
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
