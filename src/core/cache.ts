import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const CACHE_DIR = ".claudecog";

export interface CacheEntry<T> {
  key: string;
  createdAt: string;
  payload: T;
}

export class RepoCache {
  private dir: string;

  constructor(repoRoot: string) {
    this.dir = path.join(repoRoot, CACHE_DIR);
  }

  async ensure(): Promise<void> {
    await fs.mkdir(this.dir, { recursive: true });
    const gitignore = path.join(this.dir, ".gitignore");
    try {
      await fs.access(gitignore);
    } catch {
      await fs.writeFile(gitignore, "*\n");
    }
  }

  hash(input: string): string {
    return crypto.createHash("sha256").update(input).digest("hex").slice(0, 16);
  }

  async read<T>(name: string): Promise<CacheEntry<T> | null> {
    const file = path.join(this.dir, `${name}.json`);
    try {
      const raw = await fs.readFile(file, "utf-8");
      return JSON.parse(raw) as CacheEntry<T>;
    } catch {
      return null;
    }
  }

  async write<T>(name: string, key: string, payload: T): Promise<void> {
    await this.ensure();
    const file = path.join(this.dir, `${name}.json`);
    const entry: CacheEntry<T> = {
      key,
      createdAt: new Date().toISOString(),
      payload,
    };
    await fs.writeFile(file, JSON.stringify(entry, null, 2));
  }

  async writeText(name: string, content: string): Promise<string> {
    await this.ensure();
    const file = path.join(this.dir, name);
    await fs.writeFile(file, content);
    return file;
  }

  path(name: string): string {
    return path.join(this.dir, name);
  }
}
