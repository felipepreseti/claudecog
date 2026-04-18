declare module "marked-terminal" {
  import type { MarkedExtension } from "marked";
  export interface TerminalRendererOptions {
    code?: (code: string, lang?: string) => string;
    blockquote?: (quote: string) => string;
    html?: (html: string) => string;
    heading?: (text: string, level: number) => string;
    firstHeading?: (text: string, level: number) => string;
    hr?: () => string;
    listitem?: (text: string) => string;
    table?: (header: string, body: string) => string;
    paragraph?: (text: string) => string;
    strong?: (text: string) => string;
    em?: (text: string) => string;
    codespan?: (text: string) => string;
    del?: (text: string) => string;
    link?: (href: string, title: string, text: string) => string;
    image?: (href: string, title: string, text: string) => string;
    text?: (text: string) => string;
    width?: number;
    reflowText?: boolean;
    showSectionPrefix?: boolean;
    unescape?: boolean;
    emoji?: boolean;
    tab?: number;
    tableOptions?: Record<string, unknown>;
  }
  export function markedTerminal(
    options?: TerminalRendererOptions,
    highlightOptions?: unknown,
  ): MarkedExtension;
  const _default: typeof markedTerminal;
  export default _default;
}
