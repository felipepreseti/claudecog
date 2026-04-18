import prompts from "prompts";
import {
  type ClaudeCogConfig,
  DEFAULT_MAX_TOKENS,
  DEFAULT_MODEL,
  configPath,
  envApiKey,
  loadConfig,
  saveConfig,
} from "../core/config.js";
import { detectClaudeCodeCli } from "../core/claude.js";
import { ui } from "../core/ui.js";

export interface EnsureConfigOptions {
  force?: boolean;
}

export async function ensureConfig(
  opts: EnsureConfigOptions = {},
): Promise<ClaudeCogConfig> {
  if (!opts.force) {
    const existing = await loadConfig();
    if (existing) return existing;
  }
  return await runWizard();
}

export async function runWizard(): Promise<ClaudeCogConfig> {
  console.log(
    ui.box(
      [
        `${ui.brandTag()} needs to talk to Claude on your behalf.`,
        ``,
        `${ui.subtle("This wizard takes ~30 seconds. Your settings will be saved to:")}`,
        `  ${ui.subtle(configPath())}`,
      ].join("\n"),
      { title: "First-time setup", color: "magenta" },
    ),
  );

  const hasClaudeCode = await detectClaudeCodeCli();
  const envKey = envApiKey();

  const choices: Array<{ title: string; description: string; value: string }> = [];

  if (hasClaudeCode) {
    choices.push({
      title: "Use Claude Code (recommended — no extra cost)",
      description: "Detected `claude` CLI on your system. Uses your existing subscription.",
      value: "claude-code-cli",
    });
  }
  choices.push({
    title: envKey
      ? "Use Anthropic API key (detected ANTHROPIC_API_KEY in your environment)"
      : "Use Anthropic API key (paste it now)",
    description: "Direct API access. Pay-per-use. Get a key at console.anthropic.com.",
    value: "anthropic-api",
  });

  const { backend } = await prompts(
    {
      type: "select",
      name: "backend",
      message: "How should ClaudeCog talk to Claude?",
      choices,
      initial: 0,
    },
    { onCancel: cancel },
  );

  let apiKey: string | undefined;
  if (backend === "anthropic-api") {
    if (envKey) {
      const { useEnv } = await prompts(
        {
          type: "confirm",
          name: "useEnv",
          message: "Use the ANTHROPIC_API_KEY from your environment?",
          initial: true,
        },
        { onCancel: cancel },
      );
      if (useEnv) {
        apiKey = envKey;
      }
    }
    if (!apiKey) {
      const { key } = await prompts(
        {
          type: "password",
          name: "key",
          message: "Paste your Anthropic API key (starts with sk-ant-...)",
          validate: (v: string) =>
            v.startsWith("sk-ant-") ? true : "That doesn't look like an Anthropic key.",
        },
        { onCancel: cancel },
      );
      apiKey = key;
    }
  }

  const cfg: ClaudeCogConfig = {
    backend: backend as ClaudeCogConfig["backend"],
    apiKey: backend === "anthropic-api" && apiKey !== envKey ? apiKey : undefined,
    model: DEFAULT_MODEL,
    maxTokens: DEFAULT_MAX_TOKENS,
    createdAt: new Date().toISOString(),
  };

  await saveConfig(cfg);

  ui.success("ClaudeCog is ready.");
  console.log(
    ui.box(
      [
        `Backend  ${ui.accent(cfg.backend)}`,
        `Model    ${ui.accent(cfg.model)}`,
        `Config   ${ui.subtle(configPath())}`,
        ``,
        `${ui.subtle("Try one of these to get started:")}`,
        `  ${ui.cmd("claudecog map")}            ${ui.subtle("# system overview + interactive graph")}`,
        `  ${ui.cmd("claudecog explain <file>")}  ${ui.subtle("# senior-engineer walkthrough")}`,
        `  ${ui.cmd("claudecog risks")}           ${ui.subtle("# prioritized risk report")}`,
      ].join("\n"),
      { title: "You're set", color: "green" },
    ),
  );

  return cfg;
}

function cancel(): void {
  ui.fail("Setup cancelled.", "Run `claudecog setup` whenever you're ready.");
  process.exit(1);
}
