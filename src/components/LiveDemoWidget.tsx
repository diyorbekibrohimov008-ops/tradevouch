import { useState } from 'react';
import { CheckCircle2, Copy, ExternalLink, Sparkles, Star } from 'lucide-react';
import {
  buildGoogleMapsReviewUrl,
  draftTradeReview,
  SAMPLE_VOICE_CLIPS,
} from '../../shared/reviewAi';
import type { ReviewInputMode, ReviewTone, TradeKind } from '../../shared/types';
import { copyTextSafe } from '../lib/api';
import { VoiceRecorderInput } from './VoiceRecorderInput';

const DEMO_TRADES: Array<{ id: TradeKind; label: string; businessName: string }> = [
  { id: 'roofing', label: 'Roofing', businessName: 'PeakLine Roofing' },
  { id: 'plumbing', label: 'Plumbing', businessName: 'CopperPipe Plumbing' },
  { id: 'detailing', label: 'Auto Detailing', businessName: 'MirrorCoat Detailing' },
];

export function LiveDemoWidget() {
  const [trade, setTrade] = useState<TradeKind>('roofing');
  const [inputMode, setInputMode] = useState<ReviewInputMode>('voice');
  const [transcript, setTranscript] = useState(SAMPLE_VOICE_CLIPS.roofing.transcript);
  const [quickHighlights, setQuickHighlights] = useState<string[]>(['On-time arrival']);
  const [extraNote, setExtraNote] = useState('');
  const [tone, setTone] = useState<ReviewTone>('warm');
  const [copied, setCopied] = useState(false);

  const meta = DEMO_TRADES.find((t) => t.id === trade) ?? DEMO_TRADES[0];
  const clip = SAMPLE_VOICE_CLIPS[trade];

  const handleTradeSwitch = (nextTrade: TradeKind) => {
    setTrade(nextTrade);
    setTranscript(SAMPLE_VOICE_CLIPS[nextTrade].transcript);
    setQuickHighlights(['On-time arrival']);
    setCopied(false);
  };

  const toggleHighlight = (label: string) => {
    setQuickHighlights((prev) =>
      prev.includes(label) ? prev.filter((item) => item !== label) : [...prev, label],
    );
  };

  const result = draftTradeReview({
    businessName: meta.businessName,
    trade,
    techName: clip.techName,
    serviceType: clip.serviceType,
    rating: 5,
    inputMode,
    rawTranscript: transcript,
    quickHighlights,
    extraNote,
    tone,
  });

  const handleCopyAndOpen = async () => {
    await copyTextSafe(result.draftText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="rounded-3xl border border-slate-200/90 bg-white p-5 shadow-xl shadow-slate-900/5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3.5">
        <div>
          <span className="inline-flex items-center gap-1.5 text-xs font-extrabold tracking-wide text-orange-600 uppercase">
            <Sparkles className="h-3.5 w-3.5" />
            Live AI Voice-to-Review Simulator
          </span>
          <p className="text-xs text-slate-500">
            What homeowners see when they tap your SMS link
          </p>
        </div>
        <div className="flex gap-1.5">
          {DEMO_TRADES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => handleTradeSwitch(t.id)}
              className={`cursor-pointer rounded-full px-3 py-1 text-xs font-bold transition ${
                trade === t.id
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 rounded-2xl bg-slate-900 px-4 py-3 text-white">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-300">
            {meta.businessName} · Verified Job
          </span>
          <span className="inline-flex items-center gap-1 font-bold text-amber-400">
            <Star className="h-3.5 w-3.5 fill-amber-400" />
            5.0 Experience
          </span>
        </div>
        <p className="mt-1 text-sm font-bold">
          Tech: {clip.techName} — {clip.serviceType}
        </p>
      </div>

      <div className="mt-4">
        <VoiceRecorderInput
          trade={trade}
          techName={clip.techName}
          inputMode={inputMode}
          onInputModeChange={setInputMode}
          transcript={transcript}
          onTranscriptChange={setTranscript}
          quickHighlights={quickHighlights}
          onToggleHighlight={toggleHighlight}
          extraNote={extraNote}
          onExtraNoteChange={setExtraNote}
        />
      </div>

      {/* Drafted Google Review Output */}
      <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-extrabold text-emerald-900">
              AI-Drafted Google Maps Review
            </span>
            {result.fillersRemoved > 0 ? (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
                {result.fillersRemoved} filler words cleaned
              </span>
            ) : null}
          </div>
          <div className="flex gap-1">
            {(['warm', 'short', 'detailed'] as ReviewTone[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTone(t)}
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

        <p className="mt-2.5 text-sm leading-relaxed font-medium text-slate-800">
          &ldquo;{result.draftText}&rdquo;
        </p>

        <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleCopyAndOpen}
            className="inline-flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700"
          >
            {copied ? (
              <>
                <CheckCircle2 className="h-4 w-4" />
                <span>Copied! Ready to Paste on Google Maps</span>
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                <span>Copy Review &amp; Open Google Maps</span>
              </>
            )}
          </button>
          <a
            href={buildGoogleMapsReviewUrl('', meta.businessName)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-xl border border-emerald-300 bg-white px-3 py-2.5 text-xs font-bold text-emerald-800 hover:bg-emerald-50"
          >
            <span>Preview Maps</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}
