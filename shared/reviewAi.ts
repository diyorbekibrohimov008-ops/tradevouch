import type { ReviewInputMode, ReviewTone, TradeKind } from './types.js';

export interface DraftReviewInput {
  businessName: string;
  trade: TradeKind;
  techName: string;
  serviceType: string;
  customerName?: string;
  rating?: number;
  inputMode: ReviewInputMode;
  rawTranscript?: string;
  quickHighlights?: string[];
  extraNote?: string;
  tone: ReviewTone;
  variantSeed?: number;
}

export interface DraftReviewResult {
  draftText: string;
  cleanedTranscript: string;
  fillersRemoved: number;
  suggestPrivateResolution: boolean;
  usedAiProvider: 'openai' | 'local';
}

export const TRADE_LABELS: Record<TradeKind, string> = {
  roofing: 'Roofing & Exteriors',
  plumbing: 'Plumbing & Drain',
  detailing: 'Auto Detailing',
  hvac: 'HVAC & Mechanical',
  electrical: 'Electrical',
  landscaping: 'Lawn & Tree Care',
};

export const TRADE_HIGHLIGHT_CHIPS: Record<TradeKind, string[]> = {
  roofing: [
    'On-time arrival',
    'Clean job site',
    'Clear upfront quote',
    'Spotless magnet sweep',
    'Solved leak fast',
  ],
  plumbing: [
    'On-time arrival',
    'Clean workspace',
    'Clear upfront pricing',
    'Fixed right first time',
    'Respectful crew',
  ],
  detailing: [
    'Spotless finish',
    'On-time arrival',
    'Respectful crew',
    'Like-new interior',
    'Clear upfront pricing',
  ],
  hvac: [
    'On-time arrival',
    'Clear upfront pricing',
    'Fixed right first time',
    'Clean workspace',
    'Explained options clearly',
  ],
  electrical: [
    'On-time arrival',
    'Neat panel work',
    'Clear upfront pricing',
    'Code-compliant fix',
    'Respectful crew',
  ],
  landscaping: [
    'On-time arrival',
    'Clean yard cleanup',
    'Clear upfront quote',
    'Respectful crew',
    'Great attention to detail',
  ],
};

export const TECH_SHOUTOUT_CHIPS = [
  'Explained options clearly',
  'Went above & beyond',
  'Friendly & polite',
  'Fair pricing',
  'Would hire again',
];

export const SAMPLE_VOICE_CLIPS: Record<
  TradeKind,
  { techName: string; serviceType: string; transcript: string; durationSec: number }
> = {
  roofing: {
    techName: 'Marcus Vance',
    serviceType: 'Chimney Flashing & Leak Repair',
    transcript:
      'Um, so like Marcus came out right on time for our roof leak, you know, fixed the flashing around the chimney and uh cleaned up every single nail from the driveway.',
    durationSec: 11,
  },
  plumbing: {
    techName: 'Elena Rostova',
    serviceType: 'Tankless Water Heater & Shutoff Valve',
    transcript:
      'Uh yeah, Elena was honestly awesome. She showed up early, like explained what went wrong with the valve, gave us the exact price upfront, and left our laundry room spotless.',
    durationSec: 10,
  },
  detailing: {
    techName: 'Devon Brooks',
    serviceType: 'Ceramic Coating & Interior Reset',
    transcript:
      'So, um, Devon basically made our five-year-old SUV look brand new again, you know? Got coffee stains out of the seats and the ceramic shine is crazy.',
    durationSec: 9,
  },
  hvac: {
    techName: 'Carlos Mendez',
    serviceType: 'AC Capacitor & Coil Tune-Up',
    transcript:
      'Our AC died at 90 degrees and uh Carlos was here in two hours. Literally zero pushy upsells, just got cool air running fast.',
    durationSec: 10,
  },
  electrical: {
    techName: 'Priya Nair',
    serviceType: 'EV Charger 240V Panel Install',
    transcript:
      'Um, Priya labeled the whole breaker box clearly and, like, walked me through how to use the charger before she packed up.',
    durationSec: 9,
  },
  landscaping: {
    techName: 'Samir Patel',
    serviceType: 'Storm Limb Removal & Grading',
    transcript:
      'Samir and his crew hauled away two massive fallen oak limbs, uh, didn’t tear up the lawn at all, and blew off the whole patio.',
    durationSec: 10,
  },
};

const FILLER_REGEXES: RegExp[] = [
  /\b(um+|uh+|er+|ah+|hmm+)\b/gi,
  /\byou know\b/gi,
  /\bbasically\b/gi,
  /\bliterally\b/gi,
  /\bhonestly\b/gi,
  /\bkind of\b/gi,
  /\bsort of\b/gi,
  /\bi mean\b/gi,
  /(?:^|\s)like(?=,|\s+(?:the|a|an|he|she|they|we|our|it|explained|fixed|cleaned|showed|gave|got|marcus|elena|devon))/gi,
];

const HIGHLIGHT_PHRASES: Record<string, string> = {
  'on-time arrival': 'arrived right on time',
  'clean job site': 'left the entire job site spotless',
  'clean workspace': 'left our workspace spotless',
  'spotless magnet sweep': 'ran a thorough magnet sweep so nothing was left behind',
  'clear upfront quote': 'gave a clear upfront quote with zero surprises',
  'clear upfront pricing': 'gave clear upfront pricing with zero surprises',
  'fixed right first time': 'diagnosed and fixed the issue right the first time',
  'solved leak fast': 'tracked down and solved the leak quickly',
  'spotless finish': 'delivered a showroom-quality finish',
  'like-new interior': 'made the interior look brand new again',
  'respectful crew': 'worked respectfully around our home',
  'explained options clearly': 'explained every option clearly without pressure',
  'went above & beyond': 'went above and beyond from start to finish',
  'friendly & polite': 'was friendly, patient, and easy to work with',
  'fair pricing': 'kept pricing fair and transparent',
  'would hire again': 'is someone we will definitely call again',
  'neat panel work': 'did super neat, organized panel work',
  'code-compliant fix': 'completed a clean, code-compliant repair',
  'clean yard cleanup': 'left the yard cleaner than they found it',
  'great attention to detail': 'showed great attention to detail',
};

export function cleanSpokenTranscript(raw: string): {
  cleaned: string;
  fillersRemoved: number;
} {
  if (!raw.trim()) {
    return { cleaned: '', fillersRemoved: 0 };
  }

  let fillersRemoved = 0;
  let working = raw;

  for (const regex of FILLER_REGEXES) {
    working = working.replace(regex, (match) => {
      fillersRemoved += 1;
      return match.startsWith(' ') ? ' ' : '';
    });
  }

  working = working
    .replace(/\bso,\s*/gi, '')
    .replace(/\s*,\s*,+/g, ', ')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.!?])/g, '$1')
    .replace(/,\s*\?/g, '?')
    .replace(/^[\s,;:.-]+/, '')
    .replace(/^(?:and|so|yeah|well|okay|ok)\b[\s,]*/i, '')
    .replace(/^[\s,;:.-]+/, '')
    .trim();

  if (working.length > 0) {
    working = working.charAt(0).toUpperCase() + working.slice(1);
    if (!/[.!?]$/.test(working)) {
      working += '.';
    }
  }

  return { cleaned: working, fillersRemoved };
}

function joinNaturalList(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

function mapHighlightsToClauses(highlights: string[]): string[] {
  return highlights
    .map((h) => h.trim())
    .filter(Boolean)
    .map((h) => HIGHLIGHT_PHRASES[h.toLowerCase()] ?? h.toLowerCase());
}

function ensureTechMention(text: string, techName: string): boolean {
  const firstName = techName.trim().split(/\s+/)[0] ?? '';
  if (!firstName) return true;
  return text.toLowerCase().includes(firstName.toLowerCase());
}

export function draftTradeReview(input: DraftReviewInput): DraftReviewResult {
  const rating = input.rating ?? 5;
  const business = input.businessName.trim() || 'the crew';
  const tech = input.techName.trim() || 'the technician';
  const service = input.serviceType.trim() || 'the service call';
  const { cleaned, fillersRemoved } = cleanSpokenTranscript(input.rawTranscript ?? '');
  const highlightClauses = mapHighlightsToClauses(input.quickHighlights ?? []);
  const extraNote = (input.extraNote ?? '').trim();
  const meaningfulWords = cleaned
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const hasRichTranscript = meaningfulWords.length >= 4 && cleaned.length >= 16;

  if (rating <= 3) {
    const coreObservation = hasRichTranscript
      ? cleaned
      : extraNote || `Our ${service} was completed by ${tech} with ${business}.`;
    const honestText =
      input.tone === 'short'
        ? `${coreObservation} Sharing candid feedback so ${business} can follow up.`
        : `We hired ${business} for ${service} with ${tech}. ${coreObservation} Appreciate the team reviewing this feedback directly.`;

    return {
      draftText: honestText.replace(/\s{2,}/g, ' ').trim(),
      cleanedTranscript: cleaned,
      fillersRemoved,
      suggestPrivateResolution: true,
      usedAiProvider: 'local',
    };
  }

  const techMentionedInVoice = hasRichTranscript && ensureTechMention(cleaned, tech);
  const serviceMentionedInVoice =
    hasRichTranscript &&
    service
      .toLowerCase()
      .split(/\s+/)
      .some((w) => w.length > 3 && cleaned.toLowerCase().includes(w));

  if (input.tone === 'short') {
    const body = hasRichTranscript
      ? `${techMentionedInVoice ? '' : `${tech} did a great job on our ${service}. `}${cleaned}`
      : `${tech} from ${business} did outstanding work on our ${service}${
          highlightClauses.length > 0 ? ` — ${joinNaturalList(highlightClauses.slice(0, 2))}` : ''
        }.`;
    const extra = extraNote ? ` ${extraNote.replace(/[.!?]+$/, '')}.` : '';
    const closing = body.toLowerCase().includes(business.toLowerCase())
      ? ' Highly recommend!'
      : ` Highly recommend ${business}!`;
    return {
      draftText: `${body}${extra}${closing}`.replace(/\s{2,}/g, ' ').trim(),
      cleanedTranscript: cleaned,
      fillersRemoved,
      suggestPrivateResolution: false,
      usedAiProvider: 'local',
    };
  }

  if (input.tone === 'detailed') {
    const opener = `I couldn't be happier with ${business} for our ${service}.`;
    const techLead = techMentionedInVoice
      ? cleaned
      : `${tech} handled the job with real professionalism${
          hasRichTranscript ? ` — ${cleaned.charAt(0).toLowerCase()}${cleaned.slice(1)}` : '.'
        }`;
    const highlightsSentence =
      highlightClauses.length > 0
        ? ` What stood out most was that ${tech.split(' ')[0]} ${joinNaturalList(highlightClauses)}.`
        : '';
    const noteSentence = extraNote
      ? ` ${extraNote.endsWith('.') ? extraNote : `${extraNote}.`}`
      : '';
    const closer = ` If you're looking for a reliable crew that communicates clearly and respects your property, ask for ${tech} at ${business}.`;

    return {
      draftText: `${opener} ${techLead}${highlightsSentence}${noteSentence}${closer}`
        .replace(/\s{2,}/g, ' ')
        .trim(),
      cleanedTranscript: cleaned,
      fillersRemoved,
      suggestPrivateResolution: false,
      usedAiProvider: 'local',
    };
  }

  // Default: 'warm'
  const sentences: string[] = [];
  if (hasRichTranscript) {
    if (!techMentionedInVoice || !serviceMentionedInVoice) {
      sentences.push(`Great experience with ${business} on our ${service} — ${tech} was top-notch.`);
    } else {
      sentences.push(`Had a great experience with ${business} on our ${service}.`);
    }
    sentences.push(cleaned);
  } else {
    const highlightText =
      highlightClauses.length > 0
        ? ` ${tech} ${joinNaturalList(highlightClauses)}.`
        : ` ${tech} was punctual, thorough, and easy to work with.`;
    sentences.push(`Called ${business} for ${service} and couldn't be happier with the result.${highlightText}`);
  }

  if (extraNote) {
    sentences.push(extraNote.endsWith('.') || extraNote.endsWith('!') ? extraNote : `${extraNote}.`);
  }

  if (highlightClauses.length > 0 && hasRichTranscript) {
    sentences.push(`Really appreciated that the team ${joinNaturalList(highlightClauses.slice(0, 2))}.`);
  }

  sentences.push(`Would happily recommend ${business} and ${tech} to neighbors!`);

  return {
    draftText: sentences.join(' ').replace(/\s{2,}/g, ' ').trim(),
    cleanedTranscript: cleaned,
    fillersRemoved,
    suggestPrivateResolution: false,
    usedAiProvider: 'local',
  };
}

export function draftOwnerReply(input: {
  businessName: string;
  customerName: string;
  techName: string;
  serviceType: string;
  rating: number;
  reviewText: string;
}): string {
  const firstName = input.customerName.trim().split(/\s+/)[0] || 'there';
  const techFirst = input.techName.trim().split(/\s+/)[0] || 'our technician';

  if (input.rating <= 3) {
    return `Hi ${firstName}, thank you for taking the time to share honest feedback about your ${input.serviceType}. This isn't the standard we hold ourselves to at ${input.businessName}. Our owner is reviewing this with ${techFirst} today—please call our office directly so we can make it right.`;
  }

  return `Thank you so much, ${firstName}! We're thrilled ${techFirst} took great care of your ${input.serviceType} and made the process easy. We'll share your kind words with ${techFirst} and the rest of the ${input.businessName} crew today. Appreciate you trusting us with your home!`;
}

export function buildGoogleMapsReviewUrl(rawUrl: string, businessName: string): string {
  const trimmed = rawUrl.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  const query = encodeURIComponent(`${businessName.trim() || 'local trade'} reviews`);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}
