// The single source of truth for every data shape in the engine.
// Imported by the runtime loaders (content.ts, progress.ts), the build-time
// validator (scripts/validate.ts), and the grader server (server/grade.ts).
import { z } from "zod";

export const LESSON_TYPES = [
  "read_run",
  "explore",
  "complete",
  "debug",
  "write",
] as const;
export type LessonType = (typeof LESSON_TYPES)[number];

// Packages the engine will let a lesson request from Pyodide — the scientific
// core most lessons want; extend the whitelist when a lesson needs more.
export const PYODIDE_PACKAGES = [
  "numpy",
  "scipy",
  "sympy",
  "matplotlib",
] as const;

/** One score: checks passed over checks total. */
export const ScoreSchema = z.object({
  passed: z.number().int(),
  total: z.number().int(),
});
export type Score = z.infer<typeof ScoreSchema>;

const idSchema = z.string().regex(/^[a-z0-9][a-z0-9-]*$/, "kebab-case id");

export const AiGradingSchema = z.object({
  mode: z.enum(["augment", "replace"]),
  criteria: z.string().trim().min(1),
  fail_hint: z.string().optional(),
});
export type AiGrading = z.infer<typeof AiGradingSchema>;

export const FrontmatterSchema = z
  .object({
    id: idSchema,
    title: z.string().min(1),
    type: z.enum(LESSON_TYPES),
    packages: z.array(z.enum(PYODIDE_PACKAGES)).optional(),
    entry_point: z.string().optional(),
    est_minutes: z.number().positive().optional(),
    tags: z.array(z.string()).optional(),
    predict: z.string().optional(),
    grading: z.object({ ai: AiGradingSchema.optional() }).strict().optional(),
  })
  .strict();
export type Frontmatter = z.infer<typeof FrontmatterSchema>;

/** Which paths the engine serves, in shelf order — ids of folders under
 *  content/paths/. Empty is valid: a fresh engine has no paths yet. */
export const PathsIndexSchema = z
  .object({ paths: z.array(idSchema) })
  .strict();
export type PathsIndex = z.infer<typeof PathsIndexSchema>;

export const ManifestSchema = z
  .object({
    path: z
      .object({
        id: idSchema,
        title: z.string().min(1),
        courses: z
          .array(
            z
              .object({
                id: idSchema,
                title: z.string().min(1),
                units: z
                  .array(
                    z
                      .object({
                        id: idSchema,
                        title: z.string().min(1),
                        lessons: z.array(idSchema).min(1),
                      })
                      .strict(),
                  )
                  .min(1),
              })
              .strict(),
          )
          .min(1),
      })
      .strict(),
  })
  .strict();
export type Manifest = z.infer<typeof ManifestSchema>;

export const ConfigSchema = z
  .object({
    /** App name shown in the topbar — no path owns the brand anymore. */
    app_title: z.string().min(1),
    ep_per_lesson: z.number().int().positive(),
    est_minutes_by_type: z
      .object({
        read_run: z.number().positive(),
        explore: z.number().positive(),
        complete: z.number().positive(),
        debug: z.number().positive(),
        write: z.number().positive(),
      })
      .strict(),
    default_packages: z.array(z.enum(PYODIDE_PACKAGES)),
    run_timeout_ms: z.number().int().positive(),
    // The Python runtime version is an engine concern, not a content one: it
    // is pinned by the installed pyodide package and vendored at build time,
    // so content no longer names it.
  })
  .strict();
export type EngineConfig = z.infer<typeof ConfigSchema>;

// ---- progress (localStorage; mirrored to the server's file copy) ----

export const LessonProgressSchema = z.object({
  completedAt: z.string().optional(),
  attempts: z.number().int().nonnegative().default(0),
  bestScore: ScoreSchema.optional(),
  code: z.string().optional(),
  aiSkipped: z.boolean().optional(),
});
export type LessonProgress = z.infer<typeof LessonProgressSchema>;

export const ProgressSchema = z.object({
  v: z.literal(1),
  lessons: z.record(z.string(), LessonProgressSchema),
});
export type Progress = z.infer<typeof ProgressSchema>;

// ---- /api/progress wire shapes (shared with server/progress-store.ts) ----
// The PUT request body is just `ProgressSchema` — the file on disk holds the
// same blob localStorage does, so there is one format and no migration surface.

/** `progress: null` means "no file yet", which is not an error. */
export const ProgressGetResponseSchema = z.union([
  z.object({ ok: z.literal(true), progress: ProgressSchema.nullable() }),
  z.object({ ok: z.literal(false), error: z.string() }),
]);
export type ProgressGetResponse = z.infer<typeof ProgressGetResponseSchema>;

export const ProgressPutResponseSchema = z.union([
  z.object({ ok: z.literal(true) }),
  z.object({ ok: z.literal(false), error: z.string() }),
]);
export type ProgressPutResponse = z.infer<typeof ProgressPutResponseSchema>;

// ---- /api/grade wire shapes (shared with server/grade.ts) ----

export const GradeRequestSchema = z.object({
  lessonId: z.string(),
  mode: z.enum(["augment", "replace"]),
  criteria: z.string().trim().min(1),
  entryPoint: z.string().optional(),
  code: z.string(),
  context: z.object({ title: z.string(), type: z.enum(LESSON_TYPES) }),
  deterministic: ScoreSchema,
});
export type GradeRequest = z.infer<typeof GradeRequestSchema>;

export const GradeResponseSchema = z.union([
  z.object({ ok: z.literal(true), verdict: z.enum(["pass", "fail"]) }),
  z.object({ ok: z.literal(false), error: z.string() }),
]);
export type GradeResponse = z.infer<typeof GradeResponseSchema>;
