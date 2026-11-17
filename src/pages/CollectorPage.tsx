import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Edit3,
  ExternalLink,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
} from 'lucide-react';
import { TRADE_LABELS } from '../../shared/reviewAi';
import type {
  PublicCollectorContext,
  ReviewInputMode,
  ReviewTone,
} from '../../shared/types';
import { api, ApiError, copyTextSafe } from '../lib/api';
import { VoiceRecorderInput } from '../components/VoiceRecorderInput';

interface CollectorPageProps {
  token: string;
  onNavigate: (path: string) => void;
}

export function CollectorPage({ token, onNavigate }: CollectorPageProps) {
  const [ctx, setCtx] = useState<PublicCollectorContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [rating, setRating] = useState<number>(5);
  const [ratingPicked, setRatingPicked] = useState(false);
  const [inputMode, setInputMode] = useState<ReviewInputMode>('voice');
  const [transcript, setTranscript] = useState('');
  const [quickHighlights, setQuickHighlights] = useState<string[]>([]);
  const [extraNote, setExtraNote] = useState('');
  const [tone, setTone] = useState<ReviewTone>('warm');

  const [draftedReview, setDraftedReview] = useState('');
  const [fillersRemoved, setFillersRemoved] = useState(0);
  const [editingDraft, setEditingDraft] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [copiedBanner, setCopiedBanner] = useState(false);

  const [privateMessage, setPrivateMessage] = useState('');
  const [privateSent, setPrivateSent] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    api
      .getCollector(token)
      .then((data) => {
        if (!active) return;
        setCtx(data);
        if (data.rating) {
          setRating(data.rating);
          setRatingPicked(true);
        }
        if (data.inputMode) setInputMode(data.inputMode);
        if (data.rawTranscript) setTranscript(data.rawTranscript);
        if (data.quickHighlights?.length) setQuickHighlights(data.quickHighlights);
        if (data.extraNote) setExtraNote(data.extraNote);
        if (data.tone) setTone(data.tone);
        if (data.draftedReview) setDraftedReview(data.draftedReview);
        setFillersRemoved(data.fillersRemoved || 0);
        if (data.status === 'private_feedback') {
          setPrivateSent(true);
          setPrivateMessage(data.privateFeedback);
        }
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof ApiError ? err.message : 'Review link could not be loaded.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token]);

  const toggleHighlight = (label: string) => {
    setQuickHighlights((prev) =>
      prev.includes(label) ? prev.filter((x) => x !== label) : [...prev, label],
    );
  };

  const handleDraft = async (nextTone: ReviewTone = tone) => {
    if (!ctx) return;
    setDrafting(true);
    setError('');
    try {
      const res = await api.draftCollectorReview(token, {
        rating,
        inputMode,
        rawTranscript: transcript,
        quickHighlights,
        extraNote,
        tone: nextTone,
      });
      setDraftedReview(res.draft.draftText);
      setFillersRemoved(res.draft.fillersRemoved);
      setTone(nextTone);
      setEditingDraft(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not generate review draft.');
    } finally {
      setDrafting(false);
    }
  };

  const handleCopyAndLaunchGoogle = async () => {
    if (!ctx || !draftedReview.trim()) return;
    await copyTextSafe(draftedReview.trim());
    setCopiedBanner(true);
    try {
      await api.trackCollectorAction(token, {
        action: 'copied_to_google',
        draftedReview: draftedReview.trim(),
        rating,
      });
    } catch {
      // keep copy UX smooth
    }
    window.open(ctx.business.googleMapsUrl, '_blank', 'noopener,noreferrer');
  };

  const handlePrivateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!privateMessage.trim()) return;
    try {
      await api.trackCollectorAction(token, {
        action: 'private_feedback',
        privateFeedback: privateMessage.trim(),
        rating,
      });
      setPrivateSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send private note.');
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-orange-600 border-t-transparent" />
        <p className="mt-3 text-sm font-semibold text-slate-600">
          Loading your 10-second review helper…
        </p>
      </div>
    );
  }

  if (error && !ctx) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <AlertTriangle className="mx-auto h-10 w-10 text-amber-500" />
          <h1 className="mt-4 text-xl font-extrabold text-slate-900">
            Review link not found
          </h1>
          <p className="mt-2 text-sm text-slate-600">{error}</p>
          <button
            type="button"
            onClick={() => onNavigate('/')}
            className="mt-6 cursor-pointer rounded-full bg-slate-900 px-5 py-2.5 text-xs font-bold text-white"
          >
            Back to TradeVouch Home
          </button>
        </div>
      </div>
    );
  }

  if (!ctx) return null;

  const firstName = ctx.customerName.split(/\s+/)[0] || 'there';

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gradient-to-b from-slate-100/70 to-[#f4f5f7] px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-xl">
        {/* Header Card */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-900/5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <span className="inline-flex rounded-full bg-orange-100 px-3 py-0.5 text-[11px] font-extrabold text-orange-800">
                {TRADE_LABELS[ctx.business.trade]}
              </span>
              <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900">
                {ctx.business.name}
              </h1>
            </div>
            <div className="rounded-2xl bg-slate-900 px-3.5 py-2 text-right text-white">
              <p className="text-[10px] font-bold text-slate-400 uppercase">Technician</p>
              <p className="text-xs font-extrabold text-orange-300">{ctx.techName}</p>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-slate-200/80 bg-slate-50 px-4 py-3">
            <p className="text-sm font-bold text-slate-800">
              Hi {firstName}! Thanks for trusting us with your{' '}
              <span className="text-orange-700">{ctx.serviceType}</span>.
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              Skip the blank text box — speak a 10s voice note or tap 2 answers and we&apos;ll write your review for you.
            </p>
          </div>

          {/* Step 1: Star check */}
          <div className="mt-6">
            <p className="text-xs font-extrabold tracking-wide text-slate-500 uppercase">
              1. How did {ctx.techName.split(' ')[0]} do today?
            </p>
            <div className="mt-2.5 flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => {
                const active = star <= rating;
                return (
                  <button
                    key={star}
                    type="button"
                    aria-label={`${star} stars`}
                    onClick={() => {
                      setRating(star);
                      setRatingPicked(true);
                    }}
                    className={`flex h-11 w-11 cursor-pointer items-center justify-center rounded-2xl border transition ${
                      active
                        ? 'border-amber-400 bg-amber-50 text-amber-500 shadow-xs'
                        : 'border-slate-200 bg-white text-slate-300 hover:border-slate-300'
                    }`}
                  >
                    <Star className={`h-5 w-5 ${active ? 'fill-amber-400' : ''}`} />
                  </button>
                );
              })}
              <span className="ml-2 text-xs font-bold text-slate-600">
                {ratingPicked ? `${rating}/5 stars` : 'Tap to rate'}
              </span>
            </div>
          </div>

          {/* Private resolution flow when rating <= 3 */}
          {ratingPicked && rating <= 3 ? (
            <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
                <div>
                  <h2 className="text-sm font-extrabold text-slate-900">
                    Tell {ctx.business.name}&apos;s owner directly so we can make it right today
                  </h2>
                  <p className="mt-1 text-xs text-slate-600">
                    Your note goes straight to the shop owner—never lost in an inbox.
                  </p>
                </div>
              </div>

              {privateSent ? (
                <div className="mt-3 rounded-xl bg-white p-3 text-xs font-semibold text-emerald-800">
                  Sent directly to the owner! Thank you for giving us a chance to fix this.
                </div>
              ) : (
                <form onSubmit={handlePrivateSubmit} className="mt-3 space-y-2.5">
                  <textarea
                    rows={3}
                    required
                    value={privateMessage}
                    onChange={(e) => setPrivateMessage(e.target.value)}
                    placeholder="What could we have done better on this visit?"
                    className="w-full rounded-xl border border-amber-200 bg-white px-3.5 py-2.5 text-sm focus:border-orange-500 focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-800"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>Send Private Note to Owner</span>
                  </button>
                </form>
              )}

              <div className="mt-3 border-t border-amber-200/70 pt-2.5">
                <a
                  href={ctx.business.googleMapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 underline hover:text-slate-900"
                >
                  <span>Or leave a public review on Google Maps</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          ) : (
            <>
              {/* Step 2: Voice or 2 Questions */}
              <div className="mt-6">
                <p className="mb-2.5 text-xs font-extrabold tracking-wide text-slate-500 uppercase">
                  2. Speak 10 seconds or tap 2 answers
                </p>
                <VoiceRecorderInput
                  trade={ctx.business.trade}
                  techName={ctx.techName}
                  inputMode={inputMode}
                  onInputModeChange={setInputMode}
                  transcript={transcript}
                  onTranscriptChange={setTranscript}
                  quickHighlights={quickHighlights}
                  onToggleHighlight={toggleHighlight}
                  extraNote={extraNote}
                  onExtraNoteChange={setExtraNote}
                />

                <button
                  type="button"
                  disabled={drafting}
                  onClick={() => handleDraft(tone)}
                  className="mt-4 flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3.5 text-sm font-bold text-white shadow-md transition hover:bg-slate-800 disabled:opacity-60"
                >
                  <Sparkles className="h-4 w-4 text-orange-400" />
                  <span>{drafting ? 'Drafting Your Review...' : 'Draft My Review'}</span>
                </button>
              </div>
            </>
          )}

          {error ? (
            <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
              {error}
            </p>
          ) : null}

          {/* Step 3: Drafted Review + 1-Click Copy to Google Maps */}
          {draftedReview ? (
            <div className="mt-6 rounded-3xl border-2 border-emerald-500/40 bg-emerald-50/70 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-extrabold text-emerald-900 uppercase">
                    Your Ready-to-Post Review
                  </span>
                  {fillersRemoved > 0 ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
                      {fillersRemoved} fillers cleaned
                    </span>
                  ) : null}
                </div>

                <div className="flex items-center gap-1">
                  {(['warm', 'short', 'detailed'] as ReviewTone[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => handleDraft(t)}
                      className={`cursor-pointer rounded-full px-2.5 py-0.5 text-[11px] font-bold capitalize transition ${
                        tone === t
                          ? 'bg-emerald-700 text-white'
                          : 'bg-white text-emerald-800 hover:bg-emerald-100'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {editingDraft ? (
                <textarea
                  rows={4}
                  value={draftedReview}
                  onChange={(e) => setDraftedReview(e.target.value)}
                  className="mt-3 w-full rounded-2xl border border-emerald-300 bg-white p-3 text-sm leading-relaxed text-slate-800 focus:border-emerald-600 focus:outline-none"
                />
              ) : (
                <p className="mt-3 text-sm leading-relaxed font-medium text-slate-900">
                  &ldquo;{draftedReview}&rdquo;
                </p>
              )}

              <div className="mt-3 flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => setEditingDraft((v) => !v)}
                  className="inline-flex cursor-pointer items-center gap-1 font-bold text-emerald-800 hover:underline"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  <span>{editingDraft ? 'Done Editing' : 'Edit Text'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDraft(tone)}
                  className="inline-flex cursor-pointer items-center gap-1 font-bold text-emerald-800 hover:underline"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Refresh Draft</span>
                </button>
              </div>

              <button
                type="button"
                onClick={handleCopyAndLaunchGoogle}
                className="mt-4 flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-4 text-sm font-extrabold text-white shadow-lg shadow-emerald-600/25 transition hover:bg-emerald-700"
              >
                <Copy className="h-4 w-4" />
                <span>Copy Review &amp; Open Google Maps</span>
                <ExternalLink className="h-4 w-4" />
              </button>

              {copiedBanner ? (
                <div className="mt-3 flex items-center gap-2 rounded-xl bg-white px-3.5 py-2.5 text-xs font-bold text-emerald-800 shadow-xs">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                  <span>
                    Copied to clipboard! Just tap Paste &amp; Post in the Google Maps tab.
                  </span>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
