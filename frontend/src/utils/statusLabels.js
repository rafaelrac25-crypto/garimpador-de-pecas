/**
 * Util único de status para todo o app.
 *
 * Regra visual:
 *   verde   → ativo / ok / sucesso
 *   amarelo → pausado / em revisão / aguardando
 *   vermelho→ erro / falhou / esgotado
 *   cinza   → encerrado / arquivado / rascunho
 */

const TONE = {
  success: { color: 'var(--c-success)',   bg: 'rgba(46,187,122,.18)',  border: 'var(--c-success)' },
  warning: { color: 'var(--c-warning)',   bg: 'rgba(251,191,36,.18)',  border: 'var(--c-warning)' },
  danger:  { color: 'var(--c-attention)', bg: 'rgba(248,113,113,.16)', border: 'var(--c-attention)' },
  neutral: { color: 'var(--c-text-3)',    bg: 'var(--c-surface)',      border: 'var(--c-border)' },
};

export const STATUS_MAP = {
  /* Locais (lowercase) */
  active:    { label: 'Ativo',         tone: 'success', icon: '🟢' },
  ok:        { label: 'OK',            tone: 'success', icon: '🟢' },
  paused:    { label: 'Pausado',       tone: 'warning', icon: '⏸️' },
  pending:   { label: 'Aguardando',    tone: 'warning', icon: '⏳' },
  loading:   { label: 'Carregando…',   tone: 'warning', icon: '⏳' },
  failed:    { label: 'Falhou',        tone: 'danger',  icon: '❌' },
  error:     { label: 'Erro',          tone: 'danger',  icon: '❌' },
  done:      { label: 'Concluído',     tone: 'success', icon: '✅' },
  draft:     { label: 'Rascunho',      tone: 'neutral', icon: '📝' },
  empty:     { label: 'Vazio',         tone: 'neutral', icon: '·' },
};

export function statusOf(key) {
  const raw = key == null ? '' : String(key).trim().toLowerCase();
  const entry = STATUS_MAP[raw];
  if (!entry) {
    return {
      key: raw || 'unknown',
      label: raw || '—',
      tone: 'neutral',
      icon: '·',
      ...TONE.neutral,
      dot: TONE.neutral.color,
    };
  }
  const tone = TONE[entry.tone] || TONE.neutral;
  return { key: raw, ...entry, ...tone, dot: tone.color };
}

export const statusLabel = (k) => statusOf(k).label;
export const statusColor = (k) => statusOf(k).color;
export const statusBg    = (k) => statusOf(k).bg;
