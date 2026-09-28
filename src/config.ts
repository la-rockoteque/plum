import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { CONFIG_PATH } from "./env.js";

export interface PlumConfig {
  enabled: boolean;
  mode: "coach" | "gating";
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
  telemetry: {
    enabled: boolean;     // opt-in, personal/local only (see resolveConfig)
    debug: boolean;       // also write tracebacks to a local debug log
    retentionDays: number;
  };
}

export const DEFAULTS: PlumConfig = {
  enabled: true,
  mode: "coach",
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
  telemetry: {
    enabled: false,
    debug: false,
    retentionDays: 30
  }
};

type Layer = Partial<Omit<PlumConfig, "thresholds" | "domains" | "feedback" | "telemetry">> & {
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

// Merge DEFAULTS ← shared ← personal ← local, then apply the consent rule for usage statistics:
// only a personal or local layer can turn them on, and a shared `false` always wins.
export function resolveConfig({ shared = {}, personal = {}, local = {} }: ConfigLayers): PlumConfig {
  const layers = [shared, personal, local];
  const merged = layers.reduce<PlumConfig>((acc, l) => ({
    ...acc, ...l,
    thresholds: { ...acc.thresholds, ...l.thresholds },
    domains:    { ...acc.domains,    ...l.domains },
    feedback:   { ...acc.feedback,   ...l.feedback },
    telemetry:  acc.telemetry
  }), DEFAULTS);

  const personalChoice = (key: "enabled" | "debug") =>
    local.telemetry?.[key] ?? personal.telemetry?.[key] ?? false;
  const vetoed  = shared.telemetry?.enabled === false;
  const enabled = !vetoed && personalChoice("enabled") === true;
  const days    = local.telemetry?.retentionDays ?? personal.telemetry?.retentionDays ?? shared.telemetry?.retentionDays;

  return {
    ...merged,
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
  return (_cfg = resolveConfig({
    shared:   sharedPath ? readLayer(sharedPath) : {},
    personal: readLayer(paths.personal),
    local:    readLayer(paths.local)
  }));
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
