// Auto-advance policy, pure and testable. After a submission the page asks
// this one question; the timer, sweep, and cancel listeners live in the page.
import type { LessonType } from "../schemas";

/** How long a successful submission waits before moving on. The Next
    button's sweep reads its duration from here too, so the visual and the
    timer cannot drift. */
export const AUTO_ADVANCE_MS = 1500;

/**
 * Advance only on the submission that first completes a lesson, and only
 * when there is somewhere to go. read_run lessons complete on Run and are
 * never auto-advanced; re-submissions of an already complete lesson stay
 * put.
 */
export function shouldAutoAdvance(args: {
  passed: boolean;
  alreadyCompleted: boolean;
  type: LessonType;
  nextId: string | undefined;
}): boolean {
  return (
    args.passed &&
    !args.alreadyCompleted &&
    args.type !== "read_run" &&
    Boolean(args.nextId)
  );
}
