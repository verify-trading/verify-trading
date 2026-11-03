import { describe, expect, it } from 'vitest';
import { btsVerificationGate, btsWebsiteIdentity, readBtsResearch } from '@/lib/compare/bts-research';

const research = (website: string, legalEntity = '') => readBtsResearch({ research_input: { website_url: website, legal_entity: legalEntity }, source_evidence: [] });

describe('original BTS research', () => {
  it('keeps links historical and parses licence JSON without exposing private notes', () => {
    const result = readBtsResearch({ research_input: { website_url: 'https://example.com', research_notes: 'PRIVATE', regulatory_licences_json: '[{"regulator":"FCA","licence_holder":"Example Ltd"}]' }, source_evidence: [{ url: 'https://example.com/terms', roles: ['payout_terms_url'], research_date: '2026-10-28' }, { url: 'javascript:alert(1)' }] });
    expect(result?.licences[0].licence_holder).toBe('Example Ltd');
    expect(result?.sources).toEqual([{ url: 'https://example.com/terms', roles: ['payout_terms_url'], researchDate: '2026-10-28' }]);
    expect(JSON.stringify(result)).not.toContain('PRIVATE');
    expect(readBtsResearch({ research_input: { website_url: 'https://acetop.uk' }, clone_notice: { source_url: 'https://fca.org.uk/clone-notice' } })?.cloneNoticeSource).toBe('https://fca.org.uk/clone-notice');
  });

  it.each(['inactive', 'redirected', 'merged', 'closed'])('blocks positive outcomes for %s operators', (status) => {
    expect(btsVerificationGate(status, 'complete')).toBe('inactive');
  });

  it('quarantines needs-review records before any scored assessment', () => {
    expect(btsVerificationGate('active', 'needs_review')).toBe('needs_review');
    expect(btsVerificationGate('unknown', 'complete')).toBe('unknown');
    expect(btsVerificationGate('active', 'partial')).toBeNull();
  });

  it('collapses exact website/name variants but preserves distinct products and identities', () => {
    expect(btsWebsiteIdentity('Uprofit', research('https://uprofit.com/'))).toBe(btsWebsiteIdentity('UpProfit', research('https://www.uprofit.com')));
    expect(btsWebsiteIdentity('DayTraders', research('https://daytraders.com'))).toBe(btsWebsiteIdentity('DayTraders.com', research('https://daytraders.com/')));
    expect(btsWebsiteIdentity('FTMO', research('https://ftmo.com', 'Operator A'))).not.toBe(btsWebsiteIdentity('FTMO Futures', research('https://ftmo.com', 'Operator A')));
    expect(btsWebsiteIdentity('Same', research('https://example.com', 'Operator A'))).not.toBe(btsWebsiteIdentity('Same', research('https://example.com', 'Operator B')));
    expect(btsWebsiteIdentity('HyperFunding', research('https://thehyperfunding.com'))).not.toBe(btsWebsiteIdentity('HyperFunded', research('https://hyperfunded.pro')));
  });
});
