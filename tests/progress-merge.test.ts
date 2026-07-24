import { describe, expect, it } from "vitest";
import {
  betterScore,
  mergeLessonProgress,
  mergeProgress,
} from "../src/progress-merge";
import type { Progress } from "../src/schemas";

const EARLY = "2026-07-20T00:00:00.000Z";
const LATE = "2026-07-22T00:00:00.000Z";

const empty: Progress = { v: 1, lessons: {} };
const snapshot = (lessons: Progress["lessons"]): Progress => ({ v: 1, lessons });

describe("betterScore", () => {
  it("prefers the higher pass ratio", () => {
    expect(betterScore({ passed: 1, total: 4 }, { passed: 3, total: 4 })).toEqual({
      passed: 3,
      total: 4,
    });
  });

  it("breaks a ratio tie on absolute checks passed", () => {
    expect(betterScore({ passed: 1, total: 2 }, { passed: 2, total: 4 })).toEqual({
      passed: 2,
      total: 4,
    });
  });

  it("is commutative, so merge order cannot change the winner", () => {
    const a = { passed: 1, total: 2 };
    const b = { passed: 2, total: 4 };
    expect(betterScore(a, b)).toEqual(betterScore(b, a));
  });

  it("takes whichever side exists", () => {
    expect(betterScore(undefined, { passed: 1, total: 1 })).toEqual({
      passed: 1,
      total: 1,
    });
    expect(betterScore({ passed: 1, total: 1 }, undefined)).toEqual({
      passed: 1,
      total: 1,
    });
    expect(betterScore(undefined, undefined)).toBeUndefined();
  });
});

describe("mergeLessonProgress", () => {
  it("takes the higher attempt count", () => {
    expect(mergeLessonProgress({ attempts: 2 }, { attempts: 7 }).attempts).toBe(7);
  });

  it("keeps a completion recorded on either side alone", () => {
    expect(
      mergeLessonProgress({ attempts: 1 }, { attempts: 1, completedAt: EARLY })
        .completedAt,
    ).toBe(EARLY);
    expect(
      mergeLessonProgress({ attempts: 1, completedAt: EARLY }, { attempts: 1 })
        .completedAt,
    ).toBe(EARLY);
  });

  it("keeps the earlier completion — the real first pass", () => {
    expect(
      mergeLessonProgress(
        { attempts: 1, completedAt: LATE },
        { attempts: 1, completedAt: EARLY },
      ).completedAt,
    ).toBe(EARLY);
  });

  it("carries aiSkipped along with the completion that won", () => {
    const merged = mergeLessonProgress(
      { attempts: 1, completedAt: LATE, aiSkipped: true },
      { attempts: 1, completedAt: EARLY, aiSkipped: false },
    );
    expect(merged.completedAt).toBe(EARLY);
    expect(merged.aiSkipped).toBe(false);
  });

  it("never downgrades an AI-verified completion on an identical timestamp", () => {
    expect(
      mergeLessonProgress(
        { attempts: 1, completedAt: EARLY, aiSkipped: true },
        { attempts: 1, completedAt: EARLY, aiSkipped: false },
      ).aiSkipped,
    ).toBe(false);
  });

  it("leaves aiSkipped unset when nothing completed", () => {
    expect(mergeLessonProgress({ attempts: 1 }, { attempts: 2 }).aiSkipped)
      .toBeUndefined();
  });

  it("prefers the local draft, but restores the server's when there is none", () => {
    expect(
      mergeLessonProgress(
        { attempts: 0, code: "local" },
        { attempts: 0, code: "server" },
      ).code,
    ).toBe("local");
    expect(
      mergeLessonProgress({ attempts: 0 }, { attempts: 0, code: "server" }).code,
    ).toBe("server");
  });
});

describe("mergeProgress", () => {
  const server = snapshot({
    "p/a": {
      attempts: 3,
      completedAt: EARLY,
      bestScore: { passed: 4, total: 4 },
      code: "print(1)",
    },
  });

  it("recovers everything when local storage was cleared", () => {
    // The headline case: a wiped browser merged against the server's file must
    // come back whole.
    expect(mergeProgress(empty, server)).toEqual(server);
  });

  it("leaves local untouched when the server has nothing yet", () => {
    expect(mergeProgress(server, empty)).toEqual(server);
  });

  it("unions lessons the two sides do not share", () => {
    const local = snapshot({ "p/b": { attempts: 2 } });
    const merged = mergeProgress(local, server);
    expect(Object.keys(merged.lessons)).toEqual(["p/a", "p/b"]);
    expect(merged.lessons["p/a"].completedAt).toBe(EARLY);
    expect(merged.lessons["p/b"].attempts).toBe(2);
  });

  it("is idempotent, so merging on every boot is stable", () => {
    const local = snapshot({
      "p/a": { attempts: 9, completedAt: LATE },
      "p/b": { attempts: 1, code: "draft" },
    });
    const once = mergeProgress(local, server);
    expect(mergeProgress(once, server)).toEqual(once);
  });

  it("orders keys canonically regardless of insertion order", () => {
    const unsorted = snapshot({ "p/z": { attempts: 1 }, "p/a": { attempts: 1 } });
    expect(Object.keys(mergeProgress(unsorted, empty).lessons)).toEqual([
      "p/a",
      "p/z",
    ]);
  });

  it("agrees on the monotonic fields whichever way round it is merged", () => {
    const local = snapshot({
      "p/a": { attempts: 9, completedAt: LATE, bestScore: { passed: 1, total: 4 } },
    });
    const ab = mergeProgress(local, server).lessons["p/a"];
    const ba = mergeProgress(server, local).lessons["p/a"];
    expect(ab.attempts).toBe(ba.attempts);
    expect(ab.completedAt).toBe(ba.completedAt);
    expect(ab.bestScore).toEqual(ba.bestScore);
  });
});
