import { describe, expect, it } from "vitest";
import { AUTO_ADVANCE_MS, shouldAutoAdvance } from "../src/ui/advance";

const base = {
  passed: true,
  alreadyCompleted: false,
  type: "write" as const,
  nextId: "u1-l4",
};

describe("shouldAutoAdvance", () => {
  it("advances on the submission that first completes a lesson", () => {
    expect(shouldAutoAdvance(base)).toBe(true);
  });

  it("stays put on a failed submission", () => {
    expect(shouldAutoAdvance({ ...base, passed: false })).toBe(false);
  });

  it("stays put on re-submission of an already complete lesson", () => {
    expect(shouldAutoAdvance({ ...base, alreadyCompleted: true })).toBe(false);
  });

  it("never advances read_run lessons (they complete on Run)", () => {
    expect(shouldAutoAdvance({ ...base, type: "read_run" })).toBe(false);
  });

  it("stays put when the unit has no next lesson", () => {
    expect(shouldAutoAdvance({ ...base, nextId: undefined })).toBe(false);
  });

  it("advances all gradeable types", () => {
    for (const type of ["explore", "complete", "debug", "write"] as const) {
      expect(shouldAutoAdvance({ ...base, type })).toBe(true);
    }
  });

  it("waits about a second and a half", () => {
    expect(AUTO_ADVANCE_MS).toBeGreaterThanOrEqual(1000);
    expect(AUTO_ADVANCE_MS).toBeLessThanOrEqual(2000);
  });
});
