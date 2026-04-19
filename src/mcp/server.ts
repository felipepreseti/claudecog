import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import path from "node:path";
import { promises as fs } from "node:fs";
import os from "node:os";
import { configFromEnv } from "./config.js";
import { makeClient } from "../core/claude.js";
import { analyzeMap } from "../analyze/map.js";
import { analyzeRisks } from "../analyze/risks.js";
import { analyzeExplain } from "../analyze/explain.js";
import { renderGraphHtml } from "../render/graph.js";

const VERSION = "0.1.0";

async function resolveRepoPath(input: string | undefined): Promise<string> {
  const raw = (input ?? "").trim();
  if (!raw) {
    throw new Error(
      "repo_path is required. Pass the absolute path of the project you want ClaudeCog to read.",
    );
  }
  const expanded = raw.startsWith("~/") ? path.join(os.homedir(), raw.slice(2)) : raw;
  const resolved = path.resolve(expanded);
  const stat = await fs.stat(resolved).catch(() => null);
  if (!stat || !stat.isDirectory()) {
    throw new Error(`Not a readable directory: ${resolved}`);
  }
  return resolved;
}

async function main(): Promise<void> {
  const cfg = await configFromEnv();
  const client = makeClient(cfg);

  const server = new McpServer({
    name: "claudecog",
    version: VERSION,
  });

  server.registerTool(
    "cog_map",
    {
      title: "Map a codebase",
      description:
        "Read a local repository as a system. Returns architectural modules, what each one does, how they relate, plus a link to a 3D walkthrough you can open in the browser.",
      inputSchema: {
        repo_path: z
          .string()
          .describe("Absolute path of the project on the user's machine."),
        refresh: z
          .boolean()
          .optional()
          .describe("Force a fresh analysis instead of using the cache."),
      },
    },
    async (args) => {
      const cwd = await resolveRepoPath(args.repo_path);
      const result = await analyzeMap(
        { cwd, refresh: Boolean(args.refresh) },
        client,
        cfg,
      );

      const html = await renderGraphHtml(result.graph, {
        repoName: result.repoName,
        generatedAt:
          new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC",
      });
      const outDir = path.join(os.homedir(), ".claudecog", "maps");
      await fs.mkdir(outDir, { recursive: true });
      const outPath = path.join(
        outDir,
        `${slugify(result.repoName)}-${Date.now()}.html`,
      );
      await fs.writeFile(outPath, html, "utf-8");

      const summaryText = [
        `# ClaudeCog map of ${result.repoName}`,
        ``,
        result.graph.summary,
        ``,
        `**Modules:** ${result.graph.modules.length}  ·  **Relationships:** ${result.graph.relationships.length}  ·  **Source:** ${result.source}${
          result.cachedAt ? ` (${result.cachedAt})` : ""
        }`,
        ``,
        `## Modules`,
        ...result.graph.modules.map(
          (m) => `- **${m.name}** *(${m.layer})* — ${m.purpose}`,
        ),
        ``,
        `## Open the 3D walkthrough`,
        `file://${outPath}`,
      ].join("\n");

      return {
        content: [
          { type: "text" as const, text: summaryText },
          {
            type: "text" as const,
            text:
              "```json\n" +
              JSON.stringify(
                { ...result.graph, walkthroughHtml: outPath },
                null,
                2,
              ) +
              "\n```",
          },
        ],
      };
    },
  );

  server.registerTool(
    "cog_explain",
    {
      title: "Explain a file",
      description:
        "Walk through a single file like a senior engineer pairing with you for ten minutes: purpose, mental model, gotchas, and what to change.",
      inputSchema: {
        repo_path: z
          .string()
          .describe("Absolute path of the project the file lives in."),
        file: z
          .string()
          .describe("Path of the file to explain (absolute or relative to repo_path)."),
      },
    },
    async (args) => {
      const cwd = await resolveRepoPath(args.repo_path);
      const result = await analyzeExplain({ cwd, file: args.file }, client);
      return {
        content: [
          {
            type: "text" as const,
            text: `# ${result.relPath}\n\n${result.markdown}`,
          },
        ],
      };
    },
  );

  server.registerTool(
    "cog_risks",
    {
      title: "Find real risks",
      description:
        "Surface the things that will hurt this team in production, in 6 months, or during onboarding. Skips lint nits.",
      inputSchema: {
        repo_path: z
          .string()
          .describe("Absolute path of the project on the user's machine."),
        refresh: z
          .boolean()
          .optional()
          .describe("Force a fresh analysis instead of using the cache."),
      },
    },
    async (args) => {
      const cwd = await resolveRepoPath(args.repo_path);
      const result = await analyzeRisks(
        { cwd, refresh: Boolean(args.refresh) },
        client,
        cfg,
      );

      const lines: string[] = [
        `# Risks for ${result.repoName}`,
        ``,
        `Found ${result.risks.length} risks (source: ${result.source}${
          result.cachedAt ? `, ${result.cachedAt}` : ""
        }).`,
        ``,
      ];
      result.risks.forEach((r, i) => {
        lines.push(
          `## ${i + 1}. [${r.severity.toUpperCase()}] ${r.title}  *(${r.category})*`,
        );
        if (r.file) lines.push(`**File:** \`${r.file}\``);
        lines.push(``);
        lines.push(`**Why it matters:** ${r.whyItMatters}`);
        lines.push(``);
        lines.push(`**Suggested fix:** ${r.suggestedFix}`);
        lines.push(``);
      });

      return {
        content: [
          { type: "text" as const, text: lines.join("\n") },
          {
            type: "text" as const,
            text:
              "```json\n" +
              JSON.stringify({ risks: result.risks }, null, 2) +
              "\n```",
          },
        ],
      };
    },
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "repo";
}

main().catch((err) => {
  // Stderr is the only safe channel: stdout is the JSON-RPC pipe.
  process.stderr.write(
    `[claudecog-mcp] fatal: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`,
  );
  process.exit(1);
});
