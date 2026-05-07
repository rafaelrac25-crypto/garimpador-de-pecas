import React, { useEffect, useState } from 'react';
import { Routes, Route, useSearchParams, Navigate } from 'react-router-dom';
import api from './services/api';

const ACCESS_KEY_STORAGE = 'garimpador_access_key';

/* Tela de bloqueio quando token não está salvo nem na URL */
function AccessGate({ onUnlocked }) {
  const [searchParams] = useSearchParams();
  const [tryingKey, setTryingKey] = useState(searchParams.get('key') || '');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function tryKey(k) {
    setBusy(true);
    setError(null);
    try {
      /* Faz uma chamada autenticada qualquer pra validar */
      await api.get('/api/favorites', { params: { key: k } });
      localStorage.setItem(ACCESS_KEY_STORAGE, k);
      onUnlocked(k);
    } catch (err) {
      const status = err?.response?.status;
      setError(status === 401 ? 'Token inválido' : `Erro: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  /* Tenta token da URL automaticamente */
  useEffect(() => {
    if (tryingKey && !busy && !error) tryKey(tryingKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px', background: 'var(--c-bg)',
    }}>
      <div className="ccb-card" style={{ maxWidth: '420px', width: '100%', padding: '32px 28px', borderRadius: '18px' }}>
        <div style={{ fontSize: '22px', fontWeight: 700, marginBottom: '6px' }}>Garimpador de Peças</div>
        <div style={{ fontSize: '13px', color: 'var(--c-text-3)', marginBottom: '24px' }}>
          Acesso restrito. Cole o token de acesso pra entrar.
        </div>
        <input
          type="password"
          value={tryingKey}
          onChange={(e) => setTryingKey(e.target.value)}
          placeholder="token de acesso"
          autoFocus
          onKeyDown={(e) => { if (e.key === 'Enter' && tryingKey) tryKey(tryingKey); }}
          style={{
            width: '100%', padding: '12px 14px', fontSize: '14px',
            background: 'var(--c-surface)', border: '1px solid var(--c-border)',
            borderRadius: '10px', color: 'var(--c-text-1)', outline: 'none',
            marginBottom: '12px',
          }}
        />
        {error && <div style={{ fontSize: '12px', color: 'var(--c-attention)', marginBottom: '12px' }}>{error}</div>}
        <button
          onClick={() => tryKey(tryingKey)}
          disabled={!tryingKey || busy}
          style={{
            width: '100%', padding: '12px', fontSize: '14px', fontWeight: 700,
            background: 'var(--c-accent)', color: '#fff',
            border: 'none', borderRadius: '10px',
            cursor: busy ? 'not-allowed' : 'pointer',
            opacity: busy ? 0.7 : 1,
          }}
        >{busy ? 'Verificando…' : 'Entrar'}</button>
      </div>
    </div>
  );
}

function Home() {
  return (
    <div style={{ padding: '24px' }}>
      <h1 style={{ fontSize: '20px', marginBottom: '8px' }}>Garimpador de Peças</h1>
      <p style={{ color: 'var(--c-text-3)', fontSize: '14px' }}>
        Bootstrap concluído. Próxima fase: busca em Mercado Livre.
      </p>
    </div>
  );
}

export default function App() {
  const [accessKey, setAccessKey] = useState(() => localStorage.getItem(ACCESS_KEY_STORAGE) || null);

  if (!accessKey) {
    return <AccessGate onUnlocked={(k) => setAccessKey(k)} />;
  }

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
