// AUTO-GENERATED — do not edit by hand. Regenerate with tests/lib/journal/_seed.test.ts.
// Top prop firms' challenge rules, captured by the live scraper at $100k / 2-step so the
// common firms resolve instantly instead of live-scraping on every setup.
import type { AccountType, ChallengeRules } from "./challenge";

export type FirmRulesSeed = { domain: string; firmName: string; firmUrl: string; accountSize: number; accountType: AccountType; rules: ChallengeRules };

export const FIRM_RULES_SEED: FirmRulesSeed[] = [
  {
    "domain": "ftmo.com",
    "firmName": "FTMO",
    "firmUrl": "https://ftmo.com",
    "accountSize": 100000,
    "accountType": "2step",
    "rules": {
      "firm_name": "FTMO",
      "daily_loss_limit": "5%",
      "max_drawdown": "10%",
      "profit_target": "10%",
      "min_trading_days": 4,
      "max_trading_days": null,
      "weekend_holding": true,
      "news_trading_allowed": true,
      "other_rules": [
        "Up to 90% profit share/reward",
        "Fee is refunded after successful completion",
        "Verification phase (Phase 2) requires 5% profit target",
        "News trading restrictions apply only on FTMO Account (Standard), not during Evaluation",
        "Maximum Loss is end-of-day trailing drawdown based on highest balance",
        "Swing account type has no news trading restrictions"
      ]
    }
  },
  {
    "domain": "fundednext.com",
    "firmName": "FundedNext",
    "firmUrl": "https://fundednext.com",
    "accountSize": 100000,
    "accountType": "2step",
    "rules": {
      "firm_name": "FundedNext",
      "daily_loss_limit": "5%",
      "max_drawdown": "10%",
      "profit_target": "8%",
      "min_trading_days": 5,
      "max_trading_days": null,
      "weekend_holding": true,
      "news_trading_allowed": true,
      "other_rules": [
        "Stellar 2-Step maximum loss limit is static (calculated from initial balance)",
        "60-day inactivity rule: account deactivated if no trade placed within 60 consecutive days",
        "Profit split: 80% standard, up to 90% with Scale-Up, up to 95% with add-on",
        "Cross-account hedging within FundedNext or with other firms is prohibited",
        "Account is personal and must not be shared, sold, transferred, or used by third parties",
        "No time limit to pass the challenge phases"
      ]
    }
  },
  {
    "domain": "the5ers.com",
    "firmName": "The5ers",
    "firmUrl": "https://the5ers.com",
    "accountSize": 100000,
    "accountType": "2step",
    "rules": {
      "firm_name": "The5ers",
      "daily_loss_limit": "5%",
      "max_drawdown": "10%",
      "profit_target": "10%",
      "min_trading_days": 3,
      "max_trading_days": null,
      "weekend_holding": true,
      "news_trading_allowed": false,
      "other_rules": [
        "Executing orders 2 minutes before until 2 minutes after high-impact news is not allowed",
        "Profit split: 80%-100%",
        "Scaling up to $500,000 funded account",
        "Inactivity rule: accounts inactive for more than 30 consecutive days will expire",
        "Leverage 1:100",
        "Minimum profitable day requires at least 0.5% positive profit of initial balance"
      ]
    }
  },
  {
    "domain": "fundingpips.com",
    "firmName": "FundingPips",
    "firmUrl": "https://fundingpips.com",
    "accountSize": 100000,
    "accountType": "2step",
    "rules": {
      "firm_name": "FundingPips",
      "daily_loss_limit": "4%",
      "max_drawdown": "12%",
      "profit_target": "10%",
      "min_trading_days": 0,
      "max_trading_days": null,
      "weekend_holding": true,
      "news_trading_allowed": true,
      "other_rules": [
        "2 Step Flex plan for $100K account",
        "Profit split up to 95% (biweekly) with profitable days add-on, or 85% biweekly standard",
        "Phase 2 profit target: 6%",
        "Leverage up to 1:100",
        "Raw 0.0 pip spreads",
        "No minimum trading days required"
      ]
    }
  },
  {
    "domain": "e8markets.com",
    "firmName": "E8 Markets",
    "firmUrl": "https://e8markets.com",
    "accountSize": 100000,
    "accountType": "2step",
    "rules": {
      "firm_name": "E8 Markets",
      "daily_loss_limit": "2.5%",
      "max_drawdown": "8%",
      "profit_target": "8%",
      "min_trading_days": null,
      "max_trading_days": null,
      "weekend_holding": true,
      "news_trading_allowed": true,
      "other_rules": [
        "Static drawdown — max loss locked from initial balance, never trails equity",
        "No consistency rule",
        "Daily profit cap of 2% (anything above is uncounted)",
        "Payout split: 80% default, 100% add-on available",
        "No max allocation cap at Challenge stage; max $500K combined across Performance Accounts",
        "Daily payout requests available after rollover; first payout minimum 1% of initial balance"
      ]
    }
  },
  {
    "domain": "alphacapitalgroup.uk",
    "firmName": "Alpha Capital Group",
    "firmUrl": "https://alphacapitalgroup.uk",
    "accountSize": 100000,
    "accountType": "2step",
    "rules": {
      "firm_name": "Alpha Capital Group",
      "daily_loss_limit": "N/A",
      "max_drawdown": "10%",
      "profit_target": "8%",
      "min_trading_days": null,
      "max_trading_days": null,
      "weekend_holding": true,
      "news_trading_allowed": true,
      "other_rules": [
        "2-step evaluation (Phase 1: 8% profit target, Phase 2: 5% profit target)",
        "Performance fee (profit split) up to 80%",
        "Unlimited trading days in both phases",
        "Alpha Swing plan allows overnight and weekend holding",
        "Simulated funds used throughout evaluation and qualified account",
        "Evaluation fee is the only capital at risk"
      ]
    }
  },
  {
    "domain": "topstep.com",
    "firmName": "Topstep",
    "firmUrl": "https://www.topstep.com",
    "accountSize": 100000,
    "accountType": "2step",
    "rules": {
      "firm_name": "Topstep",
      "daily_loss_limit": "$2,000",
      "max_drawdown": "$3,000",
      "profit_target": "$6,000",
      "min_trading_days": null,
      "max_trading_days": null,
      "weekend_holding": true,
      "news_trading_allowed": true,
      "other_rules": [
        "Consistency Target: best trading day cannot exceed 50% of total profits during the Trading Combine",
        "Max Contract Limit: 10 mini / 100 micro contracts",
        "90/10 profit split (trader keeps 90%)",
        "All positions must be closed by 3:10 PM CT each trading day",
        "Payout eligibility: 5 winning days of $150+ (Standard) or 3 days with 40% consistency target (Consistency XFA)",
        "Maximum Loss Limit is trailing based on highest end-of-day balance; account permanently closed if hit"
      ]
    }
  },
  {
    "domain": "blueguardian.com",
    "firmName": "Blue Guardian",
    "firmUrl": "https://blueguardian.com",
    "accountSize": 100000,
    "accountType": "2step",
    "rules": {
      "firm_name": "Blue Guardian",
      "daily_loss_limit": "5%",
      "max_drawdown": "10%",
      "profit_target": "8%",
      "min_trading_days": null,
      "max_trading_days": null,
      "weekend_holding": true,
      "news_trading_allowed": true,
      "other_rules": [
        "Phase 2 profit target: 4%",
        "Trailing drawdown applies on funded account (profits raise the floor)",
        "Up to 90% profit split (standard is 85%)",
        "Payouts in 7 days (or 14 days standard)",
        "Expert Advisors (EAs) permitted",
        "Trade copier permitted"
      ]
    }
  },
  {
    "domain": "funderpro.com",
    "firmName": "FunderPro",
    "firmUrl": "https://funderpro.com",
    "accountSize": 100000,
    "accountType": "2step",
    "rules": {
      "firm_name": "FunderPro",
      "daily_loss_limit": "5%",
      "max_drawdown": "10%",
      "profit_target": "10%",
      "min_trading_days": 4,
      "max_trading_days": null,
      "weekend_holding": true,
      "news_trading_allowed": true,
      "other_rules": [
        "Classic 2-Phase: No Consistency Rule",
        "Phase 2 profit target is 5%",
        "80% profit split on funded account",
        "Bi-weekly reward frequency on funded account",
        "Balance-based daily drawdown calculated at 5:00 p.m. EST",
        "EAs and trading bots are allowed"
      ]
    }
  },
  {
    "domain": "goatfundedtrader.com",
    "firmName": "GoatFundedTrader",
    "firmUrl": "https://goatfundedtrader.com",
    "accountSize": 100000,
    "accountType": "2step",
    "rules": {
      "firm_name": "GoatFundedTrader",
      "daily_loss_limit": "4%",
      "max_drawdown": "6%",
      "profit_target": "10%",
      "min_trading_days": null,
      "max_trading_days": null,
      "weekend_holding": true,
      "news_trading_allowed": true,
      "other_rules": [
        "100% profit split",
        "Unlimited trading period",
        "One-time 100% refundable fee",
        "No HFT or Gold Arbitrage EAs allowed",
        "No arbitrage between accounts or with third-party firms",
        "Must not switch strategy between assessment and funded stage (EA vs manual)"
      ]
    }
  },
  {
    "domain": "instantfunding.com",
    "firmName": "Instant Funding",
    "firmUrl": "https://instantfunding.com",
    "accountSize": 100000,
    "accountType": "2step",
    "rules": {
      "firm_name": "Instant Funding",
      "daily_loss_limit": "5%",
      "max_drawdown": "10%",
      "profit_target": "8%",
      "min_trading_days": 3,
      "max_trading_days": null,
      "weekend_holding": false,
      "news_trading_allowed": false,
      "other_rules": [
        "Phase 1 profit target: 8%, Phase 2 profit target: 5%",
        "Static drawdown (not trailing)",
        "Profit split: 80% baseline, scalable to 90%",
        "Max lot size for $100,000 account: 40 lots on currency pairs",
        "No martingale (except allowed on challenges with restrictions), no grid trading, no HFT (trades held 60s or less prohibited)",
        "Scaling: account grows up to 100% of starting balance at 10% profit target"
      ]
    }
  },
  {
    "domain": "thetradingpit.com",
    "firmName": "The Trading Pit",
    "firmUrl": "https://thetradingpit.com",
    "accountSize": 100000,
    "accountType": "2step",
    "rules": {
      "firm_name": "The Trading Pit",
      "daily_loss_limit": "2%",
      "max_drawdown": "5%",
      "profit_target": "7%",
      "min_trading_days": 3,
      "max_trading_days": null,
      "weekend_holding": false,
      "news_trading_allowed": true,
      "other_rules": [
        "Consistency rule: most profitable day cannot exceed 40% of total profit target (challenge phase only)",
        "Scalping rule: each trade must stay open for at least 1 minute before closing",
        "Minimum trade range: profitable trades must show at least $0.10 gain per share",
        "Minimum trading volume: stock must have 200,000+ average daily shares over past 14 days",
        "End-of-day liquidation: all positions closed 10 minutes before market close",
        "Cash out rule: first payout requires 3 profitable trading days each with $100+ profit"
      ]
    }
  },
  {
    "domain": "citytradersimperium.com",
    "firmName": "City Traders Imperium",
    "firmUrl": "https://citytradersimperium.com",
    "accountSize": 100000,
    "accountType": "2step",
    "rules": {
      "firm_name": "City Traders Imperium",
      "daily_loss_limit": "$5,000",
      "max_drawdown": "$10,000",
      "profit_target": "$10,000",
      "min_trading_days": 3,
      "max_trading_days": null,
      "weekend_holding": true,
      "news_trading_allowed": true,
      "other_rules": [
        "Balance-based drawdown",
        "Profit share 80%-100%",
        "No time limit on the challenge",
        "Scaling plan: 50% balance increase per level up to $200,000",
        "First payout after 7 days",
        "Min 3 profitable days required in each phase"
      ]
    }
  },
  {
    "domain": "maventrading.com",
    "firmName": "Maven Trading",
    "firmUrl": "https://maventrading.com",
    "accountSize": 100000,
    "accountType": "2step",
    "rules": {
      "firm_name": "Maven Trading",
      "daily_loss_limit": "4%",
      "max_drawdown": "8%",
      "profit_target": "8%",
      "min_trading_days": 3,
      "max_trading_days": null,
      "weekend_holding": true,
      "news_trading_allowed": false,
      "other_rules": [
        "Profit split: 80%, payouts every 10 business days",
        "No EAs or automated trading systems permitted",
        "No grid/gap trading, hedging, copy trading, or HFT",
        "No news trading: cannot open or close trades within 2 minutes either side of red folder news events",
        "Accounts must not be dormant for more than 30 calendar days",
        "Max drawdown is static from the initial balance; daily loss based on higher of equity or balance at 00:00 UTC+0"
      ]
    }
  },
  {
    "domain": "fundingtraders.com",
    "firmName": "FundingTraders",
    "firmUrl": "https://fundingtraders.com",
    "accountSize": 100000,
    "accountType": "2step",
    "rules": {
      "firm_name": "FundingTraders",
      "daily_loss_limit": "5%",
      "max_drawdown": "10%",
      "profit_target": "10%",
      "min_trading_days": null,
      "max_trading_days": null,
      "weekend_holding": true,
      "news_trading_allowed": true,
      "other_rules": [
        "No EAs, scripts, or robots unless granted an exception by the Risk Team",
        "No copy trading or signal providing to third parties",
        "No martingale, grid, HFT, or arbitrage strategies",
        "Consistency rule applies; no unusually large or toxic trading behavior",
        "Up to 100% profit split on funded accounts",
        "No time limit on evaluations"
      ]
    }
  },
  {
    "domain": "larkfunding.com",
    "firmName": "Lark Funding",
    "firmUrl": "https://larkfunding.com",
    "accountSize": 100000,
    "accountType": "2step",
    "rules": {
      "firm_name": "Lark Funding",
      "daily_loss_limit": "5%",
      "max_drawdown": "7%",
      "profit_target": "10%",
      "min_trading_days": 0,
      "max_trading_days": null,
      "weekend_holding": false,
      "news_trading_allowed": true,
      "other_rules": [
        "No consistency rule",
        "80% performance profit split on funded account",
        "All-or-nothing trading prohibited; daily/per-trade gain capped at $10,000",
        "EAs with HFT strategies, Gold Arbitrage EAs, and prohibited strategy EAs are not allowed",
        "Holding Single Share Equity CFD positions into earnings releases is prohibited",
        "Bi-weekly payouts on funded account"
      ]
    }
  }
];
