import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import type { Lang } from "../i18n/index.js";

export type ClaudeBackend = "anthropic-api" | "claude-code-cli";

export interface ClaudeCogConfig {
  backend: ClaudeBackend;
  apiKey?: string;
  model: string;
  maxTokens: number;
  lang: Lang;
  createdAt: string;
}

const CONFIG_DIR = path.join(os.homedir(), ".claudecog");
const CONFIG_PATH = path.join(CONFIG_DIR, "config.json");

export const DEFAULT_MODEL = "claude-sonnet-4-5";
export const DEFAULT_MAX_TOKENS = 4096;

export async function loadConfig(): Promise<ClaudeCogConfig | null> {
  try {
    const raw = await fs.readFile(CONFIG_PATH, "utf-8");
    const parsed = JSON.parse(raw) as Partial<ClaudeCogConfig>;
    if (!parsed.backend || !parsed.model) return null;
    return {
      backend: parsed.backend,
      apiKey: parsed.apiKey,
      model: parsed.model,
      maxTokens: parsed.maxTokens ?? DEFAULT_MAX_TOKENS,
      lang: (parsed.lang as Lang) ?? "en",
      createdAt: parsed.createdAt ?? new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export async function saveConfig(cfg: ClaudeCogConfig): Promise<void> {
  await fs.mkdir(CONFIG_DIR, { recursive: true });
  await fs.writeFile(CONFIG_PATH, JSON.stringify(cfg, null, 2), {
    mode: 0o600,
  });
}

export function configPath(): string {
  return CONFIG_PATH;
}

export async function resetConfig(): Promise<void> {
  try {
    await fs.unlink(CONFIG_PATH);
  } catch {
    /* noop */
  }
}

export function envApiKey(): string | undefined {
  const key = process.env.ANTHROPIC_API_KEY;
  return key && key.trim().length > 0 ? key.trim() : undefined;
}
