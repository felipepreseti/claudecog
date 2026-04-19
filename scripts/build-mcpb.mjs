#!/usr/bin/env node
// Build the .mcpb (Claude Desktop Extension) bundle.
// 1. tsup builds a standalone server bundle into mcpb-build/server/server.js
// 2. We copy the manifest, icon, README and HTML template into mcpb-build/
// 3. We zip the folder into dist-mcpb/claudecog.mcpb

import { execSync } from "node:child_process";
import { promises as fs, existsSync } from "node:fs";
import path from "node:path";
import url from "node:url";

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..");
const BUILD = path.join(ROOT, "mcpb-build");
const OUT = path.join(ROOT, "dist-mcpb");
const TARGET = path.join(OUT, "claudecog.mcpb");

function log(msg) {
  process.stdout.write(`[mcpb] ${msg}\n`);
}

async function copy(src, dst) {
  await fs.mkdir(path.dirname(dst), { recursive: true });
  await fs.copyFile(src, dst);
}

async function rmrf(p) {
  await fs.rm(p, { recursive: true, force: true });
}

async function packWithMcpbCli(srcDir, outFile) {
  await fs.mkdir(path.dirname(outFile), { recursive: true });
  execSync(`npx --yes @anthropic-ai/mcpb pack "${srcDir}" "${outFile}"`, {
    cwd: ROOT,
    stdio: "inherit",
  });
}

async function main() {
  log("cleaning build dirs");
  await rmrf(BUILD);
  await rmrf(OUT);

  log("bundling server (tsup)");
  execSync("npx tsup --config tsup.mcp.config.ts", {
    cwd: ROOT,
    stdio: "inherit",
  });

  log("copying manifest, icon, template, locales");
  await copy(path.join(ROOT, "mcpb", "manifest.json"), path.join(BUILD, "manifest.json"));
  if (existsSync(path.join(ROOT, "mcpb", "icon.png"))) {
    await copy(path.join(ROOT, "mcpb", "icon.png"), path.join(BUILD, "icon.png"));
  }
  if (existsSync(path.join(ROOT, "mcpb", "README.md"))) {
    await copy(path.join(ROOT, "mcpb", "README.md"), path.join(BUILD, "README.md"));
  }
  await copy(
    path.join(ROOT, "templates", "graph.html"),
    path.join(BUILD, "templates", "graph.html"),
  );
  await copy(
    path.join(ROOT, "mcpb", "server-package.json"),
    path.join(BUILD, "server", "package.json"),
  );

  const localesSrc = path.join(ROOT, "mcpb", "mcpb-resources");
  if (existsSync(localesSrc)) {
    const localesDst = path.join(BUILD, "mcpb-resources");
    await fs.mkdir(localesDst, { recursive: true });
    for (const file of await fs.readdir(localesSrc)) {
      if (file.endsWith(".json")) {
        await copy(path.join(localesSrc, file), path.join(localesDst, file));
      }
    }
  }

  log("installing runtime deps into mcpb-build/server/node_modules");
  execSync("npm install --omit=dev --no-package-lock --no-audit --no-fund --silent", {
    cwd: path.join(BUILD, "server"),
    stdio: "inherit",
  });

  log("packing .mcpb (mcpb pack)");
  await packWithMcpbCli(BUILD, TARGET);

  const stat = await fs.stat(TARGET);
  log(`done: ${path.relative(ROOT, TARGET)}  (${(stat.size / 1024 / 1024).toFixed(2)} MB)`);
}

main().catch((err) => {
  process.stderr.write(`[mcpb] failed: ${err.stack || err.message}\n`);
  process.exit(1);
});
