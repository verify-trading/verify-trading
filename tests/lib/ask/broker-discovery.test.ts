import { sanitizeCard } from '@/lib/ask/contracts';
import { describe, it, expect, vi } from 'vitest';
import { getBrokerDiscovery, brokerMatchesInstruments } from '@/lib/ask/broker-discovery';
import { buildUpdatedSessionMemory } from '@/lib/ask/session-memory';
import { generateAskResponse } from '@/lib/ask/pipeline';

const request = (message: string) => ({ message, history: [] });

describe('broker discovery conversation', () => {
  it.each(["I'm looking for a new broker.", 'I need a broker', 'Which prop firm should I use?', 'Help me trade', 'Recommend a forex broker', 'What are the best brokers?'])('clarifies %s before research', async message => {
    const generateTextImpl = vi.fn();
    const retrieveAskKnowledgeImpl = vi.fn();
    const response = await generateAskResponse(request(message), { generateTextImpl, retrieveAskKnowledgeImpl });
    expect(response.data.type).toBe('insight');
    expect(response.data).toHaveProperty('body', expect.stringContaining('Which country'));
    expect(generateTextImpl).not.toHaveBeenCalled();
    expect(retrieveAskKnowledgeImpl).not.toHaveBeenCalled();
    expect(response.uiMeta?.followups).toBeUndefined();
  });

  it('carries partial answers and preferences through multiple turns and session memory', () => {
    const first = getBrokerDiscovery(request("I'm looking for a new broker"))!;
    const history = [{ role: 'user' as const, content: "I'm looking for a new broker" }, { role: 'assistant' as const, content: JSON.stringify(first.clarification) }];
    const second = getBrokerDiscovery({ message: "I'm in South Africa", history })!;
    expect(second.clarification?.body).not.toContain('Which country');
    expect(second.clarification?.body).toContain('What do you mainly trade');
    history.push({ role: 'user', content: "I'm in South Africa" }, { role: 'assistant', content: JSON.stringify(second.clarification) });
    const third = getBrokerDiscovery({ message: 'Gold and forex, scalping on MT5 with low spreads', history })!;
    expect(third.clarification).toBeUndefined();
    expect(third.profile).toMatchObject({ country: 'ZA', instruments: ['Forex', 'Gold'] });
    const memory = buildUpdatedSessionMemory({ history, userMessage: 'Gold and forex, scalping on MT5 with low spreads', assistantCard: { type: 'insight', headline: 'Options to compare', body: 'Compare eligibility first.', verdict: 'Check the agreement.' } });
    expect(memory?.brokerPreferences).toEqual(third.profile);
    const next = getBrokerDiscovery({ message: 'Recommend another broker', history: [], sessionMemory: memory });
    expect(next?.clarification).toBeUndefined();
    expect(next?.profile.country).toBe('ZA');
    expect(next?.profile.requirements.join(' ')).toContain('scalping on MT5');
    expect(getBrokerDiscovery({ message: 'Recommend a broker for the UK trading stocks', history: [], sessionMemory: memory })?.profile).toMatchObject({ country: 'GB', instruments: ['Stocks'] });
  });

  it('answers specific requests and unrelated follow-ups without the discovery questionnaire', () => {
    for (const message of ['Is FxPro suitable for a UK trader scalping gold?', 'Is IG safe?', 'What is gold doing now?', 'Explain broker fees']) expect(getBrokerDiscovery(request(message))).toBeNull();
    const first = getBrokerDiscovery(request('I need a broker'))!;
    expect(getBrokerDiscovery({ message: 'Is FxPro safe?', history: [{ role: 'assistant', content: JSON.stringify(first.clarification) }] })).toBeNull();
    // Country and markets known: one question about style, nothing already answered.
    const style = getBrokerDiscovery(request('Find a broker for South Africa trading gold and forex'))!.clarification!;
    expect(style.headline).toBe('One quick question');
    expect(style.body).toContain('South Africa');
    expect(style.body).not.toContain('Which country');
    expect(getBrokerDiscovery(request('Find a broker for South Africa trading gold, I swing trade'))?.clarification).toBeUndefined();
  });
});

it('keeps investment-only platforms out of forex and gold candidates', () => {
  expect(brokerMatchesInstruments('securities', ['Forex', 'Gold'])).toBe(false);
  expect(brokerMatchesInstruments('crypto_exchange', ['Forex'])).toBe(false);
  expect(brokerMatchesInstruments('forex_cfd', ['Gold'])).toBe(true);
  expect(brokerMatchesInstruments('securities', ['Stocks'])).toBe(true);
});

it('keeps all three comparison explanations and source URLs after sanitizing and reloading', () => {
  const card = { type: 'insight' as const, variant: 'broker_discovery' as const, headline: 'Candidates to compare', body: 'Our research is dated. First option fits MT5. Its eligibility needs checking. Second option supports forex. Check https://example.com/fees-and-charges. Third option needs a gold spread quote.', verdict: 'Confirm current country acceptance.' };
  expect(sanitizeCard(sanitizeCard(card))).toEqual(card);
  const clarification = getBrokerDiscovery(request('I need a broker'))!.clarification!;
  expect(sanitizeCard(clarification)).toHaveProperty('body', expect.stringContaining('\n\n1. Which country'));
});

it('accepts ISO country answers and other trading instruments without repeating questions', () => {
  expect(getBrokerDiscovery(request('Find a broker in ZA for silver and oil, day trading'))?.clarification).toBeUndefined();
  const first = getBrokerDiscovery(request('I need a broker for futures'))!;
  expect(getBrokerDiscovery({ message: 'ZA', history: [{ role: 'user', content: 'I need a broker for futures' }, { role: 'assistant', content: JSON.stringify(first.clarification) }] })?.clarification?.headline).toBe('One quick question');
});

it('remembers a beginner for the rest of the conversation', () => {
  const first = getBrokerDiscovery(request("Hi I'm new to trading, which broker shall I start with"))!;
  expect(first.profile.experience).toBe('beginner');
  const history = [{ role: 'user' as const, content: "Hi I'm new to trading, which broker shall I start with" }, { role: 'assistant' as const, content: JSON.stringify(first.clarification) }];
  expect(getBrokerDiscovery({ message: 'UK and gold', history })!.profile).toMatchObject({ experience: 'beginner', country: 'GB', instruments: ['Gold'] });
});
