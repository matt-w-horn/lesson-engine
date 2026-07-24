// The scaffolding-fade ladder, made visible: each practice type gets a marker
// whose fill drains as support is removed — solid for read_run (the worked
// example carries you) down to hollow for write (you carry it). Used as the
// stage glyph on unit lists and as the position strip on lesson pages.
import type { LessonType } from "../schemas";

/** Fraction of the marker left filled = scaffold still standing. */
export const STAGE_FILL: Record<LessonType, number> = {
  read_run: 1,
  explore: 0.75,
  complete: 0.5,
  debug: 0.25,
  write: 0,
};

export const STAGE_LABEL: Record<LessonType, string> = {
  read_run: "read & run",
  explore: "explore",
  complete: "complete",
  debug: "debug",
  write: "write",
};

export const STAGE_HINT: Record<LessonType, string> = {
  read_run: "read & run — a worked example; the scaffold carries you",
  explore: "explore — nudge the numbers, watch what moves",
  complete: "complete — most of the code stands, you fill the gap",
  debug: "debug — something is wrong; find it",
  write: "write — no scaffold, all yours",
};

export function StageMarker({ type }: { type: LessonType }) {
  return (
    <span
      class="stage-marker"
      style={{ "--fill": `${STAGE_FILL[type] * 100}%` }}
      aria-hidden="true"
    />
  );
}
