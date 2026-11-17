import postgres from 'postgres';
import type {
  CadenceMessage,
  CadenceStepConfig,
  CompetitorName,
  CrmProvider,
  PlanTier,
  ReviewInputMode,
  ReviewRequest,
  ReviewRequestStatus,
  ReviewTone,
  TradeKind,
  WebhookEventLog,
} from '../shared/types.js';
import type { BusinessRecord, SessionRecord, StoreAdapter } from './store.js';

type SqlClient = ReturnType<typeof postgres>;

function toIso(val: unknown): string {
  if (val instanceof Date) return val.toISOString();
  if (typeof val === 'string') return val;
  return new Date().toISOString();
}

function toOptIso(val: unknown): string | null {
  if (val === null || val === undefined) return null;
  return toIso(val);
}

function parseJson<T>(val: unknown, fallback: T): T {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'string') {
    try {
      return JSON.parse(val) as T;
    } catch {
      return fallback;
    }
  }
  return val as T;
}

export class PostgresStore implements StoreAdapter {
  readonly storageKind = 'postgres' as const;
  private sql: SqlClient;
  private readyPromise: Promise<void> | null = null;

  constructor(databaseUrl: string) {
    const isInternal =
      databaseUrl.includes('railway.internal') || databaseUrl.includes('localhost');
    this.sql = postgres(databaseUrl, {
      ssl: isInternal ? false : 'prefer',
      max: 5,
      idle_timeout: 20,
      connect_timeout: 15,
    });
  }

  async ensureReady(): Promise<void> {
    if (!this.readyPromise) {
      this.readyPromise = this.migrate().catch((err) => {
        this.readyPromise = null;
        throw err;
      });
    }
    await this.readyPromise;
  }

  private async migrate(): Promise<void> {
    await this.sql`
      CREATE TABLE IF NOT EXISTS businesses (
        id TEXT PRIMARY KEY,
        slug TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        trade TEXT NOT NULL,
        phone TEXT NOT NULL DEFAULT '',
        email TEXT UNIQUE NOT NULL,
        google_maps_url TEXT NOT NULL DEFAULT '',
        brand_color TEXT NOT NULL DEFAULT '#EA580C',
        webhook_key TEXT NOT NULL,
        plan_tier TEXT NOT NULL DEFAULT 'flat_29',
        competitor_switched_from TEXT NOT NULL DEFAULT 'nicejob',
        technicians_json JSONB NOT NULL DEFAULT '[]'::jsonb,
        cadence_json JSONB NOT NULL DEFAULT '[]'::jsonb,
        owner_password_hash TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    await this.sql`
      CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        email TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMPTZ NOT NULL
      )
    `;

    await this.sql`
      CREATE TABLE IF NOT EXISTS review_requests (
        id TEXT PRIMARY KEY,
        token TEXT UNIQUE NOT NULL,
        business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        customer_name TEXT NOT NULL,
        customer_phone TEXT NOT NULL DEFAULT '',
        customer_email TEXT NOT NULL DEFAULT '',
        tech_name TEXT NOT NULL,
        service_type TEXT NOT NULL,
        job_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
        crm_source TEXT NOT NULL,
        crm_external_id TEXT,
        status TEXT NOT NULL DEFAULT 'queued',
        rating INTEGER,
        input_mode TEXT,
        raw_transcript TEXT NOT NULL DEFAULT '',
        quick_highlights_json JSONB NOT NULL DEFAULT '[]'::jsonb,
        extra_note TEXT NOT NULL DEFAULT '',
        drafted_review TEXT NOT NULL DEFAULT '',
        tone TEXT NOT NULL DEFAULT 'warm',
        fillers_removed INTEGER NOT NULL DEFAULT 0,
        owner_reply TEXT NOT NULL DEFAULT '',
        private_feedback TEXT NOT NULL DEFAULT '',
        opened_at TIMESTAMPTZ,
        drafted_at TIMESTAMPTZ,
        copied_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    await this.sql`
      CREATE INDEX IF NOT EXISTS idx_review_requests_biz_created
      ON review_requests (business_id, created_at DESC)
    `;

    await this.sql`
      CREATE TABLE IF NOT EXISTS cadence_messages (
        id TEXT PRIMARY KEY,
        request_id TEXT NOT NULL REFERENCES review_requests(id) ON DELETE CASCADE,
        business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        step_number INTEGER NOT NULL,
        channel TEXT NOT NULL,
        delay_hours INTEGER NOT NULL,
        recipient TEXT NOT NULL,
        body TEXT NOT NULL,
        status TEXT NOT NULL,
        scheduled_for TIMESTAMPTZ NOT NULL,
        sent_at TIMESTAMPTZ,
        provider_id TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    await this.sql`
      CREATE TABLE IF NOT EXISTS webhook_events (
        id TEXT PRIMARY KEY,
        business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        provider TEXT NOT NULL,
        external_id TEXT NOT NULL,
        customer_name TEXT NOT NULL,
        service_type TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
  }

  private mapBusiness(row: Record<string, unknown>): BusinessRecord {
    return {
      id: String(row.id),
      slug: String(row.slug),
      name: String(row.name),
      trade: String(row.trade) as TradeKind,
      phone: String(row.phone ?? ''),
      email: String(row.email),
      googleMapsUrl: String(row.google_maps_url ?? ''),
      brandColor: String(row.brand_color ?? '#EA580C'),
      webhookKey: String(row.webhook_key),
      planTier: String(row.plan_tier) as PlanTier,
      competitorSwitchedFrom: String(row.competitor_switched_from) as CompetitorName,
      technicians: parseJson<string[]>(row.technicians_json, []),
      cadenceSteps: parseJson<CadenceStepConfig[]>(row.cadence_json, []),
      ownerPasswordHash: String(row.owner_password_hash),
      createdAt: toIso(row.created_at),
    };
  }

  private mapRequest(row: Record<string, unknown>): ReviewRequest {
    return {
      id: String(row.id),
      token: String(row.token),
      businessId: String(row.business_id),
      customerName: String(row.customer_name),
      customerPhone: String(row.customer_phone ?? ''),
      customerEmail: String(row.customer_email ?? ''),
      techName: String(row.tech_name),
      serviceType: String(row.service_type),
      jobAmount: Number(row.job_amount ?? 0),
      crmSource: String(row.crm_source) as CrmProvider,
      crmExternalId: row.crm_external_id ? String(row.crm_external_id) : null,
      status: String(row.status) as ReviewRequestStatus,
      rating: row.rating === null || row.rating === undefined ? null : Number(row.rating),
      inputMode: row.input_mode ? (String(row.input_mode) as ReviewInputMode) : null,
      rawTranscript: String(row.raw_transcript ?? ''),
      quickHighlights: parseJson<string[]>(row.quick_highlights_json, []),
      extraNote: String(row.extra_note ?? ''),
      draftedReview: String(row.drafted_review ?? ''),
      tone: String(row.tone ?? 'warm') as ReviewTone,
      fillersRemoved: Number(row.fillers_removed ?? 0),
      ownerReply: String(row.owner_reply ?? ''),
      privateFeedback: String(row.private_feedback ?? ''),
      openedAt: toOptIso(row.opened_at),
      draftedAt: toOptIso(row.drafted_at),
      copiedAt: toOptIso(row.copied_at),
      createdAt: toIso(row.created_at),
    };
  }

  private mapMessage(row: Record<string, unknown>): CadenceMessage {
    return {
      id: String(row.id),
      requestId: String(row.request_id),
      businessId: String(row.business_id),
      stepNumber: Number(row.step_number),
      channel: String(row.channel) as 'sms' | 'email',
      delayHours: Number(row.delay_hours),
      recipient: String(row.recipient),
      body: String(row.body),
      status: String(row.status) as 'scheduled' | 'sent' | 'suppressed',
      scheduledFor: toIso(row.scheduled_for),
      sentAt: toOptIso(row.sent_at),
      providerId: String(row.provider_id ?? ''),
      createdAt: toIso(row.created_at),
    };
  }

  async getBusinessById(id: string): Promise<BusinessRecord | null> {
    await this.ensureReady();
    const rows = await this.sql`SELECT * FROM businesses WHERE id = ${id} LIMIT 1`;
    return rows[0] ? this.mapBusiness(rows[0]) : null;
  }

  async getBusinessBySlug(slug: string): Promise<BusinessRecord | null> {
    await this.ensureReady();
    const rows = await this.sql`SELECT * FROM businesses WHERE slug = ${slug} LIMIT 1`;
    return rows[0] ? this.mapBusiness(rows[0]) : null;
  }

  async getBusinessByEmail(email: string): Promise<BusinessRecord | null> {
    await this.ensureReady();
    const norm = email.trim().toLowerCase();
    const rows = await this.sql`SELECT * FROM businesses WHERE LOWER(email) = ${norm} LIMIT 1`;
    return rows[0] ? this.mapBusiness(rows[0]) : null;
  }

  async createBusiness(record: BusinessRecord): Promise<BusinessRecord> {
    await this.ensureReady();
    const rows = await this.sql`
      INSERT INTO businesses (
        id, slug, name, trade, phone, email, google_maps_url, brand_color,
        webhook_key, plan_tier, competitor_switched_from, technicians_json,
        cadence_json, owner_password_hash, created_at
      ) VALUES (
        ${record.id}, ${record.slug}, ${record.name}, ${record.trade}, ${record.phone},
        ${record.email.toLowerCase()}, ${record.googleMapsUrl}, ${record.brandColor},
        ${record.webhookKey}, ${record.planTier}, ${record.competitorSwitchedFrom},
        ${this.sql.json(record.technicians)}, ${this.sql.json(record.cadenceSteps as unknown as Parameters<typeof this.sql.json>[0])},
        ${record.ownerPasswordHash}, ${record.createdAt}
      )
      RETURNING *
    `;
    return this.mapBusiness(rows[0]);
  }

  async updateBusiness(
    id: string,
    patch: Partial<Omit<BusinessRecord, 'id' | 'createdAt'>>,
  ): Promise<BusinessRecord | null> {
    const existing = await this.getBusinessById(id);
    if (!existing) return null;
    const merged: BusinessRecord = { ...existing, ...patch };
    const rows = await this.sql`
      UPDATE businesses SET
        slug = ${merged.slug},
        name = ${merged.name},
        trade = ${merged.trade},
        phone = ${merged.phone},
        email = ${merged.email.toLowerCase()},
        google_maps_url = ${merged.googleMapsUrl},
        brand_color = ${merged.brandColor},
        webhook_key = ${merged.webhookKey},
        plan_tier = ${merged.planTier},
        competitor_switched_from = ${merged.competitorSwitchedFrom},
        technicians_json = ${this.sql.json(merged.technicians)},
        cadence_json = ${this.sql.json(merged.cadenceSteps as unknown as Parameters<typeof this.sql.json>[0])},
        owner_password_hash = ${merged.ownerPasswordHash}
      WHERE id = ${id}
      RETURNING *
    `;
    return rows[0] ? this.mapBusiness(rows[0]) : null;
  }

  async createSession(session: SessionRecord): Promise<void> {
    await this.ensureReady();
    await this.sql`
      INSERT INTO sessions (token, business_id, email, created_at, expires_at)
      VALUES (${session.token}, ${session.businessId}, ${session.email}, ${session.createdAt}, ${session.expiresAt})
    `;
  }

  async getSession(token: string): Promise<SessionRecord | null> {
    await this.ensureReady();
    const rows = await this.sql`SELECT * FROM sessions WHERE token = ${token} LIMIT 1`;
    const row = rows[0];
    if (!row) return null;
    const expiresAt = toIso(row.expires_at);
    if (new Date(expiresAt).getTime() <= Date.now()) {
      await this.sql`DELETE FROM sessions WHERE token = ${token}`;
      return null;
    }
    return {
      token: String(row.token),
      businessId: String(row.business_id),
      email: String(row.email),
      createdAt: toIso(row.created_at),
      expiresAt,
    };
  }

  async listRequestsByBusiness(businessId: string): Promise<ReviewRequest[]> {
    await this.ensureReady();
    const rows = await this.sql`
      SELECT * FROM review_requests WHERE business_id = ${businessId}
      ORDER BY created_at DESC
    `;
    return rows.map((r) => this.mapRequest(r));
  }

  async getRequestById(id: string): Promise<ReviewRequest | null> {
    await this.ensureReady();
    const rows = await this.sql`SELECT * FROM review_requests WHERE id = ${id} LIMIT 1`;
    return rows[0] ? this.mapRequest(rows[0]) : null;
  }

  async getRequestByToken(token: string): Promise<ReviewRequest | null> {
    await this.ensureReady();
    const rows = await this.sql`SELECT * FROM review_requests WHERE token = ${token} LIMIT 1`;
    return rows[0] ? this.mapRequest(rows[0]) : null;
  }

  async findRequestByExternalId(
    businessId: string,
    crmSource: CrmProvider,
    crmExternalId: string,
  ): Promise<ReviewRequest | null> {
    await this.ensureReady();
    const rows = await this.sql`
      SELECT * FROM review_requests
      WHERE business_id = ${businessId}
        AND crm_source = ${crmSource}
        AND crm_external_id = ${crmExternalId}
      LIMIT 1
    `;
    return rows[0] ? this.mapRequest(rows[0]) : null;
  }

  async createRequest(req: ReviewRequest): Promise<ReviewRequest> {
    await this.ensureReady();
    const rows = await this.sql`
      INSERT INTO review_requests (
        id, token, business_id, customer_name, customer_phone, customer_email,
        tech_name, service_type, job_amount, crm_source, crm_external_id, status,
        rating, input_mode, raw_transcript, quick_highlights_json, extra_note,
        drafted_review, tone, fillers_removed, owner_reply, private_feedback,
        opened_at, drafted_at, copied_at, created_at
      ) VALUES (
        ${req.id}, ${req.token}, ${req.businessId}, ${req.customerName},
        ${req.customerPhone}, ${req.customerEmail}, ${req.techName}, ${req.serviceType},
        ${req.jobAmount}, ${req.crmSource}, ${req.crmExternalId}, ${req.status},
        ${req.rating}, ${req.inputMode}, ${req.rawTranscript},
        ${this.sql.json(req.quickHighlights)}, ${req.extraNote}, ${req.draftedReview},
        ${req.tone}, ${req.fillersRemoved}, ${req.ownerReply}, ${req.privateFeedback},
        ${req.openedAt}, ${req.draftedAt}, ${req.copiedAt}, ${req.createdAt}
      )
      RETURNING *
    `;
    return this.mapRequest(rows[0]);
  }

  async updateRequest(
    id: string,
    patch: Partial<Omit<ReviewRequest, 'id' | 'token' | 'businessId' | 'createdAt'>>,
  ): Promise<ReviewRequest | null> {
    const existing = await this.getRequestById(id);
    if (!existing) return null;
    const m: ReviewRequest = { ...existing, ...patch };
    const rows = await this.sql`
      UPDATE review_requests SET
        customer_name = ${m.customerName},
        customer_phone = ${m.customerPhone},
        customer_email = ${m.customerEmail},
        tech_name = ${m.techName},
        service_type = ${m.serviceType},
        job_amount = ${m.jobAmount},
        status = ${m.status},
        rating = ${m.rating},
        input_mode = ${m.inputMode},
        raw_transcript = ${m.rawTranscript},
        quick_highlights_json = ${this.sql.json(m.quickHighlights)},
        extra_note = ${m.extraNote},
        drafted_review = ${m.draftedReview},
        tone = ${m.tone},
        fillers_removed = ${m.fillersRemoved},
        owner_reply = ${m.ownerReply},
        private_feedback = ${m.privateFeedback},
        opened_at = ${m.openedAt},
        drafted_at = ${m.draftedAt},
        copied_at = ${m.copiedAt}
      WHERE id = ${id}
      RETURNING *
    `;
    return rows[0] ? this.mapRequest(rows[0]) : null;
  }

  async listMessagesByBusiness(businessId: string): Promise<CadenceMessage[]> {
    await this.ensureReady();
    const rows = await this.sql`
      SELECT * FROM cadence_messages WHERE business_id = ${businessId}
      ORDER BY created_at DESC
    `;
    return rows.map((r) => this.mapMessage(r));
  }

  async listMessagesByRequest(requestId: string): Promise<CadenceMessage[]> {
    await this.ensureReady();
    const rows = await this.sql`
      SELECT * FROM cadence_messages WHERE request_id = ${requestId}
      ORDER BY step_number ASC
    `;
    return rows.map((r) => this.mapMessage(r));
  }

  async createMessages(msgs: CadenceMessage[]): Promise<void> {
    await this.ensureReady();
    for (const msg of msgs) {
      await this.sql`
        INSERT INTO cadence_messages (
          id, request_id, business_id, step_number, channel, delay_hours,
          recipient, body, status, scheduled_for, sent_at, provider_id, created_at
        ) VALUES (
          ${msg.id}, ${msg.requestId}, ${msg.businessId}, ${msg.stepNumber},
          ${msg.channel}, ${msg.delayHours}, ${msg.recipient}, ${msg.body},
          ${msg.status}, ${msg.scheduledFor}, ${msg.sentAt}, ${msg.providerId}, ${msg.createdAt}
        )
      `;
    }
  }

  async updateMessage(
    id: string,
    patch: Partial<Pick<CadenceMessage, 'status' | 'sentAt' | 'providerId'>>,
  ): Promise<void> {
    await this.ensureReady();
    const rows = await this.sql`SELECT * FROM cadence_messages WHERE id = ${id} LIMIT 1`;
    if (!rows[0]) return;
    const cur = this.mapMessage(rows[0]);
    const next = { ...cur, ...patch };
    await this.sql`
      UPDATE cadence_messages SET
        status = ${next.status},
        sent_at = ${next.sentAt},
        provider_id = ${next.providerId}
      WHERE id = ${id}
    `;
  }

  async suppressScheduledMessagesForRequest(requestId: string): Promise<number> {
    await this.ensureReady();
    const rows = await this.sql`
      UPDATE cadence_messages
      SET status = 'suppressed'
      WHERE request_id = ${requestId} AND status = 'scheduled'
      RETURNING id
    `;
    return rows.length;
  }

  async listWebhookLogsByBusiness(businessId: string): Promise<WebhookEventLog[]> {
    await this.ensureReady();
    const rows = await this.sql`
      SELECT * FROM webhook_events WHERE business_id = ${businessId}
      ORDER BY created_at DESC
    `;
    return rows.map((r) => ({
      id: String(r.id),
      businessId: String(r.business_id),
      provider: String(r.provider) as CrmProvider,
      externalId: String(r.external_id),
      customerName: String(r.customer_name),
      serviceType: String(r.service_type),
      status: String(r.status) as 'processed' | 'duplicate' | 'error',
      createdAt: toIso(r.created_at),
    }));
  }

  async createWebhookLog(log: WebhookEventLog): Promise<void> {
    await this.ensureReady();
    await this.sql`
      INSERT INTO webhook_events (
        id, business_id, provider, external_id, customer_name, service_type, status, created_at
      ) VALUES (
        ${log.id}, ${log.businessId}, ${log.provider}, ${log.externalId},
        ${log.customerName}, ${log.serviceType}, ${log.status}, ${log.createdAt}
      )
    `;
  }
}
