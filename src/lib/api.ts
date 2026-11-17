import type {
  BusinessProfile,
  CadenceMessage,
  CrmProvider,
  PublicCollectorContext,
  ReviewInputMode,
  ReviewRequest,
  ReviewTone,
  StudioSnapshot,
  TradeKind,
} from '../../shared/types';
import type { DraftReviewResult } from '../../shared/reviewAi';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function copyTextSafe(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fallback below
  }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.left = '-9999px';
    document.body.appendChild(area);
    area.focus();
    area.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

async function requestJson<T>(
  path: string,
  options: RequestInit & { authToken?: string | null } = {},
): Promise<T> {
  const { authToken, headers, ...rest } = options;
  const mergedHeaders: Record<string, string> = {
    ...(headers as Record<string, string> | undefined),
  };
  if (rest.body && !mergedHeaders['content-type']) {
    mergedHeaders['content-type'] = 'application/json';
  }
  if (authToken) {
    mergedHeaders.authorization = `Bearer ${authToken}`;
  }

  const res = await fetch(path, { ...rest, headers: mergedHeaders });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError((data as { error?: string }).error || 'Request failed', res.status);
  }
  return data as T;
}

export interface PublicHubResponse {
  business: {
    slug: string;
    name: string;
    trade: TradeKind;
    googleMapsUrl: string;
    brandColor: string;
    technicians: string[];
  };
  avgRating: number;
  totalReviews: number;
  reviews: Array<{
    id: string;
    customerFirstName: string;
    techName: string;
    serviceType: string;
    rating: number;
    reviewText: string;
    ownerReply: string;
    inputMode: ReviewInputMode | null;
    verifiedOnGoogle: boolean;
    createdAt: string;
  }>;
}

export const api = {
  getDemo: () => requestJson<StudioSnapshot>('/api/demo'),

  register: (payload: {
    businessName: string;
    trade: TradeKind;
    email: string;
    password: string;
    phone?: string;
    googleMapsUrl?: string;
    competitorSwitchedFrom?: 'nicejob' | 'birdeye' | 'none';
  }) =>
    requestJson<{ token: string; business: BusinessProfile }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  login: (payload: { email: string; password: string }) =>
    requestJson<{ token: string; business: BusinessProfile }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getStudioSnapshot: (authToken: string | null) =>
    authToken
      ? requestJson<StudioSnapshot>('/api/studio/snapshot', { authToken })
      : requestJson<StudioSnapshot>('/api/demo'),

  updateBusiness: (
    authToken: string | null,
    patch: Partial<BusinessProfile>,
  ) =>
    requestJson<StudioSnapshot>(
      authToken ? '/api/studio/business' : '/api/studio/business?demo=1',
      {
        method: 'PATCH',
        authToken,
        body: JSON.stringify(patch),
      },
    ),

  createRequest: (
    authToken: string | null,
    payload: {
      customerName: string;
      customerPhone: string;
      customerEmail: string;
      techName: string;
      serviceType: string;
      jobAmount: number;
    },
  ) =>
    requestJson<{ request: ReviewRequest; messages: CadenceMessage[] }>(
      authToken ? '/api/studio/requests' : '/api/studio/requests?demo=1',
      {
        method: 'POST',
        authToken,
        body: JSON.stringify(payload),
      },
    ),

  importCsv: (authToken: string | null, csvText: string) =>
    requestJson<{ importedCount: number; requests: ReviewRequest[] }>(
      authToken ? '/api/studio/import-csv' : '/api/studio/import-csv?demo=1',
      {
        method: 'POST',
        authToken,
        body: JSON.stringify({ csvText }),
      },
    ),

  draftOwnerReply: (
    authToken: string | null,
    requestId: string,
    customReply?: string,
  ) =>
    requestJson<{ ownerReply: string; request: ReviewRequest }>(
      authToken
        ? `/api/studio/requests/${requestId}/owner-reply`
        : `/api/studio/requests/${requestId}/owner-reply?demo=1`,
      {
        method: 'POST',
        authToken,
        body: JSON.stringify({ customReply }),
      },
    ),

  dispatchCadence: (authToken: string | null) =>
    requestJson<{
      dispatchedCount: number;
      suppressedCount: number;
      messages: CadenceMessage[];
    }>(
      authToken ? '/api/studio/cadence/dispatch' : '/api/studio/cadence/dispatch?demo=1',
      {
        method: 'POST',
        authToken,
      },
    ),

  triggerCrmWebhook: (
    provider: CrmProvider,
    bizSlug: string,
    webhookKey: string,
    payload: unknown,
  ) =>
    requestJson<{
      duplicate: boolean;
      request: ReviewRequest;
      reviewUrl: string;
    }>(`/api/webhooks/crm/${provider}?biz=${encodeURIComponent(bizSlug)}&key=${encodeURIComponent(webhookKey)}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getCollector: (token: string) =>
    requestJson<PublicCollectorContext>(`/api/r/${encodeURIComponent(token)}`),

  draftCollectorReview: (
    token: string,
    payload: {
      rating: number;
      inputMode: ReviewInputMode;
      rawTranscript: string;
      quickHighlights: string[];
      extraNote: string;
      tone: ReviewTone;
    },
  ) =>
    requestJson<{ draft: DraftReviewResult; request: ReviewRequest }>(
      `/api/r/${encodeURIComponent(token)}/draft`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    ),

  trackCollectorAction: (
    token: string,
    payload: {
      action: 'copied_to_google' | 'private_feedback';
      draftedReview?: string;
      privateFeedback?: string;
      rating?: number;
    },
  ) =>
    requestJson<{ ok: boolean; request: ReviewRequest }>(
      `/api/r/${encodeURIComponent(token)}/track`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    ),

  getPublicHub: (slug: string) =>
    requestJson<PublicHubResponse>(`/api/public/${encodeURIComponent(slug)}`),

  checkinPublicHub: (
    slug: string,
    payload: { customerName: string; techName: string; serviceType: string },
  ) =>
    requestJson<{ token: string; collectorUrl: string }>(
      `/api/public/${encodeURIComponent(slug)}/checkin`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    ),
};
