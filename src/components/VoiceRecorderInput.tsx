import { useEffect, useRef, useState } from 'react';
import { Check, Mic, MessageSquareText, Sparkles, Square, Volume2 } from 'lucide-react';
import {
  SAMPLE_VOICE_CLIPS,
  TECH_SHOUTOUT_CHIPS,
  TRADE_HIGHLIGHT_CHIPS,
} from '../../shared/reviewAi';
import type { ReviewInputMode, TradeKind } from '../../shared/types';

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

interface VoiceRecorderInputProps {
  trade: TradeKind;
  techName: string;
  inputMode: ReviewInputMode;
  onInputModeChange: (mode: ReviewInputMode) => void;
  transcript: string;
  onTranscriptChange: (val: string) => void;
  quickHighlights: string[];
  onToggleHighlight: (label: string) => void;
  extraNote: string;
  onExtraNoteChange: (val: string) => void;
}

export function VoiceRecorderInput({
  trade,
  techName,
  inputMode,
  onInputModeChange,
  transcript,
  onTranscriptChange,
  quickHighlights,
  onToggleHighlight,
  extraNote,
  onExtraNoteChange,
}: VoiceRecorderInputProps) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [micNote, setMicNote] = useState('');
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const timerRef = useRef<number | null>(null);

  const sampleClip = SAMPLE_VOICE_CLIPS[trade] ?? SAMPLE_VOICE_CLIPS.roofing;
  const highlightChips = TRADE_HIGHLIGHT_CHIPS[trade] ?? TRADE_HIGHLIGHT_CHIPS.roofing;

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      try {
        recognitionRef.current?.stop();
      } catch {
        // ignore cleanup error
      }
    };
  }, []);

  const stopRecording = () => {
    setRecording(false);
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    try {
      recognitionRef.current?.stop();
    } catch {
      // ignore
    }
  };

  const startRecording = () => {
    setMicNote('');
    const win = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const Rec = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!Rec) {
      setRecording(true);
      setSeconds(0);
      setMicNote('Live browser speech-to-text unavailable here — tap "Use Sample 10s Voice Note" or type a few casual words.');
      timerRef.current = window.setInterval(() => {
        setSeconds((s) => {
          if (s >= 10) {
            stopRecording();
            onTranscriptChange(sampleClip.transcript);
            return 10;
          }
          return s + 1;
        });
      }, 300);
      return;
    }

    try {
      const rec = new Rec();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'en-US';
      rec.onresult = (event) => {
        let full = '';
        for (let i = 0; i < event.results.length; i += 1) {
          full += event.results[i][0]?.transcript ?? '';
          full += ' ';
        }
        onTranscriptChange(full.trim());
      };
      rec.onerror = () => {
        setMicNote('Mic blocked or unavailable — loaded sample voice note so you can test right away.');
        onTranscriptChange(sampleClip.transcript);
        stopRecording();
      };
      rec.onend = () => {
        setRecording(false);
        if (timerRef.current) {
          window.clearInterval(timerRef.current);
          timerRef.current = null;
        }
      };
      recognitionRef.current = rec;
      rec.start();
      setRecording(true);
      setSeconds(0);
      timerRef.current = window.setInterval(() => {
        setSeconds((s) => {
          if (s >= 15) {
            stopRecording();
            return 15;
          }
          return s + 1;
        });
      }, 1000);
    } catch {
      setMicNote('Could not access mic — tap "Use Sample 10s Voice Note" below.');
    }
  };

  return (
    <div className="space-y-4">
      {/* Mode Switcher */}
      <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1.5">
        <button
          type="button"
          onClick={() => onInputModeChange('voice')}
          className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold transition ${
            inputMode === 'voice'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Mic className="h-4 w-4 text-orange-600" />
          <span>10s Voice Note</span>
        </button>
        <button
          type="button"
          onClick={() => onInputModeChange('questions')}
          className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold transition ${
            inputMode === 'questions'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <MessageSquareText className="h-4 w-4 text-orange-600" />
          <span>2 Quick Questions</span>
        </button>
      </div>

      {inputMode === 'voice' ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col items-center text-center">
            <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
              Just speak naturally for 10 seconds — AI cleans up &quot;ums&quot; &amp; formats it
            </p>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
              {!recording ? (
                <button
                  type="button"
                  onClick={startRecording}
                  className="inline-flex cursor-pointer items-center gap-2.5 rounded-full bg-orange-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-orange-600/25 transition hover:bg-orange-700"
                >
                  <Mic className="h-4 w-4" />
                  <span>Tap to Speak (10s)</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopRecording}
                  className="animate-mic-ring inline-flex cursor-pointer items-center gap-2.5 rounded-full bg-rose-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg transition hover:bg-rose-700"
                >
                  <Square className="h-3.5 w-3.5 fill-current" />
                  <span>Listening… {seconds}s (Tap to Finish)</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setMicNote('');
                  onTranscriptChange(sampleClip.transcript);
                }}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-slate-300 bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-100"
              >
                <Volume2 className="h-3.5 w-3.5 text-orange-600" />
                <span>Use Sample 10s Voice Note</span>
              </button>
            </div>

            {micNote ? (
              <p className="mt-2.5 text-xs text-amber-700">{micNote}</p>
            ) : null}
          </div>

          <div className="mt-4">
            <label className="block text-xs font-semibold text-slate-500">
              Spoken transcript (auto-transcribed or edit casually):
            </label>
            <textarea
              rows={3}
              value={transcript}
              onChange={(e) => onTranscriptChange(e.target.value)}
              placeholder={`e.g. "Um ${techName.split(' ')[0]} showed up right on time, fixed our leak fast, and left everything spotless..."`}
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-orange-500 focus:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
            />
          </div>
        </div>
      ) : (
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div>
            <p className="text-xs font-bold tracking-wide text-slate-500 uppercase">
              Question 1 of 2 — What stood out most?
            </p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {highlightChips.map((chip) => {
                const selected = quickHighlights.includes(chip);
                return (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => onToggleHighlight(chip)}
                    className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-bold transition ${
                      selected
                        ? 'border-orange-600 bg-orange-50 text-orange-800'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    {selected ? <Check className="h-3.5 w-3.5 text-orange-600" /> : null}
                    <span>{chip}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-xs font-bold tracking-wide text-slate-500 uppercase">
              Question 2 of 2 — Shoutout for {techName}?
            </p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {TECH_SHOUTOUT_CHIPS.map((chip) => {
                const selected = quickHighlights.includes(chip);
                return (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => onToggleHighlight(chip)}
                    className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-bold transition ${
                      selected
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    {selected ? <Sparkles className="h-3 w-3 text-emerald-600" /> : null}
                    <span>{chip}</span>
                  </button>
                );
              })}
            </div>

            <input
              type="text"
              value={extraNote}
              onChange={(e) => onExtraNoteChange(e.target.value)}
              placeholder={`Optional 1-line detail (e.g. "${techName.split(' ')[0]} walked us through the shutoff valve")`}
              className="mt-3 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-orange-500 focus:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
            />
          </div>
        </div>
      )}
    </div>
  );
}
