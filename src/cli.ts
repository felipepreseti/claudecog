import { Command } from "commander";
import path from "node:path";
import { ui } from "./core/ui.js";
import { runMap } from "./commands/map.js";
import { runExplain } from "./commands/explain.js";
import { runRisks } from "./commands/risks.js";
import { runWizard } from "./setup/wizard.js";
import { configPath, loadConfig, resetConfig } from "./core/config.js";

const VERSION = "0.1.0";

function resolveCwd(input?: string): string {
  return path.resolve(input ?? process.cwd());
}

function printHelp(): void {
  console.log(ui.banner(VERSION));
  console.log(
    ui.box(
      [
        `${ui.c.bold("ClaudeCog")} is a cognitive layer for code.`,
        `It reads your repo as a system, not a pile of files.`,
        ``,
        ui.c.bold("Commands"),
        `  ${ui.cmd("claudecog map")}                ${ui.subtle("model the system + open interactive graph")}`,
        `  ${ui.cmd("claudecog explain <file>")}     ${ui.subtle("senior-engineer walkthrough of one file")}`,
        `  ${ui.cmd("claudecog risks")}              ${ui.subtle("prioritized list of real risks")}`,
        `  ${ui.cmd("claudecog setup")}              ${ui.subtle("(re)configure how Claude is called")}`,
        ``,
        ui.c.bold("Quick start"),
        `  $ cd your-project`,
        `  $ ${ui.accent("claudecog map")}`,
        ``,
        ui.subtle("First run? It will guide you through a 30-second setup."),
      ].join("\n"),
      { title: `v${VERSION}`, color: "magenta" },
    ),
  );
}

async function main(): Promise<void> {
  const program = new Command();
  program
    .name("claudecog")
    .description("A cognitive layer for code. Powered by Claude.")
    .version(VERSION, "-v, --version", "show version")
    .helpOption("-h, --help", "show help")
    .showHelpAfterError(false)
    .configureHelp({ showGlobalOptions: true })
    .action(() => printHelp());

  program
    .command("map")
    .description("Model the system as a graph and open an interactive view in your browser")
    .option("-C, --cwd <path>", "directory to analyze", process.cwd())
    .option("--no-open", "do not open the browser automatically")
    .option("--refresh", "ignore cache and re-analyze", false)
    .action(async (opts) => {
      await runMap({
        cwd: resolveCwd(opts.cwd),
        open: opts.open !== false,
        refresh: !!opts.refresh,
      });
    });

  program
    .command("explain")
    .description("Senior-engineer walkthrough of a single file")
    .argument("[file]", "path to the file (relative to cwd)")
    .option("-C, --cwd <path>", "directory to analyze", process.cwd())
    .option("--save", "save the explanation to .claudecog/", false)
    .action(async (file: string | undefined, opts) => {
      await runExplain({
        cwd: resolveCwd(opts.cwd),
        file,
        save: !!opts.save,
      });
    });

  program
    .command("risks")
    .description("Prioritized list of real risks (no lint nits)")
    .option("-C, --cwd <path>", "directory to analyze", process.cwd())
    .option("--refresh", "ignore cache and re-analyze", false)
    .option("--json", "print raw JSON", false)
    .action(async (opts) => {
      await runRisks({
        cwd: resolveCwd(opts.cwd),
        refresh: !!opts.refresh,
        json: !!opts.json,
      });
    });

  program
    .command("setup")
    .description("Configure how ClaudeCog talks to Claude")
    .option("--reset", "delete existing config first", false)
    .action(async (opts) => {
      if (opts.reset) {
        await resetConfig();
        ui.info("Existing config removed.");
      }
      await runWizard();
    });

  program
    .command("config")
    .description("Show where the config lives and what it contains")
    .action(async () => {
      const cfg = await loadConfig();
      console.log(ui.kv("path", configPath()));
      if (!cfg) {
        console.log(ui.subtle("No config yet. Run `claudecog setup`."));
        return;
      }
      console.log(ui.kv("backend", cfg.backend));
      console.log(ui.kv("model", cfg.model));
      console.log(ui.kv("maxTokens", String(cfg.maxTokens)));
      console.log(ui.kv("apiKey", cfg.apiKey ? "•••••••• (stored)" : "(from env)"));
      console.log(ui.kv("createdAt", cfg.createdAt));
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
  const raw = e.message || "Something went wrong.";
  if (e.status === 401 || /authentication_error|invalid x-api-key/i.test(raw)) {
    return {
      title: "Anthropic rejected your API key.",
      hint: "Run `claudecog setup --reset` to enter a new key, or check ANTHROPIC_API_KEY in your environment.",
    };
  }
  if (e.status === 429 || /rate_limit/i.test(raw)) {
    return {
      title: "Anthropic rate-limited the request.",
      hint: "Wait a moment and try again, or lower --max-tokens.",
    };
  }
  if (/ENOTFOUND|ECONNREFUSED|fetch failed/i.test(raw)) {
    return {
      title: "Couldn't reach Anthropic.",
      hint: "Check your internet connection and try again.",
    };
  }
  if (/Claude Code CLI/i.test(raw)) {
    return {
      title: raw,
      hint: "Install Claude Code from https://www.anthropic.com/claude-code, or run `claudecog setup --reset` to switch to the API.",
    };
  }
  if (/parseable JSON/i.test(raw)) {
    return {
      title: "Claude returned a response we couldn't parse.",
      hint: "This is rare — re-run with --refresh, or open an issue with the repo you tried it on.",
    };
  }
  return {
    title: raw,
    hint: "Re-run with NODE_OPTIONS=--stack-trace-limit=20 to see more, or open an issue.",
  };
}

main();
