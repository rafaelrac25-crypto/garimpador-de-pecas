import React, { useEffect, useState } from 'react';
import { Routes, Route, useSearchParams, Navigate, Link, useLocation } from 'react-router-dom';
import api from './services/api';
import Logo from './components/Logo';
import NotificationBell from './components/NotificationBell';
import Home from './pages/Home';
import Results from './pages/Results';

const ACCESS_KEY_STORAGE = 'garimpador_access_key';

function AccessGate({ onUnlocked }) {
  const [searchParams] = useSearchParams();
  const [tryingKey, setTryingKey] = useState(searchParams.get('key') || '');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function tryKey(k) {
    setBusy(true); setError(null);
    try {
      await api.get('/api/favorites', { headers: { 'X-Access-Key': k } });
      localStorage.setItem(ACCESS_KEY_STORAGE, k);
      onUnlocked(k);
    } catch (err) {
      setError(err?.response?.status === 401 ? 'Token inválido' : `Erro: ${err.message}`);
    } finally { setBusy(false); }
  }

  useEffect(() => { if (tryingKey && !busy && !error) tryKey(tryingKey); /* eslint-disable-line */ }, []);

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div className="gar-card" style={{ maxWidth: '420px', width: '100%', padding: '36px 28px' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
          <Logo height={70} />
        </div>
        <div style={{ fontSize: '14px', color: 'var(--c-text-3)', marginBottom: '24px', textAlign: 'center', lineHeight: 1.5 }}>
          Garimpador de Peças<br />
          <span style={{ fontSize: '12.5px' }}>Acesso restrito — cole o token pra entrar.</span>
        </div>
        <input
          type="password"
          value={tryingKey}
          onChange={(e) => setTryingKey(e.target.value)}
          placeholder="token de acesso"
          autoFocus
          onKeyDown={(e) => { if (e.key === 'Enter' && tryingKey) tryKey(tryingKey); }}
          style={{ width: '100%', marginBottom: '12px' }}
        />
        {error && <div style={{ fontSize: '12px', color: 'var(--c-bowtie)', marginBottom: '12px' }}>{error}</div>}
        <button onClick={() => tryKey(tryingKey)} disabled={!tryingKey || busy} className="gar-btn" style={{ width: '100%' }}>
          {busy ? 'Verificando…' : 'Entrar'}
        </button>
      </div>
    </div>
  );
}

function Header() {
  const location = useLocation();
  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 50,
      background: 'var(--c-bg)',
      borderBottom: '1px solid var(--c-border)',
      padding: '10px 16px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <Link to="/" style={{ display: 'flex', alignItems: 'center' }}>
        <Logo height={40} />
      </Link>
      <NotificationBell />
    </header>
  );
}

export default function App() {
  const [accessKey, setAccessKey] = useState(() => localStorage.getItem(ACCESS_KEY_STORAGE) || null);

  if (!accessKey) {
    return <AccessGate onUnlocked={(k) => setAccessKey(k)} />;
  }

  return (
    <>
      <Header />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/resultados" element={<Results />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
