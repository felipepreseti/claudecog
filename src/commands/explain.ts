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

export interface ExplainOptions {
  cwd: string;
  file?: string;
  save: boolean;
}

const SYSTEM = `You are ClaudeCog, a senior staff engineer reading a single file from a larger codebase.
Your goal is not to repeat the code. Your goal is to make the reader UNDERSTAND it.
You speak plainly, with strong opinions, like a thoughtful tech lead pairing with a junior.`;

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
    answer = await client.ask(prompt, { system: SYSTEM, maxTokens: 4096 });
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

function buildExplainPrompt(relPath: string, code: string): string {
  const ext = path.extname(relPath).slice(1) || "text";
  const langInstr = t().promptExplainLang;
  return `I will give you a single file from a larger codebase. Walk a smart developer through it as if you were pairing with them for ten minutes.

${langInstr}

Format your answer in Markdown with these sections, in this order:

## What this file is for
One paragraph. Plain language. What problem does it solve in the system?

## Mental model
Bullet list of the 3 to 6 key abstractions/objects/flows the reader should hold in their head before reading the code.

## Walkthrough
Go through the file in narrative order, quoting only the smallest snippets needed (use fenced code blocks). Skip boring parts. Focus on intent, not syntax.

## Surprises and gotchas
Things that would NOT be obvious from a quick read. Implicit contracts, hidden coupling, subtle bugs, performance traps, ordering requirements, etc.

## How I would change it
Two or three concrete improvements you would suggest if you were reviewing this in a PR. Be opinionated. No "consider adding tests" platitudes.

Constraints:
- Be concise. Aim for about 400 to 600 words total.
- Don't restate the code; illuminate it.
- If something is well written, say so briefly and move on.

<file path="${relPath}" language="${ext}">
${code}
</file>`;
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
