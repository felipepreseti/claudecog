import { existsSync, promises as fs } from "node:fs";
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

function findTemplate(): string {
  const here = path.dirname(url.fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(here, "../templates/graph.html"),
    path.resolve(here, "../../templates/graph.html"),
    path.resolve(here, "../../../templates/graph.html"),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return candidates[0]!;
}

export async function renderGraphHtml(
  data: GraphData,
  meta: { repoName: string; generatedAt: string },
): Promise<string> {
  const template = await fs.readFile(findTemplate(), "utf-8");
  return template
    .replaceAll("__TITLE__", escapeHtml(meta.repoName))
    .replaceAll("__REPO_NAME__", escapeHtml(meta.repoName))
    .replaceAll("__GENERATED_AT__", escapeHtml(meta.generatedAt))
    .replaceAll("__SUMMARY__", escapeHtml(data.summary))
    .replaceAll("__DATA__", JSON.stringify(data).replaceAll("</script", "<\\/script"));
}

function escapeHtml(str: string): string {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
