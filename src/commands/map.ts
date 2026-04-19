import path from "node:path";
import open from "open";
import { ensureConfig } from "../setup/wizard.js";
import { makeClient } from "../core/claude.js";
import { scanRepo, summarizeRepo } from "../core/scanner.js";
import { RepoCache } from "../core/cache.js";
import { ui, fmtNumber } from "../core/ui.js";
import { renderGraphHtml, type GraphData } from "../render/graph.js";
import { t } from "../i18n/index.js";
import {
  analyzeMap,
  buildMapPrompt,
  MAP_SYSTEM,
  normalizeGraph,
  type RawMap,
} from "../analyze/map.js";
import { extractJsonBlock } from "../core/json.js";

export type { AnalyzeMapResult } from "../analyze/map.js";
export { analyzeMap } from "../analyze/map.js";

export interface MapOptions {
  cwd: string;
  open: boolean;
  refresh: boolean;
}

export async function runMap(opts: MapOptions): Promise<void> {
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
      ui.accent(fmtNumber(snap.totals.files)),
      ui.accent(fmtNumber(snap.totals.loc)),
      ui.accent(formatBytes(snap.totals.bytes)),
    ),
  );

  printRepoOverview(summary);

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
  if (!opts.refresh) {
    const cached = await cache.read<RawMap>("map");
    if (cached && cached.key === cacheKey) {
      ui.info(s.msgCacheHit(cached.createdAt.slice(0, 19) + "Z"));
      raw = cached.payload;
    }
  }

  if (!raw) {
    console.log(ui.hr(s.hrAskingMap));
    const askSpinner = ui.spinner(s.msgThinkingWith(client.describe())).start();
    try {
      const prompt = buildMapPrompt(summary);
      const text = await client.ask(prompt, { system: MAP_SYSTEM, maxTokens: 4096 });
      raw = extractJsonBlock(text) as RawMap;
      await cache.write<RawMap>("map", cacheKey, raw);
      askSpinner.succeed(s.msgClaudeReturned);
    } catch (e) {
      askSpinner.fail(s.msgClaudeFailedMap);
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

  ui.success(s.msgMapReady);
  console.log(ui.kv(s.kvHtml, outPath));
  console.log(ui.kv(s.kvModulesCount, String(graph.modules.length)));
  console.log(ui.kv(s.kvEdgesCount, String(graph.relationships.length)));

  if (opts.open) {
    try {
      await open(outPath);
      console.log(ui.subtle(`\n  ${s.msgOpenedInBrowser}`));
      console.log(`  ${ui.link("file://" + outPath)}\n`);
    } catch {
      console.log(ui.subtle(`\n  ${s.msgOpenManually} ${ui.link("file://" + outPath)}\n`));
    }
  } else {
    console.log(ui.subtle(`\n  ${s.msgOpenManually} ${ui.link("file://" + outPath)}\n`));
  }
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(2)} MB`;
}

function printRepoOverview(
  s: Awaited<ReturnType<typeof summarizeRepo>>,
): void {
  const tx = t();
  const langs = s.topLanguages
    .slice(0, 5)
    .map(
      (l) =>
        `${ui.c.white(l.language.padEnd(12))} ${ui.subtle(`${l.files} ${tx.filesUnit}`)} ${ui.subtle(
          `${l.loc} ${tx.locUnit}`,
        )}`,
    )
    .join("\n");
  console.log(
    ui.box(
      [
        `${ui.c.bold(tx.boxRepo)}  ${path.basename(s.root)}`,
        `${ui.c.bold(tx.boxPath)}  ${ui.subtle(s.root)}`,
        ``,
        ui.c.bold(tx.boxTopLanguages),
        langs || ui.subtle("(none)"),
      ].join("\n"),
      { title: tx.boxSnapshotTitle, color: "cyan" },
    ),
  );
}

function printSystemSummary(g: GraphData): void {
  const tx = t();
  console.log(ui.hr(tx.hrSystemSummary));
  console.log(ui.box(g.summary, { title: tx.boxWhatThisIs, color: "magenta" }));
  if (g.modules.length === 0) return;
  console.log(ui.hr(tx.hrModules));
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
