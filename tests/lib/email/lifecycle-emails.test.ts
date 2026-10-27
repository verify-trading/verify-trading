import { describe, expect, it } from "vitest";

import { renderLifecycleEmail } from "@/lib/email/lifecycle/emails";
import type { LifecycleEmailId, TopicBranch } from "@/lib/email/lifecycle/types";
import { STORE_URLS } from "@/lib/site-config";

const UNSUBSCRIBE_URL = "https://www.verify.trading/api/email/unsubscribe?u=user-1&t=token";
const IDS: LifecycleEmailId[] = ["e2a", "e3a", "e2b", "e3b", "c1", "c2", "c3", "c4", "c5", "c6", "r1", "r2", "r3"];
const TOPICS: TopicBranch[] = ["broker", "propfirm", "risk", "psychology", "market", "other"];

function render(id: LifecycleEmailId, vars: Partial<Parameters<typeof renderLifecycleEmail>[1]> = {}) {
  return renderLifecycleEmail(id, { firstName: "Sam", ...vars }, UNSUBSCRIBE_URL);
}

function hrefs(html: string): string[] {
  return [...html.matchAll(/href="([^"]+)"/g)].map((match) => match[1].replaceAll("&amp;", "&"));
}

describe("renderLifecycleEmail", () => {
  it.each(IDS)("%s renders a complete email", (id) => {
    const email = render(id);

    expect(email.subject.length).toBeGreaterThan(0);
    expect(email.html).toContain("Hi Sam,");
    expect(email.text).toContain("Hi Sam,");
    expect(email.html).not.toContain("{{");
    expect(email.text).not.toContain("{{");
    expect(email.html).toContain("verify.trading gives information, not financial advice.");
    expect(email.text).toContain(`Unsubscribe: ${UNSUBSCRIBE_URL}`);
  });

  it.each(IDS)("%s tags every own link with UTMs and links the unsubscribe page", (id) => {
    const links = hrefs(render(id).html);

    expect(links).toContain(UNSUBSCRIBE_URL);
    for (const link of links) {
      if (link === UNSUBSCRIBE_URL || link.startsWith("https://fonts.")) continue;
      const url = new URL(link);
      if (url.hostname !== "www.verify.trading") continue;
      expect(url.searchParams.get("utm_source")).toBe("email");
      expect(url.searchParams.get("utm_medium")).toBe("lifecycle");
      expect(url.searchParams.get("utm_campaign")).toBe(id === "e2b" ? "e2b_other" : id);
    }
  });

  it.each(TOPICS)("e2b %s uses its topic in the subject and campaign", (topic) => {
    const email = render("e2b", { topic });
    const askLinks = hrefs(email.html).filter((link) => link.includes("/ask?"));

    expect(email.subject).toMatch(/^Yesterday you asked about /);
    expect(askLinks.length).toBeGreaterThan(0);
    for (const link of askLinks) {
      const url = new URL(link);
      expect(url.searchParams.get("prefill")).toBeTruthy();
      expect(url.searchParams.get("utm_campaign")).toBe(`e2b_${topic}`);
    }
  });

  it("e2b without a topic falls back to the general version", () => {
    expect(render("e2b").subject).toBe("Yesterday you asked about trading");
  });

  it("c2 leads with the feature closest to the user's topic", () => {
    const firstCard = (topic?: TopicBranch) => render("c2", { topic }).html.match(/font-weight:600;color:#FFFFFF;">([^<]+)</)?.[1];

    expect(firstCard("propfirm")).toBe("Journal");
    expect(firstCard("psychology")).toBe("Mind");
    expect(firstCard("market")).toBe("Intelligence");
    expect(firstCard(undefined)).toBe("Intelligence");
  });

  it("uses the billing config prices", () => {
    expect(render("c2").text).toContain("Weekly £6.99 · Monthly £19.99 · Annual £119.99");
    expect(render("c1").text).toContain("Plans from £6.99 a week.");
  });

  it("sends c4 and c5 from the pro address, everything else from ai", () => {
    for (const id of IDS) {
      expect(render(id).sender).toBe(id === "c4" || id === "c5" ? "pro" : "ai");
    }
  });

  it("c5 overrides only the card copy that differs from the shared Pro cards", () => {
    const text = render("c5").text;

    expect(text).toContain("- Intelligence: Your daily market brief");
    expect(text).toContain("- Economic calendar: Event alerts, switched on");
    expect(text).toContain("- Journal: With Challenge Mode");
    expect(text).toContain("- Mind: Coaching for discipline and tilt");
  });

  it("r1 says how long the user has been away", () => {
    expect(render("r1", { daysSince: 16 }).text).toContain("It's been 16 days since your last check.");
  });

  it("c6 sends the user back to the plan they picked", () => {
    const email = render("c6", { plan: "annual" });

    expect(email.text).toContain("your annual plan");
    expect(hrefs(email.html).some((link) => link.includes("/billing?plan=annual"))).toBe(true);
  });

  it("store links point at the real listings without UTMs", () => {
    const c5 = hrefs(render("c5").html);
    const r2 = hrefs(render("r2").html);

    expect(c5).toContain(STORE_URLS.apple);
    expect(c5).toContain(STORE_URLS.googlePlay);
    expect(r2).toContain(`${STORE_URLS.apple}?action=write-review`);
    expect(r2).toContain(STORE_URLS.googlePlay);
  });

  it("leaves out unsubscribe links when an account email has no signed link", () => {
    const email = renderLifecycleEmail("c5", { firstName: "Sam" }, null);

    expect(email.html).not.toContain("Unsubscribe");
    expect(email.html).not.toContain("Email preferences");
    expect(email.text).not.toContain("Unsubscribe");
  });

  it("escapes user-supplied names", () => {
    const email = renderLifecycleEmail("c1", { firstName: "<b>Sam</b>" }, UNSUBSCRIBE_URL);

    expect(email.html).not.toContain("<b>Sam</b>");
    expect(email.html).toContain("&lt;b&gt;Sam&lt;/b&gt;");
  });
});
