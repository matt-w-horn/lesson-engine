// Serves /content/* from the data dir, and seeds the data dir with the
// bundled starter path on first run. Framework-free (like grade.ts and
// progress-store.ts) so the Hono server and the Vite dev middleware share one
// implementation — content must resolve identically in both run modes.
import { cp, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join, normalize, resolve, sep } from "node:path";
import { contentDir } from "./data-dir";

// Everything a lesson can legitimately ship: the data files themselves plus
// image assets referenced from prose. Anything else 404s rather than being
// guessed at.
const MIME: Record<string, string> = {
  ".yaml": "text/yaml; charset=utf-8",
  ".yml": "text/yaml; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".py": "text/x-python; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

export interface ContentFile {
  data: Buffer;
  type: string;
}

/**
 * Reads one file under the content dir, or null for anything missing,
 * unknown-typed, or outside the root. `urlPath` is the path AFTER the
 * /content prefix (e.g. "/paths/demo/manifest.yaml").
 */
export async function readContentFile(
  urlPath: string,
): Promise<ContentFile | null> {
  const type = MIME[extname(urlPath).toLowerCase()];
  if (!type) return null;
  const root = resolve(contentDir());
  // decodeURIComponent can throw on malformed escapes — treat as a miss.
  let decoded: string;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  if (decoded.includes("\0")) return null;
  // join, not resolve: a leading "/" in `decoded` concatenates under root
  // rather than re-rooting the path (resolve would re-root — join doesn't).
  const abs = normalize(join(root, decoded));
  // Traversal guard: after normalization the target must still be inside the
  // content root. (Localhost-only server, but the invariant is free.)
  if (abs !== root && !abs.startsWith(root + sep)) return null;
  try {
    return { data: await readFile(abs), type };
  } catch {
    return null;
  }
}

/**
 * First-run experience: if the data dir has no content yet, copy the bundled
 * starter content in so the app opens onto a working path. Never touches an
 * existing content dir — a config.yaml there, valid or not, means the dir is
 * owned by the user. Both servers call this once at boot.
 */
export async function seedContentIfMissing(examplesDir: string): Promise<void> {
  const root = contentDir();
  if (existsSync(join(root, "config.yaml"))) return;
  if (!existsSync(join(examplesDir, "config.yaml"))) return; // nothing to seed
  await cp(examplesDir, root, { recursive: true, force: false });
  console.log(`[content] seeded starter content into ${root}`);
}

/** Where both servers log content from, for the boot message. */
export function contentRoot(): string {
  return contentDir();
}
