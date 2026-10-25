import { useCallback, useEffect, useRef, useState } from 'react';
import type { ClientState, Payload } from '../lib/types';
import { loadSeat, poll, saveSeat, send, type Seat } from './api';
import { sound } from './audio';
import { Final, Home, Lobby, Reveal, Rules, Vote, Write, type Ctx } from './screens';

function useSecondsLeft(deadline: number, offset: number) {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    if (!deadline) return setSecs(0);
    const update = () => setSecs(Math.max(0, (deadline - (Date.now() + offset)) / 1000));
    update();
    const id = setInterval(update, 200);
    return () => clearInterval(id);
  }, [deadline, offset]);
  return secs;
}

export default function App() {
  const [seat, setSeat] = useState<Seat | null>(loadSeat);
  const [state, setState] = useState<ClientState | null>(null);
  const [offset, setOffset] = useState(0);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const [rules, setRules] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const invite = new URLSearchParams(window.location.search).get('room')?.toUpperCase().replace(/[^A-Z]/g, '') ?? '';

  const flash = useCallback((msg: string) => {
    setToast(msg);
    window.clearTimeout((flash as unknown as { t?: number }).t);
    (flash as unknown as { t?: number }).t = window.setTimeout(() => setToast(''), 4000);
  }, []);

  const apply = useCallback((s: ClientState) => {
    setOffset(s.serverTime - Date.now());
    setState((prev) => (prev && prev.code === s.code && prev.version > s.version ? prev : s));
  }, []);

  const leave = useCallback((msg?: string) => {
    saveSeat(null);
    setSeat(null);
    setState(null);
    if (msg) flash(msg);
  }, [flash]);

  /* keep every screen in sync by asking the server once a second */
  useEffect(() => {
    if (!seat) return;
    let alive = true;
    let inFlight = false;
    const tick = async () => {
      if (inFlight) return;
      inFlight = true;
      const r = await poll(seat.code, seat.playerId);
      inFlight = false;
      if (!alive) return;
      if (r.ok && r.state) apply(r.state);
      else if (r.status === 403 || r.status === 404) leave('That room is gone, or you were removed from it.');
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [seat, apply, leave]);

  /* sounds on phase changes */
  const lastPhase = useRef('');
  useEffect(() => {
    if (!state) return;
    const key = `${state.phase}-${state.round}-${state.promptNumber}`;
    if (key === lastPhase.current) return;
    lastPhase.current = key;
    const me = state.players.find((p) => p.id === seat?.playerId);
    if (state.phase === 'WRITE') sound.start();
    else if (state.phase === 'REVEAL') (me && me.gain > 0 ? sound.win : sound.lose)();
    else if (state.phase === 'FINAL') sound.fanfare();
  }, [state, seat]);

  const secs = useSecondsLeft(state?.deadline ?? 0, offset);
  const lastTick = useRef(-1);
  useEffect(() => {
    const whole = Math.ceil(secs);
    if ((state?.phase === 'WRITE' || state?.phase === 'VOTE') && whole <= 5 && whole > 0 && whole !== lastTick.current) {
      lastTick.current = whole;
      sound.tick();
    }
  }, [secs, state?.phase]);

  const enter = async (payload: Payload) => {
    sound.click();
    setBusy(true);
    const r = await send(payload);
    setBusy(false);
    if (!r.ok || !r.playerId || !r.state) return flash(r.error || 'Something went wrong.');
    const next = { code: r.state.code, playerId: r.playerId };
    saveSeat(next);
    localStorage.setItem('barefaced.name', payload.name ?? '');
    window.history.replaceState({}, '', window.location.pathname);
    setState(r.state);
    setOffset(r.state.serverTime - Date.now());
    setSeat(next);
  };

  const act: Ctx['act'] = async (p, quiet) => {
    if (!seat) return { ok: false };
    const r = await send({ ...p, code: seat.code, playerId: seat.playerId } as Payload);
    if (r.ok && r.state) apply(r.state);
    else if (!quiet) flash(r.error || 'Something went wrong.');
    return r;
  };

  const toggleSound = () => setSoundOn(sound.toggle());

  const leaveClick = async () => {
    if (!state) return;
    if (state.phase !== 'LOBBY' && !window.confirm('Leave this game? Your seat will stay empty.')) return;
    if (state.phase === 'LOBBY') await act({ action: 'leave' }, true);
    leave();
  };

  const me = state?.players.find((p) => p.id === seat?.playerId);
  const ctx: Ctx | null = state && me ? { s: state, me, isHost: state.hostId === me.id, secs, act } : null;
  const key = state ? `${state.round}-${state.promptNumber}` : '';

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <i />
            <i />
          </span>
          <span className="brand-name">Barefaced</span>
        </div>
        <nav>
          <button className="linkbtn" onClick={() => setRules(true)}>
            Rules
          </button>
          <button className="linkbtn" onClick={toggleSound} aria-pressed={soundOn}>
            Sound {soundOn ? 'on' : 'off'}
          </button>
          {state && (
            <button className="linkbtn" onClick={leaveClick}>
              Leave
            </button>
          )}
        </nav>
      </header>

      <main className="stage">
        {!ctx && !seat && (
          <Home
            invite={invite}
            busy={busy}
            initialName={localStorage.getItem('barefaced.name') ?? ''}
            onCreate={(name) => enter({ action: 'create', name })}
            onJoin={(name, code) => enter({ action: 'join', name, code })}
            onRules={() => setRules(true)}
          />
        )}
        {!ctx && seat && <p className="loading">Finding your room...</p>}
        {ctx && ctx.s.phase === 'LOBBY' && <Lobby {...ctx} />}
        {ctx && ctx.s.phase === 'WRITE' && <Write key={key} {...ctx} />}
        {ctx && ctx.s.phase === 'VOTE' && <Vote key={key} {...ctx} />}
        {ctx && ctx.s.phase === 'REVEAL' && <Reveal key={key} {...ctx} />}
        {ctx && ctx.s.phase === 'FINAL' && <Final {...ctx} />}
      </main>

      {toast && (
        <div className="toast" role="alert" onClick={() => setToast('')}>
          {toast}
        </div>
      )}
      {rules && <Rules onClose={() => setRules(false)} />}
    </div>
  );
}
