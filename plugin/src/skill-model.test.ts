// Scoring v2: weighted engagement per request, over a window, computed from events.
import { test, expect } from "bun:test";
import { scoreDomains, type ScoringEvent } from "./skill-model.js";

const DAY = 86_400_000;
const NOW = 100 * DAY;
let t = NOW - 20 * DAY;
const at = (dtMinutes = 1) => (t += dtMinutes * 60_000);

const prompt = (domain: string, session = "s1"): ScoringEvent => ({ session, ts: at(), type: "user_prompt", domain });
const predict = (session = "s1"): ScoringEvent => ({ session, ts: at(), type: "predict" });
const explained = (quality: "full" | "partial", session = "s1"): ScoringEvent => ({ session, ts: at(), type: "explanation", quality });
const verified = (session = "s1"): ScoringEvent => ({ session, ts: at(), type: "manual_verify" });
const independent = (domain: string, session = "s1"): ScoringEvent => ({ session, ts: at(), type: "independence", domain });
const tool = (domain: string, session = "s1"): ScoringEvent => ({ session, ts: at(), type: "post_tool", domain });

const score = (events: ScoringEvent[], d: string) => scoreDomains(events, NOW).find((s) => s.domain === d)!;

test("no data scores 50 in every domain, stable, not at risk", () => {
  for (const s of scoreDomains([], NOW)) expect(s).toMatchObject({ score: 50, trend: "stable", atRisk: false, requests: 0 });
});

test("tool-call volume doesn't move the score — requests do", () => {
  t = NOW - 20 * DAY;
  const few = [prompt("testing"), tool("testing")];
  t = NOW - 20 * DAY;
  const many = [prompt("testing"), ...Array.from({ length: 500 }, () => tool("testing"))];
  expect(score(many, "testing").score).toBe(score(few, "testing").score);
});

test("a prediction counts for the next request; explain-back and verify for the previous one", () => {
  t = NOW - 20 * DAY;
  const ev = [predict(), prompt("debugging"), explained("full"), prompt("debugging"), verified(), prompt("debugging")];
  const s = score(ev, "debugging");
  // request 1: predict 1 + full explain 2 = 3 → 1.0 ; request 2: verify 1 → 1/3 ; request 3: nothing → 0
  expect(s.requests).toBe(3);
  expect(s.engagement).toBeCloseTo((1 + 1 / 3 + 0) / 3, 5);
  expect(s.score).toBe(Math.round((100 * (1 + 1 / 3 + 0 + 2)) / (3 + 4)));
});

test("weights cap at 3 per request, and signals don't leak across sessions", () => {
  t = NOW - 20 * DAY;
  const ev = [prompt("testing", "a"), explained("full", "a"), explained("full", "a"), verified("a"), predict("b"), prompt("testing", "c")];
  const s = score(ev, "testing");
  expect(s.requests).toBe(2);
  expect(s.engagement).toBeCloseTo(0.5, 5);          // a: capped at 1.0 ; c: the prediction was in session b → 0
});

test("solving something yourself is a fully engaged request of its own", () => {
  t = NOW - 20 * DAY;
  const s = score([independent("architecture"), independent("architecture")], "architecture");
  expect(s.requests).toBe(2);
  expect(s.engagement).toBe(1);
});

test("the score can't saturate on a handful of events", () => {
  t = NOW - 20 * DAY;
  expect(score([prompt("implementation")], "implementation").score).toBeGreaterThan(30);
  t = NOW - 20 * DAY;
  expect(score([independent("implementation")], "implementation").score).toBeLessThan(70);
});

test("events outside the 30-day window are ignored", () => {
  t = NOW - 60 * DAY;
  expect(score([prompt("testing"), prompt("testing"), prompt("testing")], "testing").requests).toBe(0);
});

test("trend compares the last 7 days with the 7 before, only with enough data", () => {
  t = NOW - 13 * DAY;
  const older = Array.from({ length: 4 }, () => prompt("debugging"));      // 0 engagement
  t = NOW - 3 * DAY;
  const recent = Array.from({ length: 4 }, () => [predict(), prompt("debugging"), explained("full")]).flat();
  expect(score([...older, ...recent], "debugging").trend).toBe("up");
  t = NOW - 3 * DAY;
  expect(score([prompt("debugging"), prompt("debugging")], "debugging").trend).toBe("stable");   // too little data
});

test("at risk means a low score backed by enough requests", () => {
  t = NOW - 20 * DAY;
  const lots = Array.from({ length: 12 }, () => prompt("testing"));
  expect(score(lots, "testing").atRisk).toBe(true);
  t = NOW - 20 * DAY;
  expect(score([prompt("testing")], "testing").atRisk).toBe(false);
});
