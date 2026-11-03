import type { AskRequest, InsightCard } from './contracts';

export type BrokerPreferences = {
  kind: 'broker' | 'propfirm';
  country?: string;
  instruments: string[];
  requirements: string[];
};

const DISCOVERY = /\b(?:which|what|best|top|safest|recommend\w*|suggest\w*|find\w*|choos\w*|switch\w*|chang\w*|looking\s+for|(?:i\s+)?(?:need|want))\b[^?!.]{0,90}\b(?:brokers?|prop\s*firms?)\b|\b(?:brokers?|prop\s*firms?)\b[^?!.]{0,40}\b(?:recommend|suggest|should\s+i\s+use|are\s+(?:good|best))\b|^help\s+me\s+(?:start\s+)?trad(?:e|ing)[.!?]*$/i;
const HEADLINES = ['Find a broker that fits', 'Find a prop firm that fits', 'Start with your trading needs'];
const regions = new Intl.DisplayNames(['en'], { type: 'region' });
const countries = Array.from({ length: 676 }, (_, i) => String.fromCharCode(65 + Math.floor(i / 26), 65 + i % 26))
  .map(code => ({ code, name: regions.of(code) ?? code })).filter(({ code, name }) => code !== name);

function countryIn(message: string): string | undefined {
  const code = (/^[A-Za-z]{2}$/.test(message.trim()) ? message.trim() : message.match(/\b(?:in|from|country(?: is)?)\s+([A-Z]{2})\b/)?.[1])?.toUpperCase();
  if (code && countries.some(country => country.code === code)) return code;
  if (/\b(?:UK|U\.K\.|Britain|British)\b/i.test(message)) return 'GB';
  if (/\b(?:USA|U\.S\.|United States(?: of America)?)\b/i.test(message) || /\bUS\b/.test(message)) return 'US';
  return countries.find(({ name }) => new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(message))?.code;
}

function addRequirements(profile: BrokerPreferences, message: string): BrokerPreferences {
  const instruments = [
    ['Forex', /\b(?:forex|fx|currenc(?:y|ies)|eur\/?usd|gbp\/?usd)\b/i],
    ['Gold', /\b(?:gold|xau(?:\/?usd)?)\b/i],
    ['Indices', /\b(?:indices|indexes|index|nasdaq|nas100|us30|s&p\s*500)\b/i],
    ['Stocks', /\b(?:stocks?|shares?|equities|etfs?)\b/i],
    ['Crypto', /\b(?:crypto|bitcoin|btc|ethereum|eth)\b/i],
    ['Futures', /\bfutures\b/i],
    ['Commodities', /\b(?:commodities|oil|silver|brent|wti)\b/i],
    ['Options', /\boptions\b/i],
  ] as const;
  const found = instruments.filter(([, pattern]) => pattern.test(message)).map(([label]) => label);
  return {
    ...profile,
    country: countryIn(message) ?? profile.country,
    instruments: found.length ? found : profile.instruments,
    requirements: [...new Set([...profile.requirements, message.slice(0, 500)])].slice(-6),
  };
}

function isClarification(content: string) {
  try { return HEADLINES.includes(JSON.parse(content).headline); } catch { return false; }
}

/** Shared by quota reservation and generation: clarification never calls a model or consumes a query. */
export function getBrokerDiscovery(request: Pick<AskRequest, 'message' | 'history' | 'sessionMemory' | 'image'>) {
  if (request.image || /https?:\/\//i.test(request.message) || /^(?:is|are|verify|check|review|compare)\s+.+\b(?:safe|legit|suitable|regulated|scam|trustworthy)\b/i.test(request.message)) return null;
  let profile = request.sessionMemory?.brokerPreferences;
  let awaiting = false;
  for (const turn of request.history ?? []) {
    if (turn.role === 'assistant') { awaiting = isClarification(turn.content); continue; }
    if (DISCOVERY.test(turn.content) || awaiting) {
      profile = addRequirements(profile ?? { kind: /prop\s*firm/i.test(turn.content) ? 'propfirm' : 'broker', instruments: [], requirements: [] }, turn.content);
      awaiting = false;
    }
  }
  if (!DISCOVERY.test(request.message) && !awaiting) return null;
  const kind = /prop\s*firm/i.test(request.message) ? 'propfirm' : /\bbroker/i.test(request.message) ? 'broker' : profile?.kind ?? 'broker';
  profile = addRequirements({ ...(profile ?? { instruments: [], requirements: [] }), kind }, request.message);
  const questions = [
    ...(!profile.country ? ['Which country are you based in?'] : []),
    ...(!profile.instruments.length ? ['What do you mainly trade: Forex, Gold, Indices, Stocks or Crypto?'] : []),
  ];
  const clarification: InsightCard | undefined = questions.length ? {
    type: 'insight',
    variant: 'broker_discovery',
    headline: kind === 'propfirm' ? HEADLINES[1] : /^help me/i.test(request.message) ? HEADLINES[2] : HEADLINES[0],
    body: `Of course, I can help you find ${kind === 'propfirm' ? 'a prop firm' : 'a broker'} that suits your trading needs.\n\n${questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}`,
    verdict: kind === 'propfirm' ? "I'll compare suitable options using their rules, fees and payout risks, alongside trust evidence." : "I'll compare suitable brokers using regulation, costs, platforms and reliability, alongside trust evidence.",
  } : undefined;
  return { profile, clarification };
}

/** Product category is a first filter, never proof of instrument availability or residence eligibility. */
export function brokerMatchesInstruments(brokerType: string | null, instruments: string[]) {
  if (!brokerType || brokerType === 'unknown' || brokerType === 'multi_asset') return true;
  const markets = instruments.join(' ');
  return (/forex|gold|indices|commodities/i.test(markets) && brokerType === 'forex_cfd')
    || (/stocks|options/i.test(markets) && ['securities', 'forex_cfd'].includes(brokerType))
    || (/crypto/i.test(markets) && ['crypto_exchange', 'forex_cfd'].includes(brokerType))
    || (/futures/i.test(markets) && brokerType === 'futures');
}
