/**
 * Trading and prop-firm glossary. General, evergreen education only: no claims about named firms.
 * Regulatory figures (FSCS, CySEC ICF, leverage caps) change: keep `reviewed` current and re-check
 * before each review date. Client review required before launch.
 */
export type GlossaryCategory = "Basics" | "Risk" | "Prop firms" | "Broker safety" | "Psychology" | "Markets and news";

export type GlossaryTerm = {
  slug: string;
  term: string;
  category: GlossaryCategory;
  /** 1-3 self-contained sentences. Used as meta description and DefinedTerm.description. */
  short: string;
  /** Explanatory paragraphs. */
  body: string[];
  points: string[];
  example?: string;
  related: string[];
  links: Array<{ href: string; label: string }>;
};

export const GLOSSARY_REVIEWED = "2026-09-29";

export const GLOSSARY: GlossaryTerm[] = [
  {
    slug: "pip",
    term: "Pip",
    category: "Basics",
    short: "A pip is the standard unit of price movement in forex: 0.0001 for most currency pairs and 0.01 for pairs quoted in Japanese yen.",
    body: [
      "Traders measure stops, targets and profit in pips because it gives one yardstick across pairs. A move in EUR/USD from 1.0850 to 1.0860 is 10 pips.",
      "Many brokers also quote a fractional pip, or pipette, which is a tenth of a pip. The money value of a pip depends on the pair, the position size and your account currency, which is what a pip value calculator works out.",
    ],
    points: ["0.0001 for most pairs, 0.01 for yen pairs.", "Pip value depends on lot size and account currency.", "A pipette is one tenth of a pip."],
    example: "One standard lot of EUR/USD (100,000 units) moves 10 USD for every pip, so a 20 pip move is 200 USD.",
    related: ["lot-size", "spread", "position-sizing"],
    links: [{ href: "/tools/pip-value-calculator", label: "Pip value calculator" }, { href: "/blog/position-sizing-how-much-to-risk-per-trade", label: "Position sizing guide" }],
  },
  {
    slug: "lot-size",
    term: "Lot size",
    category: "Basics",
    short: "A lot is the standard trade size in forex. One standard lot is 100,000 units of the base currency, a mini lot is 10,000 and a micro lot is 1,000.",
    body: [
      "Lot size sets how much each pip is worth, so it is the main dial for controlling risk on a trade. A smaller lot means a smaller loss for the same stop distance.",
      "Brokers allow different minimum sizes and steps, often down to 0.01 lots. A position size calculator turns a risk amount and a stop distance into the lot size to enter.",
    ],
    points: ["Standard 100,000 units, mini 10,000, micro 1,000.", "Lot size scales pip value in direct proportion.", "Work out lot size from the stop, not the other way round."],
    related: ["pip", "position-sizing", "leverage"],
    links: [{ href: "/tools/position-size-calculator", label: "Position size calculator" }],
  },
  {
    slug: "spread",
    term: "Spread",
    category: "Basics",
    short: "The spread is the difference between the price you can buy at (ask) and the price you can sell at (bid). It is a cost you pay on every trade.",
    body: [
      "You open a long trade at the ask and it is valued at the bid, so a new position starts slightly negative by the size of the spread. Spreads widen when liquidity is thin, around major news and at the market open.",
      "Some brokers add a commission on top of a narrower spread. Compare the total cost of a round trip, not the spread alone.",
    ],
    points: ["Buy at ask, sell at bid.", "Widens around news and low liquidity.", "Tight stops feel the spread most."],
    example: "If EUR/USD is quoted 1.0850 / 1.0851, the spread is 1 pip.",
    related: ["slippage", "pip", "red-folder-news"],
    links: [{ href: "/economic-calendar", label: "Economic calendar" }],
  },
  {
    slug: "slippage",
    term: "Slippage",
    category: "Basics",
    short: "Slippage is the difference between the price you expected for an order and the price at which it was filled. It happens when the market moves or liquidity is thin.",
    body: [
      "Slippage can work for or against you, but it is most noticeable on stop orders in fast markets, such as during a major data release, where the market can jump past your stop level.",
      "It is one reason a stop does not guarantee your planned loss, and one reason to size positions with room for error.",
    ],
    points: ["Most common in fast markets and around news.", "A stop is not a guaranteed exit price.", "Allow for it when sizing risk."],
    related: ["stop-loss", "spread", "red-folder-news"],
    links: [{ href: "/economic-calendar", label: "Economic calendar" }],
  },
  {
    slug: "leverage",
    term: "Leverage",
    category: "Risk",
    short: "Leverage lets you control a position larger than your deposited funds. At 30:1 leverage, 1,000 of margin can hold a 30,000 position.",
    body: [
      "It magnifies both gains and losses because profit and loss are calculated on the full position size, not on your margin. High leverage is the fastest way to turn a small adverse move into a large loss.",
      "Regulators cap it for retail clients. Under UK and EU retail rules the maximum on major forex pairs is 30:1, with lower limits on other instruments. Your broker's limit depends on the entity that holds your account and your client category.",
    ],
    points: ["Magnifies gains and losses equally.", "Retail caps in the UK and EU: 30:1 on major forex pairs.", "Lower leverage is a risk control, not a handicap."],
    related: ["margin", "margin-call", "negative-balance-protection"],
    links: [{ href: "/tools/margin-calculator", label: "Margin calculator" }, { href: "/blog/how-to-check-if-a-broker-is-fca-regulated", label: "Check a broker is FCA regulated" }],
  },
  {
    slug: "margin",
    term: "Margin",
    category: "Risk",
    short: "Margin is the amount a broker sets aside from your account to keep a leveraged position open. It is a deposit held against the trade, not a fee.",
    body: [
      "Required margin equals the position value divided by the leverage. The rest of your balance is free margin, which absorbs losses. If losses eat into the margin, you risk a margin call.",
      "Margin is released when the position closes. Opening several positions adds their required margin together.",
    ],
    points: ["Required margin = position value / leverage.", "Free margin is what is left to absorb losses.", "Margin is held, not spent."],
    example: "One standard lot of EUR/USD at 1.0850 with 30:1 leverage needs about 3,617 USD of margin.",
    related: ["leverage", "margin-call", "balance-vs-equity"],
    links: [{ href: "/tools/margin-calculator", label: "Margin calculator" }],
  },
  {
    slug: "margin-call",
    term: "Margin call",
    category: "Risk",
    short: "A margin call is a broker warning, or an automatic closure of positions, when your account equity falls too far below the margin needed to hold them.",
    body: [
      "For retail CFD accounts, UK and EU rules require brokers to close positions when equity falls to 50% of the required margin, and many brokers act earlier. The exact level is in your broker's terms.",
      "Over-sizing is the usual cause. Keeping each position small enough that a normal adverse move does not threaten your margin is the reliable defence.",
    ],
    points: ["Broker closes positions when equity drops too low.", "Retail rules set a minimum close-out level of 50% of margin.", "Small position sizes are the defence."],
    related: ["margin", "leverage", "position-sizing"],
    links: [{ href: "/tools/position-size-calculator", label: "Position size calculator" }],
  },
  {
    slug: "stop-loss",
    term: "Stop-loss",
    category: "Risk",
    short: "A stop-loss is an order that closes a trade automatically when price reaches a level you set, limiting how much the trade can lose.",
    body: [
      "Set the stop where your trade idea is proven wrong, based on market structure, and then size the position so that a stop-out costs an amount you accepted in advance.",
      "In fast markets a stop can fill at a worse price than planned (slippage), and over a weekend gap it may fill well beyond the level. A stop is a plan, not a guarantee.",
    ],
    points: ["Place it where the idea is invalid, not where the loss feels affordable.", "Size the position from the stop distance.", "Not a guaranteed price."],
    related: ["take-profit", "slippage", "position-sizing"],
    links: [{ href: "/tools/position-size-calculator", label: "Position size calculator" }, { href: "/tools/risk-reward-calculator", label: "Risk to reward calculator" }],
  },
  {
    slug: "take-profit",
    term: "Take-profit",
    category: "Risk",
    short: "A take-profit is an order that closes a trade automatically when price reaches your target, locking in the gain.",
    body: [
      "Together with a stop-loss it defines the reward and the risk of a trade before you enter, which is what makes a risk to reward ratio possible to calculate.",
      "Targets are placed at levels where price has a reason to pause, such as prior highs and lows. A target that is very far away pays well on paper but is less likely to be reached.",
    ],
    points: ["Defines the reward side of the trade.", "Pairs with a stop-loss to set risk to reward.", "A distant target is a lower-probability target."],
    related: ["stop-loss", "risk-reward-ratio", "win-rate"],
    links: [{ href: "/tools/risk-reward-calculator", label: "Risk to reward calculator" }],
  },
  {
    slug: "position-sizing",
    term: "Position sizing",
    category: "Risk",
    short: "Position sizing is deciding how large a trade should be so that hitting your stop-loss costs a fixed, pre-decided amount of your account.",
    body: [
      "The formula is risk amount divided by stop distance times the value of one pip per lot. Because the stop comes from the market and the risk amount comes from you, the size follows from both.",
      "Consistent sizing keeps any single loss small and makes results comparable from trade to trade. Sizing up after wins, or to win a loss back, breaks this.",
    ],
    points: ["Size = risk amount / (stop in pips x pip value per lot).", "Stop from the market, risk from your plan.", "Do not size up to recover a loss."],
    example: "10,000 account, 1% risk, 20 pip stop, 10 per pip per lot: 100 / (20 x 10) = 0.50 lots.",
    related: ["lot-size", "stop-loss", "risk-reward-ratio"],
    links: [{ href: "/tools/position-size-calculator", label: "Position size calculator" }, { href: "/blog/position-sizing-how-much-to-risk-per-trade", label: "Position sizing guide" }],
  },
  {
    slug: "risk-reward-ratio",
    term: "Risk to reward ratio",
    category: "Risk",
    short: "The risk to reward ratio compares how much you stand to gain if a trade works with how much you stand to lose if it does not. A trade risking 30 pips to make 90 pips is 1:3.",
    body: [
      "It is calculated as the distance from entry to target divided by the distance from entry to stop. On its own it does not say whether a trade is good, because it ignores how likely the target is to be reached.",
      "It matters most alongside win rate: the lower your ratio, the higher a win rate you need to break even.",
    ],
    points: ["Reward distance / risk distance.", "Needs to be read with win rate.", "Costs such as spread reduce the real ratio."],
    related: ["win-rate", "expectancy", "break-even"],
    links: [{ href: "/tools/risk-reward-calculator", label: "Risk to reward calculator" }, { href: "/blog/risk-reward-and-win-rate-what-the-maths-says", label: "Risk to reward and win rate" }],
  },
  {
    slug: "win-rate",
    term: "Win rate",
    category: "Risk",
    short: "Win rate is the share of your trades that close in profit. It says nothing about how big the wins and losses are.",
    body: [
      "A strategy with a 40% win rate can be profitable if its winners are larger than its losers, and a 70% win rate can lose money if the losers are much bigger. That is why win rate and risk to reward are always judged together.",
      "A win rate is only meaningful over a large enough sample of trades, and a journal is the way to measure it honestly.",
    ],
    points: ["Wins divided by total trades.", "Meaningless without average win and loss.", "Needs a decent sample size."],
    related: ["risk-reward-ratio", "expectancy", "trading-journal"],
    links: [{ href: "/journal", label: "Trading journal" }],
  },
  {
    slug: "expectancy",
    term: "Expectancy",
    category: "Risk",
    short: "Expectancy is the average amount you expect to make or lose per trade: win rate times average win, minus loss rate times average loss.",
    body: [
      "A positive expectancy is a necessary condition for a strategy to make money over many trades, but it is estimated from past trades and can change when markets do. Costs must be included.",
    ],
    points: ["(win rate x average win) - (loss rate x average loss).", "Estimated from history, not guaranteed.", "Include spreads and commissions."],
    example: "Win rate 40%, average win 300, average loss 100: (0.4 x 300) - (0.6 x 100) = 60 per trade before costs.",
    related: ["win-rate", "risk-reward-ratio", "trading-journal"],
    links: [{ href: "/blog/risk-reward-and-win-rate-what-the-maths-says", label: "Risk to reward and win rate" }],
  },
  {
    slug: "break-even",
    term: "Break-even win rate",
    category: "Risk",
    short: "The break-even win rate is the share of trades you must win to cover your losses at a given risk to reward ratio. It is 1 / (1 + ratio), before costs.",
    body: [
      "At 1:1 you need to win half your trades. At 1:2 you need about a third. At 1:3 you need a quarter. Spreads and commissions push all of these up.",
    ],
    points: ["1:1 needs 50%, 1:2 needs 33%, 1:3 needs 25% before costs.", "Costs raise the real figure."],
    related: ["risk-reward-ratio", "win-rate", "expectancy"],
    links: [{ href: "/tools/risk-reward-calculator", label: "Risk to reward calculator" }],
  },
  {
    slug: "drawdown",
    term: "Drawdown",
    category: "Risk",
    short: "Drawdown is the fall in an account from a peak to a later low, shown as a percentage or an amount. It measures how much you are down from your best point.",
    body: [
      "Drawdown matters because losses compound against you: a 20% drawdown needs a 25% gain to get back to the peak, and a 50% drawdown needs 100%.",
      "Prop firms turn drawdown into rules, with a daily loss limit and a maximum drawdown, and breaching either usually ends the challenge or funded account.",
    ],
    points: ["Measured from a peak to a subsequent low.", "Recovery needs a larger percentage gain than the loss.", "Prop firm rules cap it."],
    example: "Peak 10,000, later low 8,500: a 15% drawdown, which needs about a 17.6% gain to recover.",
    related: ["maximum-drawdown", "daily-loss-limit", "trailing-drawdown"],
    links: [{ href: "/prop-firm-traders", label: "For prop firm traders" }, { href: "/blog/prop-firm-challenge-rules-that-catch-traders-out", label: "Prop firm rules that catch traders out" }],
  },
  {
    slug: "balance-vs-equity",
    term: "Balance vs equity",
    category: "Basics",
    short: "Balance is your account's value from closed trades only. Equity is balance plus the floating profit or loss on open positions.",
    body: [
      "Margin calls and many prop firm drawdown rules are measured on equity, so an open trade that is deeply negative counts against you even though you have not closed it. Firms differ on whether a rule uses balance or equity, so read the exact definition.",
    ],
    points: ["Equity = balance + open profit/loss.", "Margin and many drawdown rules use equity.", "Check which one a rule uses."],
    related: ["drawdown", "margin", "daily-loss-limit"],
    links: [{ href: "/blog/prop-firm-challenge-rules-that-catch-traders-out", label: "Prop firm rules that catch traders out" }],
  },
  {
    slug: "daily-loss-limit",
    term: "Daily loss limit",
    category: "Prop firms",
    short: "A daily loss limit is a prop firm rule capping how much an account may lose in a single trading day. Breaching it usually fails the challenge or closes the funded account.",
    body: [
      "Firms define it differently: as a percentage of the starting balance or of the day's opening balance, measured on balance or on equity, and reset at a set time of day. Floating losses on open trades often count.",
      "Because the definition drives what counts as a breach, read the rule text itself and check when the day resets in your own time zone.",
    ],
    points: ["Percentage or amount, measured per day.", "May include floating losses on open trades.", "Reset time varies by firm."],
    related: ["maximum-drawdown", "trailing-drawdown", "balance-vs-equity"],
    links: [{ href: "/journal", label: "Journal with challenge mode" }, { href: "/prop-firm-traders", label: "For prop firm traders" }],
  },
  {
    slug: "maximum-drawdown",
    term: "Maximum drawdown",
    category: "Prop firms",
    short: "Maximum drawdown is the total loss a prop firm allows an account to reach before it is closed, measured against a fixed or moving reference point.",
    body: [
      "It is the overall limit, as opposed to the daily one. It may be static, measured from the starting balance, or trailing, measured from the account's highest point.",
    ],
    points: ["The overall loss cap for the account.", "Static or trailing depending on the firm.", "Breach ends the account."],
    related: ["trailing-drawdown", "daily-loss-limit", "drawdown"],
    links: [{ href: "/prop-firm-traders", label: "For prop firm traders" }],
  },
  {
    slug: "trailing-drawdown",
    term: "Trailing drawdown",
    category: "Prop firms",
    short: "A trailing drawdown is a loss limit that moves up as your account reaches new highs, so the room to lose shrinks as you profit.",
    body: [
      "Where a static limit stays at a fixed level, a trailing limit follows your peak. Some versions trail equity in real time, including open profits, which can catch traders who let a winner reverse. Firms also differ on whether and when the trail stops.",
    ],
    points: ["Follows the highest point reached.", "Can trail floating equity.", "Read whether and when it stops trailing."],
    related: ["maximum-drawdown", "drawdown", "balance-vs-equity"],
    links: [{ href: "/blog/prop-firm-challenge-rules-that-catch-traders-out", label: "Prop firm rules that catch traders out" }],
  },
  {
    slug: "profit-target",
    term: "Profit target",
    category: "Prop firms",
    short: "A profit target is the gain a trader must reach in a prop firm evaluation to pass, usually a percentage of the starting balance.",
    body: [
      "Targets often differ by phase. Reaching the target is normally not enough on its own: the daily loss, drawdown and minimum trading day rules must also be respected.",
    ],
    points: ["Usually a percentage of the starting balance.", "Often different per phase.", "Must be met without breaching other rules."],
    related: ["evaluation-phase", "minimum-trading-days", "daily-loss-limit"],
    links: [{ href: "/journal", label: "Journal with challenge mode" }],
  },
  {
    slug: "minimum-trading-days",
    term: "Minimum trading days",
    category: "Prop firms",
    short: "Minimum trading days is a prop firm rule requiring you to place trades on a set number of separate days before you can pass, even if you hit the profit target sooner.",
    body: [
      "It is meant to stop a pass from a single lucky day. Firms define what counts as a trading day, such as a day with at least one trade or a trade of a minimum size, so check the definition.",
    ],
    points: ["Stops a pass from one lucky day.", "What counts as a day is defined by the firm."],
    related: ["profit-target", "evaluation-phase", "consistency-rule"],
    links: [{ href: "/journal", label: "Journal with challenge mode" }],
  },
  {
    slug: "consistency-rule",
    term: "Consistency rule",
    category: "Prop firms",
    short: "A consistency rule is a prop firm condition that limits how much of your total profit can come from one day or one trade, to discourage a single big win.",
    body: [
      "Where it exists, it is usually expressed as a maximum percentage of total profit that a single day may represent. Not every firm has one, and where it applies to a payout or a pass differs, so read the wording.",
    ],
    points: ["Caps how much profit one day or trade can contribute.", "Not every firm has one.", "Wording and scope vary."],
    related: ["profit-target", "minimum-trading-days", "evaluation-phase"],
    links: [{ href: "/blog/prop-firm-challenge-rules-that-catch-traders-out", label: "Prop firm rules that catch traders out" }],
  },
  {
    slug: "news-trading-rule",
    term: "News trading rule",
    category: "Prop firms",
    short: "A news trading rule restricts opening or holding trades around high-impact economic releases, for a window of time set by the prop firm.",
    body: [
      "Firms that apply one typically specify how many minutes before and after a release the restriction covers, and which events count. Breaching it can void profits or fail the account, depending on the firm.",
      "The economic calendar shows when releases fall. The rule itself always has to be read from the firm.",
    ],
    points: ["Window around high-impact events.", "Which events count varies by firm.", "Use the calendar to see when they fall."],
    related: ["red-folder-news", "economic-calendar", "slippage"],
    links: [{ href: "/economic-calendar", label: "Economic calendar" }, { href: "/prop-firm-traders", label: "For prop firm traders" }],
  },
  {
    slug: "evaluation-phase",
    term: "Evaluation phase (challenge)",
    category: "Prop firms",
    short: "An evaluation, or challenge, is the paid test a prop firm sets: reach a profit target within its rules to qualify for a funded account.",
    body: [
      "Many firms use one or two phases with different targets. You pay a fee, trade a test account under the firm's rules, and if you pass you move to the next phase or to a funded account.",
      "The fee is a real cost and is normally not refunded if you fail, so verify the firm and read its rules before paying.",
    ],
    points: ["Paid test with rules and targets.", "One or two phases at many firms.", "Fee is normally at risk."],
    related: ["funded-account", "profit-target", "daily-loss-limit"],
    links: [{ href: "/verify", label: "Verify a prop firm" }, { href: "/compare/prop-firms", label: "Compare prop firms" }],
  },
  {
    slug: "funded-account",
    term: "Funded account",
    category: "Prop firms",
    short: "A funded account is what a prop firm offers a trader who passes its evaluation, with profits shared between trader and firm under the firm's terms.",
    body: [
      "How a funded account works differs by firm, including whether trades run in a live or simulated environment. Read how the firm describes it, along with its payout terms and the rules that apply after you pass.",
    ],
    points: ["Follows a passed evaluation.", "Live or simulated depends on the firm.", "Payout terms vary."],
    related: ["profit-split", "evaluation-phase", "maximum-drawdown"],
    links: [{ href: "/verify", label: "Verify a prop firm" }],
  },
  {
    slug: "profit-split",
    term: "Profit split",
    category: "Prop firms",
    short: "A profit split is the share of profits a prop firm pays the trader on a funded account, with the rest kept by the firm.",
    body: [
      "Splits vary between firms and can change with tiers or scaling. The headline percentage is only part of the picture: payout timing, minimum payout and any conditions matter as much.",
    ],
    points: ["Trader's share of profit.", "Check payout timing and conditions."],
    related: ["funded-account", "consistency-rule", "evaluation-phase"],
    links: [{ href: "/prop-firms", label: "How prop firms are assessed" }],
  },
  {
    slug: "fscs",
    term: "FSCS",
    category: "Broker safety",
    short: "The Financial Services Compensation Scheme (FSCS) is the UK's compensation scheme, which can pay eligible claims against an authorised firm that fails, up to a limit.",
    body: [
      "For investment claims the limit at the time of writing is 85,000 GBP per person per firm. Limits are reviewed, so check the FSCS website for the current figure and for what is covered.",
      "FSCS protection applies to firms authorised in the UK and does not cover losses from trading or from poor performance. An offshore entity of a broker is generally outside it.",
    ],
    points: ["UK scheme for authorised firms that fail.", "85,000 GBP per person per firm for investment claims, at the time of writing.", "Does not cover trading losses."],
    related: ["fca-register", "segregated-funds", "cysec-icf"],
    links: [{ href: "/regulators/fca", label: "FCA-regulated brokers" }, { href: "/blog/how-to-check-if-a-broker-is-fca-regulated", label: "How to check a broker is FCA regulated" }, { href: "/verify", label: "Verify a broker" }],
  },
  {
    slug: "cysec-icf",
    term: "CySEC Investor Compensation Fund",
    category: "Broker safety",
    short: "The Investor Compensation Fund (ICF) covers eligible clients of investment firms licensed by the Cyprus Securities and Exchange Commission (CySEC), up to 20,000 euros per person.",
    body: [
      "It pays out only in defined circumstances, such as when a licensed firm is unable to return client assets, and it does not compensate for trading losses. Coverage depends on the entity that holds your account.",
      "Confirm the licence number on CySEC's own register and read your client agreement to see which entity you are contracting with.",
    ],
    points: ["Covers eligible clients of CySEC-licensed firms.", "Up to 20,000 euros per person.", "Not for trading losses."],
    related: ["fscs", "segregated-funds", "regulated-broker"],
    links: [{ href: "/regulators/cysec", label: "CySEC-regulated brokers" }, { href: "/verify", label: "Verify a broker" }, { href: "/compare/brokers", label: "Compare brokers" }],
  },
  {
    slug: "segregated-funds",
    term: "Segregated funds",
    category: "Broker safety",
    short: "Segregated funds means a broker keeps client money separate from its own money, so client funds are not treated as the firm's assets if it fails.",
    body: [
      "In the UK, FCA client money rules require authorised firms to hold client money apart from their own. Segregation is a safeguard, not a guarantee: it does not protect against trading losses and it is only as reliable as the firm's controls.",
      "Ask which entity holds your funds and which regulator's client money rules apply to it.",
    ],
    points: ["Client money held apart from the firm's own.", "A safeguard, not a guarantee.", "Depends on the regulator and entity."],
    related: ["fscs", "regulated-broker", "negative-balance-protection"],
    links: [{ href: "/blog/how-to-check-if-a-broker-is-fca-regulated", label: "How to check a broker is FCA regulated" }],
  },
  {
    slug: "negative-balance-protection",
    term: "Negative balance protection",
    category: "Broker safety",
    short: "Negative balance protection means a retail client cannot lose more than the money in their account on leveraged CFD trading.",
    body: [
      "It is a regulatory requirement for retail clients of UK and EU-regulated CFD brokers. Brokers outside those regimes, or offering professional accounts, may not provide it, so check the terms for your specific entity.",
    ],
    points: ["Losses capped at your account funds.", "Required for retail clients under UK and EU rules.", "May not apply offshore."],
    related: ["leverage", "margin-call", "regulated-broker"],
    links: [{ href: "/verify", label: "Verify a broker" }],
  },
  {
    slug: "fca-register",
    term: "FCA Register",
    category: "Broker safety",
    short: "The FCA Register is the public database of firms and individuals authorised or registered by the UK Financial Conduct Authority. It is the source to confirm a UK broker's status.",
    body: [
      "Search it by firm reference number (FRN) rather than brand name, then check the firm's status, permissions and contact details. The FCA also publishes a warning list of firms and websites it has flagged.",
    ],
    points: ["Search by firm reference number.", "Check permissions, not just status.", "Also check the FCA warning list."],
    related: ["fscs", "clone-firm", "regulated-broker"],
    links: [{ href: "/regulators/fca", label: "FCA-regulated brokers" }, { href: "/blog/how-to-check-if-a-broker-is-fca-regulated", label: "How to check a broker is FCA regulated" }, { href: "/verify", label: "Verify a broker" }],
  },
  {
    slug: "regulated-broker",
    term: "Regulated broker",
    category: "Broker safety",
    short: "A regulated broker is one licensed or authorised by a financial regulator to offer its services. Regulation is a starting point, not a guarantee of quality.",
    body: [
      "Regulators differ widely in the protections they require, and one broker group may run several entities under different regulators. What matters is the regulator of the entity that holds your account, confirmed on that regulator's own register.",
    ],
    points: ["Confirm on the regulator's own register.", "Regulators differ in strength.", "The entity holding your account is what counts."],
    related: ["fca-register", "cysec-icf", "clone-firm"],
    links: [{ href: "/regulators", label: "Browse regulators" }, { href: "/verify", label: "Verify a broker" }, { href: "/blog/how-to-tell-a-scam-broker-from-a-real-one", label: "Scam broker warning signs" }],
  },
  {
    slug: "clone-firm",
    term: "Clone firm",
    category: "Broker safety",
    short: "A clone firm is a scam that copies the name, details or reference number of a genuine authorised firm to trick people into depositing money.",
    body: [
      "Clones often use a real firm reference number with different contact details, or a lookalike website address. Always compare the phone, address and website with the regulator's register, using contact details from the register and not from the site you are checking.",
    ],
    points: ["Copies a real firm's identity.", "Compare contact details with the register.", "Check the regulator's warning list."],
    related: ["fca-register", "regulated-broker", "warning-list"],
    links: [{ href: "/blog/how-to-tell-a-scam-broker-from-a-real-one", label: "Scam broker warning signs" }],
  },
  {
    slug: "warning-list",
    term: "Warning list",
    category: "Broker safety",
    short: "A warning list is a regulator's published list of firms and websites it has flagged as unauthorised or suspicious, such as the FCA Warning List.",
    body: [
      "Presence on a warning list is a serious red flag. Absence is not proof a firm is genuine, because new scams appear faster than lists are updated.",
    ],
    points: ["Presence is a red flag.", "Absence proves nothing.", "Check the brand and the web address."],
    related: ["clone-firm", "fca-register", "regulated-broker"],
    links: [{ href: "/verify", label: "Verify a broker" }],
  },
  {
    slug: "market-maker",
    term: "Market maker",
    category: "Broker safety",
    short: "A market maker broker takes the other side of client trades rather than passing them to an outside market. It sets its own prices and earns from the spread and, potentially, from client losses.",
    body: [
      "That creates a conflict of interest that regulated brokers must manage and disclose. It is not by itself a sign of a bad broker, but it is a reason to read the order execution policy and to prefer a broker regulated by a strong authority.",
    ],
    points: ["Broker is the counterparty.", "Conflict of interest to be managed.", "Read the order execution policy."],
    related: ["spread", "regulated-broker", "slippage"],
    links: [{ href: "/verify", label: "Verify a broker" }],
  },
  {
    slug: "cfd",
    term: "CFD (contract for difference)",
    category: "Basics",
    short: "A CFD is a leveraged contract that pays the difference between the opening and closing price of an asset, without owning the asset.",
    body: [
      "Because CFDs are leveraged, losses can build quickly. UK and EU regulators require firms to state the percentage of their retail clients who lose money trading CFDs, and that share is typically high.",
    ],
    points: ["Leveraged, no ownership of the asset.", "Firms must state the share of retail clients who lose money.", "Losses can be fast."],
    related: ["leverage", "negative-balance-protection", "spread"],
    links: [{ href: "/risk-disclosure", label: "Risk disclosure" }],
  },
  {
    slug: "swap",
    term: "Swap (overnight financing)",
    category: "Basics",
    short: "A swap is the interest charged or paid for holding a leveraged position open past the daily rollover time, typically late in the New York afternoon.",
    body: [
      "It reflects the interest rate difference between the two currencies and the broker's markup, so it can be a cost or a credit depending on direction. Positions held over a weekend are usually charged for extra days, often on Wednesday for three days.",
    ],
    points: ["Charged on positions held past rollover.", "Depends on interest rate difference and markup.", "Longer holds cost more."],
    related: ["leverage", "spread", "cfd"],
    links: [{ href: "/tools/margin-calculator", label: "Margin calculator" }],
  },
  {
    slug: "red-folder-news",
    term: "Red-folder news",
    category: "Markets and news",
    short: "Red-folder news is the trader's name for high-impact scheduled economic events, so called because calendars often mark them in red.",
    body: [
      "Examples include central bank interest rate decisions, inflation reports and US non-farm payrolls. Spreads widen and price can jump around them, which is why many traders reduce size or stay flat, and why some prop firms restrict trading near them.",
    ],
    points: ["High-impact scheduled events.", "Spreads widen and price can gap.", "Some firms restrict trading around them."],
    related: ["non-farm-payrolls", "cpi", "news-trading-rule"],
    links: [{ href: "/economic-calendar", label: "Economic calendar" }, { href: "/blog/how-to-trade-around-economic-news", label: "Trading around economic news" }],
  },
  {
    slug: "non-farm-payrolls",
    term: "Non-farm payrolls (NFP)",
    category: "Markets and news",
    short: "Non-farm payrolls is the US monthly jobs report, published by the Bureau of Labor Statistics, showing how many jobs the economy added outside farming.",
    body: [
      "It is normally released on the first Friday of the month and is one of the most closely watched events for the US dollar, gold and indices. It is a classic red-folder event, with wider spreads and fast moves in the minutes around it.",
    ],
    points: ["US jobs report, usually first Friday.", "Moves the dollar, gold and indices.", "A red-folder event."],
    related: ["red-folder-news", "cpi", "economic-calendar"],
    links: [{ href: "/economic-calendar", label: "Economic calendar" }],
  },
  {
    slug: "cpi",
    term: "CPI (consumer price index)",
    category: "Markets and news",
    short: "The consumer price index measures the change in prices paid by consumers for a basket of goods and services. It is the most widely used gauge of inflation.",
    body: [
      "Central banks weigh inflation heavily when setting interest rates, so CPI releases can move currencies and gold quickly. Markets react to the gap between the figure and the consensus forecast.",
    ],
    points: ["Headline gauge of inflation.", "Feeds into rate expectations.", "The surprise versus forecast moves price."],
    related: ["red-folder-news", "non-farm-payrolls", "economic-calendar"],
    links: [{ href: "/economic-calendar", label: "Economic calendar" }],
  },
  {
    slug: "economic-calendar",
    term: "Economic calendar",
    category: "Markets and news",
    short: "An economic calendar lists upcoming scheduled data releases and central bank events, with the time, country, expected impact, forecast and previous figure.",
    body: [
      "Traders use it to know when volatility is likely and to plan size, stops or time flat. Forecast figures are consensus estimates and can be wrong, and actual figures may be revised later.",
    ],
    points: ["Time, country, impact, forecast, previous.", "Use it to plan around volatility.", "Check the time zone."],
    related: ["red-folder-news", "news-trading-rule", "cpi"],
    links: [{ href: "/economic-calendar", label: "Economic calendar" }, { href: "/intelligence", label: "Daily market brief" }],
  },
  {
    slug: "trading-journal",
    term: "Trading journal",
    category: "Psychology",
    short: "A trading journal is a record of your trades and the reasoning, mood and outcome behind each, used to find patterns you cannot see in the moment.",
    body: [
      "The value is in reviewing it: what you planned, what you did, and how you felt. Over weeks it shows whether losses come from analysis or from behaviour such as overtrading after a loss.",
    ],
    points: ["Record plan, result and mood.", "Review it on a schedule.", "Look for repeated behaviour."],
    related: ["overtrading", "revenge-trading", "win-rate"],
    links: [{ href: "/journal", label: "Trading journal" }, { href: "/blog/how-to-keep-a-trading-journal", label: "How to keep a trading journal" }],
  },
  {
    slug: "revenge-trading",
    term: "Revenge trading",
    category: "Psychology",
    short: "Revenge trading is placing impulsive, often oversized trades to win back a loss quickly, driven by emotion rather than a plan.",
    body: [
      "It usually follows a loss that felt unfair, and it tends to produce a bigger loss. Rules that stop trading after a set loss, and a written plan for the next session, are the standard defences.",
    ],
    points: ["Trading to recover a loss, not to follow a plan.", "Usually oversized.", "A daily stop rule helps."],
    related: ["tilt", "overtrading", "trading-journal"],
    links: [{ href: "/mind", label: "Mind: trading psychology" }, { href: "/blog/revenge-trading-and-tilt-how-to-stop", label: "Stopping revenge trading and tilt" }],
  },
  {
    slug: "tilt",
    term: "Tilt",
    category: "Psychology",
    short: "Tilt is an emotional state after a loss or frustration in which you abandon your rules and trade recklessly.",
    body: [
      "The word comes from poker. Early signs are trading faster, ignoring your plan and feeling you need to make it back. Stepping away for a set time is more effective than trying to trade through it.",
    ],
    points: ["Emotion overrides the plan.", "Watch for faster, larger trades.", "Stepping away breaks the loop."],
    related: ["revenge-trading", "overtrading", "fomo"],
    links: [{ href: "/mind", label: "Mind: trading psychology" }, { href: "/blog/revenge-trading-and-tilt-how-to-stop", label: "Stopping revenge trading and tilt" }],
  },
  {
    slug: "fomo",
    term: "FOMO",
    category: "Psychology",
    short: "FOMO, the fear of missing out, is the urge to enter a trade late because price is moving without you, usually at a worse level and with a weaker plan.",
    body: [
      "Chasing a move gives a poor entry and a wide, arbitrary stop. A rule such as never entering more than a set distance from the planned level removes the decision in the moment.",
    ],
    points: ["Entering late because price is running.", "Poor entry, arbitrary stop.", "Pre-set rules remove the choice."],
    related: ["tilt", "overtrading", "trading-journal"],
    links: [{ href: "/mind", label: "Mind: trading psychology" }],
  },
  {
    slug: "overtrading",
    term: "Overtrading",
    category: "Psychology",
    short: "Overtrading is taking more trades, or larger trades, than your plan calls for, often out of boredom, frustration or a need for action.",
    body: [
      "Costs accumulate with every trade, and lower-quality setups dilute results. A daily trade limit and a journal that counts trades against your plan make it visible.",
    ],
    points: ["More trades than the plan allows.", "Costs and weak setups add up.", "Set a daily trade limit."],
    related: ["revenge-trading", "tilt", "trading-journal"],
    links: [{ href: "/journal", label: "Trading journal" }, { href: "/mind", label: "Mind: trading psychology" }],
  },
  {
    slug: "martingale",
    term: "Martingale",
    category: "Risk",
    short: "Martingale is a betting approach that doubles the position size after each loss. It risks a very large loss and can breach margin or drawdown limits quickly.",
    body: [
      "The idea is that one win recovers all the losses, but a run of losses grows the position size exponentially, and account size and broker limits are finite. Many prop firms prohibit it explicitly, and it conflicts with basic position sizing.",
    ],
    points: ["Doubling size after a loss.", "Exponential risk during a losing run.", "Often banned by prop firms."],
    related: ["position-sizing", "drawdown", "margin-call"],
    links: [{ href: "/blog/position-sizing-how-much-to-risk-per-trade", label: "Position sizing guide" }],
  },
  {
    slug: "volatility",
    term: "Volatility",
    category: "Markets and news",
    short: "Volatility is how much and how fast a market's price moves. Higher volatility means bigger swings, wider spreads and a greater chance a stop is hit.",
    body: [
      "Volatility is not constant: it rises around news and at session opens and falls when liquidity is thin. Wider stops in volatile conditions mean smaller position sizes for the same risk.",
    ],
    points: ["Size and speed of price moves.", "Rises around news and session opens.", "Wider stops need smaller size."],
    related: ["red-folder-news", "spread", "position-sizing"],
    links: [{ href: "/intelligence", label: "Daily market brief" }],
  },
];

export const getTerm = (slug: string) => GLOSSARY.find((t) => t.slug === slug);

/** Term entries sorted A-Z by display name. */
export const sortedGlossary = () => [...GLOSSARY].sort((a, b) => a.term.localeCompare(b.term, "en", { sensitivity: "base" }));

export const glossaryLetters = () => {
  const set = new Set(sortedGlossary().map((t) => t.term[0].toUpperCase()));
  return [...set].sort();
};
