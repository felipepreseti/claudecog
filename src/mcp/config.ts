import {
  type ClaudeCogConfig,
  DEFAULT_MAX_TOKENS,
  DEFAULT_MODEL,
  envApiKey,
  loadConfig,
} from "../core/config.js";
import { detectClaudeCodeCli } from "../core/claude.js";
import { detectSystemLang, normalizeLang, setLang } from "../i18n/index.js";

/**
 * Build a ClaudeCog config without ever prompting the user.
 * Selection order:
 *   1. ANTHROPIC_API_KEY env var (set by Claude Desktop user_config)
 *   2. API key cached on disk by the standalone CLI
 *   3. Fallback: silently use the local `claude` CLI if it's installed
 *      (advanced users who set it up in their terminal get it for free)
 *   4. Otherwise: a clear error explaining how to get a key
 */
export async function configFromEnv(): Promise<ClaudeCogConfig> {
  const onDisk = await loadConfig();
  const apiKey = envApiKey() ?? onDisk?.apiKey;

  const lang =
    normalizeLang(process.env.CLAUDECOG_LANG) ??
    onDisk?.lang ??
    detectSystemLang();
  setLang(lang);

  const model = process.env.CLAUDECOG_MODEL || onDisk?.model || DEFAULT_MODEL;
  const maxTokens =
    Number(process.env.CLAUDECOG_MAX_TOKENS) ||
    onDisk?.maxTokens ||
    DEFAULT_MAX_TOKENS;

  if (apiKey) {
    return {
      backend: "anthropic-api",
      apiKey,
      model,
      maxTokens,
      lang,
      createdAt: onDisk?.createdAt ?? new Date().toISOString(),
    };
  }

  if (await detectClaudeCodeCli()) {
    return {
      backend: "claude-code-cli",
      apiKey: undefined,
      model,
      maxTokens,
      lang,
      createdAt: onDisk?.createdAt ?? new Date().toISOString(),
    };
  }

  throw new Error(
    "ClaudeCog needs an Anthropic API key. Open the ClaudeCog extension settings in Claude Desktop and paste a key from console.anthropic.com/settings/keys (it's a separate thing from your Claude Pro subscription).",
  );
}
