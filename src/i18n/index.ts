import { execFileSync } from "node:child_process";
import { en, type Strings } from "./strings/en.js";
import { pt } from "./strings/pt.js";
import { es } from "./strings/es.js";

export type Lang = "en" | "pt" | "es";

const TABLES: Record<Lang, Strings> = { en, pt, es };

let current: Lang = "en";

export function setLang(lang: Lang): void {
  current = lang;
}

export function getLang(): Lang {
  return current;
}

export function t(): Strings {
  return TABLES[current];
}

export function listLangs(): Array<{ code: Lang; name: string }> {
  return (Object.keys(TABLES) as Lang[]).map((code) => ({
    code,
    name: TABLES[code].langName,
  }));
}

export function isLang(value: string | undefined | null): value is Lang {
  return value === "en" || value === "pt" || value === "es";
}

export function normalizeLang(input: string | undefined | null): Lang | null {
  if (!input) return null;
  const lower = input.toLowerCase().trim();
  if (lower.startsWith("pt")) return "pt";
  if (lower.startsWith("es")) return "es";
  if (lower.startsWith("en")) return "en";
  return null;
}

export function detectSystemLang(): Lang {
  const envSources = [
    process.env.CLAUDECOG_LANG,
    process.env.LC_ALL,
    process.env.LC_MESSAGES,
    process.env.LANG,
    process.env.LANGUAGE,
  ];
  for (const src of envSources) {
    const guess = normalizeLangStrict(src);
    if (guess) return guess;
  }
  const osGuess = readOsLocale();
  if (osGuess) return osGuess;
  try {
    const native = Intl.DateTimeFormat().resolvedOptions().locale;
    const guess = normalizeLangStrict(native);
    if (guess) return guess;
  } catch {
    /* noop */
  }
  return "en";
}

/**
 * Like normalizeLang, but ignores generic "C"/"POSIX" locales
 * which carry no real language signal.
 */
function normalizeLangStrict(input: string | undefined | null): Lang | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  if (lower === "c" || lower === "posix" || lower.startsWith("c.")) return null;
  return normalizeLang(trimmed);
}

function readOsLocale(): Lang | null {
  try {
    if (process.platform === "darwin") {
      const out = execFileSync("defaults", ["read", "-g", "AppleLocale"], {
        encoding: "utf8",
        timeout: 1000,
      }).trim();
      return normalizeLang(out);
    }
    if (process.platform === "win32") {
      const out = execFileSync(
        "powershell",
        ["-NoProfile", "-Command", "(Get-Culture).Name"],
        { encoding: "utf8", timeout: 1500 },
      ).trim();
      return normalizeLang(out);
    }
  } catch {
    /* noop */
  }
  return null;
}
