import path from "node:path";
import type { ClaudeClient } from "../core/claude.js";
import { readFileSafe, scanRepo, summarizeRepo } from "../core/scanner.js";
import { RepoCache } from "../core/cache.js";
import { extractJsonBlock } from "../core/json.js";
import type { ClaudeCogConfig } from "../core/config.js";
import { t } from "../i18n/index.js";

export const RISKS_SYSTEM = `You are ClaudeCog, a senior staff engineer doing a focused risk review.
You ignore stylistic nits. You surface things that will hurt this team in production, in 6 months, or during onboarding.
You always respond with strict JSON wrapped in <json>...</json> tags.`;

export interface RawRisks {
  risks?: Array<{
    title?: string;
    severity?: string;
    category?: string;
    file?: string;
    why_it_matters?: string;
    suggested_fix?: string;
  }>;
}

export interface Risk {
  title: string;
  severity: "low" | "medium" | "high" | "critical";
  category: string;
  file: string;
  whyItMatters: string;
  suggestedFix: string;
}

export interface AnalyzeRisksResult {
  risks: Risk[];
  source: "cache" | "fresh";
  cachedAt?: string;
  totals: { files: number; loc: number };
  repoName: string;
}

export async function analyzeRisks(
  opts: { cwd: string; refresh: boolean },
  client: ClaudeClient,
  cfg: ClaudeCogConfig,
): Promise<AnalyzeRisksResult> {
  const cache = new RepoCache(opts.cwd);
  await cache.ensure();

  const snap = await scanRepo(opts.cwd);
  const summary = await summarizeRepo(snap);

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
  let source: "cache" | "fresh" = "fresh";
  let cachedAt: string | undefined;

  if (!opts.refresh) {
    const cached = await cache.read<RawRisks>("risks");
    if (cached && cached.key === cacheKey) {
      raw = cached.payload;
      source = "cache";
      cachedAt = cached.createdAt;
    }
  }

  if (!raw) {
    const prompt = buildRisksPrompt(summary, samples);
    const text = await client.ask(prompt, { system: RISKS_SYSTEM, maxTokens: 4096 });
    raw = extractJsonBlock(text) as RawRisks;
    await cache.write<RawRisks>("risks", cacheKey, raw);
  }

  return {
    risks: normalizeRisks(raw),
    source,
    cachedAt,
    totals: { files: snap.totals.files, loc: snap.totals.loc },
    repoName: path.basename(opts.cwd),
  };
}

export function buildRisksPrompt(
  s: Awaited<ReturnType<typeof summarizeRepo>>,
  samples: Array<{ relPath: string; content: string }>,
): string {
  const langInstr = t().promptOutputLang;
  const langs = s.topLanguages
    .map((l) => `- ${l.language}: ${l.files} files, ${l.loc} LOC`)
    .join("\n");
  const manifests = s.manifests
    .map((m) => `### ${m.relPath}\n\`\`\`\n${m.preview}\n\`\`\``)
    .join("\n\n");
  const sampleBlocks = samples
    .map((x) => `<sample path="${x.relPath}">\n${x.content}\n</sample>`)
    .join("\n\n");

  return `Review this repository as a senior engineer. Find the REAL risks. Skip lint-level nits.

${langInstr}

Look for:
- security and secrets exposure
- production reliability hazards (error handling, retries, blocking I/O on hot paths)
- data integrity and consistency issues
- silent coupling that will hurt future refactors
- onboarding pain (missing docs, undocumented assumptions, magic constants)
- dependency risks (abandoned, vulnerable, mis-pinned)
- testing blind spots (NOT "you should add tests": say WHERE the lack of tests will bite)
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
      "title": string,
      "severity": "low" | "medium" | "high" | "critical",
      "category": "security" | "reliability" | "data" | "coupling" | "onboarding" | "dependencies" | "testing" | "performance" | "architecture",
      "file": string,
      "why_it_matters": string,
      "suggested_fix": string
    }
  ]
}

Rules:
- Return 5 to 12 risks. Quality over quantity.
- title is 6 to 10 words, concrete.
- file is a best-guess path (use one from the snapshot, or "" if cross-cutting).
- why_it_matters is 1 to 3 sentences. Be specific. No platitudes.
- suggested_fix is 1 to 3 sentences. Concrete next step.
- No filler. No "consider adding more comments."
- Order matters: list highest severity first.`;
}

export function normalizeRisks(raw: RawRisks): Risk[] {
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
