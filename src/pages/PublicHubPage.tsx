import { useEffect, useState } from 'react';
import { CheckCircle2, Mic, QrCode, Star, Wrench } from 'lucide-react';
import { TRADE_LABELS } from '../../shared/reviewAi';
import { api, ApiError, type PublicHubResponse } from '../lib/api';

interface PublicHubPageProps {
  slug: string;
  onNavigate: (path: string) => void;
}

export function PublicHubPage({ slug, onNavigate }: PublicHubPageProps) {
  const [hub, setHub] = useState<PublicHubResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [customerName, setCustomerName] = useState('');
  const [techName, setTechName] = useState('');
  const [serviceType, setServiceType] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setLoading(true);
    api
      .getPublicHub(slug)
      .then((data) => {
        setHub(data);
        setTechName(data.business.technicians[0] || 'Lead Technician');
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : 'Hub not found.');
      })
      .finally(() => setLoading(false));
  }, [slug]);

  const handleStartCheckin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await api.checkinPublicHub(slug, {
        customerName: customerName || 'Verified Homeowner',
        techName,
        serviceType: serviceType || 'Recent Service Visit',
      });
      onNavigate(`/r/${res.token}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not launch voice check-in.');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-orange-600 border-t-transparent" />
      </div>
    );
  }

  if (error || !hub) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-sm font-bold text-rose-700">{error || 'Business hub not found.'}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="grid gap-8 lg:grid-cols-12">
        {/* Walk-in QR Card */}
        <div className="lg:col-span-5">
          <div className="rounded-3xl border border-slate-200 bg-slate-900 p-6 text-white shadow-xl">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-600/20 px-3 py-1 text-xs font-extrabold text-orange-300">
              <QrCode className="h-3.5 w-3.5" />
              Job-Site Voice Check-In
            </span>
            <h1 className="mt-3 text-2xl font-extrabold">{hub.business.name}</h1>
            <p className="mt-1 text-xs text-slate-300">
              {TRADE_LABELS[hub.business.trade]} · {hub.avgRating} ★ ({hub.totalReviews} verified reviews)
            </p>

            <form onSubmit={handleStartCheckin} className="mt-5 space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-300">Your Name</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. Alex Taylor"
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-sm text-white placeholder:text-slate-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-300">
                  Technician Who Helped You
                </label>
                <select
                  value={techName}
                  onChange={(e) => setTechName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-sm text-white"
                >
                  {hub.business.technicians.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-300">Work Done</label>
                <input
                  type="text"
                  value={serviceType}
                  onChange={(e) => setServiceType(e.target.value)}
                  placeholder="e.g. Roof Leak Repair / Water Heater"
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-sm text-white placeholder:text-slate-500"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-orange-600 px-4 py-3 text-sm font-extrabold text-white hover:bg-orange-700 disabled:opacity-60"
              >
                <Mic className="h-4 w-4" />
                <span>{submitting ? 'Opening...' : 'Leave 10s Voice Review'}</span>
              </button>
            </form>
          </div>
        </div>

        {/* Verified Reviews Feed */}
        <div className="space-y-4 lg:col-span-7">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-extrabold text-slate-900">
              Verified Homeowner Reviews
            </h2>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-extrabold text-emerald-800">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Captured by Voice-to-Review
            </span>
          </div>

          {hub.reviews.map((rev) => (
            <div
              key={rev.id}
              className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-xs font-extrabold text-white">
                    {rev.customerFirstName.slice(0, 1)}
                  </div>
                  <div>
                    <p className="text-sm font-extrabold text-slate-900">
                      {rev.customerFirstName}
                    </p>
                    <p className="text-[11px] font-medium text-slate-500">
                      <Wrench className="mr-1 inline h-3 w-3 text-orange-600" />
                      {rev.serviceType} · Tech: {rev.techName}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-0.5 text-amber-400">
                  {Array.from({ length: rev.rating }).map((_, idx) => (
                    <Star key={idx} className="h-4 w-4 fill-amber-400" />
                  ))}
                </div>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-slate-700">
                &ldquo;{rev.reviewText}&rdquo;
              </p>
              {rev.ownerReply ? (
                <div className="mt-3 rounded-2xl bg-slate-50 p-3 text-xs text-slate-600">
                  <strong className="text-slate-900">Reply from {hub.business.name}:</strong>{' '}
                  {rev.ownerReply}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
