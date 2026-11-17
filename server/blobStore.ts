import type {
  CadenceMessage,
  CrmProvider,
  ReviewRequest,
  WebhookEventLog,
} from '../shared/types.js';
import { MemoryStore, type MemorySnapshot } from './memoryStore.js';
import { seedDemoData } from './seed.js';
import type { BusinessRecord, SessionRecord, StoreAdapter } from './store.js';

const BLOB_STATE_KEY = 'tradevouch/state-v1.json';

export interface BlobSdkLike {
  get: (
    pathname: string,
    options: { access: 'private'; useCache?: boolean },
  ) => Promise<{ statusCode: number; stream: ReadableStream | null } | null>;
  put: (
    pathname: string,
    body: string,
    options: {
      access: 'private';
      allowOverwrite?: boolean;
      addRandomSuffix?: boolean;
      contentType?: string;
    },
  ) => Promise<unknown>;
}

export class VercelBlobStore implements StoreAdapter {
  readonly storageKind = 'vercel-blob' as const;
  private readonly mem = new MemoryStore();
  private lastSyncedAt = 0;
  private syncInFlight: Promise<void> | null = null;
  private writeChain: Promise<void> = Promise.resolve();
  private readonly customSdk?: BlobSdkLike;

  constructor(customSdk?: BlobSdkLike) {
    this.customSdk = customSdk;
  }

  private async blobSdk(): Promise<BlobSdkLike> {
    if (this.customSdk) return this.customSdk;
    return (await import('@vercel/blob')) as unknown as BlobSdkLike;
  }

  private async readBlobSnapshot(): Promise<MemorySnapshot | null> {
    try {
      const { get } = await this.blobSdk();
      const result = await get(BLOB_STATE_KEY, {
        access: 'private',
        useCache: false,
      });
      if (!result || result.statusCode !== 200 || !result.stream) {
        return null;
      }
      const raw = await new Response(result.stream).text();
      return JSON.parse(raw) as MemorySnapshot;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/not\s*found|404|does\s*not\s*exist/i.test(msg)) {
        return null;
      }
      console.error('[VercelBlobStore.readBlobSnapshot]', msg);
      throw err;
    }
  }

  private async flushToBlob(): Promise<void> {
    const { put } = await this.blobSdk();
    const payload = JSON.stringify(this.mem.exportSnapshot());
    await put(BLOB_STATE_KEY, payload, {
      access: 'private',
      allowOverwrite: true,
      addRandomSuffix: false,
      contentType: 'application/json',
    });
    this.lastSyncedAt = Date.now();
  }

  private async syncIfNeeded(force = false): Promise<void> {
    const now = Date.now();
    if (!force && this.lastSyncedAt > 0 && now - this.lastSyncedAt < 250) {
      return;
    }
    if (this.syncInFlight) {
      await this.syncInFlight;
      if (!force) return;
    }

    this.syncInFlight = (async () => {
      const snap = await this.readBlobSnapshot();
      if (snap && Array.isArray(snap.businesses) && snap.businesses.length > 0) {
        this.mem.importSnapshot(snap);
        this.lastSyncedAt = Date.now();
        return;
      }
      await seedDemoData(this.mem);
      await this.flushToBlob();
    })().finally(() => {
      this.syncInFlight = null;
    });

    await this.syncInFlight;
  }

  private withWriteLock<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.writeChain.then(fn, fn);
    this.writeChain = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  async ensureReady(): Promise<void> {
    await this.syncIfNeeded(this.lastSyncedAt === 0);
  }

  async getBusinessById(id: string): Promise<BusinessRecord | null> {
    await this.syncIfNeeded();
    return this.mem.getBusinessById(id);
  }

  async getBusinessBySlug(slug: string): Promise<BusinessRecord | null> {
    await this.syncIfNeeded();
    return this.mem.getBusinessBySlug(slug);
  }

  async getBusinessByEmail(email: string): Promise<BusinessRecord | null> {
    await this.syncIfNeeded();
    return this.mem.getBusinessByEmail(email);
  }

  async createBusiness(record: BusinessRecord): Promise<BusinessRecord> {
    return this.withWriteLock(async () => {
      await this.syncIfNeeded(true);
      const created = await this.mem.createBusiness(record);
      await this.flushToBlob();
      return created;
    });
  }

  async updateBusiness(
    id: string,
    patch: Partial<Omit<BusinessRecord, 'id' | 'createdAt'>>,
  ): Promise<BusinessRecord | null> {
    return this.withWriteLock(async () => {
      await this.syncIfNeeded(true);
      const updated = await this.mem.updateBusiness(id, patch);
      if (updated) await this.flushToBlob();
      return updated;
    });
  }

  async createSession(session: SessionRecord): Promise<void> {
    return this.withWriteLock(async () => {
      await this.syncIfNeeded(true);
      await this.mem.createSession(session);
      await this.flushToBlob();
    });
  }

  async getSession(token: string): Promise<SessionRecord | null> {
    await this.syncIfNeeded();
    return this.mem.getSession(token);
  }

  async listRequestsByBusiness(businessId: string): Promise<ReviewRequest[]> {
    await this.syncIfNeeded();
    return this.mem.listRequestsByBusiness(businessId);
  }

  async getRequestById(id: string): Promise<ReviewRequest | null> {
    await this.syncIfNeeded();
    return this.mem.getRequestById(id);
  }

  async getRequestByToken(token: string): Promise<ReviewRequest | null> {
    await this.syncIfNeeded();
    return this.mem.getRequestByToken(token);
  }

  async findRequestByExternalId(
    businessId: string,
    crmSource: CrmProvider,
    crmExternalId: string,
  ): Promise<ReviewRequest | null> {
    await this.syncIfNeeded();
    return this.mem.findRequestByExternalId(businessId, crmSource, crmExternalId);
  }

  async createRequest(req: ReviewRequest): Promise<ReviewRequest> {
    return this.withWriteLock(async () => {
      await this.syncIfNeeded(true);
      const created = await this.mem.createRequest(req);
      await this.flushToBlob();
      return created;
    });
  }

  async updateRequest(
    id: string,
    patch: Partial<Omit<ReviewRequest, 'id' | 'token' | 'businessId' | 'createdAt'>>,
  ): Promise<ReviewRequest | null> {
    return this.withWriteLock(async () => {
      await this.syncIfNeeded(true);
      const updated = await this.mem.updateRequest(id, patch);
      if (updated) await this.flushToBlob();
      return updated;
    });
  }

  async listMessagesByBusiness(businessId: string): Promise<CadenceMessage[]> {
    await this.syncIfNeeded();
    return this.mem.listMessagesByBusiness(businessId);
  }

  async listMessagesByRequest(requestId: string): Promise<CadenceMessage[]> {
    await this.syncIfNeeded();
    return this.mem.listMessagesByRequest(requestId);
  }

  async createMessages(msgs: CadenceMessage[]): Promise<void> {
    return this.withWriteLock(async () => {
      await this.syncIfNeeded(true);
      await this.mem.createMessages(msgs);
      await this.flushToBlob();
    });
  }

  async updateMessage(
    id: string,
    patch: Partial<Pick<CadenceMessage, 'status' | 'sentAt' | 'providerId'>>,
  ): Promise<void> {
    return this.withWriteLock(async () => {
      await this.syncIfNeeded(true);
      await this.mem.updateMessage(id, patch);
      await this.flushToBlob();
    });
  }

  async suppressScheduledMessagesForRequest(requestId: string): Promise<number> {
    return this.withWriteLock(async () => {
      await this.syncIfNeeded(true);
      const count = await this.mem.suppressScheduledMessagesForRequest(requestId);
      if (count > 0) await this.flushToBlob();
      return count;
    });
  }

  async listWebhookLogsByBusiness(businessId: string): Promise<WebhookEventLog[]> {
    await this.syncIfNeeded();
    return this.mem.listWebhookLogsByBusiness(businessId);
  }

  async createWebhookLog(log: WebhookEventLog): Promise<void> {
    return this.withWriteLock(async () => {
      await this.syncIfNeeded(true);
      await this.mem.createWebhookLog(log);
      await this.flushToBlob();
    });
  }
}
