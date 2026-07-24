// Local "production" server: serves the built app from dist/ and exposes the
// single grader route. Run with: npm run build && npm start
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { gradeWithAI } from "./grade";
import {
  contentRoot,
  readContentFile,
  seedContentIfMissing,
} from "./content-static";
import {
  progressFilePath,
  readProgress,
  writeProgress,
} from "./progress-store";

// Tiny .env loader (KEY=value lines); avoids a dotenv dependency. Matches
// dev's loadEnv semantics for the common shapes: optional `export `, quoted
// values (quotes stripped), trailing whitespace trimmed.
const envPath = resolve(import.meta.dirname, "../.env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m || m[1] in process.env) continue;
    let value = m[2].trim();
    const q = value[0];
    if ((q === '"' || q === "'") && value.endsWith(q) && value.length >= 2) {
      value = value.slice(1, -1);
    }
    process.env[m[1]] = value;
  }
}

const app = new Hono();

app.post("/api/grade", async (c) => {
  // Same JSON demand as /api/progress below: with no CORS headers, requiring
  // application/json forces a preflight and makes a browser refuse the
  // cross-site call — without it any web page could invoke the paid grader.
  if (!c.req.header("content-type")?.includes("application/json")) {
    return c.json({ ok: false, error: "expected_json" }, 415);
  }
  const body = await c.req.json().catch(() => null);
  const res = await gradeWithAI(body);
  if (res.ok) return c.json(res, 200);
  // A malformed request is the caller's error, not an upstream failure.
  return c.json(res, res.error === "bad_request" ? 400 : 502);
});

// Method error, not a missing route — mirrors /api/progress below.
app.all("/api/grade", (c) =>
  c.json({ ok: false, error: "method_not_allowed" }, 405),
);

// Registered ahead of serveStatic and the /api/* 404 below — Hono dispatches in
// registration order, and either would otherwise swallow these.
app.get("/api/progress", async (c) => {
  const res = await readProgress();
  return c.json(res, res.ok ? 200 : 500);
});

app.put("/api/progress", async (c) => {
  // Demanding JSON — while sending no CORS headers — is what makes a browser
  // refuse a cross-site write to this endpoint.
  if (!c.req.header("content-type")?.includes("application/json")) {
    return c.json({ ok: false, error: "expected_json" }, 415);
  }
  const body = await c.req.json().catch(() => null);
  const res = await writeProgress(body);
  if (res.ok) return c.json(res, 200);
  if (res.error === "bad_request") return c.json(res, 400);
  if (res.error === "too_large") return c.json(res, 413);
  return c.json(res, 500);
});

// Any other method on this path is a method error, not a missing route — without
// this it would fall through to the /api/* 404 below and disagree with the dev
// middleware in vite.config.ts.
app.all("/api/progress", (c) =>
  c.json({ ok: false, error: "method_not_allowed" }, 405),
);

// Content lives OUTSIDE the repo, in the data dir — served here, never from
// dist/. Registered ahead of serveStatic so a stale dist/content/ copy could
// never shadow the live files. Misses 404 for real: only true page routes may
// fall through to the SPA shell (otherwise a missing lesson file arrives as
// index.html with 200 and surfaces as a baffling frontmatter parse error).
app.get("/content/*", async (c) => {
  const file = await readContentFile(c.req.path.slice("/content".length));
  if (!file) return c.notFound();
  return c.body(new Uint8Array(file.data), 200, { "content-type": file.type });
});

// The vendored Python runtime is immutable per release: its directory carries
// the pyodide version, so a new release lands on a new path and can never be
// shadowed by a stale cached copy. Worth caching hard — it is ~15 MB that
// every lesson page would otherwise revalidate.
app.use("/pyodide/*", async (c, next) => {
  await next();
  if (c.res.status === 200) {
    c.res.headers.set("cache-control", "public, max-age=31536000, immutable");
  }
});

app.use("/*", serveStatic({ root: "./dist" }));
// Real 404s for API misses, same reasoning as /content above.
app.all("/api/*", (c) => c.json({ ok: false, error: "not_found" }, 404));
app.get("*", serveStatic({ path: "./dist/index.html" }));

const port = Number(process.env.PORT ?? 4173);
// First-run: a data dir with no content yet gets the bundled starter path.
await seedContentIfMissing(resolve(import.meta.dirname, "../examples/content"));
if (!existsSync(resolve(import.meta.dirname, "../dist/index.html"))) {
  console.log("dist/ is missing — run `npm run build` first");
}
// Localhost-only: this process writes to disk now, so there is no reason for it
// to be reachable from the network. A local proxy can front it if wanted.
serve({ fetch: app.fetch, port, hostname: "127.0.0.1" }, () => {
  console.log(`lesson-engine serving on http://localhost:${port}`);
  console.log(`content served from ${contentRoot()}`);
  console.log(`progress stored at ${progressFilePath()}`);
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    console.log(
      "note: no ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN — the invisible AI check will degrade gracefully",
    );
  }
});
