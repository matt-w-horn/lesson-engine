import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { validateContent } from "../scripts/validate";

const CONFIG = `app_title: "T"
ep_per_lesson: 30
est_minutes_by_type: {read_run: 3, explore: 5, complete: 8, debug: 8, write: 12}
default_packages: [numpy]
run_timeout_ms: 20000
`;

const LESSON = (id: string) => `---
id: ${id}
title: "T"
type: explore
---

Prose.

\`\`\`python starter
x = 1
\`\`\`
`;

const GRADE = `CHECKS = [
    {"name": "x", "fn": lambda ns: ns["x"] == 1, "message": "m", "hidden": False},
]
`;

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

interface FixtureLesson {
  id: string;
  md?: string;
  grade?: string | null;
}

// Content root shape: config.yaml + paths.yaml + paths/p/{manifest.yaml,lessons/}
function fixture(lessonIds: string[][], lessons: FixtureLesson[]): string {
  const root = mkdtempSync(join(tmpdir(), "lesson-engine-test-"));
  dirs.push(root);
  writeFileSync(join(root, "config.yaml"), CONFIG);
  writeFileSync(join(root, "paths.yaml"), "paths: [p]\n");
  const pathDir = join(root, "paths", "p");
  mkdirSync(pathDir, { recursive: true });
  const units = lessonIds
    .map(
      (ids, i) =>
        `        - id: u${i}\n          title: "U${i}"\n          lessons: [${ids.join(", ")}]`,
    )
    .join("\n");
  writeFileSync(
    join(pathDir, "manifest.yaml"),
    `path:\n  id: p\n  title: "P"\n  courses:\n    - id: c\n      title: "C"\n      units:\n${units}\n`,
  );
  for (const l of lessons) {
    const dir = join(pathDir, "lessons", l.id);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "lesson.md"), l.md ?? LESSON(l.id));
    if (l.grade !== null) writeFileSync(join(dir, "grade.py"), l.grade ?? GRADE);
  }
  return root;
}

describe("content validator", () => {
  it("passes a well-formed tree with no errors or warnings", () => {
    const root = fixture([["a", "b"]], [{ id: "a" }, { id: "b" }]);
    const r = validateContent(root);
    expect(r.errors).toEqual([]);
    // Unit size is the authoring skills' advisory territory, not the
    // validator's — a structurally sound tree is silent here.
    expect(r.warnings).toEqual([]);
  });

  it("catches a manifest lesson with no directory / missing paired files", () => {
    const root = fixture([["a", "ghost"]], [{ id: "a" }]);
    const errs = validateContent(root).errors.join("\n");
    expect(errs).toContain("ghost: missing lesson.md");
    expect(errs).toContain("ghost: missing grade.py");
  });

  it("catches a lesson id listed twice in the manifest", () => {
    const root = fixture([["a"], ["a"]], [{ id: "a" }]);
    expect(
      validateContent(root).errors.some((e) => e.includes("appears twice")),
    ).toBe(true);
  });

  it("catches frontmatter id != directory name", () => {
    const root = fixture([["a"]], [{ id: "a", md: LESSON("other") }]);
    expect(
      validateContent(root).errors.some((e) => e.includes('"other"')),
    ).toBe(true);
  });

  it("catches a missing or doubled starter fence", () => {
    const noFence = LESSON("a").replace(/```python starter[\s\S]*?```\n/, "");
    const root = fixture([["a"]], [{ id: "a", md: noFence }]);
    expect(
      validateContent(root).errors.some((e) => e.includes("found 0")),
    ).toBe(true);
  });

  it("catches grade.py without a CHECKS list", () => {
    const root = fixture([["a"]], [{ id: "a", grade: "def f():\n    pass\n" }]);
    expect(
      validateContent(root).errors.some((e) => e.includes("CHECKS")),
    ).toBe(true);
  });

  it("catches invalid frontmatter (unknown type)", () => {
    const bad = LESSON("a").replace("type: explore", "type: quiz");
    const root = fixture([["a"]], [{ id: "a", md: bad }]);
    expect(validateContent(root).errors.length).toBeGreaterThan(0);
  });

  it("warns (not errors) on unreferenced lesson directories", () => {
    const root = fixture([["a"]], [{ id: "a" }, { id: "draft" }]);
    const r = validateContent(root);
    expect(r.errors).toEqual([]);
    expect(r.warnings.some((w) => w.includes("draft"))).toBe(true);
  });

  it("accepts an empty shelf (no paths yet)", () => {
    const root = mkdtempSync(join(tmpdir(), "lesson-engine-test-"));
    dirs.push(root);
    writeFileSync(join(root, "config.yaml"), CONFIG);
    writeFileSync(join(root, "paths.yaml"), "paths: []\n");
    expect(validateContent(root).errors).toEqual([]);
  });

  it("catches a listed path with no folder; warns on an unlisted folder", () => {
    const root = fixture([["a"]], [{ id: "a" }]);
    writeFileSync(join(root, "paths.yaml"), "paths: [p, ghost]\n");
    mkdirSync(join(root, "paths", "stray"), { recursive: true });
    const r = validateContent(root);
    expect(r.errors.some((e) => e.includes("paths/ghost/ is missing"))).toBe(
      true,
    );
    expect(r.warnings.some((w) => w.includes("stray"))).toBe(true);
  });

  it("catches a manifest whose path id differs from its folder name", () => {
    const root = fixture([["a"]], [{ id: "a" }]);
    const manifestPath = join(root, "paths", "p", "manifest.yaml");
    writeFileSync(
      manifestPath,
      `path:\n  id: wrong\n  title: "P"\n  courses:\n    - id: c\n      title: "C"\n      units:\n        - id: u0\n          title: "U0"\n          lessons: [a]\n`,
    );
    expect(
      validateContent(root).errors.some((e) =>
        e.includes('path id "wrong" != folder name'),
      ),
    ).toBe(true);
  });
});
