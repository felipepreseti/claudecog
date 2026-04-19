import path from "node:path";
import { ensureConfig } from "../setup/wizard.js";
import { makeClient } from "../core/claude.js";
import { readFileSafe, scanRepo, summarizeRepo } from "../core/scanner.js";
import { RepoCache } from "../core/cache.js";
import { ui, severityChip } from "../core/ui.js";
import { t } from "../i18n/index.js";
import {
  buildRisksPrompt,
  normalizeRisks,
  RISKS_SYSTEM,
  type RawRisks,
  type Risk,
} from "../analyze/risks.js";
import { extractJsonBlock } from "../core/json.js";

export type { Risk, AnalyzeRisksResult } from "../analyze/risks.js";
export { analyzeRisks } from "../analyze/risks.js";

export interface RisksOptions {
  cwd: string;
  refresh: boolean;
  json: boolean;
}

export async function runRisks(opts: RisksOptions): Promise<void> {
  const cfg = await ensureConfig();
  const client = makeClient(cfg);
  const cache = new RepoCache(opts.cwd);
  await cache.ensure();
  const s = t();

  console.log(ui.hr(s.hrScanning));
  const scanSpinner = ui.spinner(s.msgReadingFiles).start();
  const snap = await scanRepo(opts.cwd);
  const summary = await summarizeRepo(snap);
  scanSpinner.succeed(
    s.msgScannedSummary(
      ui.accent(String(snap.totals.files)),
      ui.accent(String(snap.totals.loc)),
      "",
    ),
  );

  const samplePaths = summary.topFiles.slice(0, 6).map((f) => f.relPath);
  const samples: Array<{ relPath: string; content: string }> = [];
  for (const rel of samplePaths) {
    try {
      const abs = path.join(opts.cwd, rel);
      const content = await readFileSafe(abs, 30 * 1024);
      samples.push({ relPath: rel, content });
    } catch {
      /* skip unreadable */
    }
  }

  const cacheKey = cache.hash(
    JSON.stringify({
      v: 3,
      lang: cfg.lang,
      files: snap.totals.files,
      loc: snap.totals.loc,
      tree: summary.tree,
      samples: samples.map((x) => `${x.relPath}:${x.content.length}`),
    }),
  );

  let raw: RawRisks | null = null;
  if (!opts.refresh) {
    const cached = await cache.read<RawRisks>("risks");
    if (cached && cached.key === cacheKey) {
      ui.info(s.msgRiskCacheHit(cached.createdAt.slice(0, 19) + "Z"));
      raw = cached.payload;
    }
  }

  if (!raw) {
    console.log(ui.hr(s.hrAskingRisks));
    const askSpinner = ui.spinner(s.msgReviewingWith(client.describe())).start();
    try {
      const prompt = buildRisksPrompt(summary, samples);
      const text = await client.ask(prompt, { system: RISKS_SYSTEM, maxTokens: 4096 });
      raw = extractJsonBlock(text) as RawRisks;
      await cache.write<RawRisks>("risks", cacheKey, raw);
      askSpinner.succeed(s.msgRiskReportReady);
    } catch (e) {
      askSpinner.fail(s.msgClaudeFailedRisks);
      throw e;
    }
  }

  const risks = normalizeRisks(raw);

  if (opts.json) {
    console.log(JSON.stringify({ risks }, null, 2));
    return;
  }

  printRisks(risks);
  const out = await cache.writeText(
    "risks.json",
    JSON.stringify({ generatedAt: new Date().toISOString(), risks }, null, 2),
  );
  console.log(ui.subtle(`\n  ${s.msgSavedJson(out)}\n`));
}

function printRisks(risks: Risk[]): void {
  const tx = t();
  console.log(ui.hr(tx.hrRisks));
  if (risks.length === 0) {
    console.log(ui.box(tx.msgNoRisks, { color: "green" }));
    return;
  }
  for (let i = 0; i < risks.length; i++) {
    const r = risks[i]!;
    const header = `${severityChip(r.severity)} ${ui.c.bold.white(r.title)}  ${ui.subtle(`[${r.category}]`)}`;
    const fileLine = r.file
      ? ui.kv(tx.riskFile, r.file)
      : ui.kv(tx.riskFile, tx.riskFileCrossCutting);
    const why = `${ui.c.bold(tx.riskWhy.padEnd(8))} ${wrap(r.whyItMatters)}`;
    const fix = `${ui.c.bold(tx.riskFix.padEnd(8))} ${wrap(r.suggestedFix)}`;
    console.log(
      ui.box([header, "", fileLine, "", why, "", fix].join("\n"), {
        title: `${i + 1}/${risks.length}`,
        color:
          r.severity === "critical" || r.severity === "high"
            ? "red"
            : r.severity === "medium"
              ? "yellow"
              : "gray",
      }),
    );
  }
}

function wrap(text: string, width = 80): string {
  if (!text) return ui.subtle(t().riskNoDetail);
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    if ((line + " " + w).trim().length > width) {
      lines.push(line.trim());
      line = w;
    } else {
      line = (line + " " + w).trim();
    }
  }
  if (line) lines.push(line);
  return lines.map((l, i) => (i === 0 ? l : "         " + l)).join("\n");
}
