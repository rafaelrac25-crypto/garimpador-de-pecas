import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import Icon from '../components/Icon';
import { BUSCAS_RAPIDAS, MODELOS } from '../data/c10-c14-pecas';

export default function Home() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [modelo, setModelo] = useState('C10');
  const [outroModelo, setOutroModelo] = useState('');  // input livre quando "Outro" ativo
  const [offers, setOffers] = useState(null);
  const [offersLoading, setOffersLoading] = useState(true);

  /* Modelo efetivo enviado pra busca: se "Outro", usa texto livre */
  const modeloEfetivo = modelo === 'Outro' ? outroModelo.trim() : modelo;

  useEffect(() => {
    let cancelled = false;
    setOffersLoading(true);
    /* Ofertas só rolam pra modelo da família (C10/C14/etc). "Outro" pula. */
    if (modelo === 'Outro') { setOffers({ featured: [] }); setOffersLoading(false); return; }
    api.get(`/api/offers/featured?modelo=${modelo}`)
      .then(r => { if (!cancelled) setOffers(r.data); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setOffersLoading(false); });
    return () => { cancelled = true; };
  }, [modelo]);

  function buscar(termo, mod) {
    const finalQ = (termo || q || '').trim();
    if (!finalQ) return;
    const finalModelo = mod || modeloEfetivo;
    const url = finalModelo
      ? `/resultados?q=${encodeURIComponent(finalQ)}&modelo=${encodeURIComponent(finalModelo)}`
      : `/resultados?q=${encodeURIComponent(finalQ)}`;
    navigate(url);
  }

  return (
    <div className="page-container">
      {/* Modelo switch — TODOS os modelos, incluindo "Outro" */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '14px' }}>
        {MODELOS.map(m => (
          <button key={m}
            onClick={() => setModelo(m)}
            className={`gar-chip ${modelo === m ? 'active' : ''}`}
          >{m}</button>
        ))}
      </div>

      {/* Input livre quando "Outro" selecionado */}
      {modelo === 'Outro' && (
        <input
          value={outroModelo}
          onChange={(e) => setOutroModelo(e.target.value)}
          placeholder="Qual modelo? (ex: Opala, Fusca, Maverick, F-1000…)"
          style={{ width: '100%', marginBottom: '12px', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid var(--c-border)', background: 'var(--c-card-bg)' }}
        />
      )}

      {/* Caixa de busca */}
      <div style={{
        display: 'flex', gap: '8px', alignItems: 'center',
        background: 'var(--c-card-bg)',
        border: '1.5px solid var(--c-border)',
        borderRadius: '14px', padding: '6px 6px 6px 14px',
        marginBottom: '14px',
        boxShadow: 'var(--c-shadow)',
      }}>
        <Icon name="search" size={20} color="var(--c-text-3)" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') buscar(); }}
          placeholder={modeloEfetivo ? `Procurar peças do ${modeloEfetivo}…` : 'Procurar peça…'}
          style={{ flex: 1, border: 'none', background: 'transparent', padding: '10px 0', boxShadow: 'none' }}
        />
        <button onClick={() => buscar()} className="gar-btn" disabled={!q.trim()} style={{ padding: '10px 14px' }}>
          Buscar
        </button>
      </div>

      {/* Chips de busca rápida */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '12px', color: 'var(--c-text-3)', marginBottom: '8px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em' }}>
          Buscas rápidas
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {BUSCAS_RAPIDAS.map(b => (
            <button key={b.q} className="gar-chip" onClick={() => buscar(b.q, b.modelo)}>
              {b.label}
            </button>
          ))}
        </div>
      </div>

      {/* Ofertas em destaque */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <Icon name="tag" size={18} color="var(--c-bowtie)" />
          <h2>Ofertas pra olhar</h2>
        </div>
        {offersLoading && <div style={{ fontSize: '13px', color: 'var(--c-text-3)' }}>Carregando ofertas…</div>}
        {!offersLoading && offers?.featured?.length === 0 && (
          <div className="gar-card" style={{ padding: '20px', textAlign: 'center', color: 'var(--c-text-3)', fontSize: '13px' }}>
            Sem ofertas no momento. Tente buscar uma peça específica acima.
          </div>
        )}
        {!offersLoading && offers?.featured?.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '10px' }}>
            {offers.featured.slice(0, 8).map((it, i) => (
              <a key={i} href={it.url} target="_blank" rel="noopener noreferrer" className="gar-card gar-fade-in"
                 style={{ overflow: 'hidden', display: 'block' }}>
                {it.thumbUrl && (
                  <div style={{ width: '100%', aspectRatio: '1/1', overflow: 'hidden', background: 'var(--c-surface)' }}>
                    <img src={it.thumbUrl} alt={it.title} loading="lazy"
                         style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                )}
                <div style={{ padding: '10px' }}>
                  <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--c-text-1)',
                                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {it.title}
                  </div>
                  <div style={{ marginTop: '6px', fontSize: '14px', fontWeight: 700, color: 'var(--c-bowtie)' }}>
                    {formatBRL(it.price)}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--c-text-4)', marginTop: '2px', textTransform: 'uppercase' }}>{it.source}</div>
                </div>
              </a>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function formatBRL(p) {
  const n = Number(p);
  if (!Number.isFinite(n) || n <= 0) return '—';
  return 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
