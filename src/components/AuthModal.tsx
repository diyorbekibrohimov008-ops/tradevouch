import { useState } from 'react';
import { X } from 'lucide-react';
import { TRADE_LABELS } from '../../shared/reviewAi';
import type { BusinessProfile, TradeKind } from '../../shared/types';
import { api, ApiError } from '../lib/api';

interface AuthModalProps {
  mode: 'login' | 'register';
  onClose: () => void;
  onSuccess: (token: string, business: BusinessProfile) => void;
}

export function AuthModal({ mode: initialMode, onClose, onSuccess }: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [businessName, setBusinessName] = useState('');
  const [trade, setTrade] = useState<TradeKind>('roofing');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [googleMapsUrl, setGoogleMapsUrl] = useState('');
  const [competitor, setCompetitor] = useState<'nicejob' | 'birdeye' | 'none'>('nicejob');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'register') {
        const res = await api.register({
          businessName,
          trade,
          email,
          password,
          googleMapsUrl,
          competitorSwitchedFrom: competitor,
        });
        onSuccess(res.token, res.business);
      } else {
        const res = await api.login({ email, password });
        onSuccess(res.token, res.business);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to authenticate.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs overscroll-contain">
      <div className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl overscroll-contain">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close modal"
          className="absolute top-4 right-4 cursor-pointer rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="h-5 w-5" />
        </button>

        <h2 className="text-xl font-extrabold text-slate-900">
          {mode === 'register'
            ? 'Launch Your $29/mo TradeVouch Account'
            : 'Sign in to TradeVouch'}
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          {mode === 'register'
            ? 'Flat $29/mo. No annual lock-in. Instant CRM webhook & SMS links.'
            : 'Access your review pipeline, CRM webhooks, and technician leaderboard.'}
        </p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-3.5">
          {mode === 'register' ? (
            <>
              <div>
                <label className="block text-xs font-bold text-slate-700">Business Name</label>
                <input
                  required
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="e.g. LoneStar Plumbing & Drain"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:border-orange-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700">Trade</label>
                  <select
                    value={trade}
                    onChange={(e) => setTrade(e.target.value as TradeKind)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-orange-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
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
                    Switching from
                  </label>
                  <select
                    value={competitor}
                    onChange={(e) =>
                      setCompetitor(e.target.value as 'nicejob' | 'birdeye' | 'none')
                    }
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-orange-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
                  >
                    <option value="nicejob">NiceJob ($75–$125/mo)</option>
                    <option value="birdeye">Birdeye ($250+/mo)</option>
                    <option value="none">Starting Fresh</option>
                  </select>
                </div>
              </div>
            </>
          ) : null}

          <div>
            <label className="block text-xs font-bold text-slate-700">Work Email</label>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="owner@yourtrade.com"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:border-orange-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700">Password</label>
            <input
              required
              minLength={6}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:border-orange-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
            />
          </div>

          {mode === 'register' ? (
            <div>
              <label className="block text-xs font-bold text-slate-700">
                Google Maps Review Link (optional)
              </label>
              <input
                type="url"
                value={googleMapsUrl}
                onChange={(e) => setGoogleMapsUrl(e.target.value)}
                placeholder="https://search.google.com/local/writereview?placeid=…"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:border-orange-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
              />
            </div>
          ) : null}

          {error ? (
            <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full cursor-pointer rounded-xl bg-orange-600 px-4 py-3 text-sm font-bold text-white shadow-md transition hover:bg-orange-700 disabled:opacity-60"
          >
            {loading
              ? 'Working…'
              : mode === 'register'
                ? 'Create Account & Open Studio'
                : 'Sign In to Studio'}
          </button>
        </form>

        <div className="mt-4 text-center text-xs text-slate-500">
          {mode === 'register' ? (
            <>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => setMode('login')}
                className="cursor-pointer font-bold text-orange-600 hover:underline"
              >
                Sign in
              </button>
            </>
          ) : (
            <>
              New contractor?{' '}
              <button
                type="button"
                onClick={() => setMode('register')}
                className="cursor-pointer font-bold text-orange-600 hover:underline"
              >
                Create $29/mo account
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
