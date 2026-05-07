import React, { useEffect, useState } from 'react';
import { Routes, Route, useSearchParams, Navigate, Link, useLocation } from 'react-router-dom';
import api from './services/api';
import Logo from './components/Logo';
import NotificationBell from './components/NotificationBell';
import Home from './pages/Home';
import Results from './pages/Results';
import Vehicle from './pages/Vehicle';

function MLChip() {
  const [status, setStatus] = useState(null);
  useEffect(() => {
    let alive = true;
    api.get('/api/ml/status').then(r => { if (alive) setStatus(r.data); }).catch(() => {});
    return () => { alive = false; };
  }, []);
  const connected = status?.connected;
  const onClick = () => {
    /* Sem ACCESS_KEY no backend, o /api/ml/start aceita sem ?key= */
    const k = localStorage.getItem('garimpador_access_key');
    window.location.href = k ? `/api/ml/start?key=${encodeURIComponent(k)}` : '/api/ml/start';
  };
  if (!status) return null;
  return (
    <button
      onClick={onClick}
      title={connected ? `ML conectado (expira em ${status.expires_in_min} min)` : 'Conectar Mercado Livre'}
      className="gar-chip"
      style={{
        fontSize: '11.5px',
        background: connected ? 'var(--c-success-soft, #e6f5e6)' : 'var(--c-bowtie-soft, #f5e0dd)',
        color: connected ? 'var(--c-success, #2d7a3a)' : 'var(--c-bowtie, #B8362A)',
        border: 'none',
      }}
    >
      ML {connected ? 'on' : 'off'}
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
