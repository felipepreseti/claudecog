import path from "node:path";
import { ensureConfig } from "../setup/wizard.js";
import { makeClient } from "../core/claude.js";
import { readFileSafe, scanRepo, summarizeRepo } from "../core/scanner.js";
import { RepoCache } from "../core/cache.js";
import { ui, severityChip } from "../core/ui.js";
import { extractJsonBlock } from "../core/json.js";

export interface RisksOptions {
  cwd: string;
  refresh: boolean;
  json: boolean;
}

const SYSTEM = `You are ClaudeCog, a senior staff engineer doing a focused risk review.
You ignore stylistic nits. You surface things that will hurt this team in production, in 6 months, or during onboarding.
You always respond with strict JSON wrapped in <json>...</json> tags.`;

interface RawRisks {
  risks?: Array<{
    title?: string;
    severity?: string;
    category?: string;
    file?: string;
    why_it_matters?: string;
    suggested_fix?: string;
  }>;
}

interface Risk {
  title: string;
  severity: "low" | "medium" | "high" | "critical";
  category: string;
  file: string;
  whyItMatters: string;
  suggestedFix: string;
}

export async function runRisks(opts: RisksOptions): Promise<void> {
  const cfg = await ensureConfig();
  const client = makeClient(cfg);
  const cache = new RepoCache(opts.cwd);
  await cache.ensure();

  console.log(ui.hr("scanning repository"));
  const scanSpinner = ui.spinner("Reading files…").start();
  const snap = await scanRepo(opts.cwd);
  const summary = await summarizeRepo(snap);
  scanSpinner.succeed(
    `Scanned ${ui.accent(String(snap.totals.files))} files · ${ui.accent(
      String(snap.totals.loc),
    )} LOC`,
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
      v: 2,
      files: snap.totals.files,
      loc: snap.totals.loc,
      tree: summary.tree,
      samples: samples.map((s) => `${s.relPath}:${s.content.length}`),
    }),
  );

  let raw: RawRisks | null = null;
  if (!opts.refresh) {
    const cached = await cache.read<RawRisks>("risks");
    if (cached && cached.key === cacheKey) {
      ui.info(`Using cached risk report from ${cached.createdAt.slice(0, 19)}Z (use --refresh to redo).`);
      raw = cached.payload;
    }
  }

  if (!raw) {
    console.log(ui.hr("asking Claude to find real risks"));
    const askSpinner = ui.spinner(`Reviewing with ${client.describe()}…`).start();
    try {
      const prompt = buildRisksPrompt(summary, samples);
      const text = await client.ask(prompt, { system: SYSTEM, maxTokens: 4096 });
      raw = extractJsonBlock(text) as RawRisks;
      await cache.write<RawRisks>("risks", cacheKey, raw);
      askSpinner.succeed("Risk report ready.");
    } catch (e) {
      askSpinner.fail("Claude failed to produce a risk report.");
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
  console.log(ui.subtle(`\n  Saved JSON: ${out}\n`));
}

function buildRisksPrompt(
  s: Awaited<ReturnType<typeof summarizeRepo>>,
  samples: Array<{ relPath: string; content: string }>,
): string {
  const langs = s.topLanguages
    .map((l) => `- ${l.language}: ${l.files} files, ${l.loc} LOC`)
    .join("\n");
  const manifests = s.manifests
    .map((m) => `### ${m.relPath}\n\`\`\`\n${m.preview}\n\`\`\``)
    .join("\n\n");
  const sampleBlocks = samples
    .map(
      (s) =>
        `<sample path="${s.relPath}">\n${s.content}\n</sample>`,
    )
    .join("\n\n");

  return `Review this repository as a senior engineer. Find the REAL risks. Skip lint-level nits.

Look for:
- security & secrets exposure
- production reliability hazards (error handling, retries, blocking I/O on hot paths)
- data integrity / consistency issues
- silent coupling that will hurt future refactors
- onboarding pain (missing docs, undocumented assumptions, magic constants)
- dependency risks (abandoned, vulnerable, mis-pinned)
- testing blind spots (NOT "you should add tests" — say WHERE the lack of tests will bite)
- performance traps that will appear under load
- architectural debt that will compound

<repository>
<totals>files: ${s.totals.files}, LOC: ${s.totals.loc}</totals>

<languages>
${langs || "(none)"}
</languages>

<directory_tree>
${s.tree}
</directory_tree>

<manifests>
${manifests || "(none)"}
</manifests>

<source_samples>
${sampleBlocks || "(none)"}
</source_samples>
</repository>

Respond with JSON inside <json>...</json>:

{
  "risks": [
    {
      "title": string,                     // 6-10 words, concrete
      "severity": "low" | "medium" | "high" | "critical",
      "category": "security" | "reliability" | "data" | "coupling" | "onboarding" | "dependencies" | "testing" | "performance" | "architecture",
      "file": string,                       // best-guess path (use one from the snapshot, or "" if cross-cutting)
      "why_it_matters": string,             // 1-3 sentences. Be specific. No platitudes.
      "suggested_fix": string               // 1-3 sentences. Concrete next step.
    }
  ]
}

Rules:
- Return 5-12 risks. Quality > quantity.
- No filler. No "consider adding more comments."
- Order matters: list highest-severity first.`;
}

function normalizeRisks(raw: RawRisks): Risk[] {
  const list = raw.risks ?? [];
  const allowedSev = new Set(["low", "medium", "high", "critical"]);
  return list
    .map((r) => ({
      title: (r.title ?? "Untitled risk").trim(),
      severity: (allowedSev.has((r.severity ?? "").toLowerCase())
        ? (r.severity as string).toLowerCase()
        : "medium") as Risk["severity"],
      category: (r.category ?? "architecture").toLowerCase(),
      file: (r.file ?? "").trim(),
      whyItMatters: (r.why_it_matters ?? "").trim(),
      suggestedFix: (r.suggested_fix ?? "").trim(),
    }))
    .sort((a, b) => sevWeight(b.severity) - sevWeight(a.severity));
}

function sevWeight(s: Risk["severity"]): number {
  return { low: 1, medium: 2, high: 3, critical: 4 }[s];
}

function printRisks(risks: Risk[]): void {
  console.log(ui.hr("risks (highest first)"));
  if (risks.length === 0) {
    console.log(ui.box("No risks identified.", { color: "green" }));
    return;
  }
  for (let i = 0; i < risks.length; i++) {
    const r = risks[i]!;
    const header = `${severityChip(r.severity)} ${ui.c.bold.white(r.title)}  ${ui.subtle(`[${r.category}]`)}`;
    const fileLine = r.file ? ui.kv("file", r.file) : ui.kv("file", "(cross-cutting)");
    const why = `${ui.c.bold("why")}      ${wrap(r.whyItMatters)}`;
    const fix = `${ui.c.bold("fix")}      ${wrap(r.suggestedFix)}`;
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
  if (!text) return ui.subtle("(no detail)");
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
  return lines
    .map((l, i) => (i === 0 ? l : "         " + l))
    .join("\n");
}
