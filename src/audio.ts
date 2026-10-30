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

function chord(freqs: number[], start: number, len: number, type: OscillatorType = 'triangle', vol = 0.07) {
  freqs.forEach((f) => note(f, start, len, type, vol));
}

let voiceOn = true;
if (typeof window !== 'undefined') {
  const saved = localStorage.getItem('barefaced.voice');
  if (saved !== null) voiceOn = saved === '1';
}

function noise(duration: number, vol = 0.08, highpass = 400, lowpass = 3000) {
  const c = audio();
  if (!c || !on) return;
  const sampleRate = c.sampleRate;
  const bufferSize = Math.floor(sampleRate * duration);
  const buffer = c.createBuffer(1, bufferSize, sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * 0.9;
  }
  const noiseSource = c.createBufferSource();
  noiseSource.buffer = buffer;
  const hp = c.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.setValueAtTime(highpass, c.currentTime);
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(lowpass, c.currentTime);
  const gain = c.createGain();
  gain.gain.setValueAtTime(vol, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + duration);
  noiseSource.connect(hp).connect(lp).connect(gain).connect(c.destination);
  noiseSource.start();
}

let availableVoices: SpeechSynthesisVoice[] = [];
let voiceListeners: ((speaking: boolean) => void)[] = [];
let isCurrentlySpeaking = false;
let hasWelcomed = false;

function refreshVoices() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  const list = window.speechSynthesis.getVoices();
  if (list && list.length > 0) availableVoices = list;
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  refreshVoices();
  window.speechSynthesis.onvoiceschanged = () => {
    refreshVoices();
  };
}

export function getStudioHostVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  const voices = availableVoices.length > 0 ? availableVoices : window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return null;

  // High quality natural studio voices
  const preferredKeywords = [
    'natural',
    'jenny',
    'aria',
    'ana',
    'samantha',
    'victoria',
    'zira',
    'karen',
    'tessa',
    'fiona',
    'google us english',
  ];

  for (const kw of preferredKeywords) {
    const match = voices.find(
      (v) => v.lang.startsWith('en') && v.name.toLowerCase().includes(kw)
    );
    if (match) return match;
  }

  // Any clean English voice
  const anyFemale = voices.find(
    (v) =>
      v.lang.startsWith('en') &&
      (v.name.toLowerCase().includes('female') ||
        v.name.toLowerCase().includes('woman'))
  );
  if (anyFemale) return anyFemale;

  return voices.find((v) => v.lang.startsWith('en')) || voices[0] || null;
}

export const speech = {
  get enabled() {
    return voiceOn;
  },
  get isSpeaking() {
    return isCurrentlySpeaking;
  },
  subscribe(fn: (speaking: boolean) => void) {
    voiceListeners.push(fn);
    return () => {
      voiceListeners = voiceListeners.filter((l) => l !== fn);
    };
  },
  toggle() {
    voiceOn = !voiceOn;
    if (typeof window !== 'undefined') {
      localStorage.setItem('barefaced.voice', voiceOn ? '1' : '0');
    }
    if (voiceOn) {
      this.speak("Host commentary enabled.", true);
    } else {
      this.stop();
    }
    return voiceOn;
  },
  speak(text: string, priority = false) {
    if (!voiceOn || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      if (priority) {
        window.speechSynthesis.cancel();
      }
      const clean = text
        .replace(/[\u{1F300}-\u{1FAD6}\u{2000}-\u{27BF}]/gu, '')
        .replace(/[•*_~`#]/g, ' ')
        .replace(/_+/g, ' blank ')
        .replace(/\s+/g, ' ')
        .trim();
      if (!clean) return;

      const utt = new SpeechSynthesisUtterance(clean);
      // Realistic, human studio host delivery
      utt.pitch = 1.04;
      utt.rate = 1.0;
      utt.volume = 1.0;

      const hostVoice = getStudioHostVoice();
      if (hostVoice) utt.voice = hostVoice;

      utt.onstart = () => {
        isCurrentlySpeaking = true;
        voiceListeners.forEach((fn) => fn(true));
      };
      utt.onend = () => {
        isCurrentlySpeaking = false;
        voiceListeners.forEach((fn) => fn(false));
      };
      utt.onerror = () => {
        isCurrentlySpeaking = false;
        voiceListeners.forEach((fn) => fn(false));
      };

      window.speechSynthesis.speak(utt);
    } catch {
      isCurrentlySpeaking = false;
      voiceListeners.forEach((fn) => fn(false));
    }
  },
  welcome() {
    if (hasWelcomed || !voiceOn) return;
    hasWelcomed = true;
    sound.sparkle();
    setTimeout(() => {
      this.speak(
        "Welcome to Barefaced! I'm Roxy, your studio hostess. Grab your friends, invite our VIP guests, and let's see who can tell the best lies!",
        true
      );
    }, 280);
  },
  stop() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      isCurrentlySpeaking = false;
      voiceListeners.forEach((fn) => fn(false));
    }
  },
};

/* ----------------- Procedural Studio Lounge BGM ----------------- */

let bgmOn = false;
if (typeof window !== 'undefined') {
  const savedBgm = localStorage.getItem('barefaced.bgm');
  if (savedBgm !== null) bgmOn = savedBgm === '1';
}

let bgmGain: GainNode | null = null;
let bgmTimer: number | null = null;
let bgmStep = 0;

function getBgmGain(): GainNode | null {
  const c = audio();
  if (!c) return null;
  if (!bgmGain) {
    bgmGain = c.createGain();
    bgmGain.gain.setValueAtTime(0.035, c.currentTime);
    bgmGain.connect(c.destination);
  }
  return bgmGain;
}

// Auto-duck BGM when Studio Hostess speaks
speech.subscribe((speaking) => {
  const c = audio();
  const master = getBgmGain();
  if (!c || !master) return;
  master.gain.setTargetAtTime(speaking ? 0.01 : 0.035, c.currentTime, 0.25);
});

function bgmNote(freq: number, start: number, len: number, type: OscillatorType = 'sine', vol = 0.08) {
  const c = audio();
  const master = getBgmGain();
  if (!c || !master || !bgmOn) return;
  const o = c.createOscillator();
  const g = c.createGain();
  const t0 = c.currentTime + start;
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
  o.connect(g).connect(master);
  o.start(t0);
  o.stop(t0 + len + 0.02);
}

function bgmShaker(start: number) {
  const c = audio();
  const master = getBgmGain();
  if (!c || !master || !bgmOn) return;
  const duration = 0.035;
  const bufferSize = Math.floor(c.sampleRate * duration);
  const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.4;
  const source = c.createBufferSource();
  source.buffer = buffer;
  const hp = c.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.setValueAtTime(4500, c.currentTime + start);
  const gain = c.createGain();
  gain.gain.setValueAtTime(0.015, c.currentTime + start);
  gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + duration);
  source.connect(hp).connect(gain).connect(master);
  source.start(c.currentTime + start);
}

const BGM_BARS = [
  { bass: 87.31, chord: [174.61, 207.65, 261.63, 311.13] }, // Fm7
  { bass: 116.54, chord: [146.83, 174.61, 233.08, 277.18] }, // Bb7
  { bass: 77.78, chord: [155.56, 196.0, 233.08, 293.66] }, // Ebmaj7
  { bass: 65.41, chord: [164.81, 196.0, 233.08, 311.13] }, // C7alt
];

function stepBgm() {
  if (!bgmOn) return;
  const barIdx = Math.floor(bgmStep / 4) % BGM_BARS.length;
  const beat = bgmStep % 4;
  const bar = BGM_BARS[barIdx];

  // Soulful lounge bass
  if (beat === 0) {
    bgmNote(bar.bass, 0, 0.45, 'triangle', 0.1);
  } else if (beat === 2) {
    bgmNote(bar.bass * 1.5, 0, 0.35, 'triangle', 0.07);
  } else if (beat === 3) {
    bgmNote(bar.bass, 0.25, 0.2, 'triangle', 0.06);
  }

  // Smooth warm electric piano stabs on 2 & 4
  if (beat === 1 || beat === 3) {
    bar.chord.forEach((freq) => bgmNote(freq, 0, 0.32, 'sine', 0.025));
  }

  // Shaker ticks
  bgmShaker(0);
  bgmShaker(0.27);

  bgmStep++;
}

export function startStudioBgm() {
  if (bgmTimer) return;
  audio();
  bgmTimer = window.setInterval(stepBgm, 545);
}

export function stopStudioBgm() {
  if (bgmTimer) {
    clearInterval(bgmTimer);
    bgmTimer = null;
  }
}

export const sound = {
  get enabled() {
    return on;
  },
  get voiceEnabled() {
    return voiceOn;
  },
  get bgmEnabled() {
    return bgmOn;
  },
  toggle() {
    on = !on;
    if (on) this.click();
    return on;
  },
  toggleVoice() {
    return speech.toggle();
  },
  toggleBgm() {
    bgmOn = !bgmOn;
    if (typeof window !== 'undefined') {
      localStorage.setItem('barefaced.bgm', bgmOn ? '1' : '0');
    }
    if (bgmOn) startStudioBgm();
    else stopStudioBgm();
    return bgmOn;
  },
  startBgm: () => {
    if (bgmOn) startStudioBgm();
  },
  stopBgm: () => {
    stopStudioBgm();
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
  tick: () => note(880, 0, 0.04, 'square', 0.05),
  vote: () => {
    note(440, 0, 0.1, 'triangle');
    note(660, 0.07, 0.14, 'triangle');
  },
  pop: () => {
    note(580, 0, 0.04, 'sine', 0.14);
    note(880, 0.03, 0.06, 'sine', 0.12);
  },
  buzzer: () => {
    note(180, 0, 0.2, 'sawtooth', 0.08);
    note(140, 0.15, 0.25, 'sawtooth', 0.08);
  },
  chime: () => {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => note(f, i * 0.07, 0.35, 'sine', 0.09));
  },
  sparkle: () => {
    [659.25, 783.99, 987.77, 1318.51, 1567.98].forEach((f, i) =>
      note(f, i * 0.05, 0.28, 'sine', 0.08)
    );
  },
  whoosh: () => {
    note(300, 0, 0.12, 'triangle', 0.06);
    note(480, 0.06, 0.14, 'sine', 0.07);
  },
  win: () => {
    chord([523, 659], 0, 0.15, 'triangle', 0.08);
    chord([659, 784], 0.12, 0.15, 'triangle', 0.09);
    chord([784, 1046], 0.24, 0.35, 'triangle', 0.11);
  },
  wager: () => {
    note(220, 0, 0.08, 'sawtooth', 0.1);
    note(440, 0.06, 0.1, 'square', 0.1);
    note(880, 0.12, 0.22, 'triangle', 0.14);
  },
  like: () => {
    note(659.25, 0, 0.08, 'sine', 0.12);
    note(987.77, 0.07, 0.18, 'sine', 0.14);
  },
  heartbeat: () => {
    note(80, 0, 0.08, 'sine', 0.18);
    note(65, 0.12, 0.14, 'sine', 0.16);
  },
  hostessVoice: () => {
    const freqs = [440, 554.37, 659.25, 880];
    const pick1 = freqs[Math.floor(Math.random() * freqs.length)];
    const pick2 = freqs[Math.floor(Math.random() * freqs.length)];
    note(pick1, 0, 0.05, 'triangle', 0.09);
    note(pick2, 0.04, 0.07, 'sine', 0.1);
  },
  combo: (count: number) => {
    const base = 440 * Math.pow(1.08, Math.min(count, 12));
    note(base, 0, 0.06, 'sine', 0.12);
    note(base * 1.5, 0.04, 0.09, 'triangle', 0.1);
  },
  cheer: () => {
    chord([523, 659, 784], 0, 0.2, 'triangle', 0.09);
    chord([587, 740, 880], 0.12, 0.22, 'triangle', 0.1);
    chord([659, 830, 988], 0.24, 0.35, 'triangle', 0.11);
  },
  applause: () => {
    noise(1.8, 0.12, 600, 3500);
    setTimeout(() => noise(1.4, 0.1, 500, 3000), 200);
    setTimeout(() => sound.cheer(), 150);
  },
  drumroll: () => {
    const c = audio();
    if (!c || !on) return;
    for (let i = 0; i < 22; i++) {
      const delay = i * 0.05;
      const vol = 0.02 + (i / 22) * 0.08;
      setTimeout(() => noise(0.05, vol, 800, 2500), delay * 1000);
    }
    setTimeout(() => {
      noise(0.4, 0.15, 1200, 6000);
      note(220, 0, 0.3, 'triangle', 0.08);
    }, 1120);
  },
  cashRegister: () => {
    note(1046.5, 0, 0.08, 'sine', 0.14);
    note(1567.98, 0.06, 0.09, 'sine', 0.15);
    note(2093.0, 0.12, 0.28, 'sine', 0.16);
    setTimeout(() => noise(0.08, 0.06, 2000, 5000), 100);
  },
  gasp: () => {
    noise(0.6, 0.09, 300, 1800);
    note(160, 0, 0.25, 'sine', 0.08);
  },
  radar: () => {
    note(1760, 0, 0.35, 'sine', 0.14);
    note(880, 0.08, 0.4, 'sine', 0.09);
  },
  lose: () => {
    note(260, 0, 0.18, 'sawtooth', 0.07);
    note(196, 0.14, 0.3, 'sawtooth', 0.07);
  },
  shield: () => {
    note(440, 0, 0.15, 'sine', 0.12);
    note(880, 0.1, 0.25, 'triangle', 0.14);
  },
  trap: () => {
    note(180, 0, 0.08, 'sawtooth', 0.14);
    note(240, 0.06, 0.12, 'square', 0.12);
    note(120, 0.12, 0.22, 'sawtooth', 0.16);
  },
  heartCrack: () => {
    note(350, 0, 0.08, 'sawtooth', 0.12);
    note(220, 0.06, 0.14, 'sawtooth', 0.14);
    note(130, 0.12, 0.25, 'sawtooth', 0.16);
    noise(0.22, 0.09, 300, 1500);
  },
  pointShower: () => {
    [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98].forEach((f, i) =>
      note(f, i * 0.045, 0.2, 'sine', 0.09)
    );
  },
  fanfare: () => {
    [
      { f: [523, 659], s: 0, l: 0.14 },
      { f: [523, 659], s: 0.14, l: 0.14 },
      { f: [523, 659], s: 0.28, l: 0.14 },
      { f: [659, 830], s: 0.42, l: 0.28 },
      { f: [587, 740], s: 0.7, l: 0.14 },
      { f: [784, 1046], s: 0.88, l: 0.65 },
    ].forEach(({ f, s, l }) => chord(f, s, l, 'triangle', 0.08));
  },
  airhorn: () => {
    const hits = [0, 0.08, 0.16, 0.28];
    hits.forEach((t, i) => {
      const len = i === 3 ? 0.42 : 0.06;
      chord([466.16, 554.37, 698.46], t, len, 'sawtooth', 0.12);
    });
  },
  rimshot: () => {
    note(280, 0, 0.05, 'triangle', 0.12);
    noise(0.08, 0.1, 800, 4000);
    setTimeout(() => {
      note(220, 0, 0.06, 'triangle', 0.14);
      noise(0.35, 0.12, 1500, 7000);
    }, 110);
  },
  crickets: () => {
    for (let c = 0; c < 3; c++) {
      const t = c * 0.22;
      note(4500, t, 0.03, 'sine', 0.04);
      note(4800, t + 0.04, 0.03, 'sine', 0.04);
      note(4500, t + 0.08, 0.03, 'sine', 0.04);
    }
  },
  dramaSting: () => {
    chord([110, 155.56, 220, 311.13], 0, 0.8, 'sawtooth', 0.14);
  },
};
