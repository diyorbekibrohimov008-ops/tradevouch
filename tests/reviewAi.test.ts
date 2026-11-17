import { describe, expect, it } from 'vitest';
import {
  buildGoogleMapsReviewUrl,
  draftOwnerReply,
  draftTradeReview,
} from '../shared/reviewAi';

describe('draftTradeReview', () => {
  it('removes filler words from a 10s voice transcript and highlights technician professionalism', () => {
    const result = draftTradeReview({
      businessName: 'PeakLine Roofing',
      trade: 'roofing',
      techName: 'Marcus Vance',
      serviceType: 'Chimney Flashing & Leak Repair',
      customerName: 'Sarah Jenkins',
      rating: 5,
      inputMode: 'voice',
      rawTranscript:
        'Um, so like Marcus came out right on time for our roof leak, you know, fixed the flashing around the chimney and uh cleaned up every single nail.',
      tone: 'warm',
    });

    expect(result.fillersRemoved).toBeGreaterThanOrEqual(4);
    expect(result.draftText).not.toMatch(/\b(um|uh|you know)\b/i);
    expect(result.draftText).not.toContain('. ,');
    expect(result.draftText).toContain('Marcus');
    expect(result.draftText).toContain('PeakLine Roofing');
    expect(result.draftText.toLowerCase()).toContain('flashing');
    expect(result.suggestPrivateResolution).toBe(false);
  });

  it('generates a natural detailed review from 2 guided questions with zero typed transcript', () => {
    const result = draftTradeReview({
      businessName: 'CopperPipe Plumbing',
      trade: 'plumbing',
      techName: 'Elena Rostova',
      serviceType: 'Tankless Water Heater Flush',
      rating: 5,
      inputMode: 'questions',
      rawTranscript: '',
      quickHighlights: ['On-time arrival', 'Clean workspace', 'Clear upfront pricing'],
      extraNote: 'Walked me through the shutoff valve check before leaving.',
      tone: 'warm',
    });

    expect(result.draftText).toContain('Elena Rostova');
    expect(result.draftText).toContain('CopperPipe Plumbing');
    expect(result.draftText.toLowerCase()).toContain('on time');
    expect(result.draftText.toLowerCase()).toContain('pricing');
    expect(result.draftText).toContain('shutoff valve');
  });

  it('produces shorter copy for short tone than detailed tone', () => {
    const base = {
      businessName: 'MirrorCoat Auto Detailing',
      trade: 'detailing' as const,
      techName: 'Devon Brooks',
      serviceType: 'Ceramic Coating & Interior Reset',
      rating: 5,
      inputMode: 'questions' as const,
      quickHighlights: ['Spotless finish', 'On-time arrival', 'Respectful crew'],
    };

    const shortDraft = draftTradeReview({ ...base, tone: 'short' });
    const detailedDraft = draftTradeReview({ ...base, tone: 'detailed' });

    expect(shortDraft.draftText.length).toBeLessThan(detailedDraft.draftText.length);
    expect(shortDraft.draftText).toContain('Devon Brooks');
    expect(detailedDraft.draftText).toContain('MirrorCoat Auto Detailing');
  });

  it('handles empty or filler-only voice transcripts gracefully without empty output', () => {
    const result = draftTradeReview({
      businessName: 'PeakLine Roofing',
      trade: 'roofing',
      techName: 'Marcus Vance',
      serviceType: 'Ridge Vent Inspection',
      rating: 5,
      inputMode: 'voice',
      rawTranscript: 'um uh like',
      tone: 'warm',
    });

    expect(result.draftText.length).toBeGreaterThan(40);
    expect(result.draftText).toContain('Marcus Vance');
    expect(result.draftText).toContain('PeakLine Roofing');
  });

  it('flags low ratings for private owner resolution and avoids dishonest 5-star hype', () => {
    const result = draftTradeReview({
      businessName: 'CopperPipe Plumbing',
      trade: 'plumbing',
      techName: 'Elena Rostova',
      serviceType: 'Drain Snaking',
      rating: 2,
      inputMode: 'voice',
      rawTranscript: 'Arrived an hour late without calling first, though the drain works now.',
      tone: 'warm',
    });

    expect(result.suggestPrivateResolution).toBe(true);
    expect(result.draftText.toLowerCase()).not.toContain('5 star');
    expect(result.draftText).toContain('Drain');
  });
});

describe('draftOwnerReply', () => {
  it('credits the technician and personalizes by customer first name', () => {
    const reply = draftOwnerReply({
      businessName: 'PeakLine Roofing',
      customerName: 'Sarah Jenkins',
      techName: 'Marcus Vance',
      serviceType: 'Chimney Flashing Repair',
      rating: 5,
      reviewText: 'Marcus was awesome and fixed our leak quickly.',
    });

    expect(reply).toContain('Sarah');
    expect(reply).toContain('Marcus');
    expect(reply).toContain('PeakLine Roofing');
  });
});

describe('buildGoogleMapsReviewUrl', () => {
  it('preserves valid Google review URLs and generates a fallback search URL when blank', () => {
    expect(
      buildGoogleMapsReviewUrl('https://search.google.com/local/writereview?placeid=ChIJ123', 'PeakLine Roofing'),
    ).toBe('https://search.google.com/local/writereview?placeid=ChIJ123');

    expect(buildGoogleMapsReviewUrl('', 'PeakLine Roofing')).toBe(
      'https://www.google.com/maps/search/?api=1&query=PeakLine%20Roofing%20reviews',
    );
  });
});
