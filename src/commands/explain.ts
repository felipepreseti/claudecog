import path from "node:path";
import { promises as fs } from "node:fs";
import prompts from "prompts";
import { ensureConfig } from "../setup/wizard.js";
import { makeClient } from "../core/claude.js";
import { readFileSafe, scanRepo, summarizeRepo } from "../core/scanner.js";
import { ui } from "../core/ui.js";
import { renderMarkdown } from "../render/markdown.js";
import { RepoCache } from "../core/cache.js";
import { t } from "../i18n/index.js";
import { buildExplainPrompt, EXPLAIN_SYSTEM } from "../analyze/explain.js";

export type { AnalyzeExplainResult } from "../analyze/explain.js";
export { analyzeExplain } from "../analyze/explain.js";

export interface ExplainOptions {
  cwd: string;
  file?: string;
  save: boolean;
}

export async function runExplain(opts: ExplainOptions): Promise<void> {
  const cfg = await ensureConfig();
  const client = makeClient(cfg);
  const cache = new RepoCache(opts.cwd);
  const s = t();

  let target = opts.file;
  if (!target) {
    target = await pickFileInteractively(opts.cwd);
  }
  if (!target) {
    ui.fail(s.msgNoFileSelected);
    return;
  }

  const absPath = path.isAbsolute(target) ? target : path.resolve(opts.cwd, target);
  let stat;
  try {
    stat = await fs.stat(absPath);
  } catch {
    ui.fail(s.msgFileNotFound(target));
    return;
  }
  if (!stat.isFile()) {
    ui.fail(s.msgNotAFile(target));
    return;
  }

  const relPath = path.relative(opts.cwd, absPath);
  console.log(ui.hr(s.hrExplain(relPath)));

  const readSpinner = ui.spinner(s.msgReadingFile).start();
  const code = await readFileSafe(absPath);
  readSpinner.succeed(s.msgReadOk(ui.accent(relPath), String(code.split("\n").length)));

  const askSpinner = ui.spinner(s.msgExplainingWith(client.describe())).start();
  let answer: string;
  try {
    const prompt = buildExplainPrompt(relPath, code);
    answer = await client.ask(prompt, { system: EXPLAIN_SYSTEM, maxTokens: 4096 });
    askSpinner.succeed(s.msgGotExplanation);
  } catch (e) {
    askSpinner.fail(s.msgClaudeFailedExplain);
    throw e;
  }

  console.log();
  console.log(renderMarkdown(answer));

  if (opts.save) {
    const safe = relPath.replace(/[\\/]/g, "__");
    const out = await cache.writeText(`explain__${safe}.md`, answer);
    console.log(ui.subtle(`\n  ${s.msgSavedTo(out)}\n`));
  }
}

async function pickFileInteractively(cwd: string): Promise<string | undefined> {
  const s = t();
  const spinner = ui.spinner(s.msgNoFileGiven).start();
  const snap = await scanRepo(cwd);
  const summary = await summarizeRepo(snap);
  spinner.stop();

  const choices = summary.topFiles.slice(0, 12).map((f) => ({
    title: f.relPath,
    description: `${f.language} · ${f.loc} ${s.locUnit}`,
    value: f.relPath,
  }));
  if (choices.length === 0) {
    ui.fail(s.msgNoSources);
    return undefined;
  }
  const { picked } = await prompts({
    type: "select",
    name: "picked",
    message: s.msgPickFile,
    choices,
    initial: 0,
  });
  return picked as string | undefined;
}
