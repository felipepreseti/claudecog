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
  const sources = [
    process.env.CLAUDECOG_LANG,
    process.env.LC_ALL,
    process.env.LC_MESSAGES,
    process.env.LANG,
    process.env.LANGUAGE,
  ];
  for (const src of sources) {
    const guess = normalizeLang(src);
    if (guess) return guess;
  }
  return "en";
}
