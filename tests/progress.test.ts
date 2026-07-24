import { describe, expect, it } from "vitest";
import {
  courseRollup,
  pathRollup,
  progressKey,
  totalEp,
  unitRollup,
} from "../src/progress";
import type { Manifest, Progress } from "../src/schemas";

const manifest: Manifest = {
  path: {
    id: "p",
    title: "P",
    courses: [
      {
        id: "c1",
        title: "C1",
        units: [
          { id: "u1", title: "U1", lessons: ["a", "b"] },
          { id: "u2", title: "U2", lessons: ["c", "d", "e"] },
        ],
      },
      {
        id: "c2",
        title: "C2",
        units: [{ id: "u3", title: "U3", lessons: ["f"] }],
      },
    ],
  },
};

// Progress records are keyed `${pathId}/${lessonId}` — build them the same way.
const done = (ids: string[], pathId = "p"): Progress => ({
  v: 1,
  lessons: Object.fromEntries(
    ids.map((id) => [
      progressKey(pathId, id),
      { attempts: 1, completedAt: "2026-07-22T00:00:00Z" },
    ]),
  ),
});

describe("derived rollups", () => {
  it("unit rollup counts only that unit", () => {
    const r = unitRollup(manifest, "c1", "u2", done(["a", "c", "d"]));
    expect(r).toEqual({ done: 2, total: 3, percent: 67 });
  });

  it("course rollup spans its units", () => {
    const r = courseRollup(manifest, "c1", done(["a", "b", "c"]));
    expect(r).toEqual({ done: 3, total: 5, percent: 60 });
  });

  it("path rollup and EP derive from the same state (no double-award possible)", () => {
    const state = done(["a", "f"]);
    expect(pathRollup(manifest, state)).toEqual({
      done: 2,
      total: 6,
      percent: 33,
    });
    expect(totalEp([manifest], state, 30)).toBe(60);
  });

  it("incomplete attempts contribute nothing", () => {
    const state: Progress = { v: 1, lessons: { "p/a": { attempts: 5 } } };
    expect(pathRollup(manifest, state).done).toBe(0);
    expect(totalEp([manifest], state, 30)).toBe(0);
  });

  it("a same-named lesson done in another path does not leak in", () => {
    const state = done(["a"], "other-path");
    expect(pathRollup(manifest, state).done).toBe(0);
  });

  it("EP sums across every path on the shelf", () => {
    const second: Manifest = {
      path: {
        id: "q",
        title: "Q",
        courses: [
          { id: "c", title: "C", units: [{ id: "u", title: "U", lessons: ["a"] }] },
        ],
      },
    };
    const state: Progress = {
      v: 1,
      lessons: {
        ...done(["a", "b"]).lessons,
        ...done(["a"], "q").lessons,
      },
    };
    expect(totalEp([manifest, second], state, 30)).toBe(90);
  });
});
