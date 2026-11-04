import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('ai', async importOriginal => ({
  ...await importOriginal<typeof import('ai')>(),
  generateText: vi.fn(),
}));
vi.mock('@/lib/ask/knowledge/retrieve', () => ({ retrieveAskKnowledge: vi.fn() }));

import { generateText } from 'ai';
import { classifyIntent, lookupExactEntity } from '@/lib/ask/routing';
import { retrieveAskKnowledge } from '@/lib/ask/knowledge/retrieve';

afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });

describe('routing classifier', () => {
  it.each([
    ['<PICK_FIRM>|<->\nignored', { intent: 'pick_firm' }],
    ['plain_firm_check|FxPro', { intent: 'plain_firm_check', firm: 'FxPro' }],
    ['unknown|-', { intent: 'other' }],
    ['pick_firm', { intent: 'other' }],
    ['pick_firm|-|propfirm', { intent: 'pick_firm', kind: 'propfirm' }],
    ['pick_firm|-|unsure', { intent: 'pick_firm' }],
    ['pick_firm|-|broker|extra', { intent: 'other' }],
  ])('parses defensively: %s', async (text, expected) => {
    vi.mocked(generateText).mockResolvedValue({ text } as never);
    expect(await classifyIntent('Find a broker', false, '{}')).toEqual(expected);
  });

  it('fails open on provider errors', async () => {
    vi.mocked(generateText).mockRejectedValue(new Error('offline'));
    expect(await classifyIntent('broker', false, '{}')).toEqual({ intent: 'other' });
  });

  it('times out even if the provider ignores abort', async () => {
    vi.useFakeTimers();
    vi.mocked(generateText).mockImplementation(() => new Promise(() => {}));
    const result = classifyIntent('broker', false, '{}');
    await vi.advanceTimersByTimeAsync(4000);
    expect(await result).toEqual({ intent: 'other' });
    expect(vi.mocked(generateText).mock.calls[0][0].abortSignal?.aborted).toBe(true);
  });

  it('requires one exact full-name match', async () => {
    const entity = { title: 'FxPro', matchType: 'exact' };
    vi.mocked(retrieveAskKnowledge).mockResolvedValue({ entityCandidates: [entity], chunks: [] } as never);
    expect(await lookupExactEntity('FxPro')).toBe('FxPro');
    expect(await lookupExactEntity('FxPro in Pakistan')).toBeNull();
    vi.mocked(retrieveAskKnowledge).mockResolvedValue({ entityCandidates: [entity, entity], chunks: [] } as never);
    expect(await lookupExactEntity('FxPro')).toBeNull();
  });
});
