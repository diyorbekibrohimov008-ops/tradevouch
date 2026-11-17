import { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  Copy,
  ExternalLink,
  FileSpreadsheet,
  MessageSquare,
  Mic,
  Plus,
  QrCode,
  Send,
  Settings,
  Sparkles,
  TrendingUp,
  Users,
  Webhook,
} from 'lucide-react';
import { TRADE_LABELS } from '../../shared/reviewAi';
import type {
  CadenceStepConfig,
  CrmProvider,
  ReviewRequest,
  StudioSnapshot,
  TradeKind,
} from '../../shared/types';
import { api, ApiError, copyTextSafe } from '../lib/api';

interface StudioPageProps {
  authToken: string | null;
  onNavigate: (path: string) => void;
  onOpenAuth: (mode: 'login' | 'register') => void;
  onSignOut: () => void;
}

type StudioTab = 'pipeline' | 'crm' | 'cadence' | 'crew' | 'billing';

const STATUS_BADGES: Record<
  ReviewRequest['status'],
  { label: string; classes: string }
> = {
  queued: { label: 'Queued', classes: 'bg-slate-100 text-slate-700' },
  sent: { label: 'SMS Sent', classes: 'bg-sky-100 text-sky-800' },
  opened: { label: 'Link Opened', classes: 'bg-amber-100 text-amber-800' },
  drafted: { label: 'AI Drafted', classes: 'bg-teal-100 text-teal-800' },
  copied_to_google: {
    label: 'Copied to Google',
    classes: 'bg-emerald-100 text-emerald-800',
  },
  private_feedback: {
    label: 'Private Owner Alert',
    classes: 'bg-rose-100 text-rose-800',
  },
};

const SAMPLE_CSV = `customer_name,phone,email,tech_name,service_type,job_amount
Jordan Vance,+15125550141,jordan.v@example.com,Marcus Vance,"Skylight Curb Reseal, Gutter Check",1150
Hannah Cruz,+15125550169,hannah.c@example.com,Elena Rostova,Standing Seam Panel Repair,2400`;

export function StudioPage({
  authToken,
  onNavigate,
  onOpenAuth,
  onSignOut,
}: StudioPageProps) {
  const [snapshot, setSnapshot] = useState<StudioSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<StudioTab>('pipeline');
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');

  // New Manual Job form
  const [showNewJob, setShowNewJob] = useState(false);
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custEmail, setCustEmail] = useState('');
  const [techName, setTechName] = useState('');
  const [serviceType, setServiceType] = useState('');
  const [jobAmount, setJobAmount] = useState('950');

  // CSV Import
  const [csvText, setCsvText] = useState(SAMPLE_CSV);

  // Business Settings & Cadence editor
  const [bizName, setBizName] = useState('');
  const [bizTrade, setBizTrade] = useState<TradeKind>('roofing');
  const [bizGoogleUrl, setBizGoogleUrl] = useState('');
  const [bizTechsInput, setBizTechsInput] = useState('');
  const [cadenceDraft, setCadenceDraft] = useState<CadenceStepConfig[]>([]);

  const loadSnapshot = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getStudioSnapshot(authToken);
      setSnapshot(data);
      setBizName(data.business.name);
      setBizTrade(data.business.trade);
      setBizGoogleUrl(data.business.googleMapsUrl);
      setBizTechsInput(data.business.technicians.join(', '));
      setCadenceDraft(data.business.cadenceSteps);
      setTechName((prev) => prev || data.business.technicians[0] || 'Lead Technician');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to load workspace.');
    } finally {
      setLoading(false);
    }
  }, [authToken]);

  useEffect(() => {
    loadSnapshot();
  }, [loadSnapshot]);

  const showToastMsg = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(''), 4000);
  };

  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const res = await api.createRequest(authToken, {
        customerName: custName,
        customerPhone: custPhone,
        customerEmail: custEmail,
        techName,
        serviceType,
        jobAmount: Number(jobAmount) || 0,
      });
      setCustName('');
      setCustPhone('');
      setCustEmail('');
      setServiceType('');
      setShowNewJob(false);
      showToastMsg(`SMS review link queued for ${res.request.customerName}!`);
      await loadSnapshot();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create job.');
    }
  };

  const handleSimulateWebhook = async (provider: CrmProvider) => {
    if (!snapshot) return;
    setError('');
    const rand = Math.floor(1000 + Math.random() * 9000);
    const payloads: Record<string, unknown> = {
      jobber: {
        event: 'JOB_COMPLETED',
        job: {
          id: `jobber_${rand}`,
          title: 'Emergency Ridge & Valley Flashing Repair',
          total: 1680,
          client: {
            name: `Noah Alvarez #${rand}`,
            phones: [{ number: '+15125550192', primary: true }],
            emails: [{ address: `noah.${rand}@example.com`, primary: true }],
          },
          assignedTo: [{ name: snapshot.business.technicians[0] || 'Marcus Vance' }],
        },
      },
      housecall_pro: {
        event: 'job.completed',
        job: {
          id: `hcp_${rand}`,
          description: 'Full Roof Inspection & Pipe Boot Replacement',
          total_amount: 112500,
          customer: {
            first_name: 'Maya',
            last_name: `Lin-${rand}`,
            mobile_number: '+15125550138',
            email: `maya.${rand}@example.com`,
          },
          assigned_employees: [
            {
              first_name: (snapshot.business.technicians[1] || 'Elena Rostova').split(' ')[0],
              last_name:
                (snapshot.business.technicians[1] || 'Elena Rostova').split(' ')[1] || '',
            },
          ],
        },
      },
      servicetitan: {
        eventType: 'JobCompleted',
        jobId: `st_${rand}`,
        summary: 'Architectural Shingle Storm Restoration',
        total: 3450,
        customer: {
          name: `Derek Shaw #${rand}`,
          phoneNumber: '+15125550181',
          email: `derek.${rand}@example.com`,
        },
        technician: {
          name: snapshot.business.technicians[2] || 'Devon Brooks',
        },
      },
    };

    try {
      const res = await api.triggerCrmWebhook(
        provider,
        snapshot.business.slug,
        snapshot.business.webhookKey,
        payloads[provider],
      );
      const label =
        provider === 'jobber'
          ? 'Jobber'
          : provider === 'housecall_pro'
            ? 'Housecall Pro'
            : 'ServiceTitan';
      showToastMsg(
        `${label} webhook processed — Step 1 SMS dispatched to ${res.request.customerName}`,
      );
      await loadSnapshot();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Webhook simulation failed.');
    }
  };

  const handleImportCsv = async () => {
    setError('');
    try {
      const res = await api.importCsv(authToken, csvText);
      showToastMsg(`Imported ${res.importedCount} completed jobs into SMS cadence!`);
      await loadSnapshot();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'CSV import failed.');
    }
  };

  const handleDispatchCadence = async () => {
    setError('');
    try {
      const res = await api.dispatchCadence(authToken);
      showToastMsg(
        `Cadence run complete: ${res.dispatchedCount} sent, ${res.suppressedCount} suppressed after review.`,
      );
      await loadSnapshot();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Cadence dispatch failed.');
    }
  };

  const handleGenerateOwnerReply = async (requestId: string) => {
    try {
      await api.draftOwnerReply(authToken, requestId);
      showToastMsg('AI drafted owner reply!');
      await loadSnapshot();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not draft owner reply.');
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const technicians = bizTechsInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      await api.updateBusiness(authToken, {
        name: bizName,
        trade: bizTrade,
        googleMapsUrl: bizGoogleUrl,
        technicians: technicians.length > 0 ? technicians : ['Lead Technician'],
        cadenceSteps: cadenceDraft,
      });
      showToastMsg('Saved business profile & cadence settings!');
      await loadSnapshot();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save settings.');
    }
  };

  if (loading && !snapshot) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16 text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-orange-600 border-t-transparent" />
        <p className="mt-3 text-sm font-semibold text-slate-600">
          Loading contractor workspace…
        </p>
      </div>
    );
  }

  if (!snapshot) return null;

  const origin =
    typeof window !== 'undefined' && window.location.origin
      ? window.location.origin
      : 'https://tradevouch.up.railway.app';
  const { business, requests, messages, webhookLogs, metrics, techLeaderboard } = snapshot;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* Workspace Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-xs">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
              {business.name}
            </h1>
            <span className="rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-extrabold text-orange-800">
              {TRADE_LABELS[business.trade]}
            </span>
            {snapshot.isDemo ? (
              <span className="rounded-full bg-slate-900 px-2.5 py-0.5 text-[11px] font-bold text-amber-300">
                Live Demo Workspace
              </span>
            ) : (
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
                $29/mo Flat Active
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Webhook key: <code className="rounded bg-slate-100 px-1.5 py-0.5">{business.webhookKey}</code> ·
            Public QR Hub:{' '}
            <button
              type="button"
              onClick={() => onNavigate(`/biz/${business.slug}`)}
              className="cursor-pointer font-bold text-orange-600 hover:underline"
            >
              /biz/{business.slug}
            </button>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {snapshot.isDemo ? (
            <button
              type="button"
              onClick={() => onOpenAuth('register')}
              className="cursor-pointer rounded-full border border-orange-300 bg-orange-50 px-4 py-2 text-xs font-extrabold text-orange-800 hover:bg-orange-100"
            >
              Claim Your Own $29/mo Account
            </button>
          ) : (
            <button
              type="button"
              onClick={onSignOut}
              className="cursor-pointer rounded-full border border-slate-200 px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
            >
              Switch to Demo
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowNewJob((v) => !v)}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-orange-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-orange-700"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Send Review SMS</span>
          </button>
        </div>
      </div>

      {toast ? (
        <div className="mt-4 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-900">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <span>{toast}</span>
        </div>
      ) : null}

      {error ? (
        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-800">
          {error}
        </div>
      ) : null}

      {/* Quick Send Review SMS Drawer */}
      {showNewJob ? (
        <form
          onSubmit={handleCreateJob}
          className="mt-4 grid gap-3 rounded-3xl border border-orange-200 bg-orange-50/50 p-5 sm:grid-cols-6"
        >
          <input
            required
            type="text"
            placeholder="Homeowner name"
            value={custName}
            onChange={(e) => setCustName(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs sm:col-span-2"
          />
          <input
            type="tel"
            placeholder="Mobile phone (+1...)"
            value={custPhone}
            onChange={(e) => setCustPhone(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"
          />
          <input
            type="email"
            placeholder="Email (optional)"
            value={custEmail}
            onChange={(e) => setCustEmail(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"
          />
          <select
            value={techName}
            onChange={(e) => setTechName(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"
          >
            {business.technicians.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <input
            required
            type="text"
            placeholder="Service (e.g. Leak Repair)"
            value={serviceType}
            onChange={(e) => setServiceType(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"
          />
          <div className="flex items-center gap-2 sm:col-span-6">
            <input
              type="number"
              min="0"
              placeholder="Job $"
              value={jobAmount}
              onChange={(e) => setJobAmount(e.target.value)}
              className="w-28 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"
            />
            <button
              type="submit"
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800"
            >
              <Send className="h-3.5 w-3.5" />
              <span>Dispatch 10s Voice Link Now</span>
            </button>
          </div>
        </form>
      ) : null}

      {/* KPI Bar */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-bold text-slate-500">Copied to Google Maps</p>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-emerald-600 tabular-nums">
              {metrics.copiedToGoogleCount}
            </span>
            <span className="text-xs font-bold text-slate-500 tabular-nums">
              of {metrics.totalRequests} jobs
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-bold text-slate-500">Completion Conversion</p>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-slate-900 tabular-nums">
              {metrics.conversionRatePct}%
            </span>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
              vs 11% blank-box avg
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-bold text-slate-500">Voice vs 2-Question</p>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-extrabold text-slate-900 tabular-nums">
              {metrics.voiceInputCount} Voice / {metrics.questionsInputCount} Qs
            </span>
            <Mic className="h-4 w-4 text-orange-600" />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-bold text-slate-500">Your Flat Plan Savings</p>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-extrabold text-orange-600">$29/mo</span>
            <span className="text-xs font-bold text-emerald-700">
              Saves ${metrics.annualSavingsVsNiceJob}/yr vs NiceJob
            </span>
          </div>
        </div>
      </div>

      {/* Studio Tabs */}
      <div className="mt-6 flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {[
          { id: 'pipeline', label: 'Pipeline & Reviews', icon: TrendingUp },
          { id: 'crm', label: 'CRM Sync & Webhooks', icon: Webhook },
          { id: 'cadence', label: 'SMS & Email Cadences', icon: MessageSquare },
          { id: 'crew', label: 'Crew, Settings & QR', icon: Users },
          { id: 'billing', label: '$29/mo Plan & Savings', icon: Settings },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id as StudioTab)}
            className={`inline-flex cursor-pointer items-center gap-2 rounded-full px-4 py-2 text-xs font-bold transition ${
              tab === id
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* TAB 1: PIPELINE & REVIEWS */}
      {tab === 'pipeline' ? (
        <div className="mt-6 space-y-4">
          {requests.map((req) => {
            const badge = STATUS_BADGES[req.status];
            return (
              <div
                key={req.id}
                className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-base font-extrabold text-slate-900">
                        {req.customerName}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ${badge.classes}`}
                      >
                        {badge.label}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-600 uppercase">
                        {req.crmSource.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="mt-1 text-xs font-medium text-slate-500">
                      Tech: <strong className="text-slate-800">{req.techName}</strong> ·{' '}
                      {req.serviceType} · ${req.jobAmount.toLocaleString()}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        copyTextSafe(`${origin}/r/${req.token}`);
                        showToastMsg(`Copied homeowner SMS link /r/${req.token}`);
                      }}
                      className="inline-flex cursor-pointer items-center gap-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      <span>Copy Link</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onNavigate(`/r/${req.token}`)}
                      className="inline-flex cursor-pointer items-center gap-1 rounded-xl bg-orange-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-orange-700"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      <span>Open Homeowner Link</span>
                    </button>
                  </div>
                </div>

                {req.draftedReview ? (
                  <div className="mt-3 rounded-2xl bg-slate-50 p-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-bold text-slate-500">
                      <span>
                        AI Draft ({req.inputMode === 'voice' ? '10s Voice Note' : '2 Questions'}
                        {req.fillersRemoved > 0 ? ` · ${req.fillersRemoved} fillers cleaned` : ''})
                      </span>
                      <span>Rating: {req.rating ?? 5}/5</span>
                    </div>
                    <p className="mt-1.5 text-sm leading-relaxed text-slate-800">
                      &ldquo;{req.draftedReview}&rdquo;
                    </p>

                    {req.ownerReply ? (
                      <div className="mt-3 border-t border-slate-200 pt-2.5 text-xs text-slate-600">
                        <strong className="text-slate-900">Owner Reply:</strong> {req.ownerReply}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleGenerateOwnerReply(req.id)}
                        className="mt-2.5 inline-flex cursor-pointer items-center gap-1 text-xs font-bold text-orange-700 hover:underline"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        <span>Draft Owner Reply</span>
                      </button>
                    )}
                  </div>
                ) : req.privateFeedback ? (
                  <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50/70 p-3.5 text-xs text-rose-900">
                    <strong>Private Resolution Note ({req.rating}/5):</strong>{' '}
                    {req.privateFeedback}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      {/* TAB 2: CRM SYNC & WEBHOOKS */}
      {tab === 'crm' ? (
        <div className="mt-6 grid gap-6 lg:grid-cols-12">
          <div className="space-y-5 lg:col-span-7">
            <div className="rounded-3xl border border-slate-200 bg-white p-6">
              <h2 className="text-lg font-extrabold text-slate-900">
                Real-Time CRM Job Webhooks
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Point Jobber, Housecall Pro, or ServiceTitan &ldquo;Job Completed&rdquo; webhooks straight here. Duplicate job IDs are automatically ignored.
              </p>

              <div className="mt-4 rounded-2xl bg-slate-900 p-4 text-xs text-slate-200">
                <p className="font-bold text-slate-400 uppercase">Live Webhook Endpoint</p>
                <code className="mt-1 block break-all text-orange-300">
                  POST {origin}/api/webhooks/crm/jobber?biz={business.slug}&amp;key={business.webhookKey}
                </code>
              </div>

              <div className="mt-4 flex flex-wrap gap-2.5">
                <button
                  type="button"
                  onClick={() => handleSimulateWebhook('jobber')}
                  className="cursor-pointer rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-700"
                >
                  Simulate Jobber Job
                </button>
                <button
                  type="button"
                  onClick={() => handleSimulateWebhook('housecall_pro')}
                  className="cursor-pointer rounded-xl bg-sky-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-sky-700"
                >
                  Simulate Housecall Pro Job
                </button>
                <button
                  type="button"
                  onClick={() => handleSimulateWebhook('servicetitan')}
                  className="cursor-pointer rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-800"
                >
                  Simulate ServiceTitan Job
                </button>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-orange-600" />
                <h2 className="text-lg font-extrabold text-slate-900">
                  CSV Batch Job Import (Switching from NiceJob/Birdeye)
                </h2>
              </div>
              <textarea
                rows={4}
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                className="mt-3 w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 font-mono text-xs text-slate-800 focus:border-orange-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
              />
              <button
                type="button"
                onClick={handleImportCsv}
                className="mt-3 cursor-pointer rounded-xl bg-orange-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-orange-700"
              >
                Import CSV &amp; Queue SMS Links
              </button>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 lg:col-span-5">
            <h3 className="text-sm font-extrabold text-slate-900 uppercase">
              Recent Webhook Deliveries ({webhookLogs.length})
            </h3>
            <div className="mt-4 space-y-2.5">
              {webhookLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 px-3.5 py-2.5 text-xs"
                >
                  <div>
                    <p className="font-bold text-slate-900">
                      {log.provider.replace('_', ' ')} · {log.customerName}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {log.serviceType} ({log.externalId})
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                      log.status === 'processed'
                        ? 'bg-emerald-100 text-emerald-800'
                        : log.status === 'duplicate'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {log.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {/* TAB 3: SMS & EMAIL CADENCE */}
      {tab === 'cadence' ? (
        <div className="mt-6 grid gap-6 lg:grid-cols-12">
          <form
            onSubmit={handleSaveSettings}
            className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 lg:col-span-6"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-extrabold text-slate-900">
                Multi-Channel Cadence Rules
              </h2>
              <button
                type="submit"
                className="cursor-pointer rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800"
              >
                Save Cadence
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Automatically stops sending follow-ups as soon as the customer drafts or copies their review.
            </p>

            {cadenceDraft.map((step, idx) => (
              <div
                key={step.stepNumber}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-extrabold text-slate-900 uppercase">
                    Step {step.stepNumber} · {step.channel.toUpperCase()} (+{step.delayHours}h)
                  </span>
                  <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                    <input
                      type="checkbox"
                      checked={step.enabled}
                      onChange={(e) => {
                        const next = [...cadenceDraft];
                        next[idx] = { ...step, enabled: e.target.checked };
                        setCadenceDraft(next);
                      }}
                    />
                    Enabled
                  </label>
                </div>
                <textarea
                  rows={3}
                  value={step.template}
                  onChange={(e) => {
                    const next = [...cadenceDraft];
                    next[idx] = { ...step, template: e.target.value };
                    setCadenceDraft(next);
                  }}
                  className="mt-2.5 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-800"
                />
              </div>
            ))}
          </form>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 lg:col-span-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-extrabold text-slate-900">
                Outbound Queue ({messages.length})
              </h2>
              <button
                type="button"
                onClick={handleDispatchCadence}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-orange-600 px-4 py-2 text-xs font-bold text-white hover:bg-orange-700"
              >
                <Send className="h-3.5 w-3.5" />
                <span>Dispatch Due Follow-Ups Now</span>
              </button>
            </div>

            <div className="mt-4 max-h-[520px] space-y-2.5 overflow-y-auto pr-1">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className="rounded-2xl border border-slate-100 bg-slate-50 p-3.5 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800">
                      Step {m.stepNumber} ({m.channel.toUpperCase()}) → {m.recipient}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                        m.status === 'sent'
                          ? 'bg-emerald-100 text-emerald-800'
                          : m.status === 'suppressed'
                            ? 'bg-slate-200 text-slate-600'
                            : 'bg-sky-100 text-sky-800'
                      }`}
                    >
                      {m.status}
                    </span>
                  </div>
                  <p className="mt-1.5 text-slate-600">{m.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {/* TAB 4: CREW, SETTINGS & QR */}
      {tab === 'crew' ? (
        <div className="mt-6 grid gap-6 lg:grid-cols-12">
          <form
            onSubmit={handleSaveSettings}
            className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 lg:col-span-6"
          >
            <h2 className="text-lg font-extrabold text-slate-900">
              Shop Profile &amp; Google Maps Link
            </h2>
            <div>
              <label className="block text-xs font-bold text-slate-700">Business Name</label>
              <input
                type="text"
                value={bizName}
                onChange={(e) => setBizName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700">Primary Trade</label>
              <select
                value={bizTrade}
                onChange={(e) => setBizTrade(e.target.value as TradeKind)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm"
              >
                {(Object.keys(TRADE_LABELS) as TradeKind[]).map((t) => (
                  <option key={t} value={t}>
                    {TRADE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700">
                Google Maps Place Review URL
              </label>
              <input
                type="url"
                value={bizGoogleUrl}
                onChange={(e) => setBizGoogleUrl(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700">
                Technicians (comma-separated)
              </label>
              <input
                type="text"
                value={bizTechsInput}
                onChange={(e) => setBizTechsInput(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm"
              />
            </div>
            <button
              type="submit"
              className="cursor-pointer rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white hover:bg-slate-800"
            >
              Save Profile &amp; Crew
            </button>
          </form>

          <div className="space-y-6 lg:col-span-6">
            <div className="rounded-3xl border border-slate-200 bg-white p-6">
              <h2 className="text-lg font-extrabold text-slate-900">
                Technician Review Leaderboard
              </h2>
              <div className="mt-4 space-y-2.5">
                {techLeaderboard.map((tech) => (
                  <div
                    key={tech.techName}
                    className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-sm"
                  >
                    <div>
                      <p className="font-extrabold text-slate-900">{tech.techName}</p>
                      <p className="text-xs text-slate-500">
                        {tech.jobsSent} jobs dispatched · {tech.avgRating} avg stars
                      </p>
                    </div>
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-extrabold text-emerald-800">
                      {tech.reviewsCopied} Google reviews
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-900 p-6 text-white">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-orange-400 uppercase">
                    <QrCode className="h-4 w-4" />
                    Truck Decal &amp; Invoice Check-In
                  </span>
                  <h3 className="mt-2 text-lg font-extrabold">
                    Walk-In / QR Voice Check-In Hub
                  </h3>
                  <p className="mt-1 text-xs text-slate-300">
                    Put this URL on invoices, door hangers, or tailgate decals for instant 10s voice check-ins without waiting for a CRM webhook.
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => onNavigate(`/biz/${business.slug}`)}
                  className="cursor-pointer rounded-xl bg-orange-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-orange-700"
                >
                  Open /biz/{business.slug}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    copyTextSafe(`${origin}/biz/${business.slug}`);
                    showToastMsg('Copied QR Hub URL!');
                  }}
                  className="cursor-pointer rounded-xl border border-slate-700 px-4 py-2.5 text-xs font-bold text-slate-200 hover:bg-slate-800"
                >
                  Copy Public URL
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* TAB 5: $29/MO PLAN */}
      {tab === 'billing' ? (
        <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-extrabold text-emerald-800">
                NO MULTI-YEAR LOCK-IN
              </span>
              <h2 className="mt-3 text-2xl font-extrabold text-slate-900">
                TradeVouch Flat — $29/month
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Includes unlimited jobs, unlimited crew technicians, AI Voice-to-Review assistant, and Jobber/Housecall Pro/ServiceTitan webhooks.
              </p>
            </div>
            <div className="rounded-2xl bg-slate-50 px-6 py-4 text-right">
              <p className="text-xs font-bold text-slate-500">Annual Savings vs Competitors</p>
              <p className="text-2xl font-extrabold text-emerald-600">
                ${metrics.annualSavingsVsNiceJob}/yr vs NiceJob · ${metrics.annualSavingsVsBirdeye}/yr vs Birdeye
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
