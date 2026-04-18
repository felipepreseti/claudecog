import { Command } from "commander";
import path from "node:path";
import { ui } from "./core/ui.js";
import { runMap } from "./commands/map.js";
import { runExplain } from "./commands/explain.js";
import { runRisks } from "./commands/risks.js";
import { runWizard } from "./setup/wizard.js";
import { configPath, loadConfig, resetConfig } from "./core/config.js";
import {
  detectSystemLang,
  isLang,
  normalizeLang,
  setLang,
  t,
  type Lang,
} from "./i18n/index.js";

const VERSION = "0.1.0";

function resolveCwd(input?: string): string {
  return path.resolve(input ?? process.cwd());
}

async function applyLang(flagLang?: string): Promise<void> {
  const fromFlag = normalizeLang(flagLang);
  if (fromFlag) {
    setLang(fromFlag);
    return;
  }
  const cfg = await loadConfig();
  if (cfg && isLang(cfg.lang)) {
    setLang(cfg.lang);
    return;
  }
  setLang(detectSystemLang());
}

function printHelp(): void {
  const s = t();
  console.log(ui.banner(VERSION));
  console.log(
    ui.box(
      [
        ui.c.bold(s.helpHeadline),
        ``,
        ui.c.bold(s.helpCommandsTitle),
        `  ${ui.cmd("claudecog map")}                ${ui.subtle(s.helpCmdMap)}`,
        `  ${ui.cmd("claudecog explain <file>")}     ${ui.subtle(s.helpCmdExplain)}`,
        `  ${ui.cmd("claudecog risks")}              ${ui.subtle(s.helpCmdRisks)}`,
        `  ${ui.cmd("claudecog setup")}              ${ui.subtle(s.helpCmdSetup)}`,
        ``,
        ui.c.bold(s.helpQuickStart),
        `  $ cd your-project`,
        `  $ ${ui.accent("claudecog map")}`,
        ``,
        ui.subtle(s.helpFirstRun),
      ].join("\n"),
      { title: `v${VERSION}`, color: "magenta" },
    ),
  );
}

async function main(): Promise<void> {
  const langArgIndex = process.argv.findIndex(
    (a) => a === "--lang" || a === "-L",
  );
  const langArg =
    langArgIndex >= 0 ? process.argv[langArgIndex + 1] : undefined;
  await applyLang(langArg);
  const s = t();

  const program = new Command();
  program
    .name("claudecog")
    .description(s.cliDescription)
    .version(VERSION, "-v, --version")
    .helpOption("-h, --help")
    .option("-L, --lang <code>", s.optLang)
    .showHelpAfterError(false)
    .configureHelp({ showGlobalOptions: true })
    .action(() => printHelp());

  program
    .command("map")
    .description(s.cmdMapDesc)
    .option("-C, --cwd <path>", s.optCwd, process.cwd())
    .option("--no-open", s.optNoOpen)
    .option("--refresh", s.optRefresh, false)
    .action(async (opts) => {
      await runMap({
        cwd: resolveCwd(opts.cwd),
        open: opts.open !== false,
        refresh: !!opts.refresh,
      });
    });

  program
    .command("explain")
    .description(s.cmdExplainDesc)
    .argument("[file]", s.cmdExplainArg)
    .option("-C, --cwd <path>", s.optCwd, process.cwd())
    .option("--save", s.optSave, false)
    .action(async (file: string | undefined, opts) => {
      await runExplain({
        cwd: resolveCwd(opts.cwd),
        file,
        save: !!opts.save,
      });
    });

  program
    .command("risks")
    .description(s.cmdRisksDesc)
    .option("-C, --cwd <path>", s.optCwd, process.cwd())
    .option("--refresh", s.optRefresh, false)
    .option("--json", s.optJson, false)
    .action(async (opts) => {
      await runRisks({
        cwd: resolveCwd(opts.cwd),
        refresh: !!opts.refresh,
        json: !!opts.json,
      });
    });

  program
    .command("setup")
    .description(s.cmdSetupDesc)
    .option("--reset", s.optReset, false)
    .action(async (opts) => {
      if (opts.reset) {
        await resetConfig();
        ui.info(t().configResetDone);
      }
      await runWizard();
    });

  program
    .command("config")
    .description(s.cmdConfigDesc)
    .action(async () => {
      const cfg = await loadConfig();
      const sx = t();
      console.log(ui.kv(sx.kvPath, configPath()));
      if (!cfg) {
        console.log(ui.subtle(sx.configNoneYet));
        return;
      }
      console.log(ui.kv(sx.kvBackend, cfg.backend));
      console.log(ui.kv(sx.kvModel, cfg.model));
      console.log(ui.kv(sx.kvLanguage, cfg.lang));
      console.log(ui.kv(sx.kvMaxTokens, String(cfg.maxTokens)));
      console.log(
        ui.kv(
          sx.kvApiKey,
          cfg.apiKey ? `******** (${sx.kvApiKeyStored})` : `(${sx.kvApiKeyFromEnv})`,
        ),
      );
      console.log(ui.kv(sx.kvCreatedAt, cfg.createdAt));
    });

  try {
    await program.parseAsync(process.argv);
  } catch (err) {
    const e = err as Error & { status?: number };
    const msg = humanizeError(e);
    ui.fail(msg.title, msg.hint);
    process.exit(1);
  }
}

function humanizeError(e: Error & { status?: number }): {
  title: string;
  hint: string;
} {
  const s = t();
  const raw = e.message || s.errGenericHint;
  if (e.status === 401 || /authentication_error|invalid x-api-key/i.test(raw)) {
    return { title: s.errAuth, hint: s.errAuthHint };
  }
  if (e.status === 429 || /rate_limit/i.test(raw)) {
    return { title: s.errRate, hint: s.errRateHint };
  }
  if (/ENOTFOUND|ECONNREFUSED|fetch failed/i.test(raw)) {
    return { title: s.errNetwork, hint: s.errNetworkHint };
  }
  if (/Claude Code CLI/i.test(raw)) {
    return { title: raw, hint: s.errClaudeCodeMissingHint };
  }
  if (/parseable JSON/i.test(raw)) {
    return { title: s.errParse, hint: s.errParseHint };
  }
  return { title: raw, hint: s.errGenericHint };
}

main();
