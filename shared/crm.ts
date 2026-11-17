import type { CrmProvider } from './types.js';

export class CrmValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CrmValidationError';
  }
}

export interface NormalizedCrmJob {
  crmSource: CrmProvider;
  crmExternalId: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  techName: string;
  serviceType: string;
  jobAmount: number;
}

type AnyRecord = Record<string, unknown>;

function asRecord(val: unknown): AnyRecord {
  return val && typeof val === 'object' && !Array.isArray(val) ? (val as AnyRecord) : {};
}

function asString(val: unknown): string {
  return typeof val === 'string' ? val.trim() : typeof val === 'number' ? String(val) : '';
}

function asNumber(val: unknown): number {
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  if (typeof val === 'string') {
    const cleaned = val.replace(/[$,\s]/g, '');
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function firstArrayRecord(val: unknown): AnyRecord {
  return Array.isArray(val) && val.length > 0 ? asRecord(val[0]) : {};
}

export function normalizeCrmWebhook(provider: CrmProvider, payload: unknown): NormalizedCrmJob {
  const root = asRecord(payload);
  const job = asRecord(root.job ?? root.data ?? root);

  let customerName = '';
  let customerPhone = '';
  let customerEmail = '';
  let techName = '';
  let serviceType = '';
  let jobAmount = 0;
  let crmExternalId = '';

  if (provider === 'jobber') {
    const client = asRecord(job.client ?? root.client);
    const phoneObj = firstArrayRecord(client.phones);
    const emailObj = firstArrayRecord(client.emails);
    const techObj = firstArrayRecord(job.assignedTo ?? job.assigned_to);

    customerName =
      asString(client.name) ||
      `${asString(client.firstName)} ${asString(client.lastName)}`.trim() ||
      asString(root.customerName ?? root.customer_name);
    customerPhone =
      asString(phoneObj.number) ||
      asString(client.phone) ||
      asString(root.phone ?? root.customerPhone);
    customerEmail =
      asString(emailObj.address) ||
      asString(client.email) ||
      asString(root.email ?? root.customerEmail);
    techName =
      asString(techObj.name) ||
      asString(job.technicianName ?? root.techName ?? root.tech_name) ||
      'Lead Technician';
    serviceType =
      asString(job.title ?? job.description ?? root.serviceType ?? root.service_type) ||
      'Completed Service Job';
    jobAmount = asNumber(job.total ?? root.jobAmount ?? root.amount);
    crmExternalId =
      asString(job.id ?? root.jobId) || `jobber_${Date.now()}`;
  } else if (provider === 'housecall_pro') {
    const customer = asRecord(job.customer ?? root.customer);
    const emp = firstArrayRecord(job.assigned_employees ?? root.assigned_employees);
    const empFull = `${asString(emp.first_name)} ${asString(emp.last_name)}`.trim();

    customerName =
      asString(customer.name) ||
      `${asString(customer.first_name)} ${asString(customer.last_name)}`.trim() ||
      asString(root.customerName ?? root.customer_name);
    customerPhone =
      asString(customer.mobile_number ?? customer.home_number ?? customer.phone) ||
      asString(root.phone ?? root.customerPhone);
    customerEmail = asString(customer.email ?? root.email ?? root.customerEmail);
    techName =
      empFull ||
      asString(emp.name ?? root.techName ?? root.tech_name) ||
      'Field Specialist';
    serviceType =
      asString(job.description ?? job.name ?? root.serviceType ?? root.service_type) ||
      'Home Service Visit';

    if (job.total_dollars !== undefined) {
      jobAmount = asNumber(job.total_dollars);
    } else if (job.total_amount !== undefined) {
      const rawCents = asNumber(job.total_amount);
      jobAmount = Math.round(rawCents) / 100;
    } else {
      jobAmount = asNumber(root.jobAmount ?? root.amount);
    }
    crmExternalId = asString(job.id ?? root.id) || `hcp_${Date.now()}`;
  } else if (provider === 'servicetitan') {
    const customer = asRecord(root.customer ?? job.customer);
    const tech = asRecord(root.technician ?? job.technician);

    customerName =
      asString(customer.name ?? root.customerName ?? root.customer_name);
    customerPhone =
      asString(customer.phoneNumber ?? customer.phone ?? root.phone ?? root.customerPhone);
    customerEmail = asString(customer.email ?? root.email ?? root.customerEmail);
    techName =
      asString(tech.name ?? root.techName ?? root.tech_name) || 'Service Technician';
    serviceType =
      asString(root.summary ?? job.summary ?? root.jobType ?? root.serviceType) ||
      'ServiceTitan Job';
    jobAmount = asNumber(root.total ?? job.total ?? root.jobAmount);
    crmExternalId =
      asString(root.jobId ?? job.id ?? root.id) || `st_${Date.now()}`;
  } else {
    customerName = asString(root.customerName ?? root.customer_name ?? root.name);
    customerPhone = asString(root.customerPhone ?? root.phone);
    customerEmail = asString(root.customerEmail ?? root.email);
    techName = asString(root.techName ?? root.tech_name) || 'Lead Technician';
    serviceType = asString(root.serviceType ?? root.service_type) || 'Completed Service';
    jobAmount = asNumber(root.jobAmount ?? root.amount);
    crmExternalId = asString(root.crmExternalId ?? root.id) || `${provider}_${Date.now()}`;
  }

  if (!customerName) {
    throw new CrmValidationError('Webhook payload is missing customer name.');
  }
  if (!customerPhone && !customerEmail) {
    throw new CrmValidationError(
      `Customer "${customerName}" has neither a phone number nor an email address for review dispatch.`,
    );
  }

  return {
    crmSource: provider,
    crmExternalId,
    customerName,
    customerPhone,
    customerEmail,
    techName,
    serviceType,
    jobAmount,
  };
}

function splitCsvRow(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      cells.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells;
}

export function parseJobsCsv(csvText: string): NormalizedCrmJob[] {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new CrmValidationError('CSV must include a header row and at least one job row.');
  }

  const headers = splitCsvRow(lines[0]).map((h) =>
    h.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
  );

  const findIndex = (candidates: string[]): number =>
    headers.findIndex((h) => candidates.includes(h));

  const nameIdx = findIndex(['customer_name', 'customer', 'name', 'client_name']);
  const phoneIdx = findIndex(['phone', 'customer_phone', 'mobile', 'sms']);
  const emailIdx = findIndex(['email', 'customer_email']);
  const techIdx = findIndex(['tech_name', 'tech', 'technician', 'assigned_to']);
  const serviceIdx = findIndex(['service_type', 'service', 'job_title', 'description']);
  const amountIdx = findIndex(['job_amount', 'amount', 'total']);

  if (nameIdx === -1) {
    throw new CrmValidationError('CSV header must include a customer_name column.');
  }

  const jobs: NormalizedCrmJob[] = [];
  for (let rowIdx = 1; rowIdx < lines.length; rowIdx += 1) {
    const cells = splitCsvRow(lines[rowIdx]);
    const customerName = cells[nameIdx] ?? '';
    const customerPhone = phoneIdx >= 0 ? (cells[phoneIdx] ?? '') : '';
    const customerEmail = emailIdx >= 0 ? (cells[emailIdx] ?? '') : '';
    const techName = (techIdx >= 0 ? cells[techIdx] : '') || 'Lead Technician';
    const serviceType = (serviceIdx >= 0 ? cells[serviceIdx] : '') || 'Completed Service';
    const jobAmount = amountIdx >= 0 ? asNumber(cells[amountIdx]) : 0;

    if (!customerName || (!customerPhone && !customerEmail)) {
      throw new CrmValidationError(
        `Row ${rowIdx + 1} is missing customer name or phone/email contact.`,
      );
    }

    jobs.push({
      crmSource: 'csv',
      crmExternalId: `csv_row_${rowIdx}_${customerName.toLowerCase().replace(/\W+/g, '_')}`,
      customerName,
      customerPhone,
      customerEmail,
      techName,
      serviceType,
      jobAmount,
    });
  }

  return jobs;
}
