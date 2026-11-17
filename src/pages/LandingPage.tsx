import {
  ArrowRight,
  CheckCircle2,
  Mic,
  Repeat,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Wrench,
} from 'lucide-react';
import { LiveDemoWidget } from '../components/LiveDemoWidget';
import { PricingCompare } from '../components/PricingCompare';

interface LandingPageProps {
  onNavigate: (path: string) => void;
  onOpenAuth: (mode: 'login' | 'register') => void;
}

export function LandingPage({ onNavigate, onOpenAuth }: LandingPageProps) {
  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-slate-200/80 bg-gradient-to-b from-[#FAFAF9] via-white to-orange-50/40">
        <div className="mx-auto max-w-7xl px-4 pt-12 pb-16 sm:px-6 lg:pt-16 lg:pb-20">
          <div className="grid items-center gap-12 lg:grid-cols-12">
            <div className="lg:col-span-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3.5 py-1 text-xs font-extrabold text-orange-800">
                <Wrench className="h-3.5 w-3.5 text-orange-600" />
                <span>Built for Roofers, Plumbers &amp; Auto Detailers — $29/mo flat</span>
              </div>

              <h1 className="mt-5 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl lg:text-[52px] lg:leading-[1.06]">
                Stop paying $125–$250/mo for{' '}
                <span className="font-display-serif font-normal italic text-orange-600">
                  blank Google boxes.
                </span>
              </h1>

              <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-600">
                NiceJob and Birdeye charge $75–$250+/mo and drop homeowners onto an empty Google review box they abandon. TradeVouch texts after every job, turns a 10-second voice note (or 2 taps) into a detailed 5-star review praising your tech, and copies it to Google Maps in one click.
              </p>

              <div className="mt-7 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => onNavigate('/studio')}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-slate-900 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-slate-900/15 transition hover:bg-slate-800"
                >
                  <Sparkles className="h-4 w-4 text-orange-400" />
                  <span>Open Live Contractor Studio</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('/r/rv_demo_okafor')}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-300 bg-white px-6 py-3.5 text-sm font-bold text-slate-800 transition hover:bg-slate-50"
                >
                  <Mic className="h-4 w-4 text-orange-600" />
                  <span>Test Homeowner SMS Link</span>
                </button>
              </div>

              <div className="mt-8 grid grid-cols-3 gap-4 border-t border-slate-200 pt-6">
                <div>
                  <p className="text-2xl font-extrabold text-slate-900">$29/mo</p>
                  <p className="text-xs font-medium text-slate-500">Flat price, zero lock-in</p>
                </div>
                <div>
                  <p className="text-2xl font-extrabold text-emerald-600">10 sec</p>
                  <p className="text-xs font-medium text-slate-500">Voice note or 2 quick taps</p>
                </div>
                <div>
                  <p className="text-2xl font-extrabold text-slate-900">3 CRMs</p>
                  <p className="text-xs font-medium text-slate-500">Jobber, HCP &amp; ServiceTitan</p>
                </div>
              </div>
            </div>

            <div className="lg:col-span-6">
              <LiveDemoWidget />
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="bg-[#FAFAF9] py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="max-w-2xl">
            <span className="text-xs font-extrabold tracking-wide text-orange-600 uppercase">
              Why TradeVouch Wins Switchers
            </span>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">
              Solve &ldquo;Blank Page Syndrome&rdquo; on every completed ticket
            </h2>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-3">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-100 text-orange-700">
                <Repeat className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-lg font-extrabold text-slate-900">
                1. Auto-triggered from your CRM
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Connect Jobber, Housecall Pro, or ServiceTitan webhooks (or drop a CSV). When a tech marks a job done, TradeVouch sends the SMS + email cadence automatically.
              </p>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                <Mic className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-lg font-extrabold text-slate-900">
                2. 10s Voice Note or 2 Taps
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Homeowners never stare at an empty Google box. They speak a 10-second note or tap 2 quick questions—AI cleans filler words and highlights your tech&apos;s professionalism.
              </p>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white">
                <Smartphone className="h-5 w-5 text-orange-400" />
              </div>
              <h3 className="mt-4 text-lg font-extrabold text-slate-900">
                3. 1-Click Copy to Google Maps
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                One tap copies the polished review and opens your Google Business Profile review modal—and automatically pauses follow-up texts so happy customers never get nagged.
              </p>
            </div>
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-slate-200 bg-slate-900 p-6 text-white sm:p-8">
            <div className="flex items-start gap-4">
              <ShieldCheck className="mt-1 h-7 w-7 shrink-0 text-emerald-400" />
              <div>
                <h3 className="text-lg font-extrabold">
                  Private Owner Check-In for Bumpy Jobs
                </h3>
                <p className="mt-1 max-w-2xl text-sm text-slate-300">
                  If a homeowner taps 1–3 stars, TradeVouch immediately offers a direct message to the owner so you can fix cleanup or scheduling issues before they fester—while keeping Google Maps access open and compliant.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('/studio')}
              className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-orange-600 px-5 py-3 text-sm font-bold text-white hover:bg-orange-700"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>See Seeded Roofing Account</span>
            </button>
          </div>
        </div>
      </section>

      <PricingCompare
        onStartAccount={() => onOpenAuth('register')}
        onOpenStudio={() => onNavigate('/studio')}
      />
    </div>
  );
}
