/**
 * Sons do app via Web Audio API (sem assets).
 * Cada som é gerado on-the-fly. Toda chamada cria um AudioContext novo
 * (Safari iOS tem quirks com contextos longos).
 */

const SOUNDS_DISABLED_KEY = 'garimpador_sounds_disabled';

function disabled() {
  return localStorage.getItem(SOUNDS_DISABLED_KEY) === '1';
}

function ctx() {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return null;
  return new Ctor();
}

function tone({ freq = 600, duration = 0.15, type = 'sine', gain = 0.2 } = {}) {
  if (disabled()) return;
  const ac = ctx();
  if (!ac) return;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.value = gain;
  osc.connect(g);
  g.connect(ac.destination);
  osc.start();
  g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration);
  osc.stop(ac.currentTime + duration);
  setTimeout(() => ac.close().catch(() => {}), (duration * 1000) + 50);
}

export function playBell()  { tone({ freq: 880, duration: 0.18, type: 'sine',     gain: 0.18 }); }
export function playBubble(){ tone({ freq: 520, duration: 0.10, type: 'triangle', gain: 0.14 }); }
export function playSuccess(){ tone({ freq: 700, duration: 0.10, type: 'sine',     gain: 0.18 });
                               setTimeout(() => tone({ freq: 1000, duration: 0.14, type: 'sine', gain: 0.18 }), 100); }
export function playError() { tone({ freq: 220, duration: 0.30, type: 'sawtooth', gain: 0.15 }); }
