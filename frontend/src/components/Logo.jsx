import React from 'react';

/* Logo do C14 do Costa — versão escura (cor original) por default. */
export default function Logo({ height = 60, variant = 'dark', style }) {
  const src = variant === 'light' ? '/logo-clara.png' : '/logo-escura.png';
  return (
    <img
      src={src}
      alt="Chevy C14 Costa — Joinville, SC"
      style={{ height, width: 'auto', display: 'block', ...style }}
    />
  );
}
