import path from "node:path";
import open from "open";
import { ensureConfig } from "../setup/wizard.js";
import { makeClient } from "../core/claude.js";
import { scanRepo, summarizeRepo } from "../core/scanner.js";
import { RepoCache } from "../core/cache.js";
import { ui, fmtNumber } from "../core/ui.js";
import { extractJsonBlock } from "../core/json.js";
import { renderGraphHtml, type GraphData } from "../render/graph.js";

export interface MapOptions {
  cwd: string;
  open: boolean;
  refresh: boolean;
}

const SYSTEM = `You are ClaudeCog, a senior staff engineer who reads codebases as living systems.
You always respond with strict, parseable JSON wrapped in <json>...</json> tags.
Do not include prose outside the tags. Do not invent files that aren't listed.`;

interface RawMap {
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

export async function runMap(opts: MapOptions): Promise<void> {
  const cfg = await ensureConfig();
  const client = makeClient(cfg);
  const cache = new RepoCache(opts.cwd);
  await cache.ensure();

  console.log(ui.hr("scanning repository"));
  const scanSpinner = ui.spinner("Reading files…").start();
  const snap = await scanRepo(opts.cwd);
  const summary = await summarizeRepo(snap);
  scanSpinner.succeed(
    `Scanned ${ui.accent(fmtNumber(snap.totals.files))} files · ${ui.accent(
      fmtNumber(snap.totals.loc),
    )} lines · ${ui.accent(formatBytes(snap.totals.bytes))}`,
  );

  printRepoOverview(summary);

  const cacheKey = cache.hash(
    JSON.stringify({
      v: 2,
      files: snap.totals.files,
      loc: snap.totals.loc,
      langs: summary.topLanguages,
      tree: summary.tree,
    }),
  );
  let raw: RawMap | null = null;
  if (!opts.refresh) {
    const cached = await cache.read<RawMap>("map");
    if (cached && cached.key === cacheKey) {
      ui.info(`Using cached analysis from ${cached.createdAt.slice(0, 19)}Z (use --refresh to redo).`);
      raw = cached.payload;
    }
  }

  if (!raw) {
    console.log(ui.hr("asking Claude to model the system"));
    const askSpinner = ui.spinner(`Thinking with ${client.describe()}…`).start();
    try {
      const prompt = buildMapPrompt(summary);
      const text = await client.ask(prompt, { system: SYSTEM, maxTokens: 4096 });
      raw = extractJsonBlock(text) as RawMap;
      await cache.write<RawMap>("map", cacheKey, raw);
      askSpinner.succeed("Claude returned a system model.");
    } catch (e) {
      askSpinner.fail("Claude failed to produce a system model.");
      throw e;
    }
  }

  const graph = normalizeGraph(raw);
  printSystemSummary(graph);

  const html = await renderGraphHtml(graph, {
    repoName: path.basename(opts.cwd),
    generatedAt: new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC",
  });
  const outPath = await cache.writeText("map.html", html);

  ui.success("System map ready.");
  console.log(ui.kv("HTML", outPath));
  console.log(ui.kv("Modules", String(graph.modules.length)));
  console.log(ui.kv("Edges", String(graph.relationships.length)));

  if (opts.open) {
    try {
      await open(outPath);
      console.log(ui.subtle(`\n  Opened in your browser. If it didn't open, paste this URL:`));
      console.log(`  ${ui.link("file://" + outPath)}\n`);
    } catch {
      console.log(ui.subtle(`\n  Open it manually: ${ui.link("file://" + outPath)}\n`));
    }
  } else {
    console.log(ui.subtle(`\n  Open it manually: ${ui.link("file://" + outPath)}\n`));
  }
}

function buildMapPrompt(s: Awaited<ReturnType<typeof summarizeRepo>>): string {
  const langs = s.topLanguages
    .map((l) => `- ${l.language}: ${l.files} files, ${l.loc} LOC`)
    .join("\n");
  const topFiles = s.topFiles.map((f) => `- ${f.relPath} (${f.loc} LOC, ${f.language})`).join("\n");
  const entry = s.entrypoints.map((e) => `- ${e}`).join("\n") || "(none detected)";
  const manifests = s.manifests
    .map((m) => `### ${m.relPath}\n\`\`\`\n${m.preview}\n\`\`\``)
    .join("\n\n");

  return `You will receive a high-level snapshot of a software repository. Your job is to model it as a system: identify cohesive logical modules, what each one is for, and how they relate to each other. You are NOT scoring code quality here — only mapping structure.

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
  "summary": string,            // 3-5 sentences. Plain English. Describe what the system IS, what it DOES, and how it is organized. Speak to a smart developer who has never seen this code.
  "modules": [
    {
      "id": string,             // short kebab-case slug, unique
      "name": string,           // human-friendly name
      "layer": "core" | "feature" | "infra" | "ui" | "data" | "test" | "config" | "other",
      "purpose": string,        // 1-2 sentences
      "files": string[],        // up to 8 representative file paths from the repo
      "weight": number          // 1-10, rough importance/centrality
    }
  ],
  "relationships": [
    { "source": "<module id>", "target": "<module id>", "kind": "depends_on" | "calls" | "configures" | "tests" | "uses_data_from" | "renders" }
  ]
}

Rules:
- Aim for 5-12 modules. Group small adjacent things together; don't make a module per file.
- Use ONLY file paths that appear in the snapshot above.
- Every relationship must reference module ids you defined.
- Layer "test" only if the module is exclusively tests.
- Be concrete. No corporate fluff.`;
}

function normalizeGraph(raw: RawMap): GraphData {
  const summary = (raw.summary ?? "").trim() || "No summary returned.";
  const seen = new Set<string>();
  const modules = (raw.modules ?? []).map((m, i) => {
    let id = (m.id || m.name || `module-${i}`).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
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

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(2)} MB`;
}

function printRepoOverview(
  s: Awaited<ReturnType<typeof summarizeRepo>>,
): void {
  const langs = s.topLanguages
    .slice(0, 5)
    .map(
      (l) =>
        `${ui.c.white(l.language.padEnd(12))} ${ui.subtle(`${l.files} files`)} ${ui.subtle(
          `${l.loc} LOC`,
        )}`,
    )
    .join("\n");
  console.log(
    ui.box(
      [
        `${ui.c.bold("Repository")}  ${path.basename(s.root)}`,
        `${ui.c.bold("Path")}        ${ui.subtle(s.root)}`,
        ``,
        ui.c.bold("Top languages"),
        langs || ui.subtle("(none)"),
      ].join("\n"),
      { title: "snapshot", color: "cyan" },
    ),
  );
}

function printSystemSummary(g: GraphData): void {
  console.log(ui.hr("system summary"));
  console.log(ui.box(g.summary, { title: "what this system is", color: "magenta" }));
  if (g.modules.length === 0) return;
  console.log(ui.hr("modules"));
  for (const m of g.modules) {
    const layerColor =
      m.layer === "core"
        ? ui.brand
        : m.layer === "feature"
          ? ui.accent
          : m.layer === "infra"
            ? ui.ok
            : m.layer === "ui"
              ? ui.warn
              : ui.subtle;
    console.log(
      `  ${layerColor("●")} ${ui.c.bold.white(m.name)} ${ui.subtle(`[${m.layer}]`)}`,
    );
    if (m.purpose) console.log(`    ${ui.subtle(m.purpose)}`);
  }
  console.log();
}
