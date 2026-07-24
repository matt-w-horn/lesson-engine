import { describe, expect, it } from "vitest";
import {
  buildIndex,
  extractStarter,
  parseLessonFile,
  splitFrontmatter,
} from "../src/content";
import type { Manifest } from "../src/schemas";

const LESSON = `---
id: demo-lesson
title: "Demo"
type: read_run
predict: "What prints?"
---

Some prose with $\\lambda$ math.

\`\`\`python
# a read-only illustration fence
x = 1
\`\`\`

\`\`\`python starter
print("hello")
\`\`\`

Closing prose.
`;

describe("lesson file parsing", () => {
  it("splits frontmatter from the body", () => {
    const { frontmatter, body } = splitFrontmatter(LESSON);
    expect((frontmatter as any).id).toBe("demo-lesson");
    expect(body).toContain("Some prose");
    expect(body).not.toContain("id: demo-lesson");
  });

  it("throws when frontmatter is missing", () => {
    expect(() => splitFrontmatter("no frontmatter here")).toThrow(
      /frontmatter/,
    );
  });

  it("extracts exactly the starter fence and removes it from prose", () => {
    const { body } = splitFrontmatter(LESSON);
    const { prose, starter } = extractStarter(body);
    expect(starter).toBe('print("hello")\n');
    expect(prose).not.toContain("python starter");
    expect(prose).toContain("read-only illustration"); // other fences stay
    expect(prose).toContain("Closing prose.");
  });

  it("rejects zero and multiple starter fences", () => {
    expect(() => extractStarter("just prose")).toThrow(/found 0/);
    const two = "```python starter\na\n```\n\n```python starter\nb\n```\n";
    expect(() => extractStarter(two)).toThrow(/found 2/);
  });

  it("parses a full lesson file against the schema", () => {
    const lesson = parseLessonFile(LESSON);
    expect(lesson.frontmatter.type).toBe("read_run");
    expect(lesson.frontmatter.predict).toBe("What prints?");
    expect(lesson.starter).toContain("hello");
  });

  it("rejects unknown frontmatter fields (strict schema)", () => {
    const bad = LESSON.replace('predict: "What prints?"', "order: 3");
    expect(() => parseLessonFile(bad)).toThrow();
  });
});

describe("hierarchy index", () => {
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
            { id: "u2", title: "U2", lessons: ["c"] },
          ],
        },
        {
          id: "c2",
          title: "C2",
          units: [{ id: "u3", title: "U3", lessons: ["d"] }],
        },
      ],
    },
  };

  it("orders lessons across units and courses (manifest order IS the order)", () => {
    const idx = buildIndex(manifest);
    expect(idx.orderedLessonIds).toEqual(["a", "b", "c", "d"]);
  });

  it("wires prev/next across unit and course boundaries", () => {
    const idx = buildIndex(manifest);
    expect(idx.byLesson.get("a")).toMatchObject({ prevId: null, nextId: "b" });
    expect(idx.byLesson.get("b")).toMatchObject({ prevId: "a", nextId: "c" });
    expect(idx.byLesson.get("c")).toMatchObject({
      courseId: "c1",
      unitId: "u2",
      nextId: "d",
    });
    expect(idx.byLesson.get("d")).toMatchObject({ courseId: "c2", nextId: null });
  });
});
