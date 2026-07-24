// One configured markdown pipeline for all lesson prose:
// markdown-it + KaTeX math + Mermaid fences + relative-asset rewriting.
import MarkdownIt from "markdown-it";
import { katex } from "@mdit/plugin-katex";

const md: MarkdownIt = new MarkdownIt({ html: false, linkify: true });
md.use(katex, { throwOnError: false });

/* ---------- :::task and :::why containers ----------

   The lesson's call to action and its explanation are structurally different
   things, so the markup says so instead of leaving it to a heading
   convention. `:::task` renders the one thing to do, always visible;
   `:::why` renders the explanation collapsed, so the code is what the
   learner meets first.

       :::task
       Fix line 7 so the mask is computed elementwise.
       :::

       :::why What `and` does to an array
       ...explanation, full markdown including math...
       :::

   Body content is tokenized as normal markdown (math, lists, and fences all
   work inside), and raw HTML stays disabled: nothing here needs it, and the
   prose is model-generated, so the smaller surface is the safer one. */

const CONTAINER_OPEN = /^:::[ \t]*(task|why)[ \t]*(.*)$/;
const CONTAINER_NAMES = ["task", "why"] as const;
type ContainerName = (typeof CONTAINER_NAMES)[number];

md.block.ruler.before(
  "fence",
  "lesson_container",
  (state, startLine, endLine, silent) => {
    // An indented line is a code block, not a container.
    if (state.sCount[startLine] - state.blkIndent >= 4) return false;
    const open = state.src.slice(
      state.bMarks[startLine] + state.tShift[startLine],
      state.eMarks[startLine],
    );
    const m = CONTAINER_OPEN.exec(open);
    if (!m) return false;
    if (silent) return true;

    // Scan for the closing ":::" line. An unterminated container runs to the
    // end of the block rather than swallowing the rest of the document.
    let nextLine = startLine;
    for (;;) {
      nextLine++;
      if (nextLine >= endLine) break;
      const line = state.src.slice(
        state.bMarks[nextLine] + state.tShift[nextLine],
        state.eMarks[nextLine],
      );
      if (line.trim() === ":::") break;
    }

    const oldParent = state.parentType;
    const oldLineMax = state.lineMax;
    state.parentType = "root"; // container body parses as top-level blocks
    state.lineMax = nextLine;

    const name = m[1] as ContainerName;
    const openToken = state.push("lesson_container_open", "div", 1);
    openToken.markup = ":::";
    openToken.block = true;
    openToken.info = m[2].trim();
    openToken.meta = { name };
    openToken.map = [startLine, nextLine];

    state.md.block.tokenize(state, startLine + 1, nextLine);

    const closeToken = state.push("lesson_container_close", "div", -1);
    closeToken.markup = ":::";
    closeToken.block = true;
    closeToken.meta = { name };

    state.parentType = oldParent;
    state.lineMax = oldLineMax;
    state.line = Math.min(nextLine + 1, endLine);
    return true;
  },
  { alt: ["paragraph", "reference", "blockquote", "list"] },
);

// Default labels; a container may override with text after the name.
const CONTAINER_LABEL: Record<ContainerName, string> = {
  task: "Task",
  why: "Why this works",
};

md.renderer.rules.lesson_container_open = (tokens, idx) => {
  const token = tokens[idx];
  const name = (token.meta?.name ?? "why") as ContainerName;
  // Inline markdown in the label, so a summary can name `code` or $math$.
  const label = token.info
    ? md.renderInline(token.info)
    : CONTAINER_LABEL[name];
  return name === "task"
    ? `<div class="task-card"><p class="task-label">${label}</p>`
    : `<details class="hint"><summary>${label}</summary><div class="hint-body">`;
};

md.renderer.rules.lesson_container_close = (tokens, idx) => {
  const name = (tokens[idx].meta?.name ?? "why") as ContainerName;
  return name === "task" ? "</div>\n" : "</div></details>\n";
};

// ```mermaid fences render as <pre class="mermaid"> for mermaid.run();
// mermaid reads textContent, so normal HTML escaping is correct here.
const defaultFence =
  md.renderer.rules.fence ??
  ((tokens, idx, options, _env, self) =>
    self.renderToken(tokens, idx, options));
md.renderer.rules.fence = (tokens, idx, options, env, self) => {
  const token = tokens[idx];
  if (token.info.trim() === "mermaid") {
    return `<pre class="mermaid">${md.utils.escapeHtml(token.content)}</pre>`;
  }
  return defaultFence(tokens, idx, options, env, self);
};

// Rewrite relative image srcs against the lesson's base URL (env.baseUrl).
const defaultImage =
  md.renderer.rules.image ??
  ((tokens, idx, options, _env, self) =>
    self.renderToken(tokens, idx, options));
md.renderer.rules.image = (tokens, idx, options, env, self) => {
  const token = tokens[idx];
  const src = token.attrGet("src");
  const baseUrl: string | undefined = env?.baseUrl;
  if (src && baseUrl && !/^([a-z]+:)?\/\//i.test(src) && !src.startsWith("/")) {
    token.attrSet("src", baseUrl + src);
  }
  return defaultImage(tokens, idx, options, env, self);
};

// Rendered-HTML cache: lessons are immutable per session (lessonCache serves
// the same object), but LessonPage remounts per navigation — without this,
// every Back/Next revisit re-runs the full markdown + KaTeX pass.
const htmlCache = new Map<string, string>();

export function renderProse(markdown: string, baseUrl?: string): string {
  if (baseUrl) {
    const cached = htmlCache.get(baseUrl);
    if (cached !== undefined) return cached;
  }
  const html = md.render(markdown, { baseUrl });
  if (baseUrl) htmlCache.set(baseUrl, html);
  return html;
}

// Lazy-load mermaid only when a rendered lesson actually contains a diagram.
let mermaidReady: Promise<typeof import("mermaid")["default"]> | null = null;

export async function renderMermaidIn(container: HTMLElement): Promise<void> {
  const nodes = container.querySelectorAll<HTMLElement>("pre.mermaid");
  if (nodes.length === 0) return;
  if (!mermaidReady) {
    mermaidReady = import("mermaid").then((m) => {
      m.default.initialize({ startOnLoad: false, theme: "neutral" });
      return m.default;
    });
  }
  const mermaid = await mermaidReady;
  await mermaid.run({ nodes: Array.from(nodes) });
}
