#!/usr/bin/env node
// Smoke-tests the bundled MCP server: initialize handshake + tools/list.
import { spawn } from "node:child_process";
import path from "node:path";
import url from "node:url";

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..");
const SERVER = path.join(ROOT, "mcpb-build", "server", "server.js");

const env = {
  ...process.env,
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? "test-key-not-used-for-handshake",
};

const child = spawn("node", [SERVER], {
  env,
  stdio: ["pipe", "pipe", "pipe"],
});

let buffer = "";
const responses = [];

child.stdout.on("data", (chunk) => {
  buffer += chunk.toString();
  let nl;
  while ((nl = buffer.indexOf("\n")) !== -1) {
    const line = buffer.slice(0, nl).trim();
    buffer = buffer.slice(nl + 1);
    if (!line) continue;
    try {
      responses.push(JSON.parse(line));
    } catch {
      console.log("[stdout-raw]", line);
    }
  }
});

child.stderr.on("data", (chunk) => {
  process.stderr.write(`[stderr] ${chunk}`);
});

function send(msg) {
  child.stdin.write(JSON.stringify(msg) + "\n");
}

send({
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "smoke", version: "0" },
  },
});

setTimeout(() => {
  send({ jsonrpc: "2.0", method: "notifications/initialized", params: {} });
  send({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
}, 200);

setTimeout(() => {
  console.log("\n=== responses ===");
  console.log(JSON.stringify(responses, null, 2));
  child.kill();
  process.exit(0);
}, 1500);
