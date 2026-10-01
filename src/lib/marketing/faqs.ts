import { FREE_DAILY_ASK_LIMIT, PRO_DAILY_ASK_LIMIT } from "@/lib/rate-limit/usage";

/**
 * Every marketing-page FAQ lives here so tests can enforce one rule:
 * a question (and so its FAQPage markup) appears on exactly ONE page.
 * The pricing and homepage FAQs live elsewhere; tests check against them too.
 */
export type Faq = { q: string; a: string };

export const PAGE_FAQS = {
  howItWorks: [
    { q: "What can I type into Ask?", a: "A broker, prop firm or educator name for an entity check, a trade idea for position-size maths, or a market such as gold or EUR/USD for context. Ask routes each type of question to a different source instead of answering everything from one model." },
    { q: "Where does the answer to an entity check come from?", a: "From our verified registry, which is built from regulator registers, warning lists and public enforcement records. The record shows its source, so you can open the register and confirm it yourself." },
    { q: "What happens when you have no record for a name?", a: "We say so. A missing record is shown as missing, not filled in with a guess, and you can request a check. A gap is never presented as a clean result." },
    { q: "Does verify.trading tell me which broker or prop firm to use?", a: "No. It shows records, a verdict and the source behind it. Choosing where to trade stays with you, and no firm can pay to change what is shown." },
    { q: "Do I need an account to check a name?", a: "You can browse the public broker and prop firm records without one. Asking questions in Ask needs a free account, and free accounts get a daily allowance of chats." },
  ],
  verify: [
    { q: "What does Verify actually check?", a: "For a broker: the regulators it lists, its register status and any warning-list entries. For a prop firm: its operating status and published terms, and a score where we hold a scored record. For an educator or signal group: whether there is a documented regulator or court action against them." },
    { q: "What do the verdict labels mean?", a: "Brokers and prop firms get a score and band. Educators get one of three labels: Verified, Unverified or Caution. Prop firms we have not scored show “Not yet rated”, and firms that have shut down are marked closed." },
    { q: "Is a “Trusted” band a guarantee the broker is safe?", a: "No. A band summarises the records we hold at the time of the last review. It is not an endorsement and not a guarantee of future conduct, and it is not investment advice." },
    { q: "Can a firm pay to improve or remove its record?", a: "No. Records are computed from public sources and cannot be bought, improved or removed by their subject. A firm can request a correction by sending a primary source." },
    { q: "How often are records updated?", a: "Records are reviewed on a rolling basis and each one shows the date of its latest review, so check the date before relying on it. If something has changed sooner, tell us and send the source." },
    { q: "Why does a broker have several regulators?", a: "Many brokers run separate legal entities in different countries. The entity that holds your account decides which regulator and which protections apply, so check the entity you are actually onboarded to." },
  ],
  intelligence: [
    { q: "What is in the daily brief?", a: "A short session overview, a one-sentence session tone, and for each of gold, oil, the dollar index, USD/JPY, EUR/USD and GBP/USD a bias (bullish, bearish or neutral), a level and a one-line verdict." },
    { q: "When is it published?", a: "It is generated each London morning, ahead of the main sessions. A preview of the latest one is shown on this page when a recent brief exists." },
    { q: "Is this written by AI?", a: "Yes, an AI model drafts it. It is instructed to use only the live prices and headlines it is given, and not to mention events or figures those do not support. Levels are then overwritten with the live price so a quoted number cannot drift." },
    { q: "Why is the dollar index level marked as an estimate?", a: "Because we do not have a live feed for it. The other levels are locked to live prices; the dollar index level is approximate and is labelled that way." },
    { q: "Is the bias a trade signal?", a: "No. A bias is a summary of how the market looks this morning, not an instruction to buy or sell. Use it as context alongside your own plan and risk rules." },
    { q: "Can I get market context without Pro?", a: "You can ask Ask for context on a market within your daily allowance. The full brief and the market radar sit in the Markets tab, which is part of Pro." },
  ],
  calendar: [
    { q: "Which countries does the calendar cover?", a: "The United States, Germany, the United Kingdom, Canada, Japan, Australia, New Zealand and China, for the next seven days." },
    { q: "What does impact level mean?", a: "Each event carries an impact level reflecting how much it typically moves price, and you can filter to high or medium impact. High-impact events, often called red-folder news, are the likes of central bank decisions, inflation and jobs reports." },
    { q: "Are the times in my time zone?", a: "The preview on this page shows UTC. Whatever view you use, check the time zone before you plan around a release." },
    { q: "How do I use it with a prop firm's news rule?", a: "Many firms restrict trading or holding positions around high-impact releases, and the exact window differs by firm. Use the calendar to see when releases fall, then read your firm's rules for the precise restriction." },
    { q: "What is the AI risk level?", a: "A Pro addition that flags how disruptive an event is likely to be, such as a rate decision, an inflation print or a jobs report. It is context to plan around, not a forecast of direction." },
    { q: "Where do the forecast and previous figures come from?", a: "From a third-party economic data provider. Forecasts are consensus estimates, so they can be wrong, and figures can be revised after release." },
  ],
  journal: [
    { q: "What can I log in the journal?", a: "A session's profit or loss, your mood, notes on the lesson from the day, and trade details. Sessions appear on a calendar so a month reads at a glance." },
    { q: "How do broker connect and CSV import work?", a: "Connect a supported broker account and closed trades are pulled into your diary, or import a CSV export from your platform. Either way you avoid retyping trades." },
    { q: "Can I use more than one trading account?", a: "Yes. Entries can be assigned to a trading account, so a live account and a challenge account stay separate." },
    { q: "What is challenge mode?", a: "You set up a prop firm challenge with its profit target and trading-day rules, and the journal tracks your progress from your own entries. Always confirm the current rules on the firm's own site, because they change." },
    { q: "What is the weekly insight?", a: "An AI-written summary built from the sessions you actually logged that week, pointing at habits worth looking at. It is only as good as what you log, and it is not trade advice." },
    { q: "What happens to my entries if I stop paying for Pro?", a: "What you have already logged stays readable. Logging new sessions is part of Pro." },
  ],
  mind: [
    { q: "What does the Mind assessment measure?", a: "Thirty questions: five about your situation (trading status, stress, finances, sleep, energy), then five each on being wrong, fear, chasing and compulsion, self-awareness, and discipline and process." },
    { q: "How long does it take?", a: "Thirty multiple-choice questions, so a few minutes. Answer how you actually trade, not how you would like to." },
    { q: "What is the discipline radar?", a: "A chart of your five habit scores, with your weakest area flagged as your focus, so you know which habit to work on first." },
    { q: "What is the Companion?", a: "An AI you can talk to in a live voice call about a bad session or a rule you keep breaking. Calls are saved as transcripts so you can reread them." },
    { q: "Is Mind therapy or medical advice?", a: "No. It is a coaching and self-awareness tool for trading habits. If trading is affecting your wellbeing, talk to a qualified professional or a support service." },
    { q: "Are my calls private?", a: "Voice calls are processed to run the Companion and are stored as your transcripts. The privacy policy describes what is collected and how it is used, so read it before you start." },
  ],
  retailTraders: [
    { q: "What should a beginner do before opening a broker account?", a: "Confirm the exact legal entity is authorised on the regulator's own register, check the warning list, and read the terms for the entity that will hold your funds. A verify.trading check does the first two in one step." },
    { q: "Are the free calculators enough to manage risk?", a: "They cover position size, risk to reward, pip value and margin, which is the maths of risk on a single trade. They do not replace a plan for total drawdown or a stop-trading rule." },
    { q: "Does verify.trading give trade signals?", a: "No. It gives records, market context and risk maths. Signals and recommendations are outside what we do." },
    { q: "What does Pro add for a part-time trader?", a: "A morning brief, the seven-day economic calendar, a journal that pulls in broker trades, and the Mind assessment, plus a higher daily Ask allowance." },
    { q: "How do I spot a scam broker?", a: "Warning signs include no verifiable licence number, pressure to deposit quickly, promised returns, unsolicited contact, and withdrawal problems. Our guide on broker checks walks through the steps." },
  ],
  propFirmTraders: [
    { q: "What are the most common ways a challenge is failed?", a: "Breaching a drawdown limit, trading through restricted news, and oversizing after a loss. These are process failures more often than analysis failures, which is why the tools here target process." },
    { q: "How does the journal help with a challenge?", a: "Challenge mode tracks cumulative profit against your target and your trading days against the minimum and maximum, based on your own entries, so you always know where you stand." },
    { q: "Does verify.trading endorse any prop firm?", a: "No. We show a verdict and the source behind it, take no commissions from firms and rated firms cannot be our affiliates. Read a firm's own rules before you pay." },
    { q: "Can I see whether a prop firm has closed?", a: "Yes. Prop firm records show whether a firm is operating, closed or still being monitored, and firms we have not scored show as “Not yet rated”." },
    { q: "How do I avoid breaching a news rule?", a: "Check the calendar for the week's high-impact events, read your firm's news policy for the exact window, and plan flat time or reduced size around those releases." },
    { q: "How much should I risk per trade on a challenge?", a: "That depends on your strategy and the drawdown limit, and we do not recommend a figure. A position size calculator shows what a given risk percentage means in lots for your stop distance." },
  ],
  brokers: [
    { q: "How can a broker ask for a correction?", a: "Use the contact page with the record you believe is wrong and a primary source, such as a register entry or an official notice. Corrections follow the same rules for every broker." },
    { q: "Can a broker pay for a better verdict?", a: "No. We take no affiliate commissions from brokers and rated entities cannot be our affiliates. A verdict is computed from records and is not for sale." },
    { q: "What evidence is needed to remove a Caution?", a: "A Caution rests on a documented regulator or court action. It is revised when the underlying record changes, for example when an action is formally withdrawn, and we need the official source to review it." },
    { q: "Which regulators do you look at?", a: "Public registers and warning lists such as the FCA register, plus equivalent authorities in other jurisdictions where the broker lists a licence." },
    { q: "Do you review the client's entity or the whole group?", a: "The entity that serves the client matters most, since it decides which regulator applies. Records name the entity and licence so they can be checked." },
  ],
  propFirmsBusiness: [
    { q: "What does the operating status on a firm's record mean?", a: "Whether the firm is operating, closed or still being monitored. Firms we have not scored show as “Not yet rated”, which is not a negative finding." },
    { q: "How are payout complaints assessed?", a: "We look for public, attributable records of withdrawal and payout issues and assess for pattern, not for isolated reports. A negative finding needs an official source." },
    { q: "How does a prop firm request a correction?", a: "Contact us with the record and a primary source. The same rules apply to every firm, and a record only changes when the evidence does." },
    { q: "Can a firm sponsor a listing?", a: "No. There are no paid placements, and firms cannot be affiliates while they are rated." },
    { q: "Where do the published terms come from?", a: "From the firm's own site, as published. If your terms changed, point us to the updated page and we will review the record." },
  ],
  about: [
    { q: "Who runs verify.trading?", a: "Verify Trading Limited, a company based in the United Kingdom. Contact details, terms and the privacy policy are public on this site." },
    { q: "Is verify.trading regulated?", a: "We publish records and analysis and do not provide investment advice, arrange deals or hold client money, so we are not a broker. Nothing here is a personal recommendation." },
    { q: "How does verify.trading make money?", a: "Through Pro subscriptions. We do not take affiliate commissions from the brokers, prop firms or educators we rate." },
    { q: "How do I report an error?", a: "Contact us with the page and a primary source. We review corrections against the same rules we use for every record." },
  ],
  trust: [
    { q: "What is your editorial process?", a: "Records come from official sources and are turned into verdicts by a fixed model, so the same facts produce the same result. Articles are written by our team from public sources and reviewed before publishing." },
    { q: "Do you use AI to write content?", a: "AI is used inside the product, for Ask answers, the daily brief and the weekly journal insight. Guides, glossary entries and records on this site are written and reviewed by people. Where AI produces the content, the page says so." },
    { q: "Why do pages show a last-reviewed date?", a: "Regulation and prop firm rules change. The date tells you when the page was last checked, and we only change it when we have actually reviewed the content." },
    { q: "How do you handle conflicts of interest?", a: "We do not take commissions from rated entities, rated entities cannot be affiliates, and we do not run paid listings. The independence statement is repeated on the pages it applies to." },
    { q: "What are the limits of your records?", a: "They reflect public sources at the time of the last review. Absence of a regulatory action is not an endorsement, and absence from a list is not proof of authorisation." },
  ],
  tools: {
    positionSize: [
      { q: "How do I calculate position size in forex?", a: "Divide the amount you are willing to lose by the stop distance times the pip value per lot. Risk amount is account size times risk percent, so a 10,000 account risking 1% is 100. With a 20 pip stop and 10 per pip per lot, size is 100 / (20 x 10) = 0.50 lots." },
      { q: "What risk percentage should I use?", a: "There is no universal figure, and this is not a recommendation. Many traders keep single-trade risk to a small percentage of the account, and lower still on prop firm accounts with a strict daily loss limit." },
      { q: "Why does the pip value change between pairs?", a: "Pip value is quoted in the pair's second currency. If your account is in another currency, it must be converted, which is why USD/JPY needs the current price to convert into dollars." },
      { q: "Does this work for gold, indices or crypto?", a: "This calculator is built for forex pairs. For other instruments, enter the value of one price unit per lot from your broker's contract specification in the pip value box." },
      { q: "Is the result exact?", a: "It is a planning figure. Spreads, slippage, commissions and rounding to your broker's lot step all shift the real risk slightly, so allow for them." },
    ],
    riskReward: [
      { q: "What is a good risk to reward ratio?", a: "It depends on how often your strategy wins. A ratio of 1:2 needs to win a little over a third of trades to break even before costs, while 1:1 needs more than half. Costs push both figures up." },
      { q: "How do I calculate risk to reward?", a: "Divide the distance from entry to target by the distance from entry to stop. Entry 1.0850, stop 1.0820 and target 1.0940 is 90 pips of reward for 30 pips of risk, a ratio of 1:3." },
      { q: "Does a high ratio mean a good trade?", a: "No. A distant target can be unlikely to be reached. The ratio only tells you what a win pays against a loss, not how likely the win is." },
      { q: "Do I include spread in the calculation?", a: "You should. Spread widens your effective risk and narrows your effective reward, so on tight stops it can change the ratio noticeably." },
    ],
    pipValue: [
      { q: "What is a pip?", a: "The standard unit of movement in a forex price: 0.0001 for most pairs and 0.01 for pairs quoted in yen. Some brokers also show a fractional pip, a tenth of that." },
      { q: "How is pip value calculated?", a: "Units traded times pip size, converted into your account currency. For one standard lot of EUR/USD that is 100,000 x 0.0001 = 10 USD per pip." },
      { q: "Why is USD/JPY pip value not a round number?", a: "Its pip is 0.01 yen per unit, so a lot moves 1,000 yen per pip. Converting yen to dollars depends on the current price, so the dollar value changes as the pair moves." },
      { q: "What is the difference between a standard, mini and micro lot?", a: "A standard lot is 100,000 units, a mini lot 10,000 and a micro lot 1,000. Pip value scales in proportion." },
    ],
    margin: [
      { q: "What is margin in trading?", a: "The amount your broker sets aside from your account to hold a leveraged position open. It is not a fee, and it is returned when the position closes." },
      { q: "How is required margin calculated?", a: "Position size in units times the price converted to your account currency, divided by your leverage. One standard lot of EUR/USD at 1.0850 with 30:1 leverage needs about 100,000 x 1.0850 / 30 = 3,616.67 USD." },
      { q: "What leverage limits apply to retail traders?", a: "They depend on your regulator and the instrument. UK and EU retail rules cap leverage on major forex pairs at 30:1, but check your own broker's terms, since limits vary by entity." },
      { q: "What is a margin call?", a: "A broker warning, or automatic closure, when your account equity falls too far below the margin needed to keep positions open. Keeping position sizes small is the way to stay clear of it." },
    ],
  },
  hub: [
    { q: "What is verify.trading?", a: "An independent verification and decision-support tool for retail traders. It checks brokers, prop firms and educators against regulator and court records, runs risk maths, and gives market context." },
    { q: "Is verify.trading free?", a: "Entity checks and the calculators are free. Pro adds the daily brief, the economic calendar, the journal, Mind, the community and a higher daily Ask limit. See the pricing page for current plans." },
    { q: "Is there a mobile app?", a: "Yes, the verify.trading mobile app has Ask, Markets, Journal and Mind, and the same account works on the web." },
    { q: "Which markets does it cover?", a: "Major forex pairs, commodities such as gold and oil, major crypto assets and index products, through the Markets tab and Ask." },
    { q: "Do you take money from brokers or prop firms?", a: "No affiliate commissions and no paid placements. Rated entities cannot be our affiliates." },
    { q: "How do I contact support?", a: "Use the contact page and we will reply as soon as we can. Pro members have priority support, so mention your plan." },
  ],
} as const;

/** Flattened for tests. */
export function allMarketingFaqs(): Faq[] {
  const out: Faq[] = [];
  const walk = (v: unknown) => {
    if (Array.isArray(v)) out.push(...(v as Faq[]));
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(PAGE_FAQS);
  return out;
}

export const ASK_LIMITS = { free: FREE_DAILY_ASK_LIMIT, pro: PRO_DAILY_ASK_LIMIT };
