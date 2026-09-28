import { join } from "path";

export const HOME = process.env.HOME ?? "/tmp";
export const PLUM_DATA_DIR = process.env.PLUM_DATA_DIR ?? join(HOME, ".plum");
export const PLUM_REPO_DIR = join(import.meta.dir, "..");
export const DB_PATH = join(PLUM_DATA_DIR, "atrophy.db");
// User-owned config lives next to the data, not in the (possibly plugin-cached) install dir
export const CONFIG_PATH = join(PLUM_DATA_DIR, "config.json");
