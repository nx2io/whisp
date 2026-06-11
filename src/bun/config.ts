import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { AppConfig } from "../shared/types";

const CONFIG_DIR = join(homedir(), ".whisp");
const CONFIG_PATH = join(CONFIG_DIR, "config.json");

const defaultConfig: AppConfig = {
  model: "base.en",
  modelsDir: join(homedir(), ".whisp", "models"),
  language: "auto",
  theme: "system",
};

function ensureDir(): void {
  mkdirSync(CONFIG_DIR, { recursive: true });
  mkdirSync(defaultConfig.modelsDir, { recursive: true });
}

export function loadConfig(): AppConfig {
  ensureDir();

  if (!existsSync(CONFIG_PATH)) {
    writeFileSync(CONFIG_PATH, JSON.stringify(defaultConfig, null, 2));
    return { ...defaultConfig };
  }

  try {
    const raw = readFileSync(CONFIG_PATH, "utf-8");
    const parsed = JSON.parse(raw) as Partial<AppConfig>;
    return { ...defaultConfig, ...parsed };
  } catch {
    return { ...defaultConfig };
  }
}

export function saveConfig(partial: Partial<AppConfig>): AppConfig {
  ensureDir();
  const current = loadConfig();
  const merged = { ...current, ...partial };
  writeFileSync(CONFIG_PATH, JSON.stringify(merged, null, 2));
  return merged;
}
