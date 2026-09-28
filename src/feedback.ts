/**
 * Feedback: builds a pre-filled Google Form link. Nothing is ever submitted from here —
 * the user reviews the text in the browser and clicks Submit themselves. This module makes no network calls.
 */
import { readFileSync } from "fs";
import { join } from "path";
import { platform, arch } from "os";
import { getConfig, DEFAULTS } from "./config.js";
import { PLUM_REPO_DIR } from "./env.js";

export const MAX_TEXT = 5_000;
export const MAX_URL  = 7_000;
export const DEFAULT_FORM = { formUrl: DEFAULTS.feedback.formUrl, entryId: DEFAULTS.feedback.entryId };

export type FeedbackKind = "feature" | "bug" | "feedback";
const LABELS: Record<FeedbackKind, string> = { feature: "Feature request", bug: "Bug report", feedback: "Feedback" };

export interface FeedbackInput {
  kind: FeedbackKind;
  message: string;
  why?: string;
  contact?: string;
  context?: string;   // omit to leave the context line out
}

export function composeFeedback({ kind, message, why, contact, context }: FeedbackInput): string {
  const [summary = "", ...rest] = message.trim().split("\n");
  const details = rest.join("\n").trim();
  const text = [
    `[${LABELS[kind]}] ${summary.trim()}`,
    details && `\n${details}`,
    why?.trim() && `\nWhy: ${why.trim()}`,
    context && `\nContext: ${context}`,
    contact?.trim() && `${context ? "" : "\n"}Contact: ${contact.trim()}`
  ].filter(Boolean).join("\n");
  return text.length <= MAX_TEXT ? text : text.slice(0, MAX_TEXT - 1) + "…";
}

// Only https form URLs; returns the host so callers can show where the browser will go.
export function validateFormUrl(formUrl: string): string {
  let url: URL;
  try { url = new URL(formUrl); } catch { throw new Error(`Invalid form URL: ${formUrl}`); }
  if (url.protocol !== "https:") throw new Error(`Form URL must use https, got ${url.protocol}`);
  return url.host;
}

export type FormLink =
  | { kind: "link"; url: string; host: string }
  | { kind: "paste"; url: string; host: string; reason: string };

export function buildFormLink(formUrl: string, entryId: string, text: string): FormLink {
  const host = validateFormUrl(formUrl);
  if (!/^entry\.\d+$/.test(entryId)) throw new Error(`Invalid form entry id: ${entryId}`);
  const url = new URL(formUrl);
  url.search = "";
  url.hash   = "";
  url.searchParams.set("usp", "pp_url");
  url.searchParams.set(entryId, text);
  const prefilled = url.toString();
  if (prefilled.length <= MAX_URL) return { kind: "link", url: prefilled, host };
  return {
    kind: "paste", url: formUrl, host,
    reason: `the pre-filled link would be ${prefilled.length} characters (limit ${MAX_URL})`
  };
}

// Non-identifying runtime context: versions, mode and whether statistics are on. No paths, repo or user names.
export function contextLine(): string {
  const cfg = getConfig();
  return `Plum ${plumVersion()}, mode=${cfg.mode}, statistics=${cfg.telemetry.enabled ? "on" : "off"}, ` +
         `Bun ${Bun.version}, ${platform()}-${arch()}`;
}

// Plugins without a pinned version are versioned by commit; a checkout reports "dev".
function plumVersion(): string {
  try {
    const pinned = JSON.parse(readFileSync(join(PLUM_REPO_DIR, ".claude-plugin", "plugin.json"), "utf-8")).version;
    if (pinned) return pinned;
  } catch { /* fall through */ }
  const dir = PLUM_REPO_DIR.split("/").pop() ?? "";
  return /^[0-9a-f]{7,40}$/.test(dir) ? dir.slice(0, 7) : "dev";
}

// Prints the exact text and the link; opens the browser only when asked. Returns a process exit code.
export function presentFeedback(text: string, open: boolean): number {
  const { feedback } = getConfig();
  if (!feedback.enabled) {
    console.error("[Plum] Feedback is disabled in config (feedback.enabled = false).");
    return 1;
  }
  let link: FormLink;
  try { link = buildFormLink(feedback.formUrl, feedback.entryId, text); }
  catch (e) { console.error(`[Plum] ${(e as Error).message}`); return 1; }

  console.log(`Form host: ${link.host}\n`);
  console.log("──── Text ────");
  console.log(text);
  console.log("──────────────\n");
  if (link.kind === "link") console.log(`Link:\n${link.url}\n`);
  else console.log(`The text is too long for a link (${link.reason}).\nOpen the form and paste the text above:\n${link.url}\n`);

  if (open) openInBrowser(link.url);
  console.log(open
    ? "Opened in your browser. Nothing has been sent — review the form and click Submit if you want to send it."
    : "Nothing has been sent. Open the link, review the form, and click Submit if you want to send it.");
  return 0;
}

function openInBrowser(url: string): void {
  const cmd = process.platform === "darwin" ? ["open", url]
            : process.platform === "win32"  ? ["cmd", "/c", "start", "", url]
            : ["xdg-open", url];
  Bun.spawn(cmd, { stdout: "ignore", stderr: "ignore" });
}

// `plum feedback --kind feature|bug|feedback --message <text> [--why] [--contact] [--no-context] [--open]`
export async function runFeedbackCommand(argv: string[]): Promise<number> {
  const args = parseFlags(argv);
  const kind = (args.kind ?? "feedback") as FeedbackKind;
  if (!(kind in LABELS)) { console.error("[Plum] --kind must be feature, bug or feedback"); return 1; }

  const message = args.message ?? (process.stdin.isTTY ? "" : await Bun.stdin.text());
  if (!message.trim()) { console.error("[Plum] Nothing to send: pass --message or pipe the text on stdin."); return 1; }

  const text = composeFeedback({
    kind, message, why: args.why, contact: args.contact,
    context: args["no-context"] ? undefined : contextLine()
  });
  return presentFeedback(text, args.open === "true");
}

export function parseFlags(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key  = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) out[key] = "true";
    else { out[key] = next; i++; }
  }
  return out;
}
