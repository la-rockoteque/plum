import { join, resolve } from "path";

export const HOME = process.env.HOME ?? "/tmp";
// `claude plugin eval` only passes EVAL_* variables to a case, so evals isolate Plum's data with EVAL_PLUM_DATA_DIR
// (relative paths resolve against the eval workspace) instead of writing into the user's real ~/.plum.
const evalDataDir = process.env.EVAL_PLUM_DATA_DIR
  ? resolve(process.env.CLAUDE_PROJECT_DIR ?? process.cwd(), process.env.EVAL_PLUM_DATA_DIR) : undefined;
export const PLUM_DATA_DIR = process.env.PLUM_DATA_DIR ?? evalDataDir ?? join(HOME, ".plum");
export const PLUM_REPO_DIR = join(import.meta.dir, "..");
// Root of the running plugin copy; tests point it at a fake install.
export const PLUGIN_ROOT = process.env.PLUM_PLUGIN_ROOT ?? PLUM_REPO_DIR;
export const DB_PATH = join(PLUM_DATA_DIR, "atrophy.db");
// User-owned config lives next to the data, not in the (possibly plugin-cached) install dir
export const CONFIG_PATH = join(PLUM_DATA_DIR, "config.json");
