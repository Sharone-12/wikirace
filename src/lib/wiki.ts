// Browser Wikipedia client: HTML is sanitized with DOMPurify before it is
// parsed, because the result is rendered with dangerouslySetInnerHTML.
import DOMPurify from "dompurify";
import { createWiki } from "@/lib/wiki-core";

export {
  canonicalTitle,
  fetchAliases,
  fetchExtract,
  normTitle,
  pagesLinkingTo,
  type Article,
} from "@/lib/wiki-core";

function toBody(rawHtml: string): HTMLElement {
  const clean = DOMPurify.sanitize(rawHtml, {
    FORBID_TAGS: ["script", "iframe", "object", "embed", "form", "input"],
    FORBID_ATTR: ["style"],
  });
  return new DOMParser().parseFromString(clean, "text/html").body;
}

export const { fetchArticle, pickStart, closeDeps } = createWiki(toBody);
