import { existsSync, readFileSync } from "fs";
import { CONFIG_PATH } from "./env.js";

export interface PlumConfig {
  enabled: boolean;
  mode: "coach" | "gating";
  minEventsBeforeIntervene: number;
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
  if (_cfg) return _cfg;
  try {
    if (existsSync(CONFIG_PATH)) {
      const raw = JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
      _cfg = { ...DEFAULTS, ...raw, thresholds: { ...DEFAULTS.thresholds, ...raw.thresholds } };
    } else {
      _cfg = DEFAULTS;
    }
  } catch {
    _cfg = DEFAULTS;
  }
  return _cfg;
}
