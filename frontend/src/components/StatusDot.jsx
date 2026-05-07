import React from 'react';

/* Pontinho de status — sem emoji, segue regra de cores do Rafa.
   tone: 'success'|'warning'|'danger'|'neutral' */
const COLORS = {
  success: 'var(--c-success)',
  warning: 'var(--c-warning)',
  danger:  'var(--c-bowtie)',
  neutral: 'var(--c-text-4)',
};

export default function StatusDot({ tone = 'neutral', size = 8, style }) {
  return (
    <span style={{
      display: 'inline-block',
      width: size, height: size,
      borderRadius: '50%',
      background: COLORS[tone] || COLORS.neutral,
      flexShrink: 0,
      marginTop: size === 8 ? '6px' : 0,
      ...style,
    }} />
  );
}
