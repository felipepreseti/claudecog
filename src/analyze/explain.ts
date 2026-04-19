import path from "node:path";
import { promises as fs } from "node:fs";
import type { ClaudeClient } from "../core/claude.js";
import { readFileSafe } from "../core/scanner.js";
import { t } from "../i18n/index.js";

export const EXPLAIN_SYSTEM = `You are ClaudeCog, a senior staff engineer reading a single file from a larger codebase.
Your goal is not to repeat the code. Your goal is to make the reader UNDERSTAND it.
You speak plainly, with strong opinions, like a thoughtful tech lead pairing with a junior.`;

export interface AnalyzeExplainResult {
  markdown: string;
  relPath: string;
  absPath: string;
  lines: number;
}

export async function analyzeExplain(
  opts: { cwd: string; file: string },
  client: ClaudeClient,
): Promise<AnalyzeExplainResult> {
  const absPath = path.isAbsolute(opts.file)
    ? opts.file
    : path.resolve(opts.cwd, opts.file);
  const stat = await fs.stat(absPath);
  if (!stat.isFile()) {
    throw new Error(`Not a file: ${opts.file}`);
  }
  const relPath = path.relative(opts.cwd, absPath);
  const code = await readFileSafe(absPath);
  const prompt = buildExplainPrompt(relPath, code);
  const markdown = await client.ask(prompt, { system: EXPLAIN_SYSTEM, maxTokens: 4096 });
  return {
    markdown,
    relPath,
    absPath,
    lines: code.split("\n").length,
  };
}

export function buildExplainPrompt(relPath: string, code: string): string {
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
