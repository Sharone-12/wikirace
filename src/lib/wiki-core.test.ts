import { parseHTML } from "linkedom";
import { describe, expect, it } from "vitest";
import { cleanArticle, restTitle } from "@/lib/wiki-core";

// A trimmed page in the shape Wikipedia's REST /page/html endpoint returns.
const PAGE = `<!DOCTYPE html>
<html><head>
<title>Quebec French</title>
<link rel="dc:isVersionOf" href="//en.wikipedia.org/wiki/Quebec_French"/>
</head><body>
<section data-mw-section-id="0">
  <p><a rel="mw:WikiLink" href="./French_language" title="French language">French</a> spoken in
  <a rel="mw:WikiLink" href="./Canada#Provinces" title="Canada">Canada</a>, see
  <a rel="mw:WikiLink" href="./Caribbean_French?action=edit&amp;redlink=1" class="new">Caribbean French</a>,
  <a rel="mw:WikiLink" href="./Help:IPA" title="Help:IPA">IPA</a> and
  <a rel="mw:ExtLink" href="https://example.org">a site</a>.<sup class="mw-ref reference">[1]</sup></p>
  <div data-mw='{"parts":[]}'>template output</div>
</section>
<section data-mw-section-id="1"><h2 id="History">History</h2>
  <p><a rel="mw:WikiLink" href="./New_France" title="New France">New France</a></p>
</section>
<section data-mw-section-id="2"><h2 id="References">References</h2>
  <p><a rel="mw:WikiLink" href="./Some_Journal" title="Some Journal">Some Journal</a></p>
  <section data-mw-section-id="3"><h3 id="Sources">Sources</h3><p>more</p></section>
</section>
</body></html>`;

function body(raw: string): HTMLElement {
  return parseHTML(raw).document.body as unknown as HTMLElement;
}

describe("cleanArticle on REST HTML", () => {
  const out = cleanArticle(body(PAGE));

  it("keeps mainspace links and rewrites them for the game", () => {
    expect(out.links).toEqual(["French language", "Canada", "New France"]);
    expect(out.linkCount).toBe(3);
    expect(out.html).toContain('data-title="Canada"');
  });

  it("drops redlinks, namespace links and external links but keeps their text", () => {
    expect(out.html).not.toContain("Caribbean_French");
    expect(out.html).toContain("Caribbean French");
    expect(out.html).not.toContain("Help:IPA");
    expect(out.html).not.toContain("example.org");
  });

  it("cuts the References section with its subsections", () => {
    expect(out.html).not.toContain("Some Journal");
    expect(out.html).not.toContain("Sources");
    expect(out.html).toContain("History");
  });

  it("strips references and template metadata", () => {
    expect(out.html).not.toContain("[1]");
    expect(out.html).not.toContain("data-mw=");
  });
});

describe("restTitle", () => {
  it("reads the canonical title from the page head", () => {
    expect(restTitle(PAGE)).toBe("Quebec French");
    expect(restTitle('<link rel="dc:isVersionOf" href="//en.wikipedia.org/wiki/AC%2FDC"/>')).toBe("AC/DC");
  });

  it("falls back to the <title> text", () => {
    expect(restTitle("<title>Tom &amp; Jerry</title>")).toBe("Tom & Jerry");
    expect(restTitle("<p>no head</p>")).toBeNull();
  });
});
