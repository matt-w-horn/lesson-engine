import { createRequire } from "node:module";
import { resolve } from "node:path";
import { loadEnv, type Plugin } from "vite";
import { configDefaults, defineConfig } from "vitest/config";
import preact from "@preact/preset-vite";

// The Python runtime is vendored from this exact package version into
// public/pyodide/v<version>/, and the client builds its load URL from the
// same constant, so the two can never point at different releases.
const PYODIDE_VERSION = createRequire(import.meta.url)(
  "pyodide/package.json",
).version;

// Dev-server middleware exposing the same grader handler the production
// server uses, so `npm run dev` is the whole app — no second process.
function graderDevRoute(): Plugin {
  return {
    name: "grader-dev-route",
    configureServer(server) {
      server.middlewares.use("/api/grade", (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end();
          return;
        }
        // Mirrors the production route: JSON-only and no CORS headers, so a
        // browser refuses a cross-site call to the paid grader.
        if (!req.headers["content-type"]?.includes("application/json")) {
          res.statusCode = 415;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ ok: false, error: "expected_json" }));
          return;
        }
        const chunks: Buffer[] = [];
        req.on("data", (c) => chunks.push(c));
        req.on("end", () => {
          void (async () => {
            let body: unknown = null;
            try {
              body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
            } catch {
              /* handled by schema validation */
            }
            const { gradeWithAI } = await import("./server/grade");
            const out = await gradeWithAI(body);
            res.statusCode = out.ok
              ? 200
              : out.error === "bad_request"
                ? 400
                : 502;
            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify(out));
          })();
        });
      });
    },
  };
}

// Content lives in the data dir, not the repo, so the dev server must serve
// /content/* from the very same place `npm start` does — and seed the starter
// content on first run, so `npm run dev` on a fresh machine opens onto a
// working path.
function contentDevRoute(): Plugin {
  return {
    name: "content-dev-route",
    configureServer(server) {
      // Kicked off at boot, but awaited by every request below: on a fresh
      // machine the browser's first /content/config.yaml fetch races the
      // seed copy, and losing that race would boot-error the first load.
      const seeded = import("./server/content-static").then(
        ({ seedContentIfMissing }) =>
          seedContentIfMissing(resolve(import.meta.dirname, "examples/content")),
      );
      server.middlewares.use("/content", (req, res, next) => {
        if (req.method !== "GET") return next();
        void (async () => {
          await seeded.catch(() => {}); // a failed seed still serves what exists
          const { readContentFile } = await import("./server/content-static");
          const file = await readContentFile(
            (req.url ?? "/").split("?")[0],
          );
          if (!file) {
            res.statusCode = 404;
            res.end("404 Not Found");
            return;
          }
          res.setHeader("content-type", file.type);
          res.end(file.data);
        })();
      });
    },
  };
}

// Same idea for the progress store: dev must read and write the very same file
// `npm start` does, or progress would silently fork between the two modes.
function progressDevRoute(): Plugin {
  return {
    name: "progress-dev-route",
    configureServer(server) {
      server.middlewares.use("/api/progress", (req, res) => {
        const send = (status: number, body: unknown) => {
          res.statusCode = status;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify(body));
        };

        if (req.method === "GET") {
          void (async () => {
            const { readProgress } = await import("./server/progress-store");
            const out = await readProgress();
            send(out.ok ? 200 : 500, out);
          })();
          return;
        }
        if (req.method !== "PUT") {
          // Same status and body as the production route.
          send(405, { ok: false, error: "method_not_allowed" });
          return;
        }
        // Mirrors the production route: JSON-only, and no CORS headers.
        if (!req.headers["content-type"]?.includes("application/json")) {
          send(415, { ok: false, error: "expected_json" });
          return;
        }

        const chunks: Buffer[] = [];
        req.on("data", (c) => chunks.push(c));
        req.on("end", () => {
          void (async () => {
            let body: unknown = null;
            try {
              body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
            } catch {
              /* handled by schema validation */
            }
            const { writeProgress } = await import("./server/progress-store");
            const out = await writeProgress(body);
            if (out.ok) return send(200, out);
            if (out.error === "bad_request") return send(400, out);
            if (out.error === "too_large") return send(413, out);
            return send(500, out);
          })();
        });
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // Make .env's ANTHROPIC_API_KEY visible to the dev grader route (server-side
  // only — nothing is exposed to client code, which only sees VITE_* vars).
  const env = loadEnv(mode, process.cwd(), "");
  // Keep in sync with server/grade.ts's credential contract (either var).
  // LESSON_ENGINE_DATA_DIR belongs here too: without it an override set in .env
  // would apply under `npm start` but not `npm run dev`, splitting the file.
  for (const key of [
    "ANTHROPIC_API_KEY",
    "ANTHROPIC_AUTH_TOKEN",
    "GRADER_MODEL",
    "LESSON_ENGINE_DATA_DIR",
  ]) {
    if (env[key] && !process.env[key]) process.env[key] = env[key];
  }
  return {
    plugins: [preact(), contentDevRoute(), graderDevRoute(), progressDevRoute()],
    define: { __PYODIDE_VERSION__: JSON.stringify(PYODIDE_VERSION) },
    worker: { format: "es" as const },
    test: {
      // .claude/worktrees holds agent worktrees (full repo copies); scanning
      // them would run every test twice against the wrong cwd.
      exclude: [...configDefaults.exclude, ".claude/**"],
    },
  };
});
