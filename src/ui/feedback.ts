// Learner-facing feedback lines for the grade header. Picked by hashing the
// lesson id, so a given lesson keeps its line across re-renders and repeat
// submissions (no slot-machine flicker) while neighbouring lessons vary.
// This is app copy only; every lesson-authored string stays authored data.

export const PASS_LINES = [
  "Clean run.",
  "That holds.",
  "Green across the board.",
  "Nailed it.",
  "Solid work.",
  "Nothing left to fix here.",
] as const;

export const FAIL_LINES = [
  "Not there yet. The failing checks point the way.",
  "Close. Look at what the checks flagged.",
  "Not quite yet. One more pass at it.",
  "Almost. The failing rows tell you where to look.",
  "Keep going. Each attempt narrows it down.",
] as const;

/** FNV-1a, 32-bit: tiny, stable, spreads short ids well. */
export function hashLessonId(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function pickLine(
  lines: readonly string[],
  lessonId: string,
): string {
  return lines[hashLessonId(lessonId) % lines.length];
}
