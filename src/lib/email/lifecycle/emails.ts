import { formatGbp, getBillingPlanAmountGbp } from "@/lib/billing/config";
import { escapeHtml } from "@/lib/email/escape-html";
import type {
  EmailVars,
  LifecycleEmailId,
  RenderedEmail,
  TopicBranch,
} from "@/lib/email/lifecycle/types";
import { FREE_DAILY_ASK_LIMIT as FREE, PRO_DAILY_ASK_LIMIT as PRO } from "@/lib/rate-limit/usage";
import { getSiteUrl, STORE_URLS } from "@/lib/site-config";

/*
 * Copy + layout for every lifecycle email (docs/lifecycle-emails-spec.md, copy from
 * docs/lifecycle-emails-copy.md). Each email is a list of blocks; one renderer turns the
 * blocks into the HTML and the plain-text part, so the two can never drift apart.
 */

type Link = { label: string; href: string };
type Card = { title: string; body: string; href: string };

type Block =
  | { type: "p"; text: string }
  | { type: "muted"; text: string }
  | { type: "bullets"; items: string[] }
  | { type: "questions"; items: string[] }
  | { type: "cards"; items: Card[] }
  | { type: "button"; link: Link }
  | { type: "link"; link: Link }
  | { type: "stores" };

type EmailContent = {
  subject: string;
  /** "pro" sends from the subscription address; default is the signup ("ai") address. */
  sender?: "pro" | "ai";
  preview: string;
  headline: string;
  blocks: Block[];
};

const COLOR = {
  page: "#090C1D",
  card: "#0F1130",
  tile: "#161A42",
  tileBorder: "#262B5C",
  coral: "#FF6464",
  white: "#FFFFFF",
  body: "#CFD3E6",
  muted: "#8B90AD",
  footer: "#5A5F7A",
};
const FONT = "'Poppins',Arial,Helvetica,sans-serif";

type TopicCopy = { label: string; nextQuestion: string; link: Link };

const TOPICS: Record<TopicBranch, TopicCopy> = {
  broker: {
    label: "your broker",
    nextQuestion: "Compare it with another broker you're considering.",
    link: { label: "How to tell a scam broker from a real one", href: "/blog/how-to-tell-a-scam-broker-from-a-real-one" },
  },
  propfirm: {
    label: "prop firms",
    nextQuestion: "Which rules catch traders out at the firm you're looking at?",
    link: { label: "Challenge rules that catch traders out", href: "/blog/prop-firm-challenge-rules-that-catch-traders-out" },
  },
  risk: {
    label: "risk",
    nextQuestion: "How much should I risk per trade on my account size?",
    link: { label: "Position size calculator", href: "/tools/position-size-calculator" },
  },
  psychology: {
    label: "trading psychology",
    nextQuestion: "How do I stop after two losses in a row?",
    link: { label: "Revenge trading and tilt: how to stop", href: "/blog/revenge-trading-and-tilt-how-to-stop" },
  },
  market: {
    label: "the markets",
    nextQuestion: "What's on the economic calendar this week, and why does it matter?",
    link: { label: "How to trade around economic news", href: "/blog/how-to-trade-around-economic-news" },
  },
  other: {
    label: "trading",
    nextQuestion: "Is the broker I trade with properly regulated?",
    link: { label: "Compare brokers", href: "/verify/brokers" },
  },
};

const PRO_CARDS = {
  intelligence: { title: "Intelligence", body: "A daily market brief", href: "/intelligence" },
  calendar: { title: "Economic calendar", body: "Event alerts before the news hits", href: "/economic-calendar" },
  journal: { title: "Journal", body: "Log trades, with Challenge Mode for prop firm rules", href: "/journal" },
  mind: { title: "Mind", body: "Coaching for discipline and tilt", href: "/mind" },
} satisfies Record<string, Card>;

/** C2 leads with the feature closest to what the user first asked about. */
function proCardsFor(topic: TopicBranch | undefined): Card[] {
  const { intelligence, calendar, journal, mind } = PRO_CARDS;
  if (topic === "propfirm") return [journal, intelligence, calendar, mind];
  if (topic === "psychology") return [mind, intelligence, calendar, journal];
  return [intelligence, calendar, journal, mind];
}

function hi(vars: EmailVars): Block {
  return { type: "p", text: `Hi ${vars.firstName},` };
}

function content(id: LifecycleEmailId, vars: EmailVars): EmailContent {
  const weekly = formatGbp(getBillingPlanAmountGbp("weekly"));
  const monthly = formatGbp(getBillingPlanAmountGbp("monthly"));
  const annual = formatGbp(getBillingPlanAmountGbp("annual"));

  switch (id) {
    case "e2a":
      return {
        subject: "Not sure what to ask? Tap one.",
        preview: "Three questions traders start with.",
        headline: "Start with one of these.",
        blocks: [
          hi(vars),
          { type: "p", text: "An empty box is the hardest part. Tap one and you'll have an answer in seconds:" },
          {
            type: "questions",
            items: [
              "Is Pepperstone safe for UK retail CFDs?",
              "How do I spot a fake signal group?",
              "How much should I risk per trade?",
            ],
          },
          { type: "button", link: { label: "Ask now", href: "/ask" } },
          { type: "link", link: { label: "Or browse broker records first", href: "/verify/brokers" } },
        ],
      };

    case "e3a":
      return {
        subject: "One question. That's all it takes.",
        preview: "Or try a free tool, no question needed.",
        headline: "Two ways to start.",
        blocks: [
          hi(vars),
          {
            type: "p",
            text: "Ask one question about your broker, a prop firm or a trade you're planning, and see what comes back.",
          },
          { type: "p", text: "Not ready to ask? Work out your position size in 10 seconds with our free calculator." },
          { type: "button", link: { label: "Ask now", href: "/ask" } },
          { type: "link", link: { label: "Position size calculator", href: "/tools/position-size-calculator" } },
        ],
      };

    case "e2b": {
      const topic = TOPICS[vars.topic ?? "other"];
      return {
        subject: `Yesterday you asked about ${topic.label}`,
        preview: "Here's a good next question.",
        headline: "Pick up where you left off.",
        blocks: [
          hi(vars),
          { type: "p", text: `Yesterday you asked about ${topic.label}. Here's a good next step:` },
          { type: "questions", items: [topic.nextQuestion] },
          { type: "p", text: `Today's ${FREE} free questions are waiting. Yesterday's don't carry over.` },
          { type: "button", link: { label: "Continue in Ask", href: askHref(topic.nextQuestion) } },
          { type: "link", link: topic.link },
        ],
      };
    }

    case "e3b":
      return {
        subject: "Do you know who's holding your money?",
        preview: "It takes 10 seconds to check.",
        headline: "Check the firm that holds your deposit.",
        blocks: [
          hi(vars),
          {
            type: "p",
            text: "It takes 10 seconds to check the broker you actually trade with: who regulates it, what the register says, and whether there are any warnings.",
          },
          { type: "p", text: "Search it once and you'll know." },
          { type: "button", link: { label: "Check my broker", href: "/verify/brokers" } },
          {
            type: "link",
            link: {
              label: "How to check if a broker is FCA regulated",
              href: "/blog/how-to-check-if-a-broker-is-fca-regulated",
            },
          },
        ],
      };

    case "c1":
      return {
        subject: `You've used all ${FREE} for today`,
        preview: `They're back tomorrow. Or get ${PRO} a day with Pro.`,
        headline: "You've hit today's free limit.",
        blocks: [
          hi(vars),
          { type: "p", text: `You've used all ${FREE} free questions and checks for today. They reset tomorrow.` },
          { type: "p", text: "If you need more today, Pro gives you:" },
          {
            type: "bullets",
            items: [
              `${PRO} questions and checks a day`,
              "The daily Intelligence brief",
              "The economic calendar with event alerts",
              "Journal with Challenge Mode, and Mind coaching",
            ],
          },
          { type: "p", text: `Plans from ${weekly} a week. Cancel any time.` },
          { type: "button", link: { label: "See Pro plans", href: "/pricing" } },
          { type: "link", link: { label: "What's in Intelligence", href: "/intelligence" } },
        ],
      };

    case "c2":
      return {
        subject: "What you'd get with Pro",
        preview: "Four tools, and where to see each one.",
        headline: "Here's what Pro adds.",
        blocks: [
          hi(vars),
          {
            type: "p",
            text: "You hit the free limit this week, so here's what comes with Pro. Each one has its own page if you want a closer look:",
          },
          { type: "cards", items: proCardsFor(vars.topic) },
          { type: "p", text: `Plus ${PRO} questions and checks a day.` },
          { type: "muted", text: `Weekly ${weekly} · Monthly ${monthly} · Annual ${annual}` },
          { type: "button", link: { label: "See Pro plans", href: "/pricing" } },
        ],
      };

    case "c3":
      return {
        subject: "Capped again today",
        preview: `${PRO} a day on Pro.`,
        headline: "That's the limit again.",
        blocks: [
          hi(vars),
          {
            type: "p",
            text: `You've hit the free limit again. If Ask is part of how you trade now, Pro gives you ${PRO} questions and checks a day, plus the daily brief, the journal and calendar alerts.`,
          },
          { type: "button", link: { label: "Go Pro", href: "/billing?plan=monthly" } },
          { type: "link", link: { label: "Compare plans", href: "/pricing" } },
        ],
      };

    case "c4":
      return {
        subject: "Three days on Pro. Here's what to set up.",
        sender: "pro",
        preview: "Two things worth doing this week.",
        headline: "Get the most out of Pro.",
        blocks: [
          hi(vars),
          { type: "p", text: "You've had Pro for three days. Two things worth setting up this week:" },
          {
            type: "cards",
            items: [
              {
                title: "Economic calendar",
                body: "Turn on event alerts so big news never catches you mid-trade",
                href: "/economic-calendar",
              },
              {
                title: "Journal",
                body: "Log your next trade. Challenge Mode tracks prop firm rules for you",
                href: "/journal",
              },
            ],
          },
          { type: "p", text: "Your daily brief is waiting in Intelligence every morning." },
          { type: "button", link: { label: "Open Intelligence", href: "/intelligence" } },
          { type: "link", link: { label: "Manage billing", href: "/billing" } },
        ],
      };

    case "c5":
      return {
        subject: "You're on Pro",
        sender: "pro",
        preview: "Here's where everything is.",
        headline: "Welcome to Pro.",
        blocks: [
          hi(vars),
          { type: "p", text: `You've now got ${PRO} questions and checks a day, plus:` },
          {
            type: "cards",
            items: [
              { ...PRO_CARDS.intelligence, body: "Your daily market brief" },
              { ...PRO_CARDS.calendar, body: "Event alerts, switched on" },
              { ...PRO_CARDS.journal, body: "With Challenge Mode" },
              PRO_CARDS.mind,
            ],
          },
          { type: "p", text: "Pro works in the app too. Log in with the same account." },
          { type: "stores" },
          { type: "button", link: { label: "Open Intelligence", href: "/intelligence" } },
          { type: "link", link: { label: "Manage billing", href: "/billing" } },
        ],
      };

    case "c6": {
      const plan = vars.plan ?? "monthly";
      return {
        subject: "Still thinking about Pro?",
        preview: "Your plan is saved. Pick up where you left off.",
        headline: "You were one step from Pro.",
        blocks: [
          hi(vars),
          {
            type: "p",
            text: `You started upgrading to Pro but didn't finish. If something went wrong at checkout, the button below takes you straight back to your ${plan} plan.`,
          },
          { type: "p", text: "Still deciding? Here's what changes:" },
          {
            type: "bullets",
            items: [
              `${PRO} questions and checks a day instead of ${FREE}`,
              "The daily Intelligence brief",
              "Calendar alerts, Journal and Mind",
            ],
          },
          {
            type: "p",
            text: "Cancel any time. If something broke at checkout, just reply to this email and we'll sort it.",
          },
          { type: "button", link: { label: "Finish upgrading", href: `/billing?plan=${plan}` } },
          { type: "link", link: { label: "Questions about Pro? Read the FAQ", href: "/faq" } },
        ],
      };
    }

    case "r1": {
      const days = vars.daysSince ?? 14;
      return {
        subject: "Before your next trade",
        preview: "A 2-minute check, three taps.",
        headline: "A 2-minute check before your next trade.",
        blocks: [
          hi(vars),
          {
            type: "p",
            text: `It's been ${days} days since your last check. Licences change and regulators add new warnings all the time, so here are three quick checks worth running before your next trade:`,
          },
          {
            type: "questions",
            items: [
              "Is my broker still properly regulated, and are there any new warnings?",
              "How much should I risk per trade on my account size?",
              "What big economic events are coming up this week, and why do they matter?",
            ],
          },
          { type: "muted", text: "Each one opens Ask with the question ready to go." },
          { type: "button", link: { label: "Open Ask", href: "/ask" } },
        ],
      };
    }

    case "r2":
      return {
        subject: "Quick favour?",
        preview: "One tap, 10 seconds.",
        headline: "Is verify.trading useful to you?",
        blocks: [
          hi(vars),
          { type: "p", text: "You've used verify.trading on 3 different days now, so you know what it does." },
          {
            type: "p",
            text: "If it's helped, a quick rating on the App Store helps other traders find a tool where nobody can pay to change a verdict.",
          },
          { type: "p", text: "If it hasn't, reply to this email and tell us what's missing. We read every reply." },
          {
            type: "button",
            link: { label: "Rate us on the App Store", href: `${STORE_URLS.apple}?action=write-review` },
          },
          { type: "link", link: { label: "On Android? Rate us on Google Play", href: STORE_URLS.googlePlay } },
        ],
      };

    case "r3":
      return {
        subject: "Know traders who'd use this?",
        preview: "Earn 30% of their Pro plan, every month.",
        headline: "Share verify.trading. Earn every month.",
        blocks: [
          hi(vars),
          {
            type: "p",
            text: "If you run a trading community, a channel or a group chat, our affiliate programme pays you 30% of every Pro subscription you refer, every month they stay.",
          },
          {
            type: "cards",
            items: [
              { title: "Apply in minutes", body: "Tell us a bit about your audience", href: "/affiliates" },
              { title: "Share your link", body: "60 days to sign up after they click", href: "/affiliates" },
              { title: "Get paid monthly", body: "PayPal or Wise, from £20", href: "/affiliates" },
            ],
          },
          {
            type: "muted",
            text: "Affiliates must say clearly that they earn commission whenever they share their link.",
          },
          { type: "button", link: { label: "Become an affiliate", href: "/affiliates" } },
          { type: "link", link: { label: "Read the affiliate terms", href: "/affiliate-terms" } },
        ],
      };
  }
}

function askHref(question: string): string {
  return `/ask?prefill=${encodeURIComponent(question)}`;
}

/** Absolute URL with UTM tags for our own pages; store links pass through untouched. */
function resolveHref(href: string, campaign: string): string {
  if (/^https?:\/\//.test(href)) return href;
  const url = new URL(href, `${getSiteUrl()}/`);
  url.searchParams.set("utm_source", "email");
  url.searchParams.set("utm_medium", "lifecycle");
  url.searchParams.set("utm_campaign", campaign);
  return url.toString();
}

function campaignFor(id: LifecycleEmailId, vars: EmailVars): string {
  return id === "e2b" ? `e2b_${vars.topic ?? "other"}` : id;
}

// ---------------------------------------------------------------------------
// HTML
// ---------------------------------------------------------------------------

function textCell(text: string, size: number, color: string, paddingBottom: number, weight = 400): string {
  return `<tr><td style="font-family:${FONT};font-size:${size}px;line-height:${Math.round(size * 1.6)}px;color:${color};font-weight:${weight};padding-bottom:${paddingBottom}px;">${escapeHtml(text)}</td></tr>`;
}

function tileHtml(href: string, title: string, body: string | null): string {
  const bodyHtml = body
    ? `<br><span style="font-family:${FONT};font-size:14px;line-height:22px;color:${COLOR.muted};">${escapeHtml(body)}</span>`
    : "";
  return `<tr><td style="padding:0 0 10px 0;"><a href="${escapeHtml(href)}" target="_blank" style="display:block;text-decoration:none;background-color:${COLOR.tile};border:1px solid ${COLOR.tileBorder};border-radius:12px;padding:14px 16px;"><span style="font-family:${FONT};font-size:15px;line-height:22px;font-weight:600;color:${COLOR.white};">${escapeHtml(title)}</span> <span style="font-family:${FONT};font-size:15px;color:${COLOR.coral};">&rarr;</span>${bodyHtml}</a></td></tr>`;
}

function tilesHtml(rows: string[]): string {
  return `<tr><td style="padding-bottom:10px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows.join("")}</table></td></tr>`;
}

function storeBadge(href: string, small: string, big: string): string {
  return `<td style="padding:0 8px 0 0;"><a href="${escapeHtml(href)}" target="_blank" style="display:inline-block;text-decoration:none;background-color:#000000;border:1px solid #3A3F5C;border-radius:10px;padding:7px 14px;"><span style="font-family:${FONT};font-size:10px;line-height:12px;color:${COLOR.body};">${small}</span><br><span style="font-family:${FONT};font-size:16px;line-height:20px;font-weight:600;color:${COLOR.white};">${big}</span></a></td>`;
}

function blockHtml(block: Block, campaign: string): string {
  switch (block.type) {
    case "p":
      return textCell(block.text, 16, COLOR.body, 16);
    case "muted":
      return textCell(block.text, 14, COLOR.muted, 20);
    case "bullets":
      return `<tr><td style="padding-bottom:16px;"><table role="presentation" cellpadding="0" cellspacing="0">${block.items
        .map(
          (item) =>
            `<tr><td valign="top" style="font-family:${FONT};font-size:16px;line-height:26px;color:${COLOR.coral};padding:0 10px 4px 0;">&bull;</td><td style="font-family:${FONT};font-size:16px;line-height:26px;color:${COLOR.body};padding-bottom:4px;">${escapeHtml(item)}</td></tr>`,
        )
        .join("")}</table></td></tr>`;
    case "questions":
      return tilesHtml(block.items.map((q) => tileHtml(resolveHref(askHref(q), campaign), q, null)));
    case "cards":
      return tilesHtml(block.items.map((c) => tileHtml(resolveHref(c.href, campaign), c.title, c.body)));
    case "button":
      return `<tr><td align="left" style="padding:12px 0 20px 0;"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td align="center" bgcolor="${COLOR.coral}" style="border-radius:28px;background-color:${COLOR.coral};"><a href="${escapeHtml(resolveHref(block.link.href, campaign))}" target="_blank" style="display:inline-block;padding:15px 34px;font-family:${FONT};font-size:16px;font-weight:700;color:${COLOR.page};text-decoration:none;border-radius:28px;">${escapeHtml(block.link.label)} &rarr;</a></td></tr></table></td></tr>`;
    case "link":
      return `<tr><td style="font-family:${FONT};font-size:14px;line-height:22px;padding-bottom:4px;"><a href="${escapeHtml(resolveHref(block.link.href, campaign))}" target="_blank" style="color:${COLOR.coral};text-decoration:underline;">${escapeHtml(block.link.label)}</a></td></tr>`;
    case "stores":
      return `<tr><td style="padding:0 0 20px 0;"><table role="presentation" cellpadding="0" cellspacing="0"><tr>${storeBadge(STORE_URLS.apple, "Download on the", "App Store")}${storeBadge(STORE_URLS.googlePlay, "GET IT ON", "Google Play")}</tr></table></td></tr>`;
  }
}

function anchor(label: string, href: string, color: string): string {
  return `<a href="${escapeHtml(href)}" target="_blank" style="color:${color};text-decoration:underline;">${label}</a>`;
}

function footerHtml(campaign: string, unsubscribeUrl: string | null): string {
  const link = (label: string, href: string) => anchor(label, resolveHref(href, campaign), COLOR.muted);
  const sep = " &nbsp;&middot;&nbsp; ";
  return `<tr><td class="pad" style="padding:24px 24px 0;font-family:${FONT};font-size:12px;line-height:18px;color:${COLOR.footer};text-align:center;">
verify.trading gives information, not financial advice. Check any firm on its regulator's own register before you deposit.<br><br>
${[link("Blog", "/blog"), link("Glossary", "/glossary"), link("Why trust us", "/trust"), link("FAQ", "/faq")].join(sep)}<br><br>
Verify Trading Limited &middot; United Kingdom${unsubscribeUrl ? `<br>
${anchor("Unsubscribe", unsubscribeUrl, COLOR.footer)}${sep}${anchor("Email preferences", unsubscribeUrl, COLOR.footer)}` : ""}
</td></tr>`;
}

function renderHtml(email: EmailContent, campaign: string, unsubscribeUrl: string | null): string {
  const logoUrl = `${getSiteUrl()}/verify-trading-email-logo.png`;
  // Zero-width padding stops mail clients pulling body text into the inbox preview.
  const previewPad = "&#847;&zwnj;&nbsp;".repeat(30);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>${escapeHtml(email.subject)}</title>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
body{margin:0;padding:0;background:${COLOR.page};-webkit-text-size-adjust:100%;}
table,td{border-collapse:collapse;mso-table-lspace:0;mso-table-rspace:0;}
img{border:0;outline:none;text-decoration:none;}
@media screen and (max-width:600px){.wrap{width:100%!important;}.pad{padding-left:24px!important;padding-right:24px!important;}.h1{font-size:24px!important;line-height:32px!important;}}
</style>
</head>
<body style="margin:0;padding:0;background:${COLOR.page};">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${escapeHtml(email.preview)}${previewPad}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${COLOR.page}" style="background:${COLOR.page};"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" class="wrap" width="560" cellpadding="0" cellspacing="0" style="width:560px;max-width:560px;">
<tr><td class="pad" style="padding:0 0 24px 0;"><table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td style="padding-right:10px;"><img src="${escapeHtml(logoUrl)}" width="28" height="28" alt="" style="display:block;border-radius:50%;"></td>
<td><span style="font-family:${FONT};font-size:16px;font-weight:700;color:${COLOR.white};">verify<span style="color:${COLOR.coral};">.</span>trading</span></td>
</tr></table></td></tr>
<tr><td class="pad" bgcolor="${COLOR.card}" style="background:${COLOR.card};border-radius:16px;padding:40px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td class="h1" style="font-family:${FONT};font-size:28px;line-height:36px;font-weight:800;color:${COLOR.white};padding-bottom:20px;">${escapeHtml(email.headline)}</td></tr>
${email.blocks.map((block) => blockHtml(block, campaign)).join("\n")}
</table></td></tr>
${footerHtml(campaign, unsubscribeUrl)}
</table></td></tr></table>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Plain text
// ---------------------------------------------------------------------------

function blockText(block: Block, campaign: string): string {
  switch (block.type) {
    case "p":
    case "muted":
      return block.text;
    case "bullets":
      return block.items.map((item) => `- ${item}`).join("\n");
    case "questions":
      return block.items.map((q) => `- ${q}\n  ${resolveHref(askHref(q), campaign)}`).join("\n");
    case "cards":
      return block.items
        .map((c) => `- ${c.title}: ${c.body}\n  ${resolveHref(c.href, campaign)}`)
        .join("\n");
    case "button":
    case "link":
      return `${block.link.label}:\n${resolveHref(block.link.href, campaign)}`;
    case "stores":
      return `App Store: ${STORE_URLS.apple}\nGoogle Play: ${STORE_URLS.googlePlay}`;
  }
}

function renderText(email: EmailContent, campaign: string, unsubscribeUrl: string | null): string {
  return [
    email.headline,
    ...email.blocks.map((block) => blockText(block, campaign)),
    "--",
    "verify.trading gives information, not financial advice. Check any firm on its regulator's own register before you deposit.",
    "Verify Trading Limited, United Kingdom",
    ...(unsubscribeUrl ? [`Unsubscribe: ${unsubscribeUrl}`] : []),
  ].join("\n\n");
}

export function renderLifecycleEmail(
  id: LifecycleEmailId,
  vars: EmailVars,
  /** Null only for account emails sent without a signed link: the footer then has no unsubscribe links. */
  unsubscribeUrl: string | null,
): RenderedEmail {
  const email = content(id, vars);
  const campaign = campaignFor(id, vars);
  return {
    subject: email.subject,
    sender: email.sender ?? "ai",
    html: renderHtml(email, campaign, unsubscribeUrl),
    text: renderText(email, campaign, unsubscribeUrl),
  };
}
