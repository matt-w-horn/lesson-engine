import { describe, expect, it } from "vitest";
import {
  FAIL_LINES,
  PASS_LINES,
  hashLessonId,
  pickLine,
} from "../src/ui/feedback";

describe("feedback lines", () => {
  it("picks deterministically for a given lesson id", () => {
    for (const id of ["u1-l1", "u1-l2", "retry-storm-debug", ""]) {
      expect(pickLine(PASS_LINES, id)).toBe(pickLine(PASS_LINES, id));
      expect(pickLine(FAIL_LINES, id)).toBe(pickLine(FAIL_LINES, id));
    }
  });

  it("always returns a member of the given array", () => {
    for (let i = 0; i < 50; i++) {
      const id = `lesson-${i}`;
      expect(PASS_LINES).toContain(pickLine(PASS_LINES, id));
      expect(FAIL_LINES).toContain(pickLine(FAIL_LINES, id));
    }
  });

  it("varies across lesson ids (not one line for everyone)", () => {
    const seen = new Set(
      Array.from({ length: 60 }, (_, i) => pickLine(PASS_LINES, `l${i}`)),
    );
    expect(seen.size).toBeGreaterThan(1);
  });

  it("keeps the copy voice: plain sentences, no em dashes", () => {
    for (const line of [...PASS_LINES, ...FAIL_LINES]) {
      expect(line).not.toContain("—");
      expect(line.trim().length).toBeGreaterThan(0);
      expect(line.endsWith(".")).toBe(true);
    }
  });

  it("hash is a stable unsigned 32-bit value", () => {
    const h = hashLessonId("u1-l1");
    expect(h).toBe(hashLessonId("u1-l1"));
    expect(h).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(h)).toBe(true);
  });
});
