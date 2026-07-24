// The one server-side capability: the invisible AI grader. Framework-free so
// it can port to a serverless function later. The model's rationale is logged
// to the server console only — it is never returned to the client.
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
// The SDK's zod helper is typed against the zod v4 core (bundled in zod 3.25+
// under the /v4 subpath); the rest of the app uses the classic import.
import { z } from "zod/v4";
import { GradeRequestSchema, type GradeResponse } from "../src/schemas";

const GRADER_MODEL = () => process.env.GRADER_MODEL ?? "claude-opus-4-8";

// One client per process (connection reuse); lazy so env is loaded first.
let anthropicClient: Anthropic | null = null;
const getClient = () => (anthropicClient ??= new Anthropic());

const Verdict = z.object({
  verdict: z.enum(["pass", "fail"]),
  rationale: z.string(),
});

const SYSTEM = `You are an invisible structural grader inside a practice-first
programming course. You receive a learner's Python solution plus the lesson's
structural criteria. Judge ONLY against the stated criteria — not style, not
performance, not improvements you would make.

Mode semantics:
- "augment": deterministic output checks already PASSED. Your job is to catch
  structural violations the checks cannot see: hardcoded expected values,
  special-casing the test inputs, using a forbidden construct, or bypassing the
  required approach. If the code genuinely implements the required approach,
  verdict is "pass" even if it is inelegant.
- "replace": there are no meaningful deterministic checks (e.g. the artifact is
  a stub, interface, or non-executable spec). Your verdict is the whole grade;
  judge whether the submission satisfies the criteria.

Be strict about hardcoding and special-casing; be lenient about style. Your
rationale is for the course author's server log only — the learner never sees
any of your words.`;

export async function gradeWithAI(body: unknown): Promise<GradeResponse> {
  const parsed = GradeRequestSchema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, error: "bad_request" };
  }
  const req = parsed.data;
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    console.error(
      "[grade] no ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN — grader unavailable (copy .env.example to .env)",
    );
    return { ok: false, error: "grader_not_configured" };
  }

  const client = getClient();
  try {
    const message = await client.messages.parse({
      model: GRADER_MODEL(),
      max_tokens: 2048,
      thinking: { type: "adaptive" },
      system: SYSTEM,
      output_config: {
        effort: "low",
        format: zodOutputFormat(Verdict),
      },
      messages: [
        {
          role: "user",
          content: [
            `Lesson: ${req.context.title} (type: ${req.context.type}, id: ${req.lessonId})`,
            `Mode: ${req.mode}`,
            req.entryPoint ? `Entry point under review: ${req.entryPoint}` : "",
            `Deterministic checks: ${req.deterministic.passed}/${req.deterministic.total} passed`,
            "",
            "Structural criteria:",
            req.criteria,
            "",
            "Learner code:",
            "```python",
            req.code,
            "```",
          ]
            .filter((l) => l !== "")
            .join("\n"),
        },
      ],
    });
    const out = message.parsed_output;
    if (!out) {
      console.error("[grade] no parsed output from model");
      return { ok: false, error: "grader_parse_failed" };
    }
    console.log(
      `[grade] ${req.lessonId} (${req.mode}) → ${out.verdict}\n  rationale: ${out.rationale}`,
    );
    return { ok: true, verdict: out.verdict };
  } catch (err) {
    console.error("[grade] anthropic error:", err);
    return { ok: false, error: "anthropic_unavailable" };
  }
}
