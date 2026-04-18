export function extractJsonBlock(text: string): unknown {
  const tagged = text.match(/<json>([\s\S]*?)<\/json>/i);
  if (tagged && tagged[1]) {
    return JSON.parse(stripFences(tagged[1].trim()));
  }
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced && fenced[1]) {
    return JSON.parse(fenced[1].trim());
  }
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const candidate = text.slice(firstBrace, lastBrace + 1);
    return JSON.parse(candidate);
  }
  throw new Error("Claude did not return parseable JSON.");
}

function stripFences(s: string): string {
  return s.replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
}
