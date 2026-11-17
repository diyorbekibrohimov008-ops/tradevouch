import { useState } from 'react';
import { ArrowRight, Check, X } from 'lucide-react';

interface PricingCompareProps {
  onStartAccount: () => void;
  onOpenStudio: () => void;
}

export function PricingCompare({ onStartAccount, onOpenStudio }: PricingCompareProps) {
  const [incumbent, setIncumbent] = useState<'nicejob' | 'birdeye'>('nicejob');
  const currentMonthly = incumbent === 'nicejob' ? 100 : 250;
  const annualSavings = (currentMonthly - 29) * 12;

  return (
    <section className="border-t border-slate-200 bg-white py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex rounded-full bg-orange-100 px-3.5 py-1 text-xs font-extrabold tracking-wide text-orange-800 uppercase">
            Trade-Friendly Pricing — Zero Multi-Year Lock-In
          </span>
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            $29/mo flat. Save up to $2,652/yr switching from NiceJob or Birdeye.
          </h2>
          <p className="mt-3 text-base text-slate-600">
            Built for solo operators and small crews. Unlimited jobs, unlimited techs, and an AI Voice-to-Review Assistant homeowners actually finish.
          </p>
        </div>

        {/* Switcher Calculator */}
        <div className="mx-auto mt-8 max-w-3xl rounded-3xl border border-slate-200 bg-slate-50 p-6">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div>
              <p className="text-xs font-extrabold tracking-wide text-slate-500 uppercase">
                Currently paying:
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIncumbent('nicejob')}
                  className={`cursor-pointer rounded-xl px-4 py-2 text-xs font-bold transition ${
                    incumbent === 'nicejob'
                      ? 'bg-slate-900 text-white'
                      : 'border border-slate-200 bg-white text-slate-700'
                  }`}
                >
                  NiceJob ($75–$125/mo)
                </button>
                <button
                  type="button"
                  onClick={() => setIncumbent('birdeye')}
                  className={`cursor-pointer rounded-xl px-4 py-2 text-xs font-bold transition ${
                    incumbent === 'birdeye'
                      ? 'bg-slate-900 text-white'
                      : 'border border-slate-200 bg-white text-slate-700'
                  }`}
                >
                  Birdeye ($250+/mo annual)
                </button>
              </div>
            </div>

            <div className="text-center sm:text-right">
              <p className="text-xs font-bold text-slate-500">Your annual savings with TradeVouch</p>
              <p className="text-3xl font-extrabold text-emerald-600">
                ${annualSavings.toLocaleString()}/year saved
              </p>
            </div>
          </div>
        </div>

        {/* 3-Column Competitor Matrix */}
        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          {/* TradeVouch */}
          <div className="relative rounded-3xl border-2 border-orange-600 bg-white p-7 shadow-xl shadow-orange-600/10">
            <span className="inline-flex rounded-full bg-orange-600 px-3 py-1 text-[11px] font-extrabold text-white">
              BUILT FOR TRADES
            </span>
            <h3 className="mt-3 text-xl font-extrabold text-slate-900">TradeVouch Flat</h3>
            <div className="mt-3 flex items-baseline gap-1">
              <span className="text-4xl font-extrabold text-slate-900">$29</span>
              <span className="text-sm font-semibold text-slate-500">/month flat</span>
            </div>
            <p className="mt-1 text-xs font-semibold text-emerald-700">
              Month-to-month · Cancel anytime · Unlimited techs
            </p>

            <ul className="mt-6 space-y-3 text-sm text-slate-700">
              {[
                'AI 10s Voice-to-Review + 2-Question Assistant',
                '1-click copy & jump straight to Google Maps',
                'Jobber, Housecall Pro & ServiceTitan webhooks',
                'Automated multi-step SMS & Email cadences',
                'Auto-suppresses follow-ups once review drafted',
                'Printable Truck Decal & Invoice QR Check-In',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <div className="mt-7 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={onStartAccount}
                className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-orange-600 px-5 py-3 text-sm font-bold text-white shadow-md transition hover:bg-orange-700"
              >
                <span>Start $29/mo Account</span>
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={onOpenStudio}
                className="cursor-pointer rounded-xl border border-slate-200 px-5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                Explore Live Demo Studio
              </button>
            </div>
          </div>

          {/* NiceJob */}
          <div className="rounded-3xl border border-slate-200 bg-slate-50/70 p-7">
            <span className="inline-flex rounded-full bg-slate-200 px-3 py-1 text-[11px] font-bold text-slate-700">
              INCUMBENT
            </span>
            <h3 className="mt-3 text-xl font-extrabold text-slate-900">NiceJob</h3>
            <div className="mt-3 flex items-baseline gap-1">
              <span className="text-4xl font-extrabold text-slate-700">$75–$125</span>
              <span className="text-sm font-semibold text-slate-500">/month</span>
            </div>
            <p className="mt-1 text-xs font-medium text-slate-500">
              Scales up as customer volume grows
            </p>

            <ul className="mt-6 space-y-3 text-sm text-slate-600">
              <li className="flex items-start gap-2.5">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                <span>CRM integrations &amp; SMS/email drips</span>
              </li>
              <li className="flex items-start gap-2.5">
                <X className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                <span>Drops homeowners onto a blank Google text box</span>
              </li>
              <li className="flex items-start gap-2.5">
                <X className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                <span>No 10-second AI Voice-to-Review assistant</span>
              </li>
              <li className="flex items-start gap-2.5">
                <X className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                <span>3x–4x higher recurring cost for solo crews</span>
              </li>
            </ul>
          </div>

          {/* Birdeye */}
          <div className="rounded-3xl border border-slate-200 bg-slate-50/70 p-7">
            <span className="inline-flex rounded-full bg-slate-200 px-3 py-1 text-[11px] font-bold text-slate-700">
              ENTERPRISE INCUMBENT
            </span>
            <h3 className="mt-3 text-xl font-extrabold text-slate-900">Birdeye</h3>
            <div className="mt-3 flex items-baseline gap-1">
              <span className="text-4xl font-extrabold text-slate-700">$250+</span>
              <span className="text-sm font-semibold text-slate-500">/month</span>
            </div>
            <p className="mt-1 text-xs font-medium text-rose-700">
              Annual enterprise contracts required
            </p>

            <ul className="mt-6 space-y-3 text-sm text-slate-600">
              <li className="flex items-start gap-2.5">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                <span>Multi-location enterprise dashboards</span>
              </li>
              <li className="flex items-start gap-2.5">
                <X className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                <span>12-month lock-in &amp; heavy onboarding fees</span>
              </li>
              <li className="flex items-start gap-2.5">
                <X className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                <span>Blank Page Syndrome lowers homeowner completion</span>
              </li>
              <li className="flex items-start gap-2.5">
                <X className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                <span>Bloated tools local crews never touch</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
