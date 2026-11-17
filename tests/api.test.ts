import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../server/app';
import { MemoryStore } from '../server/memoryStore';
import { seedDemoData } from '../server/seed';

describe('TradeVouch API', () => {
  let store: MemoryStore;
  let app: ReturnType<typeof createApp>;

  beforeEach(async () => {
    store = new MemoryStore();
    await seedDemoData(store, 'https://tradevouch.test');
    app = createApp(store);
  });

  it('returns health status and seeded demo snapshot', async () => {
    const healthRes = await app.request('/api/health');
    expect(healthRes.status).toBe(200);
    const health = await healthRes.json();
    expect(health.ok).toBe(true);
    expect(health.storage).toBe('memory');

    const demoRes = await app.request('/api/demo');
    expect(demoRes.status).toBe(200);
    const demo = await demoRes.json();
    expect(demo.business.slug).toBe('peakline-roofing');
    expect(demo.isDemo).toBe(true);
    expect(demo.requests.length).toBeGreaterThanOrEqual(4);
    expect(demo.metrics.monthlyPrice).toBe(29);
    expect(demo.metrics.annualSavingsVsBirdeye).toBeGreaterThan(2000);
  });

  it('registers a contractor account, enforces auth, and rejects invalid tokens', async () => {
    const regRes = await app.request('/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        businessName: 'Austin Clear Drain Co',
        trade: 'plumbing',
        email: 'owner@austindrain.com',
        password: 'password123',
        googleMapsUrl: 'https://search.google.com/local/writereview?placeid=ChIJTest',
        competitorSwitchedFrom: 'nicejob',
      }),
    });
    expect(regRes.status).toBe(201);
    const reg = await regRes.json();
    expect(reg.token).toBeTruthy();
    expect(reg.business.planTier).toBe('flat_29');
    expect(reg.business.webhookKey).toBeTruthy();

    const badAuthRes = await app.request('/api/studio/snapshot', {
      headers: { authorization: 'Bearer invalid-token' },
    });
    expect(badAuthRes.status).toBe(401);

    const snapRes = await app.request('/api/studio/snapshot', {
      headers: { authorization: `Bearer ${reg.token}` },
    });
    expect(snapRes.status).toBe(200);
    const snap = await snapRes.json();
    expect(snap.isDemo).toBe(false);
    expect(snap.business.name).toBe('Austin Clear Drain Co');
  });

  it('ingests Jobber CRM webhooks idempotently and executes homeowner voice-to-review flow', async () => {
    const demo = await (await app.request('/api/demo')).json();
    const webhookUrl = `/api/webhooks/crm/jobber?biz=${demo.business.slug}&key=${demo.business.webhookKey}`;

    const jobPayload = {
      event: 'JOB_COMPLETED',
      job: {
        id: 'jobber_test_991',
        title: 'Skylight Leak & Shingle Flashing',
        total: 1290,
        client: {
          name: 'Liam Carter',
          phones: [{ number: '+15125550188', primary: true }],
          emails: [{ address: 'liam.carter@example.com', primary: true }],
        },
        assignedTo: [{ name: 'Marcus Vance' }],
      },
    };

    const first = await app.request(webhookUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(jobPayload),
    });
    expect(first.status).toBe(201);
    const created = await first.json();
    expect(created.duplicate).toBe(false);
    expect(created.request.customerName).toBe('Liam Carter');
    const token = created.request.token;

    const dup = await app.request(webhookUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(jobPayload),
    });
    expect(dup.status).toBe(200);
    const dupBody = await dup.json();
    expect(dupBody.duplicate).toBe(true);

    // Unauthorized webhook key rejected
    const badKey = await app.request(
      `/api/webhooks/crm/jobber?biz=${demo.business.slug}&key=wrong`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(jobPayload),
      },
    );
    expect(badKey.status).toBe(401);

    // Homeowner opens SMS link
    const openRes = await app.request(`/api/r/${token}`);
    expect(openRes.status).toBe(200);
    const openData = await openRes.json();
    expect(openData.status).toBe('opened');
    expect(openData.techName).toBe('Marcus Vance');

    // Homeowner submits 10s voice transcript -> AI drafts 5-star review
    const draftRes = await app.request(`/api/r/${token}/draft`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        rating: 5,
        inputMode: 'voice',
        rawTranscript:
          'Um Marcus was super fast, you know, fixed our skylight leak in an hour and uh swept the driveway clean.',
        tone: 'warm',
      }),
    });
    expect(draftRes.status).toBe(200);
    const draftBody = await draftRes.json();
    expect(draftBody.draft.draftText).toContain('Marcus');
    expect(draftBody.draft.fillersRemoved).toBeGreaterThanOrEqual(3);
    expect(draftBody.request.status).toBe('drafted');

    // Homeowner clicks 1-click Copy & Open Google Maps
    const copyRes = await app.request(`/api/r/${token}/track`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'copied_to_google',
        draftedReview: draftBody.draft.draftText,
      }),
    });
    expect(copyRes.status).toBe(200);
    const copyBody = await copyRes.json();
    expect(copyBody.request.status).toBe('copied_to_google');

    // Scheduled follow-ups are suppressed once review is drafted/copied
    const dispatchRes = await app.request('/api/studio/cadence/dispatch?demo=1', {
      method: 'POST',
    });
    expect(dispatchRes.status).toBe(200);
    const afterDemo = await (await app.request('/api/demo')).json();
    const liamMsgs = afterDemo.messages.filter(
      (m: { requestId: string; stepNumber: number; status: string }) =>
        m.requestId === created.request.id && m.stepNumber > 1,
    );
    expect(liamMsgs.every((m: { status: string }) => m.status === 'suppressed')).toBe(true);
  });

  it('imports CSV jobs, supports QR public check-in without PII leak, and handles unknown tokens cleanly', async () => {
    const csvRes = await app.request('/api/studio/import-csv?demo=1', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        csvText: [
          'customer_name,phone,email,tech_name,service_type,job_amount',
          'Nina Brooks,+15125550133,nina@example.com,Devon Brooks,Gutter Guard Install,980',
        ].join('\n'),
      }),
    });
    expect(csvRes.status).toBe(201);
    const csvBody = await csvRes.json();
    expect(csvBody.importedCount).toBe(1);

    const hubRes = await app.request('/api/public/peakline-roofing');
    expect(hubRes.status).toBe(200);
    const hub = await hubRes.json();
    expect(hub.business.name).toContain('PeakLine');
    expect(JSON.stringify(hub)).not.toContain('+15125550133');

    const checkinRes = await app.request('/api/public/peakline-roofing/checkin', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        customerName: 'Walk-in Homeowner',
        techName: 'Marcus Vance',
        serviceType: 'Hail Inspection',
      }),
    });
    expect(checkinRes.status).toBe(201);
    const checkin = await checkinRes.json();
    expect(checkin.token).toBeTruthy();

    const missingRes = await app.request('/api/r/does_not_exist');
    expect(missingRes.status).toBe(404);
  });

  it('supports VercelBlobStore persistence across cold instances and Vercel __route handler', async () => {
    const { VercelBlobStore } = await import('../server/blobStore');
    const { createApp } = await import('../server/app');

    let storedJson: string | null = null;
    const mockBlobSdk = {
      async get() {
        if (!storedJson) return null;
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(storedJson ?? undefined));
            controller.close();
          },
        });
        return { statusCode: 200, stream };
      },
      async put(_pathname: string, body: string) {
        storedJson = body;
      },
    };

    const instanceA = new VercelBlobStore(mockBlobSdk);
    const appA = createApp(instanceA);
    const demoA = await (await appA.request('/api/demo')).json();

    const hookRes = await appA.request(
      `/api/webhooks/crm/jobber?biz=${demoA.business.slug}&key=${demoA.business.webhookKey}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          id: 'blob_persist_job_1',
          client: { name: 'Clara Gomez', phone: '+15125550191' },
          techName: 'Marcus Vance',
          serviceType: 'Standing Seam Tune-Up',
          total: 1200,
        }),
      },
    );
    expect(hookRes.status).toBe(201);
    const created = await hookRes.json();

    // Fresh cold-start instance reading the same private blob snapshot sees persisted job
    const instanceB = new VercelBlobStore(mockBlobSdk);
    const appB = createApp(instanceB);
    const colRes = await appB.request(`/api/r/${created.request.token}`);
    expect(colRes.status).toBe(200);
    const colJson = await colRes.json();
    expect(colJson.customerName).toBe('Clara Gomez');

    const { GET: vercelGet, POST: vercelPost } = await import('../api/index');
    const healthRes = await vercelGet(
      new Request('https://tradevouch.vercel.app/api/index?__route=health'),
    );
    expect(healthRes.status).toBe(200);
    const healthJson = await healthRes.json();
    expect(healthJson.ok).toBe(true);

    const draftRes = await vercelPost(
      new Request('https://tradevouch.vercel.app/api/index?__route=ai/draft-review', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          businessName: 'PeakLine Roofing & Exteriors',
          techName: 'Marcus Vance',
          serviceType: 'Ridge Vent Replacement',
          tradeCategory: 'roofing',
          rating: 5,
          tone: 'short',
          highlights: ['On time'],
          voiceTranscript: 'Marcus arrived early and fixed the ridge vent fast',
        }),
      }),
    );
    expect(draftRes.status).toBe(200);
    const draftJson = await draftRes.json();
    expect(draftJson.draftText).toContain('Marcus');
  });
});
