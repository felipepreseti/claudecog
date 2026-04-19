import {
  type ClaudeCogConfig,
  DEFAULT_MAX_TOKENS,
  DEFAULT_MODEL,
  envApiKey,
  loadConfig,
} from "../core/config.js";
import { detectSystemLang, normalizeLang, setLang } from "../i18n/index.js";

/**
 * Build a config without ever prompting the user.
 * Priority: env vars > on-disk config > sane defaults.
 * Required: ANTHROPIC_API_KEY (passed by Claude Desktop via user_config).
 */
export async function configFromEnv(): Promise<ClaudeCogConfig> {
  const onDisk = await loadConfig();
  const apiKey = envApiKey() ?? onDisk?.apiKey;
  if (!apiKey) {
    throw new Error(
      "Missing ANTHROPIC_API_KEY. Open the ClaudeCog extension settings in Claude Desktop and paste your key.",
    );
  }

  const lang =
    normalizeLang(process.env.CLAUDECOG_LANG) ??
    onDisk?.lang ??
    detectSystemLang();
  setLang(lang);

  const model = process.env.CLAUDECOG_MODEL || onDisk?.model || DEFAULT_MODEL;
  const maxTokens = Number(process.env.CLAUDECOG_MAX_TOKENS) || onDisk?.maxTokens || DEFAULT_MAX_TOKENS;

  return {
    backend: "anthropic-api",
    apiKey,
    model,
    maxTokens,
    lang,
    createdAt: onDisk?.createdAt ?? new Date().toISOString(),
  };
}
