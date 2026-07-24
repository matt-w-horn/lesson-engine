// The one resolver for the engine's data directory — content, progress, and
// authoring ledgers all live under it, outside the repo:
//
//   <data-dir>/content/    config.yaml, paths.yaml, paths/<id>/…
//   <data-dir>/progress.json
//   <data-dir>/plans/      authoring skills' design ledgers
//
// Resolved from the home directory rather than any module's own location: in
// `npm run dev` these modules are imported from vite.config.ts, which Vite
// bundles into a temp file at the repo root, so a module-relative path would
// quietly resolve differently than under `npm start`. Read fresh each call so
// the env override works no matter when it is set.
import { homedir } from "node:os";
import { join, resolve } from "node:path";

export function dataDir(): string {
  const override = process.env.LESSON_ENGINE_DATA_DIR;
  return override ? resolve(override) : join(homedir(), ".lesson-engine");
}

export function contentDir(): string {
  return join(dataDir(), "content");
}
