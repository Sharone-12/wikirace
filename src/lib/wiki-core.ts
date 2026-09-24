// Wikipedia access shared by the browser and the server. The only
// environment-specific piece is how raw article HTML becomes a DOM, which the
// caller passes to createWiki (DOMParser + DOMPurify in the browser, linkedom
// on the server).

const API = "https://en.wikipedia.org/w/api.php";
// Pre-rendered article HTML, served from Wikipedia's edge cache. Much faster
// than action=parse, which renders the page from scratch on every request.
const REST_HTML = "https://en.wikipedia.org/api/rest_v1/page/html/";
const IS_SERVER = typeof window === "undefined";
// Wikimedia asks server-side clients to identify themselves.
const SERVER_HEADERS = { "User-Agent": "WikiRace/1.0 (https://github.com/Sharone-12/wikirace)" };

export interface Article {
  title: string; // canonical title after redirects
  html: string; // cleaned, links rewritten to data-title anchors
  linkCount: number;
  links: string[]; // unique outgoing article titles (only links a player can click)
}

// Compare titles regardless of underscores / case of first letter.
export function normTitle(t: string): string {
  const s = t.replace(/_/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export async function api<T>(params: Record<string, string>): Promise<T> {
  const qs = new URLSearchParams({ format: "json", formatversion: "2", ...params });
  if (!IS_SERVER) qs.set("origin", "*");
  const res = await fetch(`${API}?${qs}`, { headers: IS_SERVER ? SERVER_HEADERS : undefined });
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

// Strip non-game parts of an article and rewrite its links, in place.
export function cleanArticle(root: HTMLElement): { html: string; linkCount: number; links: string[] } {
  root.querySelectorAll(REMOVE_SELECTORS).forEach((el) => el.remove());

  // Drop trailing sections (References, External links, ...) and their content.
  root.querySelectorAll("h2").forEach((h2) => {
    if (!h2.isConnected || !CUT_SECTIONS.has(h2.id.toLowerCase())) return;
    // REST HTML: the heading opens a <section> holding everything under it.
    const section = h2.closest("section");
    if (section && section.querySelector("h2") === h2) {
      section.remove();
      return;
    }
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
    // "./Title" in the REST HTML, "/wiki/Title" in action=parse HTML. Redlinks
    // (class "new") point at pages that don't exist.
    const m = a.classList.contains("new") ? null : href.match(/^(?:\.|\/wiki)\/([^#?]+)/);
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

  // REST HTML carries template metadata in data-mw attributes; the game never needs it.
  root.querySelectorAll("[data-mw], [data-mw-i18n]").forEach((el) => {
    el.removeAttribute("data-mw");
    el.removeAttribute("data-mw-i18n");
  });

  return { html: root.innerHTML, linkCount, links: [...links] };
}

// Resolve a title to its canonical form (follows redirects).
export async function canonicalTitle(title: string): Promise<string> {
  const data = await api<{ query: { pages: { title: string; missing?: boolean }[] } }>({
    action: "query",
    titles: title,
    redirects: "1",
  });
  const page = data.query.pages[0];
  if (!page || page.missing) throw new Error(`No such article: ${title}`);
  return page.title;
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

// Does article `from` contain a link to `to` (as written in the link, before
// redirects)? Checked against Wikipedia's link table.
export async function apiHasLink(from: string, to: string): Promise<boolean> {
  const data = await api<{ query: { pages: { links?: { title: string }[] }[] } }>({
    action: "query",
    prop: "links",
    titles: from,
    pltitles: to,
    pllimit: "max",
  });
  return (data.query.pages[0]?.links?.length ?? 0) > 0;
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

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'" };

/**
 * Canonical title of a REST HTML page (after any redirect), read from its
 * head: the dc:isVersionOf link, or failing that the <title> text.
 */
export function restTitle(raw: string): string | null {
  const link = raw.match(/<link rel="dc:isVersionOf" href="[^"]*\/wiki\/([^"#?]+)"/);
  if (link) {
    try {
      return normTitle(decodeURIComponent(link[1]));
    } catch {
      // fall through to <title>
    }
  }
  const t = raw.match(/<title>([^<]*)<\/title>/);
  return t ? normTitle(t[1].replace(/&(amp|lt|gt|quot|#39);/g, (_, e: string) => ENTITIES[e])) : null;
}

export function createWiki(toBody: (rawHtml: string) => HTMLElement, cacheSize = 300) {
  const cache = new Map<string, Article>();
  const inflight = new Map<string, Promise<Article>>(); // shared by a prefetch and the click that follows

  function remember(key: string, article: Article) {
    cache.delete(key);
    cache.set(key, article);
    while (cache.size > cacheSize) cache.delete(cache.keys().next().value as string);
  }

  // Raw page downloads, kept separately from processed articles so a prefetch
  // costs only network: the parsing happens on the click that needs it.
  const raws = new Map<string, Promise<string>>();
  const RAW_KEEP = 80;

  function fetchRaw(title: string, priority: "high" | "low" = "high"): Promise<string> {
    const key = normTitle(title);
    const pending = raws.get(key);
    if (pending) return pending;
    const init = { headers: IS_SERVER ? SERVER_HEADERS : undefined, priority } as RequestInit;
    const p = fetch(REST_HTML + encodeURIComponent(key.replace(/ /g, "_")), init).then((res) => {
      if (res.status === 404) throw new Error(`No such article: ${title}`);
      if (!res.ok) throw new Error(`Wikipedia error ${res.status}`);
      return res.text();
    });
    p.catch(() => raws.delete(key)); // a failed download can be retried
    raws.set(key, p);
    while (raws.size > RAW_KEEP) raws.delete(raws.keys().next().value as string);
    return p;
  }

  function fetchArticle(title: string): Promise<Article> {
    const key = normTitle(title);
    const hit = cache.get(key);
    if (hit) return Promise.resolve(hit);
    const pending = inflight.get(key);
    if (pending) return pending;
    const p = loadArticle(title, key).finally(() => inflight.delete(key));
    inflight.set(key, p);
    return p;
  }

  async function loadArticle(title: string, key: string): Promise<Article> {
    const raw = await fetchRaw(title);
    raws.delete(key); // processed from here on; the article cache takes over
    const { html, linkCount, links } = cleanArticle(toBody(raw));
    const article: Article = { title: restTitle(raw) ?? key, html, linkCount, links };
    remember(key, article);
    remember(normTitle(article.title), article);
    return article;
  }

  /** Start downloading an article the player is about to click (hover, touch). */
  function prefetchArticle(title: string): void {
    if (cache.has(normTitle(title))) return;
    fetchRaw(title).catch(() => {});
  }

  // Background queue for the links a player is likely to click next. A new
  // page replaces the queue, and only a few downloads run at once so they
  // never crowd out the click the player actually makes.
  let queue: string[] = [];
  let running = 0;
  const PREFETCH_PARALLEL = 6;

  function pump() {
    while (running < PREFETCH_PARALLEL && queue.length) {
      const title = queue.shift()!;
      if (cache.has(normTitle(title)) || raws.has(normTitle(title))) continue;
      running++;
      fetchRaw(title, "low")
        .catch(() => {})
        .finally(() => {
          running--;
          pump();
        });
    }
  }

  /** Queue background downloads of likely next clicks, replacing any older queue. */
  function prefetchLinks(titles: string[]): void {
    queue = [...titles];
    pump();
  }

  // Random mainspace article that makes for a playable start: not a list or
  // disambiguation page, reasonably long, and with plenty of outgoing links.
  async function pickStart(exclude: string): Promise<Article> {
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

  // A curated start that makes a real race: it loads, has plenty of links,
  // and doesn't link straight to the target (a one-click round is no race).
  // Candidates load a few at a time and the first good one to arrive wins
  // (they're in random order anyway). Falls back to a random article if every
  // candidate tried fails.
  async function pickCuratedStart(candidates: string[], target: string, tries = 9): Promise<Article> {
    const aliases = fetchAliases(target).catch(() => [] as string[]);
    const BATCH = 3;
    for (let i = 0; i < Math.min(tries, candidates.length); i += BATCH) {
      const goal = aliases.then((a) => new Set([normTitle(target), ...a]));
      const batch = candidates.slice(i, i + BATCH).map(async (title) => {
        const [article, reject] = await Promise.all([fetchArticle(title), goal]);
        const bad =
          reject.has(normTitle(article.title)) ||
          article.linkCount < 25 ||
          article.links.some((l) => reject.has(l));
        if (bad) throw new Error(`Not a good start: ${title}`);
        return article;
      });
      try {
        return await Promise.any(batch);
      } catch {
        // every candidate in this batch failed or was unsuitable: next batch
      }
    }
    return pickStart(target);
  }

  // Closeness dependencies (see scoring.ts) backed by this wiki instance.
  const closeDeps = {
    aliases: fetchAliases,
    linkersOf: pagesLinkingTo,
    getArticle: fetchArticle,
  };

  return { fetchArticle, prefetchArticle, prefetchLinks, pickStart, pickCuratedStart, closeDeps };
}
