import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import Icon from '../components/Icon';
import StatusDot from '../components/StatusDot';

export default function Results() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const q = params.get('q') || '';
  const modelo = params.get('modelo') || 'C10';
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErr(null);
    api.post('/api/search', { q, modelo })
      .then(r => { if (!cancelled) setData(r.data); })
      .catch(e => { if (!cancelled) setErr(e?.response?.data?.error || e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [q, modelo]);

  return (
    <div className="page-container">
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '16px' }}>
        <button onClick={() => navigate('/')} style={{ background: 'transparent', border: 'none', color: 'var(--c-accent)', padding: '6px' }}>
          <Icon name="back" size={20} />
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: '17px' }}>{q}</h1>
          <div style={{ fontSize: '12px', color: 'var(--c-text-3)' }}>
            modelo: {modelo}
            {data?.counts && ` · ${data.results.length} resultado(s)`}
          </div>
        </div>
      </div>

      {/* Status das fontes */}
      {data?.sources && (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px', fontSize: '11.5px' }}>
          {Object.entries(data.sources).map(([name, s]) => (
            <span key={name} style={{
              display: 'inline-flex', alignItems: 'center', gap: '5px',
              padding: '4px 10px', borderRadius: '999px',
              background: 'var(--c-card-bg)', border: '1px solid var(--c-border)',
              color: 'var(--c-text-2)',
            }}>
              <StatusDot tone={s.ok ? 'success' : (s.note ? 'warning' : 'danger')} size={7} style={{ marginTop: 0 }} />
              <strong>{name}</strong>: {s.count}
            </span>
          ))}
        </div>
      )}

      {loading && (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--c-text-3)' }}>
          Buscando em Mercado Livre, OLX, Web Motor…
        </div>
      )}
      {err && (
        <div className="gar-card" style={{ padding: '16px', borderColor: 'var(--c-bowtie)', color: 'var(--c-bowtie)' }}>
          <Icon name="alert" size={18} /> Erro: {err}
        </div>
      )}
      {!loading && !err && data?.results?.length === 0 && (
        <div className="gar-card" style={{ padding: '30px 20px', textAlign: 'center', color: 'var(--c-text-3)' }}>
          Nenhum resultado encontrado pra <strong>{q}</strong>. Tente termos mais simples.
        </div>
      )}

      {data?.results?.length > 0 && (
        <div style={{ display: 'grid', gap: '10px' }}>
          {data.results.map((it, i) => (
            <a key={i} href={it.url} target="_blank" rel="noopener noreferrer"
               className="gar-card"
               style={{ display: 'flex', gap: '12px', overflow: 'hidden', padding: '0' }}>
              {it.thumbUrl ? (
                <img src={it.thumbUrl} alt="" loading="lazy"
                     style={{ width: '110px', height: '110px', objectFit: 'cover', flexShrink: 0, background: 'var(--c-surface)' }} />
              ) : (
                <div style={{ width: '110px', height: '110px', flexShrink: 0, background: 'var(--c-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--c-text-4)' }}>
                  <Icon name="camera" size={28} />
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0, padding: '12px 14px 12px 0' }}>
                <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--c-text-1)',
                              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {it.title}
                </div>
                <div style={{ marginTop: '6px', fontSize: '16px', fontWeight: 700, color: 'var(--c-bowtie)' }}>
                  {formatBRL(it.price)}
                </div>
                <div style={{ marginTop: '4px', fontSize: '11px', color: 'var(--c-text-4)', display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <span style={{ textTransform: 'uppercase', fontWeight: 600 }}>{it.source}</span>
                  {it.location && <>· <span>{it.location}</span></>}
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function formatBRL(p) {
  const n = Number(p);
  if (!Number.isFinite(n) || n <= 0) return 'Consulte';
  return 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
