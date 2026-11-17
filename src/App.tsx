import { useEffect, useState } from 'react';
import type { BusinessProfile } from '../shared/types';
import { AuthModal } from './components/AuthModal';
import { Navbar } from './components/Navbar';
import { CollectorPage } from './pages/CollectorPage';
import { LandingPage } from './pages/LandingPage';
import { PublicHubPage } from './pages/PublicHubPage';
import { StudioPage } from './pages/StudioPage';

const TOKEN_STORAGE_KEY = 'tradevouch_session_token';

export function App() {
  const [path, setPath] = useState<string>(() =>
    typeof window !== 'undefined' ? window.location.pathname || '/' : '/',
  );
  const [authToken, setAuthToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem(TOKEN_STORAGE_KEY);
    } catch {
      return null;
    }
  });
  const [authBusiness, setAuthBusiness] = useState<BusinessProfile | null>(null);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register' | null>(null);

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname || '/');
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    if (!authToken) {
      setAuthBusiness(null);
      return;
    }
    fetch('/api/auth/me', {
      headers: { authorization: `Bearer ${authToken}` },
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('expired'))))
      .then((data: { business: BusinessProfile }) => setAuthBusiness(data.business))
      .catch(() => {
        setAuthToken(null);
        setAuthBusiness(null);
        try {
          localStorage.removeItem(TOKEN_STORAGE_KEY);
        } catch {
          // ignore
        }
      });
  }, [authToken]);

  const navigate = (nextPath: string) => {
    if (nextPath === path) return;
    window.history.pushState({}, '', nextPath);
    setPath(nextPath);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAuthSuccess = (token: string, business: BusinessProfile) => {
    setAuthToken(token);
    setAuthBusiness(business);
    setAuthModalMode(null);
    try {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } catch {
      // ignore
    }
    navigate('/studio');
  };

  const handleSignOut = () => {
    setAuthToken(null);
    setAuthBusiness(null);
    try {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    } catch {
      // ignore
    }
  };

  const collectorMatch = path.match(/^\/r\/([^/]+)$/);
  const hubMatch = path.match(/^\/biz\/([^/]+)$/);

  return (
    <div className="min-h-screen bg-[#f4f5f7] text-slate-900">
      <Navbar
        currentPath={path}
        onNavigate={navigate}
        authBusiness={authBusiness}
        onOpenAuth={(mode) => setAuthModalMode(mode)}
        onSignOut={handleSignOut}
      />

      {collectorMatch ? (
        <CollectorPage token={decodeURIComponent(collectorMatch[1])} onNavigate={navigate} />
      ) : hubMatch ? (
        <PublicHubPage slug={decodeURIComponent(hubMatch[1])} onNavigate={navigate} />
      ) : path.startsWith('/studio') ? (
        <StudioPage
          authToken={authToken}
          onNavigate={navigate}
          onOpenAuth={(mode) => setAuthModalMode(mode)}
          onSignOut={handleSignOut}
        />
      ) : (
        <LandingPage
          onNavigate={navigate}
          onOpenAuth={(mode) => setAuthModalMode(mode)}
        />
      )}

      {authModalMode ? (
        <AuthModal
          mode={authModalMode}
          onClose={() => setAuthModalMode(null)}
          onSuccess={handleAuthSuccess}
        />
      ) : null}
    </div>
  );
}

export default App;
