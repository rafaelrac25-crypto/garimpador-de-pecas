import React, { useState, useEffect } from 'react';
import api from '../services/api';
import Icon from './Icon';
import StatusDot from './StatusDot';

/* Sino com 2 abas: Notificações (alertas de preço) e Diagnósticos (erros do sistema) */
export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('notif');
  const [notifs, setNotifs] = useState([]);
  const [errors, setErrors] = useState([]);
  const [unread, setUnread] = useState(0);
  const [openErrCount, setOpenErrCount] = useState(0);

  async function load() {
    try {
      const [n, d] = await Promise.all([
        api.get('/api/notifications'),
        api.get('/api/diagnostics?onlyOpen=1&limit=50'),
      ]);
      setNotifs(n.data?.notifications || []);
      setUnread(n.data?.unread_count || 0);
      setErrors(d.data?.logs || []);
      setOpenErrCount(d.data?.open_count || 0);
    } catch (e) { /* silencioso — sino é best-effort */ }
  }

  useEffect(() => { load(); const t = setInterval(load, 60000); return () => clearInterval(t); }, []);
  useEffect(() => { if (open) load(); }, [open]);

  async function markAllRead() {
    await api.patch('/api/notifications/read-all').catch(()=>{});
    load();
  }
  async function copyError(e) {
    const txt = `[${e.source}${e.action ? '/' + e.action : ''}]${e.code ? ' code=' + e.code : ''} — ${e.message}\n${e.context || ''}`;
    try { await navigator.clipboard.writeText(txt); } catch {}
  }
  async function resolveError(id) {
    await api.patch(`/api/diagnostics/${id}/resolve`).catch(()=>{});
    load();
  }

  const totalBadge = unread + openErrCount;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Notificações"
        style={{
          position: 'relative', background: 'transparent', border: 'none',
          color: 'var(--c-accent)', padding: '8px', cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Icon name="bell" size={22} />
        {totalBadge > 0 && (
          <span style={{
            position: 'absolute', top: 4, right: 2,
            background: 'var(--c-bowtie)', color: '#FFF8EB',
            fontSize: '10px', fontWeight: 700,
            minWidth: '18px', height: '18px', padding: '0 5px',
            borderRadius: '999px',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid var(--c-bg)',
          }}>{totalBadge > 99 ? '99' : totalBadge}</span>
        )}
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(44,27,14,.45)', backdropFilter: 'blur(2px)',
            display: 'flex', justifyContent: 'flex-end',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="gar-fade-in"
            style={{
              width: '100%', maxWidth: '420px', height: '100%',
              background: 'var(--c-bg)', borderLeft: '1px solid var(--c-border)',
              display: 'flex', flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div style={{
              padding: '16px', borderBottom: '1px solid var(--c-border)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <h2 style={{ fontSize: '16px' }}>Avisos</h2>
              <button onClick={() => setOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--c-text-3)', padding: '4px' }}>
                <Icon name="x" size={20} />
              </button>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--c-border)' }}>
              {['notif','diag'].map(t => (
                <button key={t}
                  onClick={() => setTab(t)}
                  style={{
                    flex: 1, padding: '12px', background: 'transparent',
                    border: 'none', borderBottom: tab === t ? '2px solid var(--c-accent)' : '2px solid transparent',
                    color: tab === t ? 'var(--c-accent)' : 'var(--c-text-3)',
                    fontWeight: 700, fontSize: '13px',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                  }}
                >
                  {t === 'notif' ? 'Alertas' : 'Diagnósticos'}
                  {((t === 'notif' && unread > 0) || (t === 'diag' && openErrCount > 0)) && (
                    <span style={{
                      background: t === 'diag' ? 'var(--c-bowtie)' : 'var(--c-accent)',
                      color: '#FFF8EB', fontSize: '10px', fontWeight: 700,
                      minWidth: '16px', height: '16px', padding: '0 5px',
                      borderRadius: '999px',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    }}>{t === 'notif' ? unread : openErrCount}</span>
                  )}
                </button>
              ))}
            </div>

            {/* Conteúdo scroll */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {tab === 'notif' && (
                <>
                  {notifs.length > 0 && (
                    <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--c-border)' }}>
                      <button className="gar-btn-secondary gar-btn" onClick={markAllRead}
                        style={{ padding: '6px 10px', fontSize: '12px' }}>
                        Marcar tudo como lido
                      </button>
                    </div>
                  )}
                  {notifs.length === 0 && (
                    <EmptyMsg icon="bell" text="Nenhum aviso por enquanto. Cadastre alertas de preço pra ser notificado." />
                  )}
                  {notifs.map(n => (
                    <div key={n.id} style={{
                      padding: '12px 16px', borderBottom: '1px solid var(--c-border)',
                      background: n.read_at ? 'transparent' : 'var(--c-accent-soft)',
                    }}>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <StatusDot tone={n.kind === 'price_alert' ? 'success' : 'neutral'} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--c-text-1)' }}>{n.title}</div>
                          {n.message && <div style={{ fontSize: '12.5px', color: 'var(--c-text-2)', whiteSpace: 'pre-wrap', marginTop: '4px' }}>{n.message}</div>}
                          {n.link && <a href={n.link} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--c-bowtie)', fontSize: '12px', fontWeight: 600, marginTop: '6px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Icon name="link" size={12} /> Abrir anúncio</a>}
                          <div style={{ fontSize: '11px', color: 'var(--c-text-4)', marginTop: '4px' }}>{formatDate(n.created_at)}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}

              {tab === 'diag' && (
                <>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--c-border)', fontSize: '12px', color: 'var(--c-text-3)' }}>
                    Erros que o sistema registrou. Clique em <strong>Copiar</strong> e me mande pra eu corrigir.
                  </div>
                  {errors.length === 0 && (
                    <EmptyMsg icon="check" text="Nenhum erro registrado. Sistema rodando bem." />
                  )}
                  {errors.map(e => (
                    <div key={e.id} style={{
                      padding: '12px 16px', borderBottom: '1px solid var(--c-border)',
                    }}>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                        <StatusDot tone="danger" />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--c-text-1)' }}>
                            {e.source}{e.action ? ` / ${e.action}` : ''}
                            {e.code && <span style={{ marginLeft: '6px', fontSize: '11px', padding: '1px 6px', background: 'var(--c-bowtie-soft)', color: 'var(--c-bowtie)', borderRadius: '4px' }}>code: {e.code}</span>}
                          </div>
                          <div style={{ fontSize: '12.5px', color: 'var(--c-text-2)', marginTop: '4px', wordBreak: 'break-word' }}>{e.message}</div>
                          <div style={{ fontSize: '11px', color: 'var(--c-text-4)', marginTop: '4px' }}>{formatDate(e.created_at)}</div>
                          <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                            <button onClick={() => copyError(e)} className="gar-btn gar-btn-secondary" style={{ padding: '5px 10px', fontSize: '11.5px' }}>
                              <Icon name="copy" size={13} /> Copiar
                            </button>
                            <button onClick={() => resolveError(e.id)} className="gar-btn gar-btn-secondary" style={{ padding: '5px 10px', fontSize: '11.5px' }}>
                              <Icon name="check" size={13} /> Resolver
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function EmptyMsg({ icon, text }) {
  return (
    <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--c-text-3)' }}>
      <div style={{ display: 'inline-flex', padding: '14px', background: 'var(--c-accent-soft)', borderRadius: '50%', marginBottom: '12px', color: 'var(--c-accent)' }}>
        <Icon name={icon} size={26} />
      </div>
      <div style={{ fontSize: '13px', maxWidth: '260px', margin: '0 auto', lineHeight: 1.5 }}>{text}</div>
    </div>
  );
}

function formatDate(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z');
    return d.toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch { return iso; }
}
