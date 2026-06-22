export type SkillDomain =
  | "implementation"
  | "debugging"
  | "testing"
  | "architecture"
  | "synthesis"
  | "search";

const TEST_RE  = /\btest(s|ing|ed)?\b|spec|jest|vitest|pytest|rspec|mocha|_test\.|\.test\.|\.spec\.|cargo test|go test|coverage/i;
const DEBUG_RE = /\berror\b|\bfix\b|\bbug\b|exception|traceback|failed|undefined is not|cannot read|TypeError|ReferenceError|NullPointerException|segfault|panic:/i;
const ARCH_RE  = /architect|system design|design pattern|structure|approach|should i use|which .* (to use|is better)|tradeoff|trade-off|scalab/i;
const SYNTH_RE = /\bsummariz|\bexplain\b|\bunderstand\b|\bmean\b|what does|how does|what is|describe|overview|document/i;

export function categorizeToolCall(toolName: string, toolInput: unknown): SkillDomain {
  const s = JSON.stringify(toolInput ?? {});

  switch (toolName) {
    case "Bash":
      if (TEST_RE.test(s))  return "testing";
      if (DEBUG_RE.test(s)) return "debugging";
      return "implementation";

    case "Edit":
    case "Write":
      if (TEST_RE.test(s)) return "testing";
      return "implementation";

    case "Agent":
      if (ARCH_RE.test(s))  return "architecture";
      if (TEST_RE.test(s))  return "testing";
      if (DEBUG_RE.test(s)) return "debugging";
      if (SYNTH_RE.test(s)) return "synthesis";
      return "synthesis";

    case "Read":
    case "Grep":
    case "Glob":
      return "search";

    case "WebSearch":
    case "WebFetch":
      return "synthesis";

    default:
      return "implementation";
  }
}

export function categorizePrompt(prompt: string): SkillDomain {
  if (TEST_RE.test(prompt))  return "testing";
  if (DEBUG_RE.test(prompt)) return "debugging";
  if (ARCH_RE.test(prompt))  return "architecture";
  if (SYNTH_RE.test(prompt)) return "synthesis";
  return "implementation";
}

// Only these tools represent meaningful delegation worth tracking / intervening on
export function isDelegationSignificant(toolName: string): boolean {
  return ["Agent", "Bash", "Edit", "Write"].includes(toolName);
}
