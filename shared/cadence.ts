import type {
  CadenceChannel,
  CadenceMessageStatus,
  CadenceStepConfig,
  ReviewRequestStatus,
} from './types.js';

export interface CadenceTemplateVars {
  customerName: string;
  techName: string;
  serviceType: string;
  businessName: string;
  reviewLink: string;
}

export interface ScheduledCadenceDraft {
  stepNumber: number;
  channel: CadenceChannel;
  delayHours: number;
  recipient: string;
  body: string;
  status: CadenceMessageStatus;
  scheduledFor: string;
  sentAt: string | null;
}

export const DEFAULT_CADENCE_STEPS: CadenceStepConfig[] = [
  {
    stepNumber: 1,
    channel: 'sms',
    delayHours: 0,
    enabled: true,
    template:
      'Hi {{first_name}}! {{tech_name}} just wrapped up your {{service_type}} with {{business_name}}. Skip the blank Google box—tap to leave a quick 10s voice review: {{review_link}}',
  },
  {
    stepNumber: 2,
    channel: 'sms',
    delayHours: 48,
    enabled: true,
    template:
      'Quick check-in from {{business_name}}, {{first_name}} — takes 10 seconds to speak or tap 2 answers about {{tech_name}}: {{review_link}}',
  },
  {
    stepNumber: 3,
    channel: 'email',
    delayHours: 120,
    enabled: true,
    template:
      'Thanks again for trusting {{business_name}} with your {{service_type}}, {{first_name}}. If you have 10 seconds to share how {{tech_name}} did, our voice helper writes the Google review for you: {{review_link}}',
  },
];

export function renderCadenceTemplate(
  template: string,
  vars: CadenceTemplateVars,
): string {
  const firstName = vars.customerName.trim().split(/\s+/)[0] || 'there';
  return template
    .replace(/\{\{\s*first_name\s*\}\}/g, firstName)
    .replace(/\{\{\s*customer_name\s*\}\}/g, vars.customerName.trim())
    .replace(/\{\{\s*tech_name\s*\}\}/g, vars.techName.trim() || 'our crew')
    .replace(/\{\{\s*service_type\s*\}\}/g, vars.serviceType.trim() || 'your recent job')
    .replace(/\{\{\s*business_name\s*\}\}/g, vars.businessName.trim())
    .replace(/\{\{\s*review_link\s*\}\}/g, vars.reviewLink.trim());
}

export function shouldSuppressFollowup(status: ReviewRequestStatus): boolean {
  return status === 'drafted' || status === 'copied_to_google' || status === 'private_feedback';
}

export function buildCadenceSchedule(
  steps: CadenceStepConfig[],
  request: {
    id: string;
    token: string;
    customerName: string;
    customerPhone: string;
    customerEmail: string;
    techName: string;
    serviceType: string;
  },
  businessName: string,
  originUrl: string,
  baseTime: Date = new Date(),
): ScheduledCadenceDraft[] {
  const cleanOrigin = originUrl.replace(/\/+$/, '');
  const reviewLink = `${cleanOrigin}/r/${request.token}`;
  const out: ScheduledCadenceDraft[] = [];

  for (const step of steps) {
    if (!step.enabled) continue;
    const recipient =
      step.channel === 'sms' ? request.customerPhone.trim() : request.customerEmail.trim();
    if (!recipient) continue;

    const scheduledDate = new Date(baseTime.getTime() + step.delayHours * 3600 * 1000);
    const immediate = step.delayHours <= 0;

    out.push({
      stepNumber: step.stepNumber,
      channel: step.channel,
      delayHours: step.delayHours,
      recipient,
      body: renderCadenceTemplate(step.template, {
        customerName: request.customerName,
        techName: request.techName,
        serviceType: request.serviceType,
        businessName,
        reviewLink,
      }),
      status: immediate ? 'sent' : 'scheduled',
      scheduledFor: scheduledDate.toISOString(),
      sentAt: immediate ? baseTime.toISOString() : null,
    });
  }

  return out;
}
