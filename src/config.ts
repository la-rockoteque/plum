import { existsSync, readFileSync } from "fs";
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
}

const DEFAULTS: PlumConfig = {
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
  }
};

let _cfg: PlumConfig | null = null;

export function getConfig(): PlumConfig {
  return (_cfg ??= loadConfig());
}

function loadConfig(): PlumConfig {
  if (!existsSync(CONFIG_PATH)) return DEFAULTS;
  try {
    const raw = JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
    return {
      ...DEFAULTS, ...raw,
      thresholds: { ...DEFAULTS.thresholds, ...raw.thresholds },
      domains:    { ...DEFAULTS.domains,    ...raw.domains }
    };
  } catch (e) {
    console.error(`[Plum] Ignoring invalid ${CONFIG_PATH}:`, e);
    return DEFAULTS;
  }
}
