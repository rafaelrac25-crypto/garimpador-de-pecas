import React, { useEffect, useState } from 'react';
import { Routes, Route, useSearchParams, Navigate, Link, useLocation } from 'react-router-dom';
import api from './services/api';
import Logo from './components/Logo';
import NotificationBell from './components/NotificationBell';
import Home from './pages/Home';
import Results from './pages/Results';
import Vehicle from './pages/Vehicle';

function tempoRelativo(iso) {
  if (!iso) return 'nunca';
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1)   return 'agora';
  if (min < 60)  return `há ${min}min`;
  if (min < 1440) return `há ${Math.round(min / 60)}h`;
  return `há ${Math.round(min / 1440)}d`;
}

function MLChip() {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  async function load() {
    try {
      const r = await api.get('/api/admin/scrape-ml/status');
      setData(r.data);
    } catch { /* ignora */ }
  }
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, []);

  async function atualizar() {
    if (busy) return;
    setBusy(true);
    try {
      const r = await api.post('/api/admin/scrape-ml/trigger');
      if (r.data?.ok) {
        /* Espera ~45s o workflow popular cache, daí recarrega status */
        setTimeout(load, 45000);
      } else {
        alert(r.data?.error || 'Falha ao disparar atualização');
      }
    } catch (e) {
      alert(e.response?.data?.error || e.message);
    } finally {
      setTimeout(() => setBusy(false), 5000);
    }
  }

  if (!data) return null;
  const count = data.cache_count || 0;
  const lastAt = data.status?.last_run_at;
  const ok = data.status?.last_run_status === 'ok';

  return (
    <button
      onClick={atualizar}
      disabled={busy}
      title={`${count} ofertas em cache · última sync ${tempoRelativo(lastAt)}. Clique pra atualizar agora.`}
      className="gar-chip"
      style={{
        fontSize: '11.5px',
        background: ok && count > 0 ? 'var(--c-success-soft, #e6f5e6)' : 'var(--c-warn-soft, #fdf2d8)',
        color: ok && count > 0 ? 'var(--c-success, #2d7a3a)' : 'var(--c-warn, #8a6300)',
        border: 'none',
        opacity: busy ? 0.6 : 1,
      }}
    >
      ML · {count} {busy ? '⟳' : ''} <span style={{ opacity: 0.7 }}>{tempoRelativo(lastAt)}</span>
    </button>
  );
}

function Header() {
  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 50,
      background: 'var(--c-bg)',
      borderBottom: '1px solid var(--c-border)',
      padding: '10px 16px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: '8px',
    }}>
      <Link to="/" style={{ display: 'flex', alignItems: 'center' }}>
        <Logo height={40} />
      </Link>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <MLChip />
        <Link to="/c14" className="gar-chip" style={{ fontSize: '11.5px' }}>C14</Link>
        <NotificationBell />
      </div>
    </header>
  );
}

export default function App() {
  /* Se a URL tiver ?key=..., persiste no localStorage uma vez (compat com link
     antigo) e remove da URL. Sem gate — entra direto. */
  const [searchParams] = useSearchParams();
  useEffect(() => {
    const k = searchParams.get('key');
    if (k) {
      localStorage.setItem('garimpador_access_key', k);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <Header />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/resultados" element={<Results />} />
        <Route path="/c14" element={<Vehicle />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
