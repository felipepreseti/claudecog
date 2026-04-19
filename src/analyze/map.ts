import path from "node:path";
import type { ClaudeClient } from "../core/claude.js";
import { scanRepo, summarizeRepo } from "../core/scanner.js";
import { RepoCache } from "../core/cache.js";
import { extractJsonBlock } from "../core/json.js";
import type { GraphData } from "../render/graph.js";
import type { ClaudeCogConfig } from "../core/config.js";
import { t } from "../i18n/index.js";

export const MAP_SYSTEM = `You are ClaudeCog, a senior staff engineer who reads codebases as living systems.
You always respond with strict, parseable JSON wrapped in <json>...</json> tags.
Do not include prose outside the tags. Do not invent files that aren't listed.`;

export interface RawMap {
  summary?: string;
  modules?: Array<{
    id?: string;
    name?: string;
    layer?: string;
    purpose?: string;
    files?: string[];
    weight?: number;
  }>;
  relationships?: Array<{
    source?: string;
    target?: string;
    kind?: string;
  }>;
}

export interface AnalyzeMapResult {
  graph: GraphData;
  source: "cache" | "fresh";
  cachedAt?: string;
  totals: { files: number; loc: number; bytes: number };
  topLanguages: Array<{ language: string; files: number; loc: number }>;
  repoName: string;
}

export async function analyzeMap(
  opts: { cwd: string; refresh: boolean },
  client: ClaudeClient,
  cfg: ClaudeCogConfig,
): Promise<AnalyzeMapResult> {
  const cache = new RepoCache(opts.cwd);
  await cache.ensure();

  const snap = await scanRepo(opts.cwd);
  const summary = await summarizeRepo(snap);

  const cacheKey = cache.hash(
    JSON.stringify({
      v: 3,
      lang: cfg.lang,
      files: snap.totals.files,
      loc: snap.totals.loc,
      langs: summary.topLanguages,
      tree: summary.tree,
    }),
  );

  let raw: RawMap | null = null;
  let source: "cache" | "fresh" = "fresh";
  let cachedAt: string | undefined;

  if (!opts.refresh) {
    const cached = await cache.read<RawMap>("map");
    if (cached && cached.key === cacheKey) {
      raw = cached.payload;
      source = "cache";
      cachedAt = cached.createdAt;
    }
  }

  if (!raw) {
    const prompt = buildMapPrompt(summary);
    const text = await client.ask(prompt, { system: MAP_SYSTEM, maxTokens: 4096 });
    raw = extractJsonBlock(text) as RawMap;
    await cache.write<RawMap>("map", cacheKey, raw);
  }

  return {
    graph: normalizeGraph(raw),
    source,
    cachedAt,
    totals: snap.totals,
    topLanguages: summary.topLanguages,
    repoName: path.basename(opts.cwd),
  };
}

export function buildMapPrompt(s: Awaited<ReturnType<typeof summarizeRepo>>): string {
  const langInstr = t().promptOutputLang;
  const langs = s.topLanguages
    .map((l) => `- ${l.language}: ${l.files} files, ${l.loc} LOC`)
    .join("\n");
  const topFiles = s.topFiles
    .map((f) => `- ${f.relPath} (${f.loc} LOC, ${f.language})`)
    .join("\n");
  const entry = s.entrypoints.map((e) => `- ${e}`).join("\n") || "(none detected)";
  const manifests = s.manifests
    .map((m) => `### ${m.relPath}\n\`\`\`\n${m.preview}\n\`\`\``)
    .join("\n\n");

  return `You will receive a high-level snapshot of a software repository. Your job is to model it as a system: identify cohesive logical modules, what each one is for, and how they relate to each other. You are NOT scoring code quality here, only mapping structure.

${langInstr}

<repository name="${path.basename(s.root)}">
<totals>
- files: ${s.totals.files}
- lines of code: ${s.totals.loc}
</totals>

<top_languages>
${langs || "(none)"}
</top_languages>

<top_files_by_size>
${topFiles || "(none)"}
</top_files_by_size>

<entry_points>
${entry}
</entry_points>

<directory_tree>
${s.tree}
</directory_tree>

<manifests>
${manifests || "(none)"}
</manifests>
</repository>

Respond with JSON inside <json>...</json> matching this schema exactly:

{
  "summary": string,
  "modules": [
    {
      "id": string,
      "name": string,
      "layer": "core" | "feature" | "infra" | "ui" | "data" | "test" | "config" | "other",
      "purpose": string,
      "files": string[],
      "weight": number
    }
  ],
  "relationships": [
    { "source": "<module id>", "target": "<module id>", "kind": "depends_on" | "calls" | "configures" | "tests" | "uses_data_from" | "renders" }
  ]
}

Rules:
- Aim for 5 to 12 modules. Group small adjacent things together; do not make a module per file.
- summary is 3 to 5 sentences in plain language. Describe what the system IS, what it DOES, and how it is organized.
- Each module's purpose is 1 to 2 sentences.
- Each module includes up to 8 representative file paths from the snapshot above.
- weight is 1 to 10 (rough importance/centrality).
- Use ONLY file paths that appear in the snapshot above.
- Every relationship must reference module ids you defined.
- Layer "test" only if the module is exclusively tests.
- Be concrete. No corporate fluff.`;
}

export function normalizeGraph(raw: RawMap): GraphData {
  const summary = (raw.summary ?? "").trim() || "No summary returned.";
  const seen = new Set<string>();
  const modules = (raw.modules ?? []).map((m, i) => {
    let id = (m.id || m.name || `module-${i}`)
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "");
    if (!id) id = `module-${i}`;
    let unique = id;
    let n = 2;
    while (seen.has(unique)) {
      unique = `${id}-${n++}`;
    }
    seen.add(unique);
    return {
      id: unique,
      name: (m.name ?? unique).slice(0, 80),
      layer: (m.layer ?? "other").toLowerCase(),
      purpose: (m.purpose ?? "").slice(0, 600),
      files: (m.files ?? []).slice(0, 12),
      weight: clamp(m.weight ?? 3, 1, 10),
    };
  });
  const idSet = new Set(modules.map((m) => m.id));
  const relationships = (raw.relationships ?? [])
    .filter((r) => r.source && r.target && idSet.has(r.source) && idSet.has(r.target))
    .map((r) => ({
      source: r.source!,
      target: r.target!,
      kind: (r.kind ?? "depends_on") as string,
    }));
  return { summary, modules, relationships };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}
