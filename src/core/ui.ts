import chalk from "chalk";
import boxen from "boxen";
import gradient from "gradient-string";
import ora, { type Ora } from "ora";
import { t } from "../i18n/index.js";

const cogGradient = gradient(["#FF6B35", "#F7B801", "#7B68EE"]);
const subtle = chalk.hex("#888888");

export const ui = {
  c: chalk,
  subtle,
  accent: chalk.hex("#FF6B35"),
  ok: chalk.hex("#10B981"),
  warn: chalk.hex("#F59E0B"),
  bad: chalk.hex("#EF4444"),
  brand: chalk.hex("#7B68EE"),

  banner(version: string): string {
    const art = [
      "   ________                __      ______           ",
      "  / ____/ /___ ___  ______/ /__   / ____/___  ____ _",
      " / /   / / __ `/ / / / __  / _ \\ / /   / __ \\/ __ `/",
      "/ /___/ / /_/ / /_/ / /_/ /  __// /___/ /_/ / /_/ / ",
      "\\____/_/\\__,_/\\__,_/\\__,_/\\___/ \\____/\\____/\\__, /  ",
      "                                           /____/   ",
    ].join("\n");

    const s = t();
    const subtitle = subtle(
      `  v${version}  ·  ${s.brandTagline}  ·  ${s.poweredBy}`,
    );
    return `\n${cogGradient.multiline(art)}\n${subtitle}\n`;
  },

  brandTag(): string {
    return cogGradient("ClaudeCog");
  },

  box(content: string, opts?: { title?: string; color?: string }): string {
    return boxen(content, {
      padding: 1,
      margin: { top: 1, bottom: 1, left: 0, right: 0 },
      borderStyle: "round",
      borderColor: opts?.color ?? "magenta",
      title: opts?.title,
      titleAlignment: "left",
    });
  },

  hr(label?: string): string {
    const cols = Math.min(process.stdout.columns ?? 80, 80);
    if (!label) return subtle("─".repeat(cols));
    const left = subtle("── ");
    const mid = chalk.bold.white(label);
    const remaining = Math.max(cols - 4 - label.length, 4);
    const right = subtle(" " + "─".repeat(remaining));
    return `${left}${mid}${right}`;
  },

  spinner(text: string): Ora {
    return ora({
      text,
      spinner: "dots",
      color: "magenta",
    });
  },

  step(n: number, total: number, text: string): string {
    return `${subtle(`[${n}/${total}]`)} ${text}`;
  },

  kv(key: string, value: string): string {
    return `  ${subtle(key.padEnd(14))} ${chalk.white(value)}`;
  },

  bullet(text: string, color: "ok" | "warn" | "bad" | "info" = "info"): string {
    const dot = {
      ok: ui.ok("●"),
      warn: ui.warn("●"),
      bad: ui.bad("●"),
      info: ui.brand("●"),
    }[color];
    return `  ${dot} ${text}`;
  },

  link(url: string): string {
    return chalk.cyan.underline(url);
  },

  cmd(text: string): string {
    return chalk.bold.white(`\`${text}\``);
  },

  success(message: string): void {
    console.log(`\n${ui.ok("✔")} ${chalk.bold.white(message)}\n`);
  },

  fail(message: string, hint?: string): void {
    console.log(`\n${ui.bad("✖")} ${chalk.bold.white(message)}`);
    if (hint) console.log(`  ${subtle(hint)}\n`);
    else console.log();
  },

  info(message: string): void {
    console.log(`${ui.brand("ℹ")} ${message}`);
  },
};

export function fmtNumber(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export function severityChip(sev: "low" | "medium" | "high" | "critical"): string {
  const map = {
    low: chalk.bgHex("#374151").white(" LOW "),
    medium: chalk.bgHex("#F59E0B").black(" MED "),
    high: chalk.bgHex("#EF4444").white(" HIGH "),
    critical: chalk.bgHex("#7F1D1D").white.bold(" CRIT "),
  };
  return map[sev];
}
