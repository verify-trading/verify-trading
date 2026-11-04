import { describe, expect, it, vi } from 'vitest';
import { buildClarification } from '@/lib/ask/broker-discovery';
import { routeAskMessage } from '@/lib/ask/routing';

const profile = { kind: 'broker' as const, instruments: [], requirements: [] };
const history = [{ role: 'assistant' as const, content: JSON.stringify(buildClarification(profile)) }];
const other = vi.fn(async () => ({ intent: 'other' as const }));
const lookupExact = vi.fn(async (name: string) => name === 'FxPro' ? 'FxPro' : null);

describe('Ask routing', () => {
  it.each(['Is FxPro safe?', 'Can I trust FxPro!', 'Are FxPro regulated'])('fast paths %s', async message => {
    other.mockClear();
    expect(await routeAskMessage({ message, history: [] }, { classify: other, lookupExact })).toEqual({ kind: 'safety', firm: 'FxPro' });
    expect(other).not.toHaveBeenCalled();
  });

  it.each(['Is FxPro safe? I deposited and cannot withdraw', 'Is FxPro safe in Pakistan?'])('keeps contextual questions on the model: %s', async message => {
    lookupExact.mockClear();
    expect(await routeAskMessage({ message, history: [] }, { classify: other, lookupExact })).toEqual({ kind: 'model' });
    expect(lookupExact).not.toHaveBeenCalled();
  });

  it('asks questions only when the classifier identifies a selection request', async () => {
    const input = { message: 'Find a broker', history: [] };
    expect(await routeAskMessage(input, { classify: async () => ({ intent: 'pick_firm' }) })).toHaveProperty('kind', 'questionnaire');
    expect(await routeAskMessage(input, { classify: other })).toEqual({ kind: 'model' });
  });

  it('lets a pending questionnaire yield to a new question', async () => {
    expect(await routeAskMessage({ message: 'What things make people fail their challenge', history }, { classify: other })).toEqual({ kind: 'model' });
  });

  it('uses country and markets without requiring style', async () => {
    expect(await routeAskMessage({ message: 'UK, forex', history }, { classify: async () => ({ intent: 'answer_preferences' }) })).toMatchObject({ kind: 'model', profile: { country: 'GB', instruments: ['Forex'] } });
  });

  it('fails open on classifier errors', async () => {
    expect(await routeAskMessage({ message: 'Find a broker', history }, { classify: async () => { throw new Error('offline'); } })).toEqual({ kind: 'model' });
  });

  it('does not classify messages without firm words', async () => {
    other.mockClear();
    expect(await routeAskMessage({ message: 'Explain leverage', history: [] }, { classify: other })).toEqual({ kind: 'model' });
    expect(other).not.toHaveBeenCalled();
  });

  it('does not treat comparison cards as pending questionnaires', async () => {
    other.mockClear();
    await routeAskMessage({ message: 'Thanks', history: [{ role: 'assistant', content: JSON.stringify({ type: 'insight', variant: 'broker_discovery', headline: 'Compare these firms' }) }] }, { classify: other });
    expect(other).not.toHaveBeenCalled();
  });

  it.each([{ message: 'Find a broker https://example.com' }, { message: 'Find a broker', image: 'image' }])('sends URLs and images to the model', async input => {
    other.mockClear();
    expect(await routeAskMessage({ ...input, history }, { classify: other })).toEqual({ kind: 'model' });
    expect(other).not.toHaveBeenCalled();
  });

  it('resolves classifier safety results exactly and preserves known profiles on other', async () => {
    expect(await routeAskMessage({ message: 'Is this broker FxPro legit?', history: [] }, { classify: async () => ({ intent: 'plain_firm_check', firm: 'FxPro' }), lookupExact })).toEqual({ kind: 'safety', firm: 'FxPro' });
    expect(await routeAskMessage({ message: 'Thanks', history: [], sessionMemory: { brokerPreferences: profile } }, { classify: other })).toEqual({ kind: 'model', profile });
  });
});
