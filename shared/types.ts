export type TradeKind =
  | 'roofing'
  | 'plumbing'
  | 'detailing'
  | 'hvac'
  | 'electrical'
  | 'landscaping';

export type CrmProvider =
  | 'jobber'
  | 'housecall_pro'
  | 'servicetitan'
  | 'csv'
  | 'manual'
  | 'qr';

export type ReviewTone = 'warm' | 'short' | 'detailed';

export type ReviewInputMode = 'voice' | 'questions';

export type ReviewRequestStatus =
  | 'queued'
  | 'sent'
  | 'opened'
  | 'drafted'
  | 'copied_to_google'
  | 'private_feedback';

export type CadenceChannel = 'sms' | 'email';

export type CadenceMessageStatus = 'scheduled' | 'sent' | 'suppressed';

export type PlanTier = 'trial' | 'flat_29';

export type CompetitorName = 'nicejob' | 'birdeye' | 'none';

export interface CadenceStepConfig {
  stepNumber: number;
  channel: CadenceChannel;
  delayHours: number;
  enabled: boolean;
  template: string;
}

export interface BusinessProfile {
  id: string;
  slug: string;
  name: string;
  trade: TradeKind;
  phone: string;
  email: string;
  googleMapsUrl: string;
  brandColor: string;
  webhookKey: string;
  planTier: PlanTier;
  competitorSwitchedFrom: CompetitorName;
  technicians: string[];
  cadenceSteps: CadenceStepConfig[];
  createdAt: string;
}

export interface ReviewRequest {
  id: string;
  token: string;
  businessId: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  techName: string;
  serviceType: string;
  jobAmount: number;
  crmSource: CrmProvider;
  crmExternalId: string | null;
  status: ReviewRequestStatus;
  rating: number | null;
  inputMode: ReviewInputMode | null;
  rawTranscript: string;
  quickHighlights: string[];
  extraNote: string;
  draftedReview: string;
  tone: ReviewTone;
  fillersRemoved: number;
  ownerReply: string;
  privateFeedback: string;
  openedAt: string | null;
  draftedAt: string | null;
  copiedAt: string | null;
  createdAt: string;
}

export interface CadenceMessage {
  id: string;
  requestId: string;
  businessId: string;
  stepNumber: number;
  channel: CadenceChannel;
  delayHours: number;
  recipient: string;
  body: string;
  status: CadenceMessageStatus;
  scheduledFor: string;
  sentAt: string | null;
  providerId: string;
  createdAt: string;
}

export interface WebhookEventLog {
  id: string;
  businessId: string;
  provider: CrmProvider;
  externalId: string;
  customerName: string;
  serviceType: string;
  status: 'processed' | 'duplicate' | 'error';
  createdAt: string;
}

export interface StudioMetrics {
  totalRequests: number;
  sentCount: number;
  openedCount: number;
  draftedCount: number;
  copiedToGoogleCount: number;
  privateFeedbackCount: number;
  voiceInputCount: number;
  questionsInputCount: number;
  conversionRatePct: number;
  monthlyPrice: number;
  annualSavingsVsNiceJob: number;
  annualSavingsVsBirdeye: number;
}

export interface TechLeaderboardEntry {
  techName: string;
  jobsSent: number;
  reviewsCopied: number;
  avgRating: number;
}

export interface StudioSnapshot {
  business: BusinessProfile;
  isDemo: boolean;
  requests: ReviewRequest[];
  messages: CadenceMessage[];
  webhookLogs: WebhookEventLog[];
  metrics: StudioMetrics;
  techLeaderboard: TechLeaderboardEntry[];
}

export interface PublicCollectorContext {
  token: string;
  status: ReviewRequestStatus;
  business: {
    name: string;
    slug: string;
    trade: TradeKind;
    googleMapsUrl: string;
    brandColor: string;
    phone: string;
  };
  customerName: string;
  techName: string;
  serviceType: string;
  rating: number | null;
  inputMode: ReviewInputMode | null;
  rawTranscript: string;
  quickHighlights: string[];
  extraNote: string;
  draftedReview: string;
  tone: ReviewTone;
  fillersRemoved: number;
  privateFeedback: string;
}
