import type {
  BusinessProfile,
  CadenceMessage,
  CrmProvider,
  ReviewRequest,
  WebhookEventLog,
} from '../shared/types.js';

export interface BusinessRecord extends BusinessProfile {
  ownerPasswordHash: string;
}

export interface SessionRecord {
  token: string;
  businessId: string;
  email: string;
  createdAt: string;
  expiresAt: string;
}

export interface StoreAdapter {
  readonly storageKind: 'memory' | 'postgres' | 'vercel-blob';
  ensureReady(): Promise<void>;

  getBusinessById(id: string): Promise<BusinessRecord | null>;
  getBusinessBySlug(slug: string): Promise<BusinessRecord | null>;
  getBusinessByEmail(email: string): Promise<BusinessRecord | null>;
  createBusiness(record: BusinessRecord): Promise<BusinessRecord>;
  updateBusiness(
    id: string,
    patch: Partial<Omit<BusinessRecord, 'id' | 'createdAt'>>,
  ): Promise<BusinessRecord | null>;

  createSession(session: SessionRecord): Promise<void>;
  getSession(token: string): Promise<SessionRecord | null>;

  listRequestsByBusiness(businessId: string): Promise<ReviewRequest[]>;
  getRequestById(id: string): Promise<ReviewRequest | null>;
  getRequestByToken(token: string): Promise<ReviewRequest | null>;
  findRequestByExternalId(
    businessId: string,
    crmSource: CrmProvider,
    crmExternalId: string,
  ): Promise<ReviewRequest | null>;
  createRequest(req: ReviewRequest): Promise<ReviewRequest>;
  updateRequest(
    id: string,
    patch: Partial<Omit<ReviewRequest, 'id' | 'token' | 'businessId' | 'createdAt'>>,
  ): Promise<ReviewRequest | null>;

  listMessagesByBusiness(businessId: string): Promise<CadenceMessage[]>;
  listMessagesByRequest(requestId: string): Promise<CadenceMessage[]>;
  createMessages(msgs: CadenceMessage[]): Promise<void>;
  updateMessage(
    id: string,
    patch: Partial<Pick<CadenceMessage, 'status' | 'sentAt' | 'providerId'>>,
  ): Promise<void>;
  suppressScheduledMessagesForRequest(requestId: string): Promise<number>;

  listWebhookLogsByBusiness(businessId: string): Promise<WebhookEventLog[]>;
  createWebhookLog(log: WebhookEventLog): Promise<void>;
}
