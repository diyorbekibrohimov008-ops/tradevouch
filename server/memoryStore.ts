import type {
  CadenceMessage,
  CrmProvider,
  ReviewRequest,
  WebhookEventLog,
} from '../shared/types.js';
import type { BusinessRecord, SessionRecord, StoreAdapter } from './store.js';

export interface MemorySnapshot {
  businesses: BusinessRecord[];
  sessions: SessionRecord[];
  requests: ReviewRequest[];
  messages: CadenceMessage[];
  webhookLogs: WebhookEventLog[];
}

export class MemoryStore implements StoreAdapter {
  readonly storageKind: 'memory' | 'postgres' | 'vercel-blob' = 'memory';

  private businesses = new Map<string, BusinessRecord>();
  private sessions = new Map<string, SessionRecord>();
  private requests = new Map<string, ReviewRequest>();
  private messages = new Map<string, CadenceMessage>();
  private webhookLogs: WebhookEventLog[] = [];

  exportSnapshot(): MemorySnapshot {
    return {
      businesses: Array.from(this.businesses.values()).map((b) => structuredClone(b)),
      sessions: Array.from(this.sessions.values()).map((s) => structuredClone(s)),
      requests: Array.from(this.requests.values()).map((r) => structuredClone(r)),
      messages: Array.from(this.messages.values()).map((m) => structuredClone(m)),
      webhookLogs: this.webhookLogs.map((w) => structuredClone(w)),
    };
  }

  importSnapshot(snapshot: MemorySnapshot): void {
    this.businesses = new Map(
      (snapshot.businesses ?? []).map((b) => [b.id, structuredClone(b)]),
    );
    this.sessions = new Map(
      (snapshot.sessions ?? []).map((s) => [s.token, structuredClone(s)]),
    );
    this.requests = new Map(
      (snapshot.requests ?? []).map((r) => [r.id, structuredClone(r)]),
    );
    this.messages = new Map(
      (snapshot.messages ?? []).map((m) => [m.id, structuredClone(m)]),
    );
    this.webhookLogs = (snapshot.webhookLogs ?? []).map((w) => structuredClone(w));
  }

  async ensureReady(): Promise<void> {
    // No-op for in-memory store
  }

  async getBusinessById(id: string): Promise<BusinessRecord | null> {
    const found = this.businesses.get(id);
    return found ? structuredClone(found) : null;
  }

  async getBusinessBySlug(slug: string): Promise<BusinessRecord | null> {
    for (const biz of this.businesses.values()) {
      if (biz.slug === slug) return structuredClone(biz);
    }
    return null;
  }

  async getBusinessByEmail(email: string): Promise<BusinessRecord | null> {
    const norm = email.trim().toLowerCase();
    for (const biz of this.businesses.values()) {
      if (biz.email.trim().toLowerCase() === norm) return structuredClone(biz);
    }
    return null;
  }

  async createBusiness(record: BusinessRecord): Promise<BusinessRecord> {
    const copy = structuredClone(record);
    this.businesses.set(copy.id, copy);
    return structuredClone(copy);
  }

  async updateBusiness(
    id: string,
    patch: Partial<Omit<BusinessRecord, 'id' | 'createdAt'>>,
  ): Promise<BusinessRecord | null> {
    const existing = this.businesses.get(id);
    if (!existing) return null;
    const updated: BusinessRecord = structuredClone({ ...existing, ...patch });
    this.businesses.set(id, updated);
    return structuredClone(updated);
  }

  async createSession(session: SessionRecord): Promise<void> {
    this.sessions.set(session.token, structuredClone(session));
  }

  async getSession(token: string): Promise<SessionRecord | null> {
    const sess = this.sessions.get(token);
    if (!sess) return null;
    if (new Date(sess.expiresAt).getTime() <= Date.now()) {
      this.sessions.delete(token);
      return null;
    }
    return structuredClone(sess);
  }

  async listRequestsByBusiness(businessId: string): Promise<ReviewRequest[]> {
    return Array.from(this.requests.values())
      .filter((r) => r.businessId === businessId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((r) => structuredClone(r));
  }

  async getRequestById(id: string): Promise<ReviewRequest | null> {
    const found = this.requests.get(id);
    return found ? structuredClone(found) : null;
  }

  async getRequestByToken(token: string): Promise<ReviewRequest | null> {
    for (const req of this.requests.values()) {
      if (req.token === token) return structuredClone(req);
    }
    return null;
  }

  async findRequestByExternalId(
    businessId: string,
    crmSource: CrmProvider,
    crmExternalId: string,
  ): Promise<ReviewRequest | null> {
    for (const req of this.requests.values()) {
      if (
        req.businessId === businessId &&
        req.crmSource === crmSource &&
        req.crmExternalId === crmExternalId
      ) {
        return structuredClone(req);
      }
    }
    return null;
  }

  async createRequest(req: ReviewRequest): Promise<ReviewRequest> {
    const copy = structuredClone(req);
    this.requests.set(copy.id, copy);
    return structuredClone(copy);
  }

  async updateRequest(
    id: string,
    patch: Partial<Omit<ReviewRequest, 'id' | 'token' | 'businessId' | 'createdAt'>>,
  ): Promise<ReviewRequest | null> {
    const existing = this.requests.get(id);
    if (!existing) return null;
    const updated = structuredClone({ ...existing, ...patch });
    this.requests.set(id, updated);
    return structuredClone(updated);
  }

  async listMessagesByBusiness(businessId: string): Promise<CadenceMessage[]> {
    return Array.from(this.messages.values())
      .filter((m) => m.businessId === businessId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((m) => structuredClone(m));
  }

  async listMessagesByRequest(requestId: string): Promise<CadenceMessage[]> {
    return Array.from(this.messages.values())
      .filter((m) => m.requestId === requestId)
      .sort((a, b) => a.stepNumber - b.stepNumber)
      .map((m) => structuredClone(m));
  }

  async createMessages(msgs: CadenceMessage[]): Promise<void> {
    for (const msg of msgs) {
      this.messages.set(msg.id, structuredClone(msg));
    }
  }

  async updateMessage(
    id: string,
    patch: Partial<Pick<CadenceMessage, 'status' | 'sentAt' | 'providerId'>>,
  ): Promise<void> {
    const existing = this.messages.get(id);
    if (!existing) return;
    this.messages.set(id, structuredClone({ ...existing, ...patch }));
  }

  async suppressScheduledMessagesForRequest(requestId: string): Promise<number> {
    let count = 0;
    for (const [id, msg] of this.messages.entries()) {
      if (msg.requestId === requestId && msg.status === 'scheduled') {
        this.messages.set(id, { ...msg, status: 'suppressed' });
        count += 1;
      }
    }
    return count;
  }

  async listWebhookLogsByBusiness(businessId: string): Promise<WebhookEventLog[]> {
    return this.webhookLogs
      .filter((l) => l.businessId === businessId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((l) => structuredClone(l));
  }

  async createWebhookLog(log: WebhookEventLog): Promise<void> {
    this.webhookLogs.push(structuredClone(log));
  }
}
