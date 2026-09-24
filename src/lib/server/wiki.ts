import "server-only";
import { parseHTML } from "linkedom";
import { createWiki } from "@/lib/wiki-core";

// Server-side Wikipedia client. The HTML is never rendered here (only its
// links are read), so it is parsed without DOMPurify.
function toBody(rawHtml: string): HTMLElement {
  const { document } = parseHTML(`<!doctype html><html><body>${rawHtml}</body></html>`);
  return document.body as unknown as HTMLElement;
}

export const serverWiki = createWiki(toBody, 500);
