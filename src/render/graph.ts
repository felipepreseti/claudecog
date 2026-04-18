import { promises as fs } from "node:fs";
import path from "node:path";
import url from "node:url";

export interface GraphModule {
  id: string;
  name: string;
  layer: string;
  purpose: string;
  files: string[];
  weight?: number;
}

export interface GraphRelationship {
  source: string;
  target: string;
  kind: string;
}

export interface GraphData {
  summary: string;
  modules: GraphModule[];
  relationships: GraphRelationship[];
}

function findTemplatesDir(): string {
  const here = path.dirname(url.fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(here, "../templates"),
    path.resolve(here, "../../templates"),
    path.resolve(here, "../../../templates"),
  ];
  for (const c of candidates) {
    try {
      // sync check via require-like; we'll just attempt and let renderGraphHtml handle errors
      return c;
    } catch {
      /* keep trying */
    }
  }
  return candidates[0]!;
}

export async function renderGraphHtml(
  data: GraphData,
  meta: { repoName: string; generatedAt: string },
): Promise<string> {
  const dir = findTemplatesDir();
  let template: string;
  try {
    template = await fs.readFile(path.join(dir, "graph.html"), "utf-8");
  } catch {
    const here = path.dirname(url.fileURLToPath(import.meta.url));
    const fallback = path.resolve(here, "..", "templates", "graph.html");
    template = await fs.readFile(fallback, "utf-8");
  }
  return template
    .replace("__TITLE__", escapeHtml(meta.repoName))
    .replace("__REPO_NAME__", escapeHtml(meta.repoName))
    .replace("__GENERATED_AT__", escapeHtml(meta.generatedAt))
    .replace("__SUMMARY__", escapeHtml(data.summary))
    .replace("__DATA__", JSON.stringify(data));
}

function escapeHtml(str: string): string {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
