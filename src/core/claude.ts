import Anthropic from "@anthropic-ai/sdk";
import { spawn } from "node:child_process";
import {
  type ClaudeCogConfig,
  DEFAULT_MAX_TOKENS,
  DEFAULT_MODEL,
  envApiKey,
} from "./config.js";

export interface AskOptions {
  system?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface ClaudeClient {
  ask(prompt: string, opts?: AskOptions): Promise<string>;
  describe(): string;
}

export function makeClient(cfg: ClaudeCogConfig): ClaudeClient {
  if (cfg.backend === "claude-code-cli") {
    return new ClaudeCodeClient(cfg);
  }
  return new AnthropicClient(cfg);
}

class AnthropicClient implements ClaudeClient {
  private client: Anthropic;
  private cfg: ClaudeCogConfig;

  constructor(cfg: ClaudeCogConfig) {
    const key = cfg.apiKey ?? envApiKey();
    if (!key) {
      throw new Error(
        "No Anthropic API key. Set ANTHROPIC_API_KEY or run `claudecog setup`.",
      );
    }
    this.cfg = cfg;
    this.client = new Anthropic({ apiKey: key });
  }

  describe(): string {
    return `Anthropic API · ${this.cfg.model}`;
  }

  async ask(prompt: string, opts: AskOptions = {}): Promise<string> {
    const res = await this.client.messages.create({
      model: this.cfg.model || DEFAULT_MODEL,
      max_tokens: opts.maxTokens ?? this.cfg.maxTokens ?? DEFAULT_MAX_TOKENS,
      temperature: opts.temperature ?? 0.2,
      system: opts.system,
      messages: [{ role: "user", content: prompt }],
    });

    const text = res.content
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("\n")
      .trim();

    if (!text) throw new Error("Claude returned an empty response.");
    return text;
  }
}

class ClaudeCodeClient implements ClaudeClient {
  private cfg: ClaudeCogConfig;

  constructor(cfg: ClaudeCogConfig) {
    this.cfg = cfg;
  }

  describe(): string {
    return `Claude Code CLI · ${this.cfg.model}`;
  }

  async ask(prompt: string, opts: AskOptions = {}): Promise<string> {
    const fullPrompt = opts.system
      ? `<system>\n${opts.system}\n</system>\n\n${prompt}`
      : prompt;

    return await new Promise<string>((resolve, reject) => {
      const child = spawn(
        "claude",
        ["-p", fullPrompt, "--output-format", "text"],
        { stdio: ["ignore", "pipe", "pipe"] },
      );

      let out = "";
      let err = "";
      child.stdout.on("data", (c: Buffer) => (out += c.toString()));
      child.stderr.on("data", (c: Buffer) => (err += c.toString()));
      child.on("error", (e) =>
        reject(
          new Error(
            `Failed to invoke Claude Code CLI: ${e.message}. Is \`claude\` on PATH?`,
          ),
        ),
      );
      child.on("close", (code) => {
        if (code !== 0) {
          reject(
            new Error(
              `Claude Code CLI exited with code ${code}: ${err.trim() || "no error output"}`,
            ),
          );
          return;
        }
        const text = out.trim();
        if (!text) reject(new Error("Claude Code CLI returned empty output."));
        else resolve(text);
      });
    });
  }
}

export async function detectClaudeCodeCli(): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn("claude", ["--version"], { stdio: "ignore" });
    child.on("error", () => resolve(false));
    child.on("close", (code) => resolve(code === 0));
  });
}
