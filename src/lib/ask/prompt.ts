export const askImageResponseGuide = `If the image is a trading chart, return a chart card:
type, pattern, bias (Bullish/Bearish/Neutral), entry, stop, target, rr, confidence, verdict.

The chart can be of ANY asset: stocks, forex, crypto, indices, ETFs, commodities. Analyse it the same way regardless of instrument.

If it is not a trading chart, return:
{"type":"insight","headline":"Need a Chart","body":"That image doesn't look like a trading chart. Send a chart or ask a trading question.","verdict":"Send a trading chart for analysis."}`;

export const defaultAskImagePrompt =
  "Analyse this image. If it is a trading chart of any asset: stocks, forex, crypto, indices, ETFs, or commodities, return a chart card with pattern, bias, entry, stop, target, rr, confidence, and verdict. If not, say you need a trading chart or trading question.";
