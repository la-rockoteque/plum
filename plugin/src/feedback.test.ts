import { test, expect } from "bun:test";
import { composeFeedback, buildFormLink, validateFormUrl, MAX_TEXT, MAX_URL, DEFAULT_FORM } from "./feedback.js";

const context = "Plum 0.2.0, mode=coach, statistics=off, Bun 1.3.5, darwin-arm64";

test("composes kind, summary line, details, why, context and contact", () => {
  const text = composeFeedback({
    kind: "feature",
    message: "Teach Rust concepts\nThe library has no Rust examples yet.",
    why: "Our backend is Rust",
    contact: "me@example.com",
    context
  });
  expect(text).toBe([
    "[Feature request] Teach Rust concepts",
    "",
    "The library has no Rust examples yet.",
    "",
    "Why: Our backend is Rust",
    "",
    `Context: ${context}`,
    "Contact: me@example.com"
  ].join("\n"));
});

test("omits empty sections and the context line when asked", () => {
  expect(composeFeedback({ kind: "bug", message: "Deck arrows skip a slide" })).toBe("[Bug report] Deck arrows skip a slide");
});

test("caps the text", () => {
  const text = composeFeedback({ kind: "feedback", message: "x".repeat(MAX_TEXT * 2) });
  expect(text.length).toBeLessThanOrEqual(MAX_TEXT);
  expect(text.endsWith("…")).toBe(true);
});

test("URL-encodes the text into the configured entry", () => {
  const link = buildFormLink(DEFAULT_FORM.formUrl, DEFAULT_FORM.entryId, "[Bug] é & ?=#\nline 2");
  expect(link.kind).toBe("link");
  if (link.kind !== "link") return;
  const url = new URL(link.url);
  expect(url.searchParams.get("usp")).toBe("pp_url");
  expect(url.searchParams.get(DEFAULT_FORM.entryId)).toBe("[Bug] é & ?=#\nline 2");
  expect(link.url).toContain("%26");
  expect(link.url).not.toContain(" ");
});

test("falls back to paste when the link would be too long", () => {
  const long = "€".repeat(3000);            // 9 bytes per char once percent-encoded
  const link = buildFormLink(DEFAULT_FORM.formUrl, DEFAULT_FORM.entryId, long);
  expect(link.kind).toBe("paste");
  if (link.kind === "paste") {
    expect(link.url).toBe(DEFAULT_FORM.formUrl);
    expect(link.reason).toContain(String(MAX_URL));
  }
});

test("accepts only https form URLs", () => {
  expect(validateFormUrl(DEFAULT_FORM.formUrl)).toBe("docs.google.com");
  for (const bad of ["http://docs.google.com/forms/x", "javascript:alert(1)", "file:///etc/passwd", "not a url", "ftp://x"]) {
    expect(() => validateFormUrl(bad)).toThrow();
  }
});

test("rejects entry ids that aren't entry.<digits>", () => {
  expect(() => buildFormLink(DEFAULT_FORM.formUrl, "entry.12&x=1", "hi")).toThrow();
});
