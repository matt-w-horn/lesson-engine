---
name: verify
description: How to build, launch, and drive the lesson-engine app to observe a change at runtime. Use when verifying a diff in this repo.
---

# Verifying lesson-engine at runtime

## Launch

`make dev` — rebuilds `dist/` and restarts the server, tearing down any old one.
It prints the resolved progress path and confirms both the server and the Caddy
proxy are up.

- **http://learn.test** (no port) → Caddy → `:4173` → Hono serving built `dist/`.
- `:4173` serves the **built** app, so client-code changes need `make dev` (or
  `npx vite build`) before they are visible. **Content does NOT live in dist**:
  both modes serve `/content/*` live from `~/.lesson-engine/content/`
  (override: `LESSON_ENGINE_DATA_DIR`), so lesson edits show on plain reload.
  A fresh data dir is seeded from `examples/content/` at server boot.
- `npm run dev` (`:5173`) is the Vite dev server with HMR — it hosts the same
  `/content/*` and `/api/*` routes via plugins in `vite.config.ts`. Anything
  touching one of those routes must be checked in **both** modes.
- `npm run build` = typecheck + bundle (content-free by design; `npm test`
  validates `examples/content`). `npm run validate` checks the data-dir
  content — advisory, and red whenever a manifest registers unwritten lessons.

## Surfaces

| Change reaches | Drive it via |
|---|---|
| Lesson UI, progress, rollups | Chrome at `http://learn.test` |
| `/api/grade`, `/api/progress` | `curl` against `:4173` **and** `:5173` |
| Python graders | The browser — they run in Pyodide, never server-side |

## Gotcha that will burn you

**Hash navigation is not a page load.** Routing is hash-based (`#/lesson/...`),
so navigating between routes does **not** re-run `boot()` in `src/main.tsx`. Any
boot-time behavior (progress hydration, config load) will appear to work purely
because the in-memory signal survived. To actually test boot:

```js
location.reload()
// then confirm it really happened:
performance.getEntriesByType("navigation")[0].type === "reload"
```

Clearing `localStorage` and then hash-navigating proves nothing — the UI still
renders from memory.

## Driving a completion

Cheapest path to exercise the grading/progress write path: open any `read & run`
lesson (the first lesson of whatever path the shelf shows) and click **Run**.
Wait for "Python ready" first — Pyodide loads from a CDN. Completion shows as
`✓ +30 EP` in the lesson header and bumps the EP badge.

## Learner progress

Stored at `~/.lesson-engine/progress.json` (`0600`, dir `0700`), mirrored from
localStorage. Override with `LESSON_ENGINE_DATA_DIR` — **use a tmpdir when
testing writes** so you don't clobber real progress. A corrupt file is renamed
to `progress.corrupt-<ts>.json` and re-seeded from localStorage on next boot.

Restoring after you break something: the live tab still holds state in memory —
typing in an editor triggers a draft autosave that writes the whole blob back.
