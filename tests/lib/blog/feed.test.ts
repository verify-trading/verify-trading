import { describe, expect, it } from "vitest";

import { categorize, stripActiveContent } from "@/lib/blog/feed";

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
});
