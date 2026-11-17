import { describe, expect, it } from 'vitest';
import {
  CrmValidationError,
  normalizeCrmWebhook,
  parseJobsCsv,
} from '../shared/crm';

describe('normalizeCrmWebhook', () => {
  it('normalizes a Jobber completed-job webhook payload', () => {
    const normalized = normalizeCrmWebhook('jobber', {
      event: 'JOB_COMPLETED',
      job: {
        id: 'job_88412',
        title: 'Emergency Water Heater Replacement',
        total: 1850,
        client: {
          name: 'David Alvarez',
          phones: [{ number: '+1 (512) 555-0148', primary: true }],
          emails: [{ address: 'david.alvarez@example.com', primary: true }],
        },
        assignedTo: [{ name: 'Elena Rostova' }],
      },
    });

    expect(normalized).toEqual({
      crmSource: 'jobber',
      crmExternalId: 'job_88412',
      customerName: 'David Alvarez',
      customerPhone: '+1 (512) 555-0148',
      customerEmail: 'david.alvarez@example.com',
      techName: 'Elena Rostova',
      serviceType: 'Emergency Water Heater Replacement',
      jobAmount: 1850,
    });
  });

  it('normalizes a Housecall Pro job.completed payload with amount in cents', () => {
    const normalized = normalizeCrmWebhook('housecall_pro', {
      event: 'job.completed',
      job: {
        id: 'hcp_9921',
        description: 'Full Ceramic Coating & Paint Correction',
        total_amount: 95000,
        customer: {
          first_name: 'Claire',
          last_name: 'Bennett',
          mobile_number: '+15125550199',
          email: 'claire.b@example.com',
        },
        assigned_employees: [{ first_name: 'Devon', last_name: 'Brooks' }],
      },
    });

    expect(normalized.crmSource).toBe('housecall_pro');
    expect(normalized.crmExternalId).toBe('hcp_9921');
    expect(normalized.customerName).toBe('Claire Bennett');
    expect(normalized.techName).toBe('Devon Brooks');
    expect(normalized.serviceType).toBe('Full Ceramic Coating & Paint Correction');
    expect(normalized.jobAmount).toBe(950);
  });

  it('normalizes a ServiceTitan JobCompleted payload', () => {
    const normalized = normalizeCrmWebhook('servicetitan', {
      eventType: 'JobCompleted',
      jobId: 'st-50411',
      summary: 'Architectural Shingle Storm Repair',
      total: 3200,
      customer: {
        name: 'Marcus Sterling',
        phoneNumber: '+15125550177',
        email: 'm.sterling@example.com',
      },
      technician: {
        name: 'Marcus Vance',
      },
    });

    expect(normalized.crmSource).toBe('servicetitan');
    expect(normalized.crmExternalId).toBe('st-50411');
    expect(normalized.customerName).toBe('Marcus Sterling');
    expect(normalized.techName).toBe('Marcus Vance');
    expect(normalized.jobAmount).toBe(3200);
  });

  it('throws CrmValidationError when customer contact details are completely missing', () => {
    expect(() =>
      normalizeCrmWebhook('jobber', {
        job: {
          id: 'job_empty',
          title: 'Roof Inspection',
          client: { name: 'No Contact' },
        },
      }),
    ).toThrow(CrmValidationError);
  });
});

describe('parseJobsCsv', () => {
  it('parses valid rows with quoted commas and skips blank lines', () => {
    const csv = [
      'customer_name,phone,email,tech_name,service_type,job_amount',
      'Sarah Jenkins,+15125550111,sarah@example.com,Marcus Vance,"Chimney Flashing, Ridge Repair",1450',
      '',
      'Tom Okafor,+15125550122,,Elena Rostova,Slab Leak Detection,680',
    ].join('\n');

    const rows = parseJobsCsv(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      crmSource: 'csv',
      customerName: 'Sarah Jenkins',
      techName: 'Marcus Vance',
      serviceType: 'Chimney Flashing, Ridge Repair',
      jobAmount: 1450,
    });
    expect(rows[1].customerEmail).toBe('');
  });
});
