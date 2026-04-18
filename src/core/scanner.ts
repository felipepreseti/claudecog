import { promises as fs } from "node:fs";
import path from "node:path";
import ignore, { type Ignore } from "ignore";

export interface FileEntry {
  relPath: string;
  absPath: string;
  size: number;
  ext: string;
  language: string;
  loc: number;
}

export interface RepoSnapshot {
  root: string;
  files: FileEntry[];
  totals: {
    files: number;
    bytes: number;
    loc: number;
    byLanguage: Record<string, { files: number; loc: number }>;
  };
}

const DEFAULT_IGNORES = [
  "node_modules",
  ".git",
  "dist",
  "build",
  "out",
  ".next",
  ".nuxt",
  ".turbo",
  ".cache",
  ".parcel-cache",
  "coverage",
  ".nyc_output",
  ".venv",
  "venv",
  "__pycache__",
  ".mypy_cache",
  ".pytest_cache",
  ".gradle",
  "target",
  "vendor",
  ".idea",
  ".vscode",
  ".DS_Store",
  ".claudecog",
  "*.lock",
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "bun.lockb",
  "Pipfile.lock",
  "poetry.lock",
  "Gemfile.lock",
  "composer.lock",
  "*.log",
  "*.min.js",
  "*.min.css",
  "*.map",
  "*.png",
  "*.jpg",
  "*.jpeg",
  "*.gif",
  "*.webp",
  "*.svg",
  "*.ico",
  "*.pdf",
  "*.woff",
  "*.woff2",
  "*.ttf",
  "*.eot",
  "*.mp4",
  "*.mov",
  "*.zip",
  "*.tar",
  "*.gz",
];

const LANG_BY_EXT: Record<string, string> = {
  ".ts": "TypeScript",
  ".tsx": "TypeScript",
  ".js": "JavaScript",
  ".jsx": "JavaScript",
  ".mjs": "JavaScript",
  ".cjs": "JavaScript",
  ".py": "Python",
  ".rb": "Ruby",
  ".go": "Go",
  ".rs": "Rust",
  ".java": "Java",
  ".kt": "Kotlin",
  ".swift": "Swift",
  ".c": "C",
  ".h": "C",
  ".cpp": "C++",
  ".hpp": "C++",
  ".cs": "C#",
  ".php": "PHP",
  ".scala": "Scala",
  ".sh": "Shell",
  ".bash": "Shell",
  ".zsh": "Shell",
  ".lua": "Lua",
  ".dart": "Dart",
  ".ex": "Elixir",
  ".exs": "Elixir",
  ".html": "HTML",
  ".css": "CSS",
  ".scss": "SCSS",
  ".md": "Markdown",
  ".json": "JSON",
  ".yaml": "YAML",
  ".yml": "YAML",
  ".toml": "TOML",
  ".sql": "SQL",
  ".vue": "Vue",
  ".svelte": "Svelte",
};

const MAX_FILE_BYTES = 512 * 1024;

async function loadIgnore(root: string): Promise<Ignore> {
  const ig = ignore().add(DEFAULT_IGNORES);
  try {
    const gitignore = await fs.readFile(path.join(root, ".gitignore"), "utf-8");
    ig.add(gitignore);
  } catch {
    /* no .gitignore */
  }
  try {
    const cogIgnore = await fs.readFile(
      path.join(root, ".claudecogignore"),
      "utf-8",
    );
    ig.add(cogIgnore);
  } catch {
    /* no .claudecogignore */
  }
  return ig;
}

async function walk(
  root: string,
  dir: string,
  ig: Ignore,
  out: string[],
): Promise<void> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    const rel = path.relative(root, full);
    if (!rel) continue;
    const testPath = entry.isDirectory() ? `${rel}/` : rel;
    if (ig.ignores(testPath)) continue;
    if (entry.isDirectory()) {
      await walk(root, full, ig, out);
    } else if (entry.isFile()) {
      out.push(full);
    }
  }
}

function detectLanguage(ext: string): string {
  return LANG_BY_EXT[ext.toLowerCase()] ?? "Other";
}

async function countLoc(absPath: string, size: number): Promise<number> {
  if (size > MAX_FILE_BYTES) return 0;
  try {
    const buf = await fs.readFile(absPath);
    let lines = 0;
    for (let i = 0; i < buf.length; i++) {
      if (buf[i] === 0x0a) lines++;
    }
    if (buf.length > 0 && buf[buf.length - 1] !== 0x0a) lines++;
    return lines;
  } catch {
    return 0;
  }
}

export async function scanRepo(root: string): Promise<RepoSnapshot> {
  const absRoot = path.resolve(root);
  const ig = await loadIgnore(absRoot);
  const collected: string[] = [];
  await walk(absRoot, absRoot, ig, collected);

  const files: FileEntry[] = [];
  let bytes = 0;
  let totalLoc = 0;
  const byLanguage: Record<string, { files: number; loc: number }> = {};

  for (const absPath of collected) {
    const stat = await fs.stat(absPath);
    if (!stat.isFile()) continue;
    const relPath = path.relative(absRoot, absPath);
    const ext = path.extname(absPath);
    const language = detectLanguage(ext);
    const loc = await countLoc(absPath, stat.size);

    files.push({
      relPath,
      absPath,
      size: stat.size,
      ext,
      language,
      loc,
    });

    bytes += stat.size;
    totalLoc += loc;
    const bucket = byLanguage[language] ?? { files: 0, loc: 0 };
    bucket.files += 1;
    bucket.loc += loc;
    byLanguage[language] = bucket;
  }

  files.sort((a, b) => a.relPath.localeCompare(b.relPath));

  return {
    root: absRoot,
    files,
    totals: {
      files: files.length,
      bytes,
      loc: totalLoc,
      byLanguage,
    },
  };
}

export interface RepoSummary {
  root: string;
  totals: RepoSnapshot["totals"];
  topLanguages: Array<{ language: string; files: number; loc: number }>;
  tree: string;
  topFiles: Array<{ relPath: string; loc: number; language: string }>;
  entrypoints: string[];
  manifests: Array<{ relPath: string; preview: string }>;
}

const ENTRYPOINT_HINTS = [
  "package.json",
  "pyproject.toml",
  "requirements.txt",
  "Cargo.toml",
  "go.mod",
  "Gemfile",
  "pom.xml",
  "build.gradle",
  "Dockerfile",
  "docker-compose.yml",
  "docker-compose.yaml",
  "Makefile",
  "README.md",
  "src/index.ts",
  "src/index.js",
  "src/main.ts",
  "src/main.py",
  "main.py",
  "app.py",
  "manage.py",
  "main.go",
];

export async function summarizeRepo(snap: RepoSnapshot): Promise<RepoSummary> {
  const topLanguages = Object.entries(snap.totals.byLanguage)
    .map(([language, v]) => ({ language, ...v }))
    .sort((a, b) => b.loc - a.loc)
    .slice(0, 8);

  const topFiles = [...snap.files]
    .filter((f) => f.language !== "Other" && f.language !== "JSON")
    .sort((a, b) => b.loc - a.loc)
    .slice(0, 15)
    .map((f) => ({ relPath: f.relPath, loc: f.loc, language: f.language }));

  const tree = renderTree(snap);
  const entrypoints = snap.files
    .map((f) => f.relPath)
    .filter((rel) => ENTRYPOINT_HINTS.includes(rel) || ENTRYPOINT_HINTS.includes(path.basename(rel)))
    .slice(0, 12);

  const manifests: Array<{ relPath: string; preview: string }> = [];
  const manifestNames = new Set([
    "package.json",
    "pyproject.toml",
    "requirements.txt",
    "Cargo.toml",
    "go.mod",
    "Gemfile",
    "README.md",
  ]);
  for (const f of snap.files) {
    if (manifestNames.has(path.basename(f.relPath)) && f.size <= MAX_FILE_BYTES) {
      try {
        const raw = await fs.readFile(f.absPath, "utf-8");
        const preview = raw.length > 4000 ? raw.slice(0, 4000) + "\n…(truncated)" : raw;
        manifests.push({ relPath: f.relPath, preview });
        if (manifests.length >= 5) break;
      } catch {
        /* skip */
      }
    }
  }

  return {
    root: snap.root,
    totals: snap.totals,
    topLanguages,
    tree,
    topFiles,
    entrypoints,
    manifests,
  };
}

function renderTree(snap: RepoSnapshot, maxLines = 120): string {
  const dirSet = new Set<string>();
  for (const f of snap.files) {
    const parts = f.relPath.split(path.sep);
    for (let i = 1; i < parts.length; i++) {
      dirSet.add(parts.slice(0, i).join(path.sep));
    }
  }
  const all = [
    ...[...dirSet].map((d) => `${d}/`),
    ...snap.files.map((f) => f.relPath),
  ].sort();

  const truncated = all.slice(0, maxLines);
  if (all.length > maxLines) {
    truncated.push(`… and ${all.length - maxLines} more entries`);
  }
  return truncated.join("\n");
}

export async function readFileSafe(
  absPath: string,
  maxBytes = MAX_FILE_BYTES,
): Promise<string> {
  const stat = await fs.stat(absPath);
  if (stat.size > maxBytes) {
    const buf = await fs.readFile(absPath);
    return (
      buf.subarray(0, maxBytes).toString("utf-8") +
      `\n\n…(file truncated at ${maxBytes} bytes; original size ${stat.size})`
    );
  }
  return await fs.readFile(absPath, "utf-8");
}
