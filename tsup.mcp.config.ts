import { defineConfig } from "tsup";

// Bundle ONLY our own source code into a single file.
// Runtime npm dependencies stay external and are installed into
// `mcpb-build/server/node_modules` by the build script. This keeps
// the .mcpb hermetic without fighting tsup over CommonJS edge cases
// (whatwg-url, punycode, etc.) inside @anthropic-ai/sdk.
export default defineConfig({
  entry: { server: "src/mcp/server.ts" },
  outDir: "mcpb-build/server",
  format: ["esm"],
  target: "node20",
  platform: "node",
  clean: true,
  dts: false,
  splitting: false,
  shims: false,
  banner: { js: "#!/usr/bin/env node" },
});
