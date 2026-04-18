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
import {
  type Lang,
  getLang,
  listLangs,
  setLang,
  t,
} from "../i18n/index.js";

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
  let s = t();

  const langChoices = listLangs().map((l) => ({
    title: l.name,
    value: l.code,
  }));
  const langInitial = langChoices.findIndex((c) => c.value === getLang());
  const { chosenLang } = await prompts(
    {
      type: "select",
      name: "chosenLang",
      message: s.wizardLangPrompt,
      choices: langChoices,
      initial: langInitial >= 0 ? langInitial : 0,
    },
    { onCancel: cancel },
  );
  setLang(chosenLang as Lang);
  s = t();

  console.log(
    ui.box(
      [
        `${ui.brandTag()} ${s.wizardIntro1}`,
        ``,
        `${ui.subtle(s.wizardIntro2)}`,
        `  ${ui.subtle(configPath())}`,
      ].join("\n"),
      { title: s.wizardTitle, color: "magenta" },
    ),
  );

  const hasClaudeCode = await detectClaudeCodeCli();
  const envKey = envApiKey();

  const choices: Array<{ title: string; description: string; value: string }> = [];

  if (hasClaudeCode) {
    choices.push({
      title: s.wizardChoiceClaudeCode,
      description: s.wizardChoiceClaudeCodeDesc,
      value: "claude-code-cli",
    });
  }
  choices.push({
    title: envKey ? s.wizardChoiceApiKeyDetected : s.wizardChoiceApiKey,
    description: s.wizardChoiceApiKeyDesc,
    value: "anthropic-api",
  });

  const { backend } = await prompts(
    {
      type: "select",
      name: "backend",
      message: s.wizardBackendPrompt,
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
          message: s.wizardUseEnvKey,
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
          message: s.wizardPasteKey,
          validate: (v: string) =>
            v.startsWith("sk-ant-") ? true : s.wizardKeyInvalid,
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
    lang: chosenLang as Lang,
    createdAt: new Date().toISOString(),
  };

  await saveConfig(cfg);

  ui.success(s.wizardReady);
  console.log(
    ui.box(
      [
        `${s.kvBackend.padEnd(8)}  ${ui.accent(cfg.backend)}`,
        `${s.kvModel.padEnd(8)}  ${ui.accent(cfg.model)}`,
        `${s.kvLanguage.padEnd(8)}  ${ui.accent(cfg.lang)}`,
        `${s.kvPath.padEnd(8)}  ${ui.subtle(configPath())}`,
        ``,
        `${ui.subtle(s.wizardTryThese)}`,
        `  ${ui.cmd("claudecog map")}            ${ui.subtle(s.wizardHintMap)}`,
        `  ${ui.cmd("claudecog explain <file>")}  ${ui.subtle(s.wizardHintExplain)}`,
        `  ${ui.cmd("claudecog risks")}           ${ui.subtle(s.wizardHintRisks)}`,
      ].join("\n"),
      { title: s.wizardYoureSet, color: "green" },
    ),
  );

  return cfg;
}

function cancel(): void {
  const s = t();
  ui.fail(s.wizardCancelled, s.wizardCancelledHint);
  process.exit(1);
}
