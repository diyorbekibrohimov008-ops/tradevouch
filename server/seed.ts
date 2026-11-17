import { buildCadenceSchedule, DEFAULT_CADENCE_STEPS } from '../shared/cadence.js';
import { draftOwnerReply, draftTradeReview } from '../shared/reviewAi.js';
import type { CadenceMessage, ReviewRequest } from '../shared/types.js';
import { hashPassword, makeId } from './auth.js';
import type { BusinessRecord, StoreAdapter } from './store.js';

export const DEMO_BUSINESS_SLUG = 'peakline-roofing';

export async function seedDemoData(store: StoreAdapter, originUrl = 'https://tradevouch.up.railway.app'): Promise<BusinessRecord> {
  await store.ensureReady();
  const existing = await store.getBusinessBySlug(DEMO_BUSINESS_SLUG);
  if (existing) {
    return existing;
  }

  const now = Date.now();
  const hoursAgo = (h: number) => new Date(now - h * 3600 * 1000).toISOString();

  const business: BusinessRecord = {
    id: 'biz_demo_peakline',
    slug: DEMO_BUSINESS_SLUG,
    name: 'PeakLine Roofing & Exteriors',
    trade: 'roofing',
    phone: '+1 (512) 555-0190',
    email: 'demo@peaklineroofing.com',
    googleMapsUrl: 'https://search.google.com/local/writereview?placeid=ChIJPeakLineDemoPlace',
    brandColor: '#EA580C',
    webhookKey: 'tv_demo_peakline_29',
    planTier: 'flat_29',
    competitorSwitchedFrom: 'nicejob',
    technicians: ['Marcus Vance', 'Elena Rostova', 'Devon Brooks', 'Carlos Mendez'],
    cadenceSteps: DEFAULT_CADENCE_STEPS,
    ownerPasswordHash: hashPassword('demo-tradevouch-29'),
    createdAt: hoursAgo(120),
  };

  await store.createBusiness(business);

  const req1Draft = draftTradeReview({
    businessName: business.name,
    trade: business.trade,
    techName: 'Marcus Vance',
    serviceType: 'Chimney Flashing & Leak Repair',
    rating: 5,
    inputMode: 'voice',
    rawTranscript:
      'Um, so like Marcus came out right on time for our roof leak, you know, fixed the flashing around the chimney and uh cleaned up every single nail from the driveway.',
    tone: 'warm',
  });

  const req2Draft = draftTradeReview({
    businessName: business.name,
    trade: business.trade,
    techName: 'Devon Brooks',
    serviceType: 'Standing Seam Metal Ridge Replacement',
    rating: 5,
    inputMode: 'questions',
    quickHighlights: ['On-time arrival', 'Clean job site', 'Clear upfront quote'],
    extraNote: 'Sent drone photos of the before and after right from the driveway.',
    tone: 'detailed',
  });

  const req3Draft = draftTradeReview({
    businessName: business.name,
    trade: business.trade,
    techName: 'Carlos Mendez',
    serviceType: 'Hail Storm Shingle & Gutter Inspection',
    rating: 5,
    inputMode: 'voice',
    rawTranscript:
      'Uh honestly Carlos saved us from filing a pointless claim, like showed us two lifted shingles and sealed them on the spot without pushing a full tear-off.',
    tone: 'warm',
  });

  const seedRequests: ReviewRequest[] = [
    {
      id: 'req_demo_1',
      token: 'rv_demo_sarah',
      businessId: business.id,
      customerName: 'Sarah Jenkins',
      customerPhone: '+1 (512) 555-0114',
      customerEmail: 'sarah.jenkins@example.com',
      techName: 'Marcus Vance',
      serviceType: 'Chimney Flashing & Leak Repair',
      jobAmount: 1450,
      crmSource: 'jobber',
      crmExternalId: 'job_4401',
      status: 'copied_to_google',
      rating: 5,
      inputMode: 'voice',
      rawTranscript:
        'Um, so like Marcus came out right on time for our roof leak, you know, fixed the flashing around the chimney and uh cleaned up every single nail from the driveway.',
      quickHighlights: ['On-time arrival', 'Spotless magnet sweep'],
      extraNote: '',
      draftedReview: req1Draft.draftText,
      tone: 'warm',
      fillersRemoved: req1Draft.fillersRemoved,
      ownerReply: draftOwnerReply({
        businessName: business.name,
        customerName: 'Sarah Jenkins',
        techName: 'Marcus Vance',
        serviceType: 'Chimney Flashing & Leak Repair',
        rating: 5,
        reviewText: req1Draft.draftText,
      }),
      privateFeedback: '',
      openedAt: hoursAgo(44),
      draftedAt: hoursAgo(44),
      copiedAt: hoursAgo(43),
      createdAt: hoursAgo(46),
    },
    {
      id: 'req_demo_2',
      token: 'rv_demo_david',
      businessId: business.id,
      customerName: 'David Alvarez',
      customerPhone: '+1 (512) 555-0148',
      customerEmail: 'david.alvarez@example.com',
      techName: 'Devon Brooks',
      serviceType: 'Standing Seam Metal Ridge Replacement',
      jobAmount: 2890,
      crmSource: 'housecall_pro',
      crmExternalId: 'hcp_9012',
      status: 'copied_to_google',
      rating: 5,
      inputMode: 'questions',
      rawTranscript: '',
      quickHighlights: ['On-time arrival', 'Clean job site', 'Clear upfront quote'],
      extraNote: 'Sent drone photos of the before and after right from the driveway.',
      draftedReview: req2Draft.draftText,
      tone: 'detailed',
      fillersRemoved: 0,
      ownerReply: '',
      privateFeedback: '',
      openedAt: hoursAgo(26),
      draftedAt: hoursAgo(25),
      copiedAt: hoursAgo(25),
      createdAt: hoursAgo(28),
    },
    {
      id: 'req_demo_3',
      token: 'rv_demo_claire',
      businessId: business.id,
      customerName: 'Claire Bennett',
      customerPhone: '+1 (512) 555-0162',
      customerEmail: 'claire.bennett@example.com',
      techName: 'Carlos Mendez',
      serviceType: 'Hail Storm Shingle & Gutter Inspection',
      jobAmount: 495,
      crmSource: 'servicetitan',
      crmExternalId: 'st_7721',
      status: 'drafted',
      rating: 5,
      inputMode: 'voice',
      rawTranscript:
        'Uh honestly Carlos saved us from filing a pointless claim, like showed us two lifted shingles and sealed them on the spot without pushing a full tear-off.',
      quickHighlights: ['Clear upfront quote'],
      extraNote: '',
      draftedReview: req3Draft.draftText,
      tone: 'warm',
      fillersRemoved: req3Draft.fillersRemoved,
      ownerReply: '',
      privateFeedback: '',
      openedAt: hoursAgo(8),
      draftedAt: hoursAgo(8),
      copiedAt: null,
      createdAt: hoursAgo(10),
    },
    {
      id: 'req_demo_4',
      token: 'rv_demo_okafor',
      businessId: business.id,
      customerName: 'Tom Okafor',
      customerPhone: '+1 (512) 555-0177',
      customerEmail: 'tom.okafor@example.com',
      techName: 'Marcus Vance',
      serviceType: 'Skylight Curb Reseal & Pipe Boot Swap',
      jobAmount: 875,
      crmSource: 'jobber',
      crmExternalId: 'job_4499',
      status: 'sent',
      rating: null,
      inputMode: null,
      rawTranscript: '',
      quickHighlights: [],
      extraNote: '',
      draftedReview: '',
      tone: 'warm',
      fillersRemoved: 0,
      ownerReply: '',
      privateFeedback: '',
      openedAt: null,
      draftedAt: null,
      copiedAt: null,
      createdAt: hoursAgo(3),
    },
    {
      id: 'req_demo_5',
      token: 'rv_demo_rachel',
      businessId: business.id,
      customerName: 'Rachel Kim',
      customerPhone: '+1 (512) 555-0155',
      customerEmail: 'rachel.kim@example.com',
      techName: 'Elena Rostova',
      serviceType: 'Soffit Vent & Fascia Trim Repair',
      jobAmount: 620,
      crmSource: 'manual',
      crmExternalId: null,
      status: 'private_feedback',
      rating: 3,
      inputMode: 'voice',
      rawTranscript:
        'Work on the fascia looks sturdy, though the crew left sawdust by the side gate.',
      quickHighlights: [],
      extraNote: '',
      draftedReview: '',
      tone: 'warm',
      fillersRemoved: 0,
      ownerReply: '',
      privateFeedback:
        'Work on the fascia looks sturdy, though the crew left sawdust by the side gate — would appreciate a quick blower pass.',
      openedAt: hoursAgo(16),
      draftedAt: null,
      copiedAt: null,
      createdAt: hoursAgo(18),
    },
  ];

  const allMessages: CadenceMessage[] = [];
  for (const req of seedRequests) {
    await store.createRequest(req);
    const schedule = buildCadenceSchedule(
      business.cadenceSteps,
      req,
      business.name,
      originUrl,
      new Date(req.createdAt),
    );
    for (const draft of schedule) {
      const suppressed =
        draft.status === 'scheduled' &&
        (req.status === 'drafted' ||
          req.status === 'copied_to_google' ||
          req.status === 'private_feedback');
      allMessages.push({
        id: makeId('msg'),
        requestId: req.id,
        businessId: business.id,
        stepNumber: draft.stepNumber,
        channel: draft.channel,
        delayHours: draft.delayHours,
        recipient: draft.recipient,
        body: draft.body,
        status: suppressed ? 'suppressed' : draft.status,
        scheduledFor: draft.scheduledFor,
        sentAt: draft.sentAt,
        providerId: draft.status === 'sent' ? `sim_${makeId('sms')}` : '',
        createdAt: req.createdAt,
      });
    }
  }
  await store.createMessages(allMessages);

  for (const req of seedRequests.filter((r) => r.crmExternalId)) {
    await store.createWebhookLog({
      id: makeId('wh'),
      businessId: business.id,
      provider: req.crmSource,
      externalId: req.crmExternalId!,
      customerName: req.customerName,
      serviceType: req.serviceType,
      status: 'processed',
      createdAt: req.createdAt,
    });
  }

  return business;
}
