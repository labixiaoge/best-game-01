// Every sound is synthesised with the Web Audio API at play time: no audio files,
// no network, just short oscillator blips shaped by a gain envelope. The context
// is created lazily on the first user gesture, so browsers never block it.

let ctx = null;
let muted = false;

export function setMuted(value) {
  muted = value;
}

export function isMuted() {
  return muted;
}

/** Call from a click or key press so the browser allows sound. */
export function unlockAudio() {
  if (!ctx) {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) ctx = new AC();
    } catch {
      ctx = null;
    }
  }
  if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
}

/**
 * Play one note: a sine or triangle tone that slides from `from` to `to` Hz over
 * `secs`, fading out. `when` delays it, so a few calls make a little arpeggio.
 */
function tone(from, to, secs, volume, type = 'sine', when = 0) {
  if (muted || !ctx || ctx.state !== 'running') return;
  const t0 = ctx.currentTime + when;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(Math.max(20, from), t0);
  if (to !== from) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + secs);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(volume, t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + secs);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + secs + 0.05);
}

/** A short filtered noise burst, for thuds and pops. */
function noise(secs, volume, freq) {
  if (muted || !ctx || ctx.state !== 'running') return;
  const t0 = ctx.currentTime;
  const len = Math.max(1, Math.floor(ctx.sampleRate * secs));
  const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = freq;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(volume, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + secs);
  src.connect(filter).connect(gain).connect(ctx.destination);
  src.start(t0);
}

export const sfx = {
  shoot() { tone(720, 520, 0.07, 0.05, 'triangle'); },
  thorn() { noise(0.09, 0.10, 900); tone(220, 90, 0.1, 0.08, 'sine'); },
  frost() { tone(980, 1400, 0.12, 0.045, 'sine'); },
  pop() { tone(520, 880, 0.08, 0.07, 'sine'); },
  coin() { tone(1180, 1180, 0.06, 0.06, 'sine'); tone(1560, 1560, 0.09, 0.05, 'sine', 0.06); },
  place() { tone(300, 420, 0.09, 0.09, 'triangle'); },
  upgrade() { tone(440, 440, 0.07, 0.07, 'triangle'); tone(660, 660, 0.07, 0.07, 'triangle', 0.07); tone(880, 880, 0.1, 0.07, 'triangle', 0.14); },
  sell() { tone(660, 330, 0.12, 0.07, 'triangle'); },
  leak() { tone(200, 90, 0.3, 0.12, 'sawtooth'); },
  wave() { tone(392, 392, 0.12, 0.09, 'triangle'); tone(523, 523, 0.12, 0.09, 'triangle', 0.1); tone(659, 659, 0.16, 0.09, 'triangle', 0.2); },
  win() {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, f, 0.18, 0.09, 'triangle', i * 0.13));
    tone(1319, 1319, 0.4, 0.08, 'sine', 0.55);
  },
  lose() {
    [392, 330, 262, 196].forEach((f, i) => tone(f, f * 0.94, 0.22, 0.09, 'sawtooth', i * 0.16));
  },
  click() { tone(600, 600, 0.04, 0.04, 'sine'); },
};
