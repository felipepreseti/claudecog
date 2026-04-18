import { marked } from "marked";
import { markedTerminal } from "marked-terminal";

let configured = false;

function configure(): void {
  if (configured) return;
  marked.use(
    markedTerminal({
      width: Math.min(process.stdout.columns ?? 100, 100),
      reflowText: true,
      tab: 2,
    }) as Parameters<typeof marked.use>[0],
  );
  configured = true;
}

export function renderMarkdown(md: string): string {
  configure();
  const out = marked.parse(md);
  if (typeof out === "string") return out;
  return md;
}
