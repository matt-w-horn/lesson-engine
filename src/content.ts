// Loads config, manifest, and lessons from /content (all data, never code),
// and derives the hierarchy index that powers breadcrumbs and Back/Next.
import yaml from "js-yaml";

// js-yaml v4's load() is safe (no code-executing tags), but pin the schema to
// plain-data explicitly; every parse result is then zod-validated.
export function parseYaml(text: string): unknown {
  return yaml.load(text, { schema: yaml.CORE_SCHEMA });
}
import {
  ConfigSchema,
  FrontmatterSchema,
  ManifestSchema,
  PathsIndexSchema,
  type EngineConfig,
  type Frontmatter,
  type Manifest,
} from "./schemas";

export interface ParsedLessonFile {
  frontmatter: Frontmatter;
  prose: string; // markdown body with the starter fence removed
  starter: string;
}

export interface LoadedLesson extends ParsedLessonFile {
  gradeCode: string;
  baseUrl: string; // for relative image assets in prose
}

export interface LessonRef {
  lessonId: string;
  courseId: string;
  unitId: string;
  prevId: string | null;
  nextId: string | null;
}

export type ManifestCourse = Manifest["path"]["courses"][number];
export type ManifestUnit = ManifestCourse["units"][number];

/** The one place manifest hierarchy lookups live (pages + rollups reuse it). */
export function findCourse(
  manifest: Manifest,
  courseId: string,
): ManifestCourse | undefined {
  return manifest.path.courses.find((c) => c.id === courseId);
}

export function findUnit(
  manifest: Manifest,
  courseId: string,
  unitId: string,
): ManifestUnit | undefined {
  return findCourse(manifest, courseId)?.units.find((u) => u.id === unitId);
}

export interface HierarchyIndex {
  byLesson: Map<string, LessonRef>;
  orderedLessonIds: string[];
}

// ---- pure parsing (unit-tested) ----

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
const STARTER_RE = /^```python starter[ \t]*\r?\n([\s\S]*?)^```[ \t]*$\r?\n?/m;

export function splitFrontmatter(raw: string): {
  frontmatter: unknown;
  body: string;
} {
  const m = raw.match(FRONTMATTER_RE);
  if (!m) throw new Error("lesson.md is missing YAML frontmatter (--- block)");
  return { frontmatter: parseYaml(m[1]), body: raw.slice(m[0].length) };
}

export function extractStarter(body: string): {
  prose: string;
  starter: string;
} {
  const matches = [...body.matchAll(new RegExp(STARTER_RE.source, "gm"))];
  if (matches.length !== 1) {
    throw new Error(
      `expected exactly one \`\`\`python starter fence, found ${matches.length}`,
    );
  }
  const starter = matches[0][1].replace(/\s+$/, "") + "\n";
  const prose = body.replace(new RegExp(STARTER_RE.source, "m"), "").trim();
  return { prose, starter };
}

export function parseLessonFile(raw: string): ParsedLessonFile {
  const { frontmatter, body } = splitFrontmatter(raw);
  const fm = FrontmatterSchema.parse(frontmatter);
  const { prose, starter } = extractStarter(body);
  return { frontmatter: fm, prose, starter };
}

export function buildIndex(manifest: Manifest): HierarchyIndex {
  const byLesson = new Map<string, LessonRef>();
  const ordered: string[] = [];
  for (const course of manifest.path.courses) {
    for (const unit of course.units) {
      for (const lessonId of unit.lessons) {
        byLesson.set(lessonId, {
          lessonId,
          courseId: course.id,
          unitId: unit.id,
          prevId: null,
          nextId: null,
        });
        ordered.push(lessonId);
      }
    }
  }
  ordered.forEach((id, i) => {
    const ref = byLesson.get(id)!;
    ref.prevId = i > 0 ? ordered[i - 1] : null;
    ref.nextId = i < ordered.length - 1 ? ordered[i + 1] : null;
  });
  return { byLesson, orderedLessonIds: ordered };
}

// ---- fetch-based loaders (browser) ----

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.text();
}

export async function loadConfig(): Promise<EngineConfig> {
  return ConfigSchema.parse(parseYaml(await fetchText("/content/config.yaml")));
}

/** Shelf order of paths; each id is a folder under /content/paths/. */
export async function loadPathsIndex(): Promise<string[]> {
  return PathsIndexSchema.parse(
    parseYaml(await fetchText("/content/paths.yaml")),
  ).paths;
}

export async function loadManifest(pathId: string): Promise<Manifest> {
  const manifest = ManifestSchema.parse(
    parseYaml(await fetchText(`/content/paths/${pathId}/manifest.yaml`)),
  );
  if (manifest.path.id !== pathId) {
    throw new Error(
      `path ${pathId}: manifest path id "${manifest.path.id}" != folder name`,
    );
  }
  return manifest;
}

const lessonCache = new Map<string, LoadedLesson>();

export async function loadLesson(
  pathId: string,
  lessonId: string,
): Promise<LoadedLesson> {
  const cacheKey = `${pathId}/${lessonId}`;
  const cached = lessonCache.get(cacheKey);
  if (cached) return cached;
  const baseUrl = `/content/paths/${pathId}/lessons/${lessonId}/`;
  const [rawMd, gradeCode] = await Promise.all([
    fetchText(`${baseUrl}lesson.md`),
    fetchText(`${baseUrl}grade.py`),
  ]);
  const parsed = parseLessonFile(rawMd);
  if (parsed.frontmatter.id !== lessonId) {
    throw new Error(
      `lesson ${lessonId}: frontmatter id "${parsed.frontmatter.id}" != directory name`,
    );
  }
  const lesson: LoadedLesson = { ...parsed, gradeCode, baseUrl };
  lessonCache.set(cacheKey, lesson);
  return lesson;
}
