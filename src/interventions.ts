import type { PatternId, PatternResult } from "./patterns.js";

export type InterventionType =
  | "predict_first"
  | "explain_back"
  | "test_first"
  | "diff_review"
  | "retrieval_exercise";

export interface Intervention {
  pattern: PatternId;
  type: InterventionType;
  message: string;
  domain: string;
  blocking: boolean;
}

// ─── Coaching message templates ───────────────────────────────────────────────
// These are injected into Claude's context via PreToolUse additionalContext.
// Claude reads them and becomes the voice of the coach.

const COACHING: Record<InterventionType, (ctx: string) => string> = {
  predict_first: (ctx) =>
    `[Plum — predict_first] ${ctx}\n` +
    `Before answering, ask the user: "What's your hypothesis here? Walk me through what you think is happening." ` +
    `Engage with their answer before responding — correct or build on it rather than starting from scratch.`,

  test_first: (ctx) =>
    `[Plum — test_first] ${ctx}\n` +
    `Before writing tests, ask: "Write the test spec first — describe the inputs and the expected output — then I'll implement." ` +
    `Don't proceed until the user has provided the spec.`,

  explain_back: (_ctx) =>
    `[Plum — explain_back] Blind-acceptance risk detected.\n` +
    `After showing this output, ask: "Can you walk me through what this change does and why it's correct?" ` +
    `Require their explanation before moving on to the next task.`,

  diff_review: (_ctx) =>
    `[Plum — diff_review] Ask the user to identify one non-obvious thing this diff does before they accept it.`,

  retrieval_exercise: (ctx) =>
    `[Plum — retrieval_exercise] Recurring weakness: ${ctx}\n` +
    `Before answering, ask: "What do you remember about this from last time? Try to recall it without looking it up." ` +
    `Engage with their recall attempt — fill in gaps rather than re-explaining from zero.`
};

const PATTERN_MAP: Record<PatternId, InterventionType> = {
  test_delegation:        "test_first",
  blind_acceptance:       "explain_back",
  repeated_weakness:      "retrieval_exercise",
  debugging_avoidance:    "predict_first",
  architectural_outsourcing: "predict_first",
  decision_outsourcing:   "predict_first",
  design_critique_atrophy: "diff_review"
};

export function buildInterventions(patterns: PatternResult[]): Intervention[] {
  const SEVERITY_RANK = { high: 2, medium: 1, low: 0 };
  const sorted = [...patterns].sort(
    (a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]
  );

  return sorted.map((p) => {
    const type = PATTERN_MAP[p.pattern] ?? "predict_first";
    return {
      pattern:  p.pattern,
      type,
      message:  COACHING[type](p.context),
      domain:   p.domain,
      blocking: p.severity === "high"
    };
  });
}
