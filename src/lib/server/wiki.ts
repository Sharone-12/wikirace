import "server-only";
import { parseHTML } from "linkedom";
import { createWiki } from "@/lib/wiki-core";

// Server-side Wikipedia client. The HTML is never rendered here (only its
// links are read), so it is parsed without DOMPurify.
function toBody(rawHtml: string): HTMLElement {
  // REST article HTML is a full document; older fragments get wrapped.
  const page = /<html[\s>]/i.test(rawHtml) ? rawHtml : `<!doctype html><html><body>${rawHtml}</body></html>`;
  const { document } = parseHTML(page);
  return document.body as unknown as HTMLElement;
}

export const serverWiki = createWiki(toBody, 500);
