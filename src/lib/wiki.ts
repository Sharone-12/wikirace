import DOMPurify from "dompurify";

const API = "https://en.wikipedia.org/w/api.php";

export interface Article {
  title: string; // canonical title after redirects
  html: string; // sanitized, links rewritten to data-title anchors
  linkCount: number;
  links: string[]; // unique outgoing article titles
}

// Compare titles regardless of underscores / case of first letter.
export function normTitle(t: string): string {
  const s = t.replace(/_/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

async function api<T>(params: Record<string, string>): Promise<T> {
  const qs = new URLSearchParams({
    format: "json",
    formatversion: "2",
    origin: "*",
    ...params,
  });
  const res = await fetch(`${API}?${qs}`);
  if (!res.ok) throw new Error(`Wikipedia API error ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(json.error.info ?? "Wikipedia API error");
  return json as T;
}

const REMOVE_SELECTORS = [
  ".mw-editsection",
  ".reference",
  ".reflist",
  ".references",
  ".mw-references-wrap",
  ".navbox",
  ".navbox-styles",
  ".catlinks",
  ".mw-empty-elt",
  "#coordinates",
  ".sistersitebox",
  ".noprint",
  ".metadata",
  ".ambox",
  ".hatnote",
  ".shortdescription",
  ".mw-cite-backlink",
  "style",
  "link",
  "meta",
].join(",");

const CUT_SECTIONS = new Set([
  "references",
  "external_links",
  "notes",
  "further_reading",
  "bibliography",
  "sources",
  "citations",
  "footnotes",
]);

// Titles with a namespace prefix ("File:", "Help:", ...) are not mainspace.
function isMainspace(title: string): boolean {
  return !title.includes(":");
}

function sanitize(rawHtml: string): { html: string; linkCount: number; links: string[] } {
  const clean = DOMPurify.sanitize(rawHtml, {
    FORBID_TAGS: ["script", "iframe", "object", "embed", "form", "input"],
    FORBID_ATTR: ["style"],
  });
  const doc = new DOMParser().parseFromString(clean, "text/html");
  const root = doc.body;

  root.querySelectorAll(REMOVE_SELECTORS).forEach((el) => el.remove());

  // Drop trailing sections (References, External links, ...) and their content.
  root.querySelectorAll("h2").forEach((h2) => {
    if (!h2.isConnected || !CUT_SECTIONS.has(h2.id.toLowerCase())) return;
    const head = h2.closest(".mw-heading") ?? h2;
    let next = head.nextElementSibling;
    while (next && !next.matches("h2, .mw-heading2, .mw-heading")) {
      const after = next.nextElementSibling;
      next.remove();
      next = after;
    }
    head.remove();
  });

  let linkCount = 0;
  const links = new Set<string>();
  root.querySelectorAll("a").forEach((a) => {
    const href = a.getAttribute("href") ?? "";
    const m = href.match(/^\/wiki\/([^#?]+)/);
    let title: string | null = null;
    if (m) {
      try {
        title = decodeURIComponent(m[1]).replace(/_/g, " ");
      } catch {
        title = null;
      }
    }
    if (title && isMainspace(title)) {
      a.setAttribute("data-title", title);
      a.setAttribute("href", "#");
      a.removeAttribute("target");
      a.removeAttribute("rel");
      linkCount++;
      links.add(normTitle(title));
    } else {
      // external, namespace, redlink, or in-page anchor: keep the text, drop the link
      a.replaceWith(...Array.from(a.childNodes));
    }
  });

  return { html: root.innerHTML, linkCount, links: [...links] };
}

const cache = new Map<string, Article>();

export async function fetchArticle(title: string): Promise<Article> {
  const key = normTitle(title);
  const hit = cache.get(key);
  if (hit) return hit;

  const data = await api<{ parse: { title: string; text: string } }>({
    action: "parse",
    page: title,
    prop: "text",
    redirects: "1",
    disableeditsection: "1",
    disabletoc: "1",
    disablelimitreport: "1",
  });
  const { html, linkCount, links } = sanitize(data.parse.text);
  const article: Article = { title: data.parse.title, html, linkCount, links };
  cache.set(key, article);
  cache.set(normTitle(data.parse.title), article);
  return article;
}

// Resolve a title to its canonical form (follows redirects).
export async function canonicalTitle(title: string): Promise<string> {
  const data = await api<{ query: { pages: { title: string }[] } }>({
    action: "query",
    titles: title,
    redirects: "1",
  });
  return data.query.pages[0]?.title ?? title;
}

const LINK_CHECK_LIMIT = 1000; // max titles prefiltered per closeness measurement
const ALIAS_PREFILTER_LIMIT = 50; // pltitles accepts at most 50 titles

// Redirect titles that point at `title` ("USA" -> "United States"). A link to
// an alias is a link to the target, so closeness needs them.
export async function fetchAliases(title: string): Promise<string[]> {
  const data = await api<{ query: { pages: { redirects?: { title: string }[] }[] } }>({
    action: "query",
    prop: "redirects",
    titles: title,
    rdlimit: "max",
    rdnamespace: "0",
    redirects: "1",
  });
  return (data.query.pages[0]?.redirects ?? []).map((r) => normTitle(r.title));
}

// Which of `titles` (as the API sees them) link to any of `targets`? This is a
// cheap PREFILTER: the API also counts links from navboxes and hatnotes that
// the game strips, so callers must confirm against the rendered article.
// Batched 50 titles per request, a few requests in parallel.
export async function pagesLinkingTo(titles: string[], targets: string[]): Promise<string[]> {
  const wanted = new Set(targets.map(normTitle));
  const unique = [...new Set(titles.map(normTitle))]
    .filter((x) => !wanted.has(x))
    .slice(0, LINK_CHECK_LIMIT);
  const batches: string[][] = [];
  for (let i = 0; i < unique.length; i += 50) batches.push(unique.slice(i, i + 50));

  const linking = new Set<string>();
  for (let i = 0; i < batches.length; i += 5) {
    const results = await Promise.all(
      batches.slice(i, i + 5).map((b) =>
        api<{ query: { pages: { title: string; links?: { title: string }[] }[] } }>({
          action: "query",
          prop: "links",
          titles: b.join("|"),
          pltitles: targets.slice(0, ALIAS_PREFILTER_LIMIT).join("|"),
          pllimit: "max",
          redirects: "1",
        }),
      ),
    );
    for (const r of results) {
      for (const p of r.query.pages) if (p.links?.length) linking.add(p.title);
    }
  }
  return [...linking];
}

export async function fetchExtract(title: string): Promise<string> {
  const data = await api<{ query: { pages: { extract?: string }[] } }>({
    action: "query",
    prop: "extracts",
    exintro: "1",
    explaintext: "1",
    exsentences: "2",
    titles: title,
    redirects: "1",
  });
  return data.query.pages[0]?.extract ?? "";
}

// Random mainspace article that makes for a playable start: not a list or
// disambiguation page, reasonably long, and with plenty of outgoing links.
export async function pickStart(exclude: string): Promise<Article> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const rnd = await api<{ query: { random: { title: string }[] } }>({
      action: "query",
      list: "random",
      rnnamespace: "0",
      rnlimit: "20",
    });
    const titles = rnd.query.random
      .map((r) => r.title)
      .filter((t) => !/^(List|Lists|Index|Outline) of /i.test(t) && !/^\d{1,4}\b/.test(t));
    if (!titles.length) continue;

    const info = await api<{
      query: {
        pages: { title: string; length?: number; pageprops?: Record<string, string> }[];
      };
    }>({
      action: "query",
      prop: "info|pageprops",
      ppprop: "disambiguation",
      titles: titles.join("|"),
    });
    const good = info.query.pages.filter(
      (p) =>
        (p.length ?? 0) > 6000 &&
        !p.pageprops?.disambiguation &&
        normTitle(p.title) !== normTitle(exclude),
    );
    for (const p of good) {
      const article = await fetchArticle(p.title);
      if (article.linkCount >= 25) return article;
    }
  }
  throw new Error("Couldn't find a good starting article. Try again.");
}
