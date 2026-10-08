import { describe, expect, it } from "vitest";

import { categorize, cleanArticleHtml, stripActiveContent } from "@/lib/blog/feed";

describe("blog feed", () => {
  it("maps BabyLoveGrowth keywords onto our categories", () => {
    expect(categorize("Best prop firm challenge rules 2026")).toBe("Prop firms");
    expect(categorize("Is this broker FCA regulated")).toBe("Broker safety");
    expect(categorize("position sizing and drawdown")).toBe("Risk management");
    expect(categorize("how to stop revenge trading")).toBe("Trading psychology");
    expect(categorize("gold price outlook this week")).toBe("Markets and news");
  });

  it("strips scripts, inline handlers and javascript: links from vendor HTML", () => {
    const html = '<p onclick="x()">Hi</p><script>alert(1)</script><a href="javascript:evil()">a</a><img src="/ok.png" onerror=\'bad()\'>';
    const out = stripActiveContent(html);
    expect(out).toBe('<p>Hi</p><a href="#">a</a><img src="/ok.png">');
  });

  it("drops the duplicate title, the repeated cover and nested vendor CTA blocks", () => {
    const hero = "https://cdn.example/cover.jpeg";
    const html =
      '<h1 id="t">Title</h1>\n<p><img src="https://cdn.example/cover.jpeg" alt="x"></p>\n<p>Intro</p>' +
      '<div data-blg-cta="after_tldr" style="a"><div><div>CTA <div>deep</div></div></div></div><h2>Next</h2>' +
      '<p><img src="https://cdn.example/other.png"></p>\n<p><a href="https://www.babylovegrowth.ai" target="_blank">Created with BabyLoveGrowth technology</a></p>';
    expect(cleanArticleHtml(html, hero)).toBe('<p>Intro</p><h2>Next</h2><p><img src="https://cdn.example/other.png"></p>');
  });
});
