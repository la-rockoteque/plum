// Consent rule: usage statistics are opt-in and personal. A committed (shared) config can only turn them off.
import { test, expect } from "bun:test";
import { resolveConfig } from "./config.js";

const on  = { telemetry: { enabled: true } };
const off = { telemetry: { enabled: false } };

test("statistics are off by default", () => {
  expect(resolveConfig({}).telemetry.enabled).toBe(false);
});

test("a shared config alone cannot turn statistics on", () => {
  expect(resolveConfig({ shared: on }).telemetry.enabled).toBe(false);
  expect(resolveConfig({ shared: { telemetry: { enabled: true, debug: true } } }).telemetry.debug).toBe(false);
});

test("a personal or local opt-in turns statistics on", () => {
  expect(resolveConfig({ personal: on }).telemetry.enabled).toBe(true);
  expect(resolveConfig({ local: on }).telemetry.enabled).toBe(true);
});

test("a shared opt-out wins over a personal or local opt-in", () => {
  expect(resolveConfig({ shared: off, personal: on }).telemetry.enabled).toBe(false);
  expect(resolveConfig({ shared: off, local: on }).telemetry.enabled).toBe(false);
});

test("local overrides personal, both ways", () => {
  expect(resolveConfig({ personal: on, local: off }).telemetry.enabled).toBe(false);
  expect(resolveConfig({ personal: off, local: on }).telemetry.enabled).toBe(true);
});

test("debug follows the same consent rule and needs statistics on", () => {
  expect(resolveConfig({ personal: { telemetry: { enabled: true, debug: true } } }).telemetry.debug).toBe(true);
  expect(resolveConfig({ personal: { telemetry: { debug: true } } }).telemetry.debug).toBe(false);
});

test("other keys merge shared → personal → local, so a team can point feedback at its own form", () => {
  const cfg = resolveConfig({
    shared:   { feedback: { formUrl: "https://forms.example.com/team/viewform", entryId: "entry.1" }, mode: "gating" },
    personal: { mode: "coach" }
  });
  expect(cfg.feedback.formUrl).toBe("https://forms.example.com/team/viewform");
  expect(cfg.feedback.entryId).toBe("entry.1");
  expect(cfg.feedback.enabled).toBe(true);
  expect(cfg.mode).toBe("coach");
  expect(cfg.thresholds.testDelegationMin).toBe(3);
});

test("retention days default to 30 and ignore nonsense", () => {
  expect(resolveConfig({}).telemetry.retentionDays).toBe(30);
  expect(resolveConfig({ personal: { telemetry: { retentionDays: -4 } } }).telemetry.retentionDays).toBe(30);
  expect(resolveConfig({ personal: { telemetry: { retentionDays: 7 } } }).telemetry.retentionDays).toBe(7);
});

test("locale defaults to English and ignores unsupported values; any layer can set it", () => {
  expect(resolveConfig({}).locale).toBe("en");
  expect(resolveConfig({ shared: { locale: "fr" } }).locale).toBe("fr");
  expect(resolveConfig({ shared: { locale: "fr" }, personal: { locale: "en" } }).locale).toBe("en");
  expect(resolveConfig({ personal: { locale: "de" as "fr" } }).locale).toBe("en");
});
