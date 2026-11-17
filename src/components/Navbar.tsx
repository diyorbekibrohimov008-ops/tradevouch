import { Mic, ShieldCheck, Wrench } from 'lucide-react';
import type { BusinessProfile } from '../../shared/types';

interface NavbarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  authBusiness: BusinessProfile | null;
  onOpenAuth: (mode: 'login' | 'register') => void;
  onSignOut: () => void;
}

export function Navbar({
  currentPath,
  onNavigate,
  authBusiness,
  onOpenAuth,
  onSignOut,
}: NavbarProps) {
  const isHome = currentPath === '/';
  const isStudio = currentPath.startsWith('/studio');
  const isCollector = currentPath.startsWith('/r/');
  const isHub = currentPath.startsWith('/biz/');

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <button
          type="button"
          onClick={() => onNavigate('/')}
          className="flex cursor-pointer items-center gap-2.5 text-left"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm">
            <Wrench className="h-4 w-4 text-orange-400" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-base font-extrabold tracking-tight text-slate-900">
                TradeVouch
              </span>
              <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-extrabold text-orange-800">
                $29/mo
              </span>
            </div>
            <p className="hidden text-[11px] font-medium text-slate-500 sm:block">
              AI Voice-to-Review for Local Trades
            </p>
          </div>
        </button>

        <nav className="hidden items-center gap-1.5 md:flex">
          <button
            type="button"
            onClick={() => onNavigate('/')}
            className={`cursor-pointer rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
              isHome ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Overview
          </button>
          <button
            type="button"
            onClick={() => onNavigate('/r/rv_demo_okafor')}
            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
              isCollector ? 'bg-orange-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Mic className="h-3.5 w-3.5" />
            <span>Homeowner Link Demo</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('/studio')}
            className={`cursor-pointer rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
              isStudio ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Contractor Studio
          </button>
          <button
            type="button"
            onClick={() => onNavigate('/biz/peakline-roofing')}
            className={`cursor-pointer rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
              isHub ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            QR Check-In Hub
          </button>
        </nav>

        <div className="flex items-center gap-2">
          {authBusiness ? (
            <>
              <button
                type="button"
                onClick={() => onNavigate('/studio')}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                <span className="max-w-[140px] truncate">{authBusiness.name}</span>
              </button>
              <button
                type="button"
                onClick={onSignOut}
                className="cursor-pointer rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => onOpenAuth('login')}
                className="cursor-pointer rounded-full px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100"
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => onOpenAuth('register')}
                className="cursor-pointer rounded-full bg-orange-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-orange-700"
              >
                Start $29/mo Plan
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
