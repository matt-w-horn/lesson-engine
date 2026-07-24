// Structural content validator: exactly the checks the runtime loader needs to
// succeed (schemas, referential integrity, one starter fence, id = dirname),
// nothing more — pedagogy and style guidance live in the authoring skills as
// an advisory QA checkpoint, not here. Uses the SAME zod schemas as the
// runtime, so schema drift between authoring and rendering is impossible by
// construction. `npm run validate` checks the data dir (an authoring aid);
// `npm test` checks the bundled examples/content.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ConfigSchema,
  FrontmatterSchema,
  ManifestSchema,
  PathsIndexSchema,
} from "../src/schemas";
import { parseYaml, extractStarter, splitFrontmatter } from "../src/content";
import { contentDir } from "../server/data-dir";

export interface ValidationReport {
  errors: string[];
  warnings: string[];
}

export function validateContent(contentDir: string): ValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const err = (m: string) => errors.push(m);
  const warn = (m: string) => warnings.push(m);

  // -- config (engine-global, checked once) --
  try {
    ConfigSchema.parse(
      parseYaml(readFileSync(join(contentDir, "config.yaml"), "utf8")),
    );
  } catch (e) {
    err(`config.yaml: ${(e as Error).message}`);
  }

  // -- paths index: every listed id has a folder; warn on unlisted folders --
  let pathIds: string[] = [];
  try {
    pathIds = PathsIndexSchema.parse(
      parseYaml(readFileSync(join(contentDir, "paths.yaml"), "utf8")),
    ).paths;
  } catch (e) {
    err(`paths.yaml: ${(e as Error).message}`);
  }
  if (new Set(pathIds).size !== pathIds.length)
    err("paths.yaml: duplicate path id");
  const pathsDir = join(contentDir, "paths");
  const pathDirs = existsSync(pathsDir)
    ? readdirSync(pathsDir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
    : [];
  for (const id of pathIds) {
    if (!pathDirs.includes(id)) err(`paths.yaml lists ${id} but paths/${id}/ is missing`);
  }
  for (const dir of pathDirs) {
    if (!pathIds.includes(dir))
      warn(`paths/${dir} exists but is not in paths.yaml (draft?)`);
  }

  for (const pathId of pathIds) {
    if (pathDirs.includes(pathId)) validatePath(join(pathsDir, pathId), pathId);
  }
  return { errors, warnings };

  // Everything below is scoped to one path folder; ids need only be unique
  // within it. `where` prefixes messages so multi-path reports stay readable.
  function validatePath(pathDir: string, pathId: string): void {
    const where = `paths/${pathId}`;
    let manifest: ReturnType<typeof ManifestSchema.parse> | null = null;
    try {
      manifest = ManifestSchema.parse(
        parseYaml(readFileSync(join(pathDir, "manifest.yaml"), "utf8")),
      );
      if (manifest.path.id !== pathId)
        err(`${where}: manifest path id "${manifest.path.id}" != folder name`);
    } catch (e) {
      err(`${where}/manifest.yaml: ${(e as Error).message}`);
    }

    const lessonsDir = join(pathDir, "lessons");
    const lessonDirs = existsSync(lessonsDir)
      ? readdirSync(lessonsDir, { withFileTypes: true })
          .filter((d) => d.isDirectory())
          .map((d) => d.name)
      : [];

    // -- manifest referential integrity + uniqueness --
    if (manifest) {
      const seenLessons = new Set<string>();
      const seenCourses = new Set<string>();
      for (const course of manifest.path.courses) {
        if (seenCourses.has(course.id))
          err(`${where}: duplicate course id: ${course.id}`);
        seenCourses.add(course.id);
        const seenUnits = new Set<string>();
        for (const unit of course.units) {
          if (seenUnits.has(unit.id))
            err(`${where}: duplicate unit id in ${course.id}: ${unit.id}`);
          seenUnits.add(unit.id);
          for (const lessonId of unit.lessons) {
            if (seenLessons.has(lessonId))
              err(`${where}: lesson id appears twice in manifest: ${lessonId}`);
            seenLessons.add(lessonId);
            const dir = join(lessonsDir, lessonId);
            if (!existsSync(join(dir, "lesson.md")))
              err(`${where}/${lessonId}: missing lesson.md`);
            if (!existsSync(join(dir, "grade.py")))
              err(`${where}/${lessonId}: missing grade.py`);
          }
        }
      }
      for (const dir of lessonDirs) {
        if (!seenLessons.has(dir))
          warn(`${where}/lessons/${dir} exists but is not in the manifest (draft?)`);
      }
    }

    // -- per-lesson checks --
    for (const dir of lessonDirs) {
      const mdPath = join(lessonsDir, dir, "lesson.md");
      if (!existsSync(mdPath)) continue;
      const raw = readFileSync(mdPath, "utf8");
      try {
        const { frontmatter, body } = splitFrontmatter(raw);
        const fm = FrontmatterSchema.parse(frontmatter);
        if (fm.id !== dir)
          err(`${where}/${dir}: frontmatter id "${fm.id}" != directory name`);
        extractStarter(body); // throws unless exactly one starter fence
      } catch (e) {
        err(`${where}/${dir}/lesson.md: ${(e as Error).message}`);
      }
      const gradePath = join(lessonsDir, dir, "grade.py");
      if (existsSync(gradePath)) {
        const grade = readFileSync(gradePath, "utf8");
        // Cheap sanity grep; actually executing grade.py at build time would
        // require Pyodide-in-node (overkill — breakage surfaces on first grade).
        if (!/^CHECKS\s*=/m.test(grade))
          err(`${where}/${dir}/grade.py: no top-level CHECKS list`);
      }
    }
  }
}

// -- CLI --
// With no argument, validates the live data-dir content (the authoring case);
// `npm test` passes examples/content explicitly.
const isMain =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const target = resolve(process.argv[2] ?? contentDir());
  if (!existsSync(join(target, "config.yaml"))) {
    console.log(`no content at ${target} (nothing to validate)`);
    process.exit(0);
  }
  const { errors, warnings } = validateContent(target);
  for (const w of warnings) console.warn(`warn: ${w}`);
  for (const e of errors) console.error(`ERROR: ${e}`);
  console.log(
    errors.length === 0
      ? `${target}: content OK (${warnings.length} warning${warnings.length === 1 ? "" : "s"})`
      : `${target}: ${errors.length} error(s)`,
  );
  process.exit(errors.length === 0 ? 0 : 1);
}
