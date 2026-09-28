import { existsSync, readFileSync } from "fs";
import { dirname, join } from "path";
import { CONFIG_PATH } from "./env.js";

export type Locale = "en" | "fr";
export const LOCALES: readonly Locale[] = ["en", "fr"];

export type UpdateMode = "prompt" | "silent" | "off";
const UPDATE_MODES: readonly UpdateMode[] = ["prompt", "silent", "off"];

export interface PlumConfig {
  enabled: boolean;
  mode: "coach" | "gating";
  locale: Locale;         // language of generated decks; Claude already answers in the user's language
  minEventsBeforeIntervene: number;
  interventionCooldownMs: number;
  thresholds: {
    testDelegationMin: number;
    debugDelegationRate: number;
    blindAcceptanceMin: number;
    archOutsourcingMin: number;
    archOutsourcingRate: number;
    weekLookbackMs: number;
  };
  domains: Record<string, boolean>;
  feedback: {
    enabled: boolean;
    formUrl: string;      // https Google Form "viewform" URL
    entryId: string;      // the paragraph field that receives the text, "entry.<digits>"
  };
  teach: {
    codeMap: "auto" | "required" | "off";   // code-map graph for precise role binding (docs/code-map.md)
  };
  library: {
    repoUrl?: string;     // where example code is streamed from; defaults to the marketplace's git URL
    ref: string;          // used when the installed commit is unknown
    cacheMaxMb: number;
    cacheTtlDays: number;
    keepAfterUses: number; // concepts fetched this many times stay cached regardless of size/age
  };
  updates: {
    mode: UpdateMode;     // "silent" only from a personal/local layer (see resolveConfig)
    checkIntervalHours: number;
  };
  telemetry: {
    enabled: boolean;     // opt-in, personal/local only (see resolveConfig)
    debug: boolean;       // also write tracebacks to a local debug log
    retentionDays: number;
  };
}

export const DEFAULTS: PlumConfig = {
  enabled: true,
  mode: "coach",
  locale: "en",
  minEventsBeforeIntervene: 8,
  interventionCooldownMs: 1_800_000,
  thresholds: {
    testDelegationMin: 3,
    debugDelegationRate: 0.75,
    blindAcceptanceMin: 4,
    archOutsourcingMin: 3,
    archOutsourcingRate: 0.7,
    weekLookbackMs: 604800000
  },
  domains: {
    implementation: true,
    debugging: true,
    testing: true,
    architecture: true,
    synthesis: true
  },
  feedback: {
    enabled: true,
    formUrl: "https://docs.google.com/forms/d/e/1FAIpQLScqThybRTWZfcqaKSlTGzE2uPhKo5rhg47YYKbJGmxir_VLlg/viewform",
    entryId: "entry.1018508464"
  },
  teach: {
    codeMap: "auto"
  },
  library: {
    ref: "main",
    cacheMaxMb: 25,
    cacheTtlDays: 30,
    keepAfterUses: 3
  },
  updates: {
    mode: "prompt",
    checkIntervalHours: 12
  },
  telemetry: {
    enabled: false,
    debug: false,
    retentionDays: 30
  }
};

type Layer = Partial<Omit<PlumConfig, "thresholds" | "domains" | "feedback" | "telemetry" | "updates" | "library" | "teach">> & {
  teach?: Partial<PlumConfig["teach"]>;
  library?: Partial<PlumConfig["library"]>;
  updates?: Partial<PlumConfig["updates"]>;
  thresholds?: Partial<PlumConfig["thresholds"]>;
  domains?: Record<string, boolean>;
  feedback?: Partial<PlumConfig["feedback"]>;
  telemetry?: Partial<PlumConfig["telemetry"]>;
};

export interface ConfigLayers {
  shared?: Layer;     // <project>/.plum/config.json — committed, applies to the whole team
  personal?: Layer;   // ~/.plum/config.json
  local?: Layer;      // <project>/.plum/config.local.json — this machine only, gitignored
}

// Merge DEFAULTS ← shared ← personal ← local, then apply the consent rules:
// - usage statistics: only a personal or local layer can turn them on; a shared `false` always wins.
// - updates: only a personal or local layer can choose "silent" (it runs new code unasked); a shared "off" wins.
export function resolveConfig({ shared: rawShared = {}, personal = {}, local = {} }: ConfigLayers): PlumConfig {
  // A committed config must not choose where code is fetched from (it would be read, and possibly run).
  const { repoUrl: _repoUrl, ref: _ref, ...sharedLibrary } = rawShared.library ?? {};
  const shared: Layer = { ...rawShared, library: sharedLibrary };
  const layers = [shared, personal, local];
  const merged = layers.reduce<PlumConfig>((acc, l) => ({
    ...acc, ...l,
    thresholds: { ...acc.thresholds, ...l.thresholds },
    domains:    { ...acc.domains,    ...l.domains },
    feedback:   { ...acc.feedback,   ...l.feedback },
    library:    { ...acc.library,    ...l.library },
    teach:      { ...acc.teach,      ...l.teach },
    telemetry:  acc.telemetry,
    updates:    acc.updates
  }), DEFAULTS);

  const personalChoice = (key: "enabled" | "debug") =>
    local.telemetry?.[key] ?? personal.telemetry?.[key] ?? false;
  const vetoed  = shared.telemetry?.enabled === false;
  const enabled = !vetoed && personalChoice("enabled") === true;
  const days    = local.telemetry?.retentionDays ?? personal.telemetry?.retentionDays ?? shared.telemetry?.retentionDays;

  const mode = (m: unknown): UpdateMode | undefined => UPDATE_MODES.includes(m as UpdateMode) ? m as UpdateMode : undefined;
  const sharedMode   = mode(shared.updates?.mode);
  const personalMode = mode(local.updates?.mode) ?? mode(personal.updates?.mode);
  const updateMode: UpdateMode =
    sharedMode === "off" ? "off" : personalMode ?? (sharedMode === "silent" ? "prompt" : sharedMode) ?? DEFAULTS.updates.mode;
  const hours = local.updates?.checkIntervalHours ?? personal.updates?.checkIntervalHours ?? shared.updates?.checkIntervalHours;

  return {
    ...merged,
    locale: LOCALES.includes(merged.locale) ? merged.locale : DEFAULTS.locale,
    updates: {
      mode: updateMode,
      checkIntervalHours: typeof hours === "number" && hours >= 0 && hours <= 24 * 30 ? hours : DEFAULTS.updates.checkIntervalHours
    },
    telemetry: {
      enabled,
      debug: enabled && personalChoice("debug") === true && shared.telemetry?.debug !== false,
      retentionDays: typeof days === "number" && days > 0 && days <= 3650 ? Math.floor(days) : DEFAULTS.telemetry.retentionDays
    }
  };
}

export function projectDir(): string {
  return process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
}

export function configPaths(dir = projectDir()) {
  return {
    shared:   join(dir, ".plum", "config.json"),
    personal: CONFIG_PATH,
    local:    join(dir, ".plum", "config.local.json")
  };
}

let _cfg: PlumConfig | null = null;

export function getConfig(): PlumConfig {
  if (_cfg) return _cfg;
  const paths = configPaths();
  // Home dir as project (e.g. running the CLI from ~) would make ~/.plum/config.json count as "shared".
  const sharedPath = paths.shared === paths.personal ? null : paths.shared;
  const local = readLayer(paths.local);
  // The local layer is trusted like personal config only while it stays out of git. A committed one is shared.
  const localIsShared = Object.keys(local).length > 0 && isTrackedByGit(paths.local);
  const shared = sharedPath ? readLayer(sharedPath) : {};
  return (_cfg = resolveConfig({
    shared:   localIsShared ? mergeLayers(shared, local) : shared,
    personal: readLayer(paths.personal),
    local:    localIsShared ? {} : local
  }));
}

// Long-running callers use this so config changes, like opting out, apply without a restart.
export function reloadConfig(): void { _cfg = null; }

function mergeLayers(a: Layer, b: Layer): Layer {
  return {
    ...a, ...b,
    thresholds: { ...a.thresholds, ...b.thresholds }, domains: { ...a.domains, ...b.domains },
    feedback: { ...a.feedback, ...b.feedback }, library: { ...a.library, ...b.library }, teach: { ...a.teach, ...b.teach },
    telemetry: { ...a.telemetry, ...b.telemetry }, updates: { ...a.updates, ...b.updates }
  };
}

function isTrackedByGit(path: string): boolean {
  try {
    const p = Bun.spawnSync(["git", "-C", dirname(path), "ls-files", "--error-unmatch", "--", path], { stdout: "ignore", stderr: "ignore", timeout: 2_000 });
    return p.exitCode === 0;
  } catch { return false; }
}

function readLayer(path: string): Layer {
  if (!existsSync(path)) return {};
  try {
    const raw = JSON.parse(readFileSync(path, "utf-8"));
    return raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  } catch (e) {
    console.error(`[Plum] Ignoring invalid ${path}:`, e);
    return {};
  }
}
