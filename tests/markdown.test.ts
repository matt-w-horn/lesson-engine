import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { renderProse } from "../src/markdown";

describe(":::task and :::why containers", () => {
  it("renders a task container as the task card", () => {
    const html = renderProse(":::task\nFix line 7.\n:::\n");
    expect(html).toContain('<div class="task-card">');
    expect(html).toContain('<p class="task-label">Task</p>');
    expect(html).toContain("Fix line 7.");
  });

  it("renders a why container collapsed, with its default label", () => {
    const html = renderProse(":::why\nBecause arrays.\n:::\n");
    expect(html).toContain('<details class="hint">');
    expect(html).toContain("<summary>Why this works</summary>");
    // No `open` attribute: the explanation starts out of the way.
    expect(html).not.toContain("<details class=\"hint\" open");
  });

  it("takes a custom label and renders inline markdown in it", () => {
    const html = renderProse(":::why What `and` does\nBody.\n:::\n");
    expect(html).toContain("<summary>What <code>and</code> does</summary>");
  });

  it("parses the body as markdown, math and fences included", () => {
    const html = renderProse(
      ":::why\n- point at $p = 0.5$\n\n```text\nout 25\n```\n:::\n",
    );
    expect(html).toContain("<li>");
    expect(html).toContain("katex");
    expect(html).toContain('<code class="language-text">');
  });

  it("leaves surrounding prose alone", () => {
    const html = renderProse("Before.\n\n:::task\nDo it.\n:::\n\nAfter.\n");
    expect(html).toContain("<p>Before.</p>");
    expect(html).toContain("<p>After.</p>");
  });

  it("closes an unterminated container at the end of the body", () => {
    const html = renderProse(":::task\nNo closing marker.\n");
    expect(html).toContain('<div class="task-card">');
    expect(html).toContain("No closing marker.");
    expect(html).not.toContain(":::");
  });

  it("ignores an indented marker, which is a code block", () => {
    const html = renderProse("    :::task\n    indented\n");
    expect(html).not.toContain("task-card");
    expect(html).toContain("<pre>");
  });

  it("still escapes HTML in lesson prose", () => {
    const html = renderProse(":::task\n<img src=x onerror=alert(1)>\n:::\n");
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img");
  });
});

describe("every bundled example lesson's prose renders", () => {
  // The engine ships only examples/content; real content lives in the data
  // dir and is validated there by `npm run validate`, not by the test suite.
  const PATHS = join(process.cwd(), "examples/content/paths");
  const lessons: Array<[string, string]> = [];
  for (const pathId of existsSync(PATHS) ? readdirSync(PATHS) : []) {
    const dir = join(PATHS, pathId, "lessons");
    if (!existsSync(dir)) continue;
    for (const id of readdirSync(dir)) {
      const md = join(dir, id, "lesson.md");
      if (existsSync(md)) lessons.push([`${pathId}/${id}`, md]);
    }
  }

  it("renders math without falling back to text", () => {
    for (const [id, md] of lessons) {
      const raw = readFileSync(md, "utf8");
      const html = renderProse(raw.replace(/^---\n[\s\S]*?\n---\n/, ""), id);
      // KaTeX runs with throwOnError:false, so a bad expression renders as a
      // .katex-error span rather than throwing.
      expect(html, id).not.toContain("katex-error");
      // A surviving $ means the math never tokenized — usually because it got
      // wrapped in a code span, which renders the TeX source at the learner.
      expect(html.replace(/<[^>]*>/g, ""), id).not.toContain("$");
    }
  });
});
