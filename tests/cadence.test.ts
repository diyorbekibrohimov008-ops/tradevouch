import { describe, expect, it } from 'vitest';
import {
  buildCadenceSchedule,
  renderCadenceTemplate,
  shouldSuppressFollowup,
} from '../shared/cadence';

describe('renderCadenceTemplate', () => {
  it('interpolates customer first name, technician, service, business, and review link', () => {
    const text = renderCadenceTemplate(
      'Hi {{first_name}}! {{tech_name}} just wrapped up your {{service_type}} with {{business_name}}. Tap to leave a quick 10s voice review (no typing): {{review_link}}',
      {
        customerName: 'Sarah Jenkins',
        techName: 'Marcus Vance',
        serviceType: 'Chimney Flashing Repair',
        businessName: 'PeakLine Roofing',
        reviewLink: 'https://tradevouch.up.railway.app/r/rv_abc123',
      },
    );

    expect(text).toBe(
      'Hi Sarah! Marcus Vance just wrapped up your Chimney Flashing Repair with PeakLine Roofing. Tap to leave a quick 10s voice review (no typing): https://tradevouch.up.railway.app/r/rv_abc123',
    );
  });
});

describe('buildCadenceSchedule', () => {
  it('dispatches immediate step 1 SMS and schedules follow-ups while skipping channels missing contact info', () => {
    const baseTime = new Date('2026-11-11T15:00:00.000Z');
    const messages = buildCadenceSchedule(
      [
        {
          stepNumber: 1,
          channel: 'sms',
          delayHours: 0,
          enabled: true,
          template: 'Hi {{first_name}}, tap {{review_link}} for {{tech_name}}.',
        },
        {
          stepNumber: 2,
          channel: 'sms',
          delayHours: 48,
          enabled: true,
          template: 'Quick nudge {{first_name}}: 10s voice review at {{review_link}}',
        },
        {
          stepNumber: 3,
          channel: 'email',
          delayHours: 120,
          enabled: true,
          template: 'Thanks for choosing {{business_name}}, {{first_name}}! {{review_link}}',
        },
      ],
      {
        id: 'req_1',
        token: 'rv_tok1',
        customerName: 'Tom Okafor',
        customerPhone: '+15125550122',
        customerEmail: '',
        techName: 'Elena Rostova',
        serviceType: 'Leak Repair',
      },
      'CopperPipe Plumbing',
      'https://tradevouch.up.railway.app',
      baseTime,
    );

    expect(messages).toHaveLength(2);
    expect(messages[0].status).toBe('sent');
    expect(messages[0].sentAt).toBe('2026-11-11T15:00:00.000Z');
    expect(messages[0].recipient).toBe('+15125550122');
    expect(messages[1].status).toBe('scheduled');
    expect(messages[1].scheduledFor).toBe('2026-11-13T15:00:00.000Z');
  });
});

describe('shouldSuppressFollowup', () => {
  it('suppresses follow-up touches once customer has drafted, copied, or sent private feedback', () => {
    expect(shouldSuppressFollowup('queued')).toBe(false);
    expect(shouldSuppressFollowup('sent')).toBe(false);
    expect(shouldSuppressFollowup('opened')).toBe(false);
    expect(shouldSuppressFollowup('drafted')).toBe(true);
    expect(shouldSuppressFollowup('copied_to_google')).toBe(true);
    expect(shouldSuppressFollowup('private_feedback')).toBe(true);
  });
});
