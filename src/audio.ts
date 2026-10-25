// Small synthesized sound set (Web Audio, no audio files).

let ctx: AudioContext | null = null;
let on = true;

function audio(): AudioContext | null {
  if (!ctx && typeof window !== 'undefined') {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (Ctor) ctx = new Ctor();
  }
  if (ctx && ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function note(freq: number, start: number, len: number, type: OscillatorType = 'sine', vol = 0.12) {
  const c = audio();
  if (!c || !on) return;
  const o = c.createOscillator();
  const g = c.createGain();
  const t0 = c.currentTime + start;
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0008, t0 + len);
  o.connect(g).connect(c.destination);
  o.start(t0);
  o.stop(t0 + len + 0.02);
}

export const sound = {
  get enabled() {
    return on;
  },
  toggle() {
    on = !on;
    if (on) this.click();
    return on;
  },
  click: () => note(620, 0, 0.06, 'triangle', 0.1),
  lock: () => {
    note(330, 0, 0.09, 'square', 0.06);
    note(495, 0.08, 0.14, 'square', 0.06);
  },
  start: () => {
    note(262, 0, 0.12, 'triangle');
    note(392, 0.1, 0.12, 'triangle');
    note(523, 0.2, 0.22, 'triangle');
  },
  tick: () => note(880, 0, 0.04, 'square', 0.04),
  vote: () => {
    note(440, 0, 0.1, 'triangle');
    note(660, 0.07, 0.14, 'triangle');
  },
  win: () => {
    [523, 659, 784, 1046].forEach((f, i) => note(f, i * 0.09, 0.3, 'triangle', 0.13));
  },
  lose: () => {
    note(260, 0, 0.18, 'sawtooth', 0.07);
    note(196, 0.14, 0.3, 'sawtooth', 0.07);
  },
  fanfare: () => {
    [523, 523, 523, 659, 784, 1046].forEach((f, i) => note(f, i * 0.14, i === 5 ? 0.7 : 0.18, 'triangle', 0.14));
  },
};
