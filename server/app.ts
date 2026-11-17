import { Hono } from 'hono';
import { z } from 'zod';
import {
  buildCadenceSchedule,
  DEFAULT_CADENCE_STEPS,
  shouldSuppressFollowup,
} from '../shared/cadence.js';
import {
  CrmValidationError,
  normalizeCrmWebhook,
  parseJobsCsv,
  type NormalizedCrmJob,
} from '../shared/crm.js';
import { buildGoogleMapsReviewUrl } from '../shared/reviewAi.js';
import type {
  BusinessProfile,
  CadenceMessage,
  CrmProvider,
  PublicCollectorContext,
  ReviewRequest,
  StudioMetrics,
  StudioSnapshot,
  TechLeaderboardEntry,
} from '../shared/types.js';
import { generateOwnerReplyText, generateReviewDraft } from './aiClient.js';
import { hashPassword, makeId, slugify, verifyPassword } from './auth.js';
import { DEMO_BUSINESS_SLUG, seedDemoData } from './seed.js';
import type { BusinessRecord, StoreAdapter } from './store.js';

export interface AppOptions {
  openAiKey?: string;
  renderSpaHtml?: () => string | Response;
}

const registerSchema = z.object({
  businessName: z.string().min(2).max(90),
  trade: z
    .enum(['roofing', 'plumbing', 'detailing', 'hvac', 'electrical', 'landscaping'])
    .default('roofing'),
  email: z.string().email(),
  password: z.string().min(6).max(120),
  phone: z.string().optional().default(''),
  googleMapsUrl: z.string().optional().default(''),
  competitorSwitchedFrom: z.enum(['nicejob', 'birdeye', 'none']).optional().default('nicejob'),
  technicians: z.array(z.string().min(1)).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const createRequestSchema = z.object({
  customerName: z.string().min(1),
  customerPhone: z.string().optional().default(''),
  customerEmail: z.string().optional().default(''),
  techName: z.string().min(1).default('Lead Technician'),
  serviceType: z.string().min(1).default('Service Visit'),
  jobAmount: z.number().nonnegative().optional().default(0),
});

const updateBusinessSchema = z.object({
  name: z.string().min(2).max(90).optional(),
  trade: z
    .enum(['roofing', 'plumbing', 'detailing', 'hvac', 'electrical', 'landscaping'])
    .optional(),
  phone: z.string().optional(),
  googleMapsUrl: z.string().optional(),
  brandColor: z.string().optional(),
  planTier: z.enum(['trial', 'flat_29']).optional(),
  competitorSwitchedFrom: z.enum(['nicejob', 'birdeye', 'none']).optional(),
  technicians: z.array(z.string().min(1)).optional(),
  cadenceSteps: z
    .array(
      z.object({
        stepNumber: z.number().int().positive(),
        channel: z.enum(['sms', 'email']),
        delayHours: z.number().nonnegative(),
        enabled: z.boolean(),
        template: z.string().min(5),
      }),
    )
    .optional(),
});

const draftInputSchema = z.object({
  rating: z.number().int().min(1).max(5).optional().default(5),
  inputMode: z.enum(['voice', 'questions']).default('voice'),
  rawTranscript: z.string().optional().default(''),
  quickHighlights: z.array(z.string()).optional().default([]),
  extraNote: z.string().optional().default(''),
  tone: z.enum(['warm', 'short', 'detailed']).default('warm'),
});

const trackSchema = z.object({
  action: z.enum(['copied_to_google', 'private_feedback']),
  draftedReview: z.string().optional(),
  privateFeedback: z.string().optional(),
  rating: z.number().int().min(1).max(5).optional(),
});

function sanitizeBusiness(record: BusinessRecord): BusinessProfile {
  const { ownerPasswordHash: _omitted, ...profile } = record;
  return profile;
}

function getOriginFromReq(reqUrl: string): string {
  try {
    const parsed = new URL(reqUrl);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return 'https://tradevouch.up.railway.app';
  }
}

function computeMetrics(requests: ReviewRequest[]): StudioMetrics {
  const totalRequests = requests.length;
  const sentCount = requests.filter((r) => r.status !== 'queued').length;
  const openedCount = requests.filter((r) => r.openedAt !== null).length;
  const draftedCount = requests.filter((r) => Boolean(r.draftedReview)).length;
  const copiedToGoogleCount = requests.filter((r) => r.status === 'copied_to_google').length;
  const privateFeedbackCount = requests.filter((r) => r.status === 'private_feedback').length;
  const voiceInputCount = requests.filter((r) => r.inputMode === 'voice').length;
  const questionsInputCount = requests.filter((r) => r.inputMode === 'questions').length;
  const conversionRatePct =
    totalRequests > 0 ? Math.round((copiedToGoogleCount / totalRequests) * 100) : 0;

  return {
    totalRequests,
    sentCount,
    openedCount,
    draftedCount,
    copiedToGoogleCount,
    privateFeedbackCount,
    voiceInputCount,
    questionsInputCount,
    conversionRatePct,
    monthlyPrice: 29,
    annualSavingsVsNiceJob: (100 - 29) * 12,
    annualSavingsVsBirdeye: (250 - 29) * 12,
  };
}

function computeLeaderboard(requests: ReviewRequest[]): TechLeaderboardEntry[] {
  const map = new Map<string, { jobsSent: number; reviewsCopied: number; ratings: number[] }>();
  for (const r of requests) {
    const key = r.techName.trim() || 'Lead Technician';
    const entry = map.get(key) ?? { jobsSent: 0, reviewsCopied: 0, ratings: [] };
    entry.jobsSent += 1;
    if (r.status === 'copied_to_google') entry.reviewsCopied += 1;
    if (r.rating !== null) entry.ratings.push(r.rating);
    map.set(key, entry);
  }
  return Array.from(map.entries())
    .map(([techName, v]) => ({
      techName,
      jobsSent: v.jobsSent,
      reviewsCopied: v.reviewsCopied,
      avgRating:
        v.ratings.length > 0
          ? Math.round((v.ratings.reduce((a, b) => a + b, 0) / v.ratings.length) * 10) / 10
          : 5.0,
    }))
    .sort((a, b) => b.reviewsCopied - a.reviewsCopied || b.jobsSent - a.jobsSent);
}

async function buildSnapshot(
  store: StoreAdapter,
  business: BusinessRecord,
): Promise<StudioSnapshot> {
  const [requests, messages, webhookLogs] = await Promise.all([
    store.listRequestsByBusiness(business.id),
    store.listMessagesByBusiness(business.id),
    store.listWebhookLogsByBusiness(business.id),
  ]);
  return {
    business: sanitizeBusiness(business),
    isDemo: business.slug === DEMO_BUSINESS_SLUG,
    requests,
    messages,
    webhookLogs,
    metrics: computeMetrics(requests),
    techLeaderboard: computeLeaderboard(requests),
  };
}

async function enrollJobInCadence(
  store: StoreAdapter,
  business: BusinessRecord,
  job: NormalizedCrmJob,
  originUrl: string,
): Promise<{ request: ReviewRequest; messages: CadenceMessage[] }> {
  const nowIso = new Date().toISOString();
  const token = `rv_${makeId('t').slice(2, 12)}`;
  const req: ReviewRequest = {
    id: makeId('req'),
    token,
    businessId: business.id,
    customerName: job.customerName,
    customerPhone: job.customerPhone,
    customerEmail: job.customerEmail,
    techName: job.techName,
    serviceType: job.serviceType,
    jobAmount: job.jobAmount,
    crmSource: job.crmSource,
    crmExternalId: job.crmExternalId || null,
    status: job.customerPhone || job.customerEmail ? 'sent' : 'queued',
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
    createdAt: nowIso,
  };

  await store.createRequest(req);

  const drafts = buildCadenceSchedule(
    business.cadenceSteps,
    req,
    business.name,
    originUrl,
    new Date(nowIso),
  );
  const messages: CadenceMessage[] = drafts.map((d) => ({
    id: makeId('msg'),
    requestId: req.id,
    businessId: business.id,
    stepNumber: d.stepNumber,
    channel: d.channel,
    delayHours: d.delayHours,
    recipient: d.recipient,
    body: d.body,
    status: d.status,
    scheduledFor: d.scheduledFor,
    sentAt: d.sentAt,
    providerId: d.status === 'sent' ? `sim_${makeId('sms')}` : '',
    createdAt: nowIso,
  }));

  if (messages.length > 0) {
    await store.createMessages(messages);
  }
  return { request: req, messages };
}

export function createApp(store: StoreAdapter, options: AppOptions = {}): Hono {
  const app = new Hono();

  async function resolveStudioBusiness(c: {
    req: {
      header: (name: string) => string | undefined;
      query: (name: string) => string | undefined;
      url: string;
    };
  }): Promise<{ business: BusinessRecord | null }> {
    const authHeader = c.req.header('authorization') ?? '';
    if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim();
      if (!token) return { business: null };
      const session = await store.getSession(token);
      if (!session) return { business: null };
      const biz = await store.getBusinessById(session.businessId);
      return { business: biz };
    }

    const demoParam = c.req.query('demo');
    const demoHeader = c.req.header('x-demo-mode');
    if (demoParam === '1' || demoHeader === 'true') {
      const demoBiz = await seedDemoData(store, getOriginFromReq(c.req.url));
      return { business: demoBiz };
    }

    return { business: null };
  }

  app.get('/api/health', async (c) => {
    await store.ensureReady();
    return c.json({
      ok: true,
      service: 'tradevouch',
      storage: store.storageKind,
      aiMode: options.openAiKey ? 'openai' : 'local',
    });
  });

  app.get('/api/demo', async (c) => {
    const demoBiz = await seedDemoData(store, getOriginFromReq(c.req.url));
    const snapshot = await buildSnapshot(store, demoBiz);
    return c.json(snapshot);
  });

  app.post('/api/auth/register', async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid registration data.' }, 400);
    }

    await store.ensureReady();
    const existingEmail = await store.getBusinessByEmail(parsed.data.email);
    if (existingEmail) {
      return c.json({ error: 'An account with this email already exists.' }, 409);
    }

    let slug = slugify(parsed.data.businessName);
    if (await store.getBusinessBySlug(slug)) {
      slug = `${slug}-${makeId('s').slice(2, 6)}`;
    }

    const nowIso = new Date().toISOString();
    const business: BusinessRecord = {
      id: makeId('biz'),
      slug,
      name: parsed.data.businessName.trim(),
      trade: parsed.data.trade,
      phone: parsed.data.phone.trim(),
      email: parsed.data.email.trim().toLowerCase(),
      googleMapsUrl: parsed.data.googleMapsUrl.trim(),
      brandColor: '#EA580C',
      webhookKey: makeId('tv_wh'),
      planTier: 'flat_29',
      competitorSwitchedFrom: parsed.data.competitorSwitchedFrom,
      technicians:
        parsed.data.technicians && parsed.data.technicians.length > 0
          ? parsed.data.technicians
          : ['Lead Technician'],
      cadenceSteps: DEFAULT_CADENCE_STEPS,
      ownerPasswordHash: hashPassword(parsed.data.password),
      createdAt: nowIso,
    };

    await store.createBusiness(business);

    const sessionToken = makeId('sess');
    await store.createSession({
      token: sessionToken,
      businessId: business.id,
      email: business.email,
      createdAt: nowIso,
      expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
    });

    return c.json({ token: sessionToken, business: sanitizeBusiness(business) }, 201);
  });

  app.post('/api/auth/login', async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Valid email and password are required.' }, 400);
    }

    const biz = await store.getBusinessByEmail(parsed.data.email);
    if (!biz || !verifyPassword(parsed.data.password, biz.ownerPasswordHash)) {
      return c.json({ error: 'Invalid email or password.' }, 401);
    }

    const sessionToken = makeId('sess');
    const nowIso = new Date().toISOString();
    await store.createSession({
      token: sessionToken,
      businessId: biz.id,
      email: biz.email,
      createdAt: nowIso,
      expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
    });

    return c.json({ token: sessionToken, business: sanitizeBusiness(biz) });
  });

  app.get('/api/auth/me', async (c) => {
    const { business } = await resolveStudioBusiness(c);
    if (!business) return c.json({ error: 'Unauthorized' }, 401);
    return c.json({ business: sanitizeBusiness(business) });
  });

  app.get('/api/studio/snapshot', async (c) => {
    const { business } = await resolveStudioBusiness(c);
    if (!business) return c.json({ error: 'Unauthorized' }, 401);
    return c.json(await buildSnapshot(store, business));
  });

  app.patch('/api/studio/business', async (c) => {
    const { business } = await resolveStudioBusiness(c);
    if (!business) return c.json({ error: 'Unauthorized' }, 401);

    const body = await c.req.json().catch(() => null);
    const parsed = updateBusinessSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid update payload.' }, 400);
    }

    const updated = await store.updateBusiness(business.id, parsed.data);
    if (!updated) return c.json({ error: 'Business not found.' }, 404);
    return c.json(await buildSnapshot(store, updated));
  });

  app.post('/api/studio/requests', async (c) => {
    const { business } = await resolveStudioBusiness(c);
    if (!business) return c.json({ error: 'Unauthorized' }, 401);

    const body = await c.req.json().catch(() => null);
    const parsed = createRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid job request.' }, 400);
    }

    if (!parsed.data.customerPhone.trim() && !parsed.data.customerEmail.trim()) {
      return c.json({ error: 'Provide either customer phone or email to send review link.' }, 400);
    }

    const result = await enrollJobInCadence(
      store,
      business,
      {
        crmSource: 'manual',
        crmExternalId: makeId('man'),
        customerName: parsed.data.customerName.trim(),
        customerPhone: parsed.data.customerPhone.trim(),
        customerEmail: parsed.data.customerEmail.trim(),
        techName: parsed.data.techName.trim(),
        serviceType: parsed.data.serviceType.trim(),
        jobAmount: parsed.data.jobAmount,
      },
      getOriginFromReq(c.req.url),
    );

    return c.json(result, 201);
  });

  app.post('/api/studio/import-csv', async (c) => {
    const { business } = await resolveStudioBusiness(c);
    if (!business) return c.json({ error: 'Unauthorized' }, 401);

    const body = (await c.req.json().catch(() => null)) as { csvText?: string } | null;
    if (!body?.csvText || typeof body.csvText !== 'string') {
      return c.json({ error: 'csvText string is required.' }, 400);
    }

    try {
      const rows = parseJobsCsv(body.csvText);
      const origin = getOriginFromReq(c.req.url);
      const created: ReviewRequest[] = [];
      for (const job of rows) {
        const res = await enrollJobInCadence(store, business, job, origin);
        created.push(res.request);
      }
      return c.json({ importedCount: created.length, requests: created }, 201);
    } catch (err) {
      if (err instanceof CrmValidationError) {
        return c.json({ error: err.message }, 400);
      }
      throw err;
    }
  });

  app.post('/api/studio/requests/:id/owner-reply', async (c) => {
    const { business } = await resolveStudioBusiness(c);
    if (!business) return c.json({ error: 'Unauthorized' }, 401);

    const reqId = c.req.param('id');
    const reviewReq = await store.getRequestById(reqId);
    if (!reviewReq || reviewReq.businessId !== business.id) {
      return c.json({ error: 'Review request not found.' }, 404);
    }

    const body = (await c.req.json().catch(() => ({}))) as { customReply?: string };
    const replyText =
      body.customReply?.trim() ||
      (await generateOwnerReplyText(
        {
          businessName: business.name,
          customerName: reviewReq.customerName,
          techName: reviewReq.techName,
          serviceType: reviewReq.serviceType,
          rating: reviewReq.rating ?? 5,
          reviewText: reviewReq.draftedReview || reviewReq.privateFeedback || reviewReq.serviceType,
        },
        options.openAiKey,
      ));

    const updated = await store.updateRequest(reqId, { ownerReply: replyText });
    return c.json({ ownerReply: replyText, request: updated });
  });

  app.post('/api/studio/cadence/dispatch', async (c) => {
    const { business } = await resolveStudioBusiness(c);
    if (!business) return c.json({ error: 'Unauthorized' }, 401);

    const [requests, messages] = await Promise.all([
      store.listRequestsByBusiness(business.id),
      store.listMessagesByBusiness(business.id),
    ]);
    const reqMap = new Map(requests.map((r) => [r.id, r]));

    let dispatchedCount = 0;
    let suppressedCount = 0;
    const nowIso = new Date().toISOString();

    for (const msg of messages) {
      if (msg.status !== 'scheduled') continue;
      const parent = reqMap.get(msg.requestId);
      if (!parent || shouldSuppressFollowup(parent.status)) {
        await store.updateMessage(msg.id, { status: 'suppressed' });
        suppressedCount += 1;
      } else {
        await store.updateMessage(msg.id, {
          status: 'sent',
          sentAt: nowIso,
          providerId: `sim_${makeId('sms')}`,
        });
        dispatchedCount += 1;
      }
    }

    return c.json({
      dispatchedCount,
      suppressedCount,
      messages: await store.listMessagesByBusiness(business.id),
    });
  });

  app.post('/api/webhooks/crm/:provider', async (c) => {
    const providerParam = c.req.param('provider') as CrmProvider;
    if (!['jobber', 'housecall_pro', 'servicetitan'].includes(providerParam)) {
      return c.json({ error: `Unsupported CRM provider "${providerParam}".` }, 400);
    }

    const bizSlug = c.req.query('biz') ?? '';
    const key = c.req.query('key') ?? c.req.header('x-tradevouch-key') ?? '';
    if (!bizSlug) {
      return c.json({ error: 'Query param ?biz=<slug> is required.' }, 400);
    }

    await seedDemoData(store, getOriginFromReq(c.req.url));
    const business = await store.getBusinessBySlug(bizSlug);
    if (!business) {
      return c.json({ error: 'Business workspace not found.' }, 404);
    }
    if (!key || key !== business.webhookKey) {
      return c.json({ error: 'Invalid webhook key.' }, 401);
    }

    const payload = await c.req.json().catch(() => null);
    let normalized: NormalizedCrmJob;
    try {
      normalized = normalizeCrmWebhook(providerParam, payload);
    } catch (err) {
      if (err instanceof CrmValidationError) {
        await store.createWebhookLog({
          id: makeId('wh'),
          businessId: business.id,
          provider: providerParam,
          externalId: 'invalid',
          customerName: 'Unknown',
          serviceType: 'Invalid payload',
          status: 'error',
          createdAt: new Date().toISOString(),
        });
        return c.json({ error: err.message }, 400);
      }
      throw err;
    }

    const existing = await store.findRequestByExternalId(
      business.id,
      normalized.crmSource,
      normalized.crmExternalId,
    );
    if (existing) {
      await store.createWebhookLog({
        id: makeId('wh'),
        businessId: business.id,
        provider: providerParam,
        externalId: normalized.crmExternalId,
        customerName: normalized.customerName,
        serviceType: normalized.serviceType,
        status: 'duplicate',
        createdAt: new Date().toISOString(),
      });
      return c.json({
        duplicate: true,
        request: existing,
        reviewUrl: `${getOriginFromReq(c.req.url)}/r/${existing.token}`,
      });
    }

    const enrolled = await enrollJobInCadence(
      store,
      business,
      normalized,
      getOriginFromReq(c.req.url),
    );
    await store.createWebhookLog({
      id: makeId('wh'),
      businessId: business.id,
      provider: providerParam,
      externalId: normalized.crmExternalId,
      customerName: normalized.customerName,
      serviceType: normalized.serviceType,
      status: 'processed',
      createdAt: new Date().toISOString(),
    });

    return c.json(
      {
        duplicate: false,
        request: enrolled.request,
        messages: enrolled.messages,
        reviewUrl: `${getOriginFromReq(c.req.url)}/r/${enrolled.request.token}`,
      },
      201,
    );
  });

  app.post('/api/ai/draft-review', async (c) => {
    const body = await c.req.json().catch(() => null);
    const schema = draftInputSchema.extend({
      businessName: z.string().min(1),
      trade: z
        .enum(['roofing', 'plumbing', 'detailing', 'hvac', 'electrical', 'landscaping'])
        .default('roofing'),
      techName: z.string().min(1),
      serviceType: z.string().min(1),
      customerName: z.string().optional(),
    });
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Invalid AI draft input.' }, 400);
    }
    const draft = await generateReviewDraft(parsed.data, options.openAiKey);
    return c.json(draft);
  });

  app.get('/api/r/:token', async (c) => {
    await seedDemoData(store, getOriginFromReq(c.req.url));
    const token = c.req.param('token');
    let reviewReq = await store.getRequestByToken(token);
    if (!reviewReq) return c.json({ error: 'Review link not found.' }, 404);

    const business = await store.getBusinessById(reviewReq.businessId);
    if (!business) return c.json({ error: 'Business not found.' }, 404);

    if (!reviewReq.openedAt) {
      const nowIso = new Date().toISOString();
      const nextStatus =
        reviewReq.status === 'queued' || reviewReq.status === 'sent'
          ? 'opened'
          : reviewReq.status;
      reviewReq =
        (await store.updateRequest(reviewReq.id, {
          openedAt: nowIso,
          status: nextStatus,
        })) ?? reviewReq;
    }

    const payload: PublicCollectorContext = {
      token: reviewReq.token,
      status: reviewReq.status,
      business: {
        name: business.name,
        slug: business.slug,
        trade: business.trade,
        googleMapsUrl: buildGoogleMapsReviewUrl(business.googleMapsUrl, business.name),
        brandColor: business.brandColor,
        phone: business.phone,
      },
      customerName: reviewReq.customerName,
      techName: reviewReq.techName,
      serviceType: reviewReq.serviceType,
      rating: reviewReq.rating,
      inputMode: reviewReq.inputMode,
      rawTranscript: reviewReq.rawTranscript,
      quickHighlights: reviewReq.quickHighlights,
      extraNote: reviewReq.extraNote,
      draftedReview: reviewReq.draftedReview,
      tone: reviewReq.tone,
      fillersRemoved: reviewReq.fillersRemoved,
      privateFeedback: reviewReq.privateFeedback,
    };

    return c.json(payload);
  });

  app.post('/api/r/:token/draft', async (c) => {
    await seedDemoData(store, getOriginFromReq(c.req.url));
    const token = c.req.param('token');
    const reviewReq = await store.getRequestByToken(token);
    if (!reviewReq) return c.json({ error: 'Review link not found.' }, 404);

    const business = await store.getBusinessById(reviewReq.businessId);
    if (!business) return c.json({ error: 'Business not found.' }, 404);

    const body = await c.req.json().catch(() => null);
    const parsed = draftInputSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Invalid voice or question payload.' }, 400);
    }

    const draft = await generateReviewDraft(
      {
        businessName: business.name,
        trade: business.trade,
        techName: reviewReq.techName,
        serviceType: reviewReq.serviceType,
        customerName: reviewReq.customerName,
        rating: parsed.data.rating,
        inputMode: parsed.data.inputMode,
        rawTranscript: parsed.data.rawTranscript,
        quickHighlights: parsed.data.quickHighlights,
        extraNote: parsed.data.extraNote,
        tone: parsed.data.tone,
      },
      options.openAiKey,
    );

    const nowIso = new Date().toISOString();
    const updated = await store.updateRequest(reviewReq.id, {
      rating: parsed.data.rating,
      inputMode: parsed.data.inputMode,
      rawTranscript: parsed.data.rawTranscript,
      quickHighlights: parsed.data.quickHighlights,
      extraNote: parsed.data.extraNote,
      draftedReview: draft.draftText,
      tone: parsed.data.tone,
      fillersRemoved: draft.fillersRemoved,
      status: reviewReq.status === 'copied_to_google' ? 'copied_to_google' : 'drafted',
      draftedAt: reviewReq.draftedAt ?? nowIso,
      openedAt: reviewReq.openedAt ?? nowIso,
    });

    await store.suppressScheduledMessagesForRequest(reviewReq.id);

    return c.json({ draft, request: updated });
  });

  app.post('/api/r/:token/track', async (c) => {
    await seedDemoData(store, getOriginFromReq(c.req.url));
    const token = c.req.param('token');
    const reviewReq = await store.getRequestByToken(token);
    if (!reviewReq) return c.json({ error: 'Review link not found.' }, 404);

    const body = await c.req.json().catch(() => null);
    const parsed = trackSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Invalid tracking action.' }, 400);
    }

    const nowIso = new Date().toISOString();
    const patch: Partial<ReviewRequest> = {
      status: parsed.data.action,
      openedAt: reviewReq.openedAt ?? nowIso,
    };
    if (parsed.data.rating !== undefined) {
      patch.rating = parsed.data.rating;
    }
    if (parsed.data.action === 'copied_to_google') {
      patch.copiedAt = nowIso;
      if (parsed.data.draftedReview?.trim()) {
        patch.draftedReview = parsed.data.draftedReview.trim();
      }
    } else if (parsed.data.action === 'private_feedback') {
      patch.privateFeedback = parsed.data.privateFeedback?.trim() ?? reviewReq.rawTranscript;
    }

    const updated = await store.updateRequest(reviewReq.id, patch);
    await store.suppressScheduledMessagesForRequest(reviewReq.id);

    return c.json({ ok: true, request: updated });
  });

  app.get('/api/public/:slug', async (c) => {
    await seedDemoData(store, getOriginFromReq(c.req.url));
    const slug = c.req.param('slug');
    const business = await store.getBusinessBySlug(slug);
    if (!business) return c.json({ error: 'Business hub not found.' }, 404);

    const requests = await store.listRequestsByBusiness(business.id);
    const publicReviews = requests
      .filter((r) => Boolean(r.draftedReview) && (r.rating ?? 5) >= 4)
      .map((r) => ({
        id: r.id,
        customerFirstName: r.customerName.split(/\s+/)[0] || 'Homeowner',
        techName: r.techName,
        serviceType: r.serviceType,
        rating: r.rating ?? 5,
        reviewText: r.draftedReview,
        ownerReply: r.ownerReply,
        inputMode: r.inputMode,
        verifiedOnGoogle: r.status === 'copied_to_google',
        createdAt: r.createdAt,
      }));

    const ratings = publicReviews.map((r) => r.rating);
    const avgRating =
      ratings.length > 0
        ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
        : 5.0;

    return c.json({
      business: {
        slug: business.slug,
        name: business.name,
        trade: business.trade,
        googleMapsUrl: buildGoogleMapsReviewUrl(business.googleMapsUrl, business.name),
        brandColor: business.brandColor,
        technicians: business.technicians,
      },
      avgRating,
      totalReviews: publicReviews.length,
      reviews: publicReviews,
    });
  });

  app.post('/api/public/:slug/checkin', async (c) => {
    await seedDemoData(store, getOriginFromReq(c.req.url));
    const slug = c.req.param('slug');
    const business = await store.getBusinessBySlug(slug);
    if (!business) return c.json({ error: 'Business hub not found.' }, 404);

    const body = (await c.req.json().catch(() => ({}))) as {
      customerName?: string;
      techName?: string;
      serviceType?: string;
    };

    const nowIso = new Date().toISOString();
    const token = `rv_${makeId('qr').slice(2, 12)}`;
    const req: ReviewRequest = {
      id: makeId('req'),
      token,
      businessId: business.id,
      customerName: body.customerName?.trim() || 'Verified Customer',
      customerPhone: '',
      customerEmail: '',
      techName: body.techName?.trim() || business.technicians[0] || 'Lead Technician',
      serviceType: body.serviceType?.trim() || 'On-Site Service',
      jobAmount: 0,
      crmSource: 'qr',
      crmExternalId: null,
      status: 'opened',
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
      openedAt: nowIso,
      draftedAt: null,
      copiedAt: null,
      createdAt: nowIso,
    };

    await store.createRequest(req);
    return c.json({ token, collectorUrl: `/r/${token}` }, 201);
  });

  if (options.renderSpaHtml) {
    app.get('*', (c) => {
      if (c.req.path.startsWith('/api/')) {
        return c.json({ error: 'API route not found.' }, 404);
      }
      const rendered = options.renderSpaHtml!();
      if (rendered instanceof Response) return rendered;
      return c.html(rendered);
    });
  }

  return app;
}
