import { describe, it, expect, vi } from 'vitest';
import { brokerMatchesInstruments, buildClarification } from '@/lib/ask/broker-discovery';
import { routeAskMessage, type classifyIntent } from '@/lib/ask/routing';
import { buildUpdatedSessionMemory } from '@/lib/ask/session-memory';
import { generateAskResponse } from '@/lib/ask/pipeline';

const classify: typeof classifyIntent = async (_, pending) => ({ intent: pending ? 'answer_preferences' : 'pick_firm' });

describe('broker discovery conversation', () => {
  it.each(['I need a broker', 'Which prop firm should I use?', 'Recommend a forex broker'])('clarifies %s without generation', async message => {
    const request = { message, history: [] };
    const route = await routeAskMessage(request, { classify });
    const generateTextImpl = vi.fn();
    const retrieveAskKnowledgeImpl = vi.fn();
    const response = await generateAskResponse(request, { route, generateTextImpl, retrieveAskKnowledgeImpl });
    expect(response.data).toHaveProperty('body', expect.stringContaining('Which country'));
    expect(generateTextImpl).not.toHaveBeenCalled();
    expect(retrieveAskKnowledgeImpl).not.toHaveBeenCalled();
  });

  it('recovers questionnaire preferences from history and persists the route profile', async () => {
    const first = await routeAskMessage({ message: 'I am a beginner, find a broker for futures', history: [] }, { classify });
    if (first.kind !== 'questionnaire') throw new Error('Expected questionnaire');
    const history = [
      { role: 'user' as const, content: 'I am a beginner, find a broker for futures' },
      { role: 'assistant' as const, content: JSON.stringify(first.clarification) },
    ];
    const route = await routeAskMessage({ message: 'ZA', history }, { classify });
    expect(route).toMatchObject({ kind: 'model', profile: { country: 'ZA', instruments: ['Futures'], experience: 'beginner' } });
    const memory = buildUpdatedSessionMemory({ history, route, userMessage: 'ZA', assistantCard: { type: 'insight', headline: 'Options', body: 'Compare eligibility.', verdict: 'Check terms.' } });
    expect(memory?.brokerPreferences).toEqual(route.kind === 'model' ? route.profile : null);
  });

  it('asks only for missing country and markets, never style', async () => {
    const route = await routeAskMessage({ message: 'Find a broker in ZA for silver and oil', history: [] }, { classify });
    expect(route).toMatchObject({ kind: 'model', profile: { country: 'ZA', instruments: ['Commodities'] } });
    const card = buildClarification({ kind: 'broker', instruments: [], requirements: [] });
    expect(card.body).toContain('1. Which country');
    expect(card.body).toContain('2. What do you mainly trade');
  });
});

it('keeps investment-only platforms out of forex and gold candidates', () => {
  expect(brokerMatchesInstruments('securities', ['Forex', 'Gold'])).toBe(false);
  expect(brokerMatchesInstruments('crypto_exchange', ['Forex'])).toBe(false);
  expect(brokerMatchesInstruments('forex_cfd', ['Gold'])).toBe(true);
  expect(brokerMatchesInstruments('securities', ['Stocks'])).toBe(true);
});
