type MarketInstrumentLike = {
  asset: string;
  symbol: string;
};

const fiatCurrencyCodes = new Set([
  "AED",
  "AUD",
  "BGN",
  "BRL",
  "CAD",
  "CHF",
  "CNH",
  "CZK",
  "DKK",
  "EUR",
  "GBP",
  "HKD",
  "HUF",
  "ILS",
  "INR",
  "JPY",
  "MXN",
  "NOK",
  "NZD",
  "PLN",
  "RON",
  "SEK",
  "SGD",
  "TRY",
  "USD",
  "ZAR",
]);

function normalizeForexPair(value: string) {
  const normalized = value.toUpperCase().replace(/[^A-Z]/g, "");
  if (!/^[A-Z]{6}$/.test(normalized)) {
    throw new Error(`Unsupported forex pair format: ${value}`);
  }

  const base = normalized.slice(0, 3);
  const quote = normalized.slice(3, 6);
  if (!fiatCurrencyCodes.has(base) || !fiatCurrencyCodes.has(quote)) {
    throw new Error(`Unsupported forex pair format: ${value}`);
  }

  return {
    base,
    quote,
  };
}

function resolveForexPair(instrument: MarketInstrumentLike) {
  for (const candidate of [instrument.symbol, instrument.asset]) {
    try {
      return normalizeForexPair(candidate);
    } catch {
      continue;
    }
  }

  return null;
}

function getFractionDigits(value: number, instrument: MarketInstrumentLike) {
  const forexPair = resolveForexPair(instrument);
  if (forexPair) {
    return forexPair.quote === "JPY" ? 3 : 4;
  }

  const absoluteValue = Math.abs(value);
  if (absoluteValue >= 1) {
    return 2;
  }

  if (absoluteValue >= 0.1) {
    return 4;
  }

  if (absoluteValue >= 0.01) {
    return 5;
  }

  return 6;
}

export function formatMarketPrice(value: number, instrument: MarketInstrumentLike) {
  if (!Number.isFinite(value)) {
    return "—";
  }

  return value.toFixed(getFractionDigits(value, instrument));
}
