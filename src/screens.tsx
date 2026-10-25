import { useState, type FormEvent } from 'react';
import type { ApiResult, ClientState, Payload, PublicOption, PublicPlayer } from '../lib/types';
import { Chip, PromptText, TimerBar, money } from './ui';
import { sound } from './audio';

export interface Ctx {
  s: ClientState;
  me: PublicPlayer;
  isHost: boolean;
  secs: number;
  act: (p: Partial<Payload>, quiet?: boolean) => Promise<ApiResult>;
}

const LETTERS = 'ABCDEFGHIJ';
const byScore = (players: PublicPlayer[]) => [...players].sort((a, b) => b.score - a.score);
const nameOf = (s: ClientState, id: string) => s.players.find((p) => p.id === id)?.name ?? 'someone';

/* ---------------------------------------------------------------- Home */

export function Home(props: {
  invite: string;
  busy: boolean;
  initialName: string;
  onCreate: (name: string) => void;
  onJoin: (name: string, code: string) => void;
  onRules: () => void;
}) {
  const [name, setName] = useState(props.initialName);
  const [code, setCode] = useState(props.invite);

  const join = (e: FormEvent) => {
    e.preventDefault();
    props.onJoin(name, code);
  };

  return (
    <div className="home">
      <section className="hero">
        <p className="eyebrow">A party game for 2 to 8 people</p>
        <h1>
          Lie well.
          <br />
          <span className="underline">Be believed.</span>
        </h1>
        <p className="lede">
          Every prompt is a real fact with the answer missing. Invent a fake answer that sounds true, then try to spot the
          real one among everyone else's. The better your lie, the more it pays.
        </p>
        <ol className="steps">
          <li>
            <b>Write</b> a believable fake answer.
          </li>
          <li>
            <b>Vote</b> for the one you think is real.
          </li>
          <li>
            <b>Score</b> for finding the truth and for fooling people.
          </li>
        </ol>
        <button className="linkbtn" onClick={props.onRules}>
          Read the full rules
        </button>
      </section>

      <section className="card entry">
        <form onSubmit={join}>
          <label className="label" htmlFor="name">
            Your name
          </label>
          <input
            id="name"
            className="input"
            value={name}
            maxLength={14}
            autoComplete="off"
            placeholder="What should we call you?"
            onChange={(e) => setName(e.target.value)}
          />

          {props.invite && <p className="invite">You were invited to room {props.invite}.</p>}

          <label className="label" htmlFor="code">
            Room code
          </label>
          <input
            id="code"
            className="input code-input"
            value={code}
            maxLength={4}
            autoComplete="off"
            autoCapitalize="characters"
            placeholder="ABCD"
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
          />

          <button id="btn-join" className="btn primary" type="submit" disabled={props.busy || code.length < 4}>
            Join this room
          </button>
        </form>

        <div className="or">
          <span>or</span>
        </div>

        <button id="btn-create" className="btn" disabled={props.busy} onClick={() => props.onCreate(name)}>
          Host a new room
        </button>
      </section>
    </div>
  );
}

/* --------------------------------------------------------------- Lobby */

export function Lobby({ s, me, isHost, act }: Ctx) {
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}${window.location.pathname}?room=${s.code}`;
  const enough = s.players.length >= 2;

  const copy = async () => {
    sound.click();
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copy this link', link);
    }
  };

  return (
    <div className="lobby">
      <section className="ticket" aria-label="Room code">
        <p className="ticket-label">Room code</p>
        <p className="ticket-code" id="room-code">
          {s.code}
        </p>
        <p className="ticket-hint">Friends open this site and type it in, or use the link.</p>
        <button id="btn-copy" className="btn small" onClick={copy}>
          {copied ? 'Link copied' : 'Copy invite link'}
        </button>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Players</h2>
          <span className="count">{s.players.length} of 8</span>
        </div>
        <ul className="roster">
          {s.players.map((p) => (
            <li key={p.id}>
              <Chip p={p} />
              <span className="roster-name">
                {p.name}
                {p.id === me.id && <em> (you)</em>}
              </span>
              {p.isHost && <span className="tag">Host</span>}
            </li>
          ))}
        </ul>

        {isHost ? (
          <>
            <button id="btn-start" className="btn primary wide" disabled={!enough} onClick={() => act({ action: 'start' })}>
              Start the game
            </button>
            {!enough && <p className="hint">Waiting for at least one more player. Open the link in a second tab to try it alone.</p>}
          </>
        ) : (
          <p className="hint center">Waiting for {nameOf(s, s.hostId)} to start.</p>
        )}
      </section>

      <section className="card quick">
        <h2>How a prompt works</h2>
        <ol>
          <li>You get a fact with a blank. Write a fake answer in under a minute.</li>
          <li>All answers, true and false, are shuffled together. Vote for the real one.</li>
          <li>
            Finding the truth is worth 1,000. Every person who falls for your lie earns you 500. Later rounds multiply it
            by 2 and 3.
          </li>
        </ol>
      </section>
    </div>
  );
}

/* --------------------------------------------------------------- Write */

function RoundStrip({ s }: { s: ClientState }) {
  return (
    <div className="strip">
      <span>
        Round {s.round} of {s.rounds}
      </span>
      <span className="dot" />
      <span>
        Prompt {s.promptNumber} of {s.promptsPerRound}
      </span>
      <span className={`mult m${s.multiplier}`}>Points x{s.multiplier}</span>
    </div>
  );
}

function Waiting({ s, done, label }: { s: ClientState; done: (p: PublicPlayer) => boolean; label: string }) {
  const left = s.players.filter((p) => !done(p)).length;
  return (
    <div className="waiting">
      <p>{left === 0 ? 'Everyone is in.' : `${label} ${left} more ${left === 1 ? 'player' : 'players'}...`}</p>
      <ul className="statuses">
        {s.players.map((p) => (
          <li key={p.id} className={done(p) ? 'done' : ''}>
            <Chip p={p} size="sm" muted={!done(p)} />
            <span>{p.name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Write({ s, isHost, secs, act }: Ctx) {
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const [sending, setSending] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    setErr('');
    const r = await act({ action: 'lie', text }, true);
    setSending(false);
    if (!r.ok) setErr(r.error || 'That did not work.');
    else sound.lock();
  };

  return (
    <div className="play">
      <RoundStrip s={s} />
      <TimerBar secs={secs} total={s.phaseTotal} />
      <h2 className="prompt">
        <PromptText text={s.prompt ?? ''} />
      </h2>

      {s.myLie === null || s.myLie === undefined ? (
        <form className="card write" onSubmit={submit}>
          <label className="label" htmlFor="lie">
            Your fake answer
          </label>
          <input
            id="lie"
            className="input big"
            value={text}
            maxLength={40}
            autoComplete="off"
            autoFocus
            placeholder="Make it sound true"
            onChange={(e) => {
              setText(e.target.value);
              setErr('');
            }}
          />
          {err && (
            <p className="error" role="alert">
              {err}
            </p>
          )}
          <button id="btn-lie" className="btn primary wide" disabled={!text.trim() || sending}>
            Lock it in
          </button>
          <p className="hint">
            Each person who picks it earns you {money(500 * s.multiplier)}. Copying the real answer will not work, the game
            checks.
          </p>
        </form>
      ) : (
        <div className="card locked">
          <p className="label">Locked in</p>
          <p className="locked-text">{s.myLie}</p>
          <Waiting s={s} done={(p) => p.submitted} label="Waiting for" />
        </div>
      )}

      {isHost && (
        <button className="linkbtn skip" onClick={() => act({ action: 'next' })}>
          Skip the timer
        </button>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- Vote */

export function Vote({ s, isHost, secs, act }: Ctx) {
  const [pending, setPending] = useState<string | null>(null);
  const chosen = s.myVote ?? pending;

  const pick = async (o: PublicOption) => {
    if (chosen || o.mine) return;
    setPending(o.id);
    sound.vote();
    const r = await act({ action: 'vote', optionId: o.id });
    if (!r.ok) setPending(null);
  };

  return (
    <div className="play">
      <RoundStrip s={s} />
      <TimerBar secs={secs} total={s.phaseTotal} />
      <h2 className="prompt">
        <PromptText text={s.prompt ?? ''} />
      </h2>
      <p className="subprompt">One of these is real. Which one?</p>

      <ul className="options">
        {s.options?.map((o, i) => (
          <li key={o.id}>
            <button
              id={`opt-${i}`}
              className={`option${chosen === o.id ? ' chosen' : ''}${o.mine ? ' mine' : ''}`}
              disabled={!!chosen || o.mine}
              onClick={() => pick(o)}
            >
              <span className="letter">{LETTERS[i]}</span>
              <span className="option-text">{o.text}</span>
              {o.mine && <span className="tag">Yours</span>}
              {chosen === o.id && <span className="tag ink">Your vote</span>}
            </button>
          </li>
        ))}
      </ul>

      {chosen && <Waiting s={s} done={(p) => p.voted} label="Waiting for" />}

      {isHost && (
        <button className="linkbtn skip" onClick={() => act({ action: 'next' })}>
          Skip the timer
        </button>
      )}
    </div>
  );
}

/* -------------------------------------------------------------- Reveal */

export function Reveal({ s, me, isHost, secs, act }: Ctx) {
  const last = s.round === s.rounds && s.promptNumber === s.promptsPerRound;
  const mine = s.players.find((p) => p.id === me.id) ?? me;
  const ranked = byScore(s.players);

  return (
    <div className="play reveal">
      <RoundStrip s={s} />
      <h2 className="prompt">
        <PromptText text={s.prompt ?? ''} fill={s.truth} />
      </h2>

      <ul className="options">
        {s.options?.map((o, i) => {
          const truth = o.kind === 'truth';
          return (
            <li key={o.id} className="rise" style={{ ['--i' as string]: i }}>
              <div className={`option shown${truth ? ' truth' : ''}${o.mine ? ' mine' : ''}`}>
                <span className="letter">{LETTERS[i]}</span>
                <div className="option-body">
                  <span className="option-text">{o.text}</span>
                  <span className="byline">
                    {truth
                      ? 'The real answer'
                      : o.kind === 'house'
                        ? 'Made up by the house'
                        : `Written by ${(o.authors ?? []).map((a) => nameOf(s, a)).join(' and ')}`}
                  </span>
                </div>
                <div className="voters">
                  {(o.voters ?? []).map((v) => {
                    const p = s.players.find((x) => x.id === v);
                    return p ? <Chip key={v} p={p} size="sm" /> : null;
                  })}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="note">{s.note}</p>

      <div className={`card yours ${mine.gain > 0 ? 'won' : ''}`}>
        <p className="label">You scored</p>
        <p className="big-gain">+{money(mine.gain)}</p>
        {mine.gainTruth > 0 && <p className="why">{money(mine.gainTruth)} for finding the truth</p>}
        {mine.gainFooled > 0 && <p className="why">{money(mine.gainFooled)} for fooling people</p>}
        {mine.gain === 0 && <p className="why">Nothing this time.</p>}
      </div>

      <section className="card">
        <h3>Standings</h3>
        <ol className="board">
          {ranked.map((p, i) => (
            <li key={p.id} className={p.id === me.id ? 'me' : ''}>
              <span className="rank">{i + 1}</span>
              <Chip p={p} size="sm" />
              <span className="board-name">{p.name}</span>
              {p.gain > 0 && <span className="delta">+{money(p.gain)}</span>}
              <span className="board-score">{money(p.score)}</span>
            </li>
          ))}
        </ol>
      </section>

      {isHost ? (
        <button id="btn-next" className="btn primary wide" onClick={() => act({ action: 'next' })}>
          {last ? 'See the final result' : 'Next prompt'}
        </button>
      ) : (
        <p className="hint center">Waiting for {nameOf(s, s.hostId)}. It moves on by itself in {Math.ceil(secs)}s.</p>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- Final */

export function Final({ s, me, isHost, act }: Ctx) {
  const ranked = byScore(s.players);
  const top = ranked[0];
  const tie = ranked.length > 1 && ranked[1].score === top.score;

  return (
    <div className="final">
      <section className="winner">
        <p className="eyebrow">{tie ? 'Dead heat' : top.id === me.id ? 'You win' : 'Winner'}</p>
        <div className="stamp">
          <Chip p={top} size="lg" />
          <h2>{tie ? ranked.filter((p) => p.score === top.score).map((p) => p.name).join(' and ') : top.name}</h2>
          <p className="winner-score">{money(top.score)} points</p>
        </div>
      </section>

      <section className="card">
        <h3>Final standings</h3>
        <ol className="board">
          {ranked.map((p, i) => (
            <li key={p.id} className={p.id === me.id ? 'me' : ''}>
              <span className="rank">{i + 1}</span>
              <Chip p={p} size="sm" />
              <span className="board-name">{p.name}</span>
              <span className="board-score">{money(p.score)}</span>
            </li>
          ))}
        </ol>
      </section>

      {s.awards && s.awards.length > 0 && (
        <section className="awards">
          {s.awards.map((a) => {
            const p = s.players.find((x) => x.id === a.playerId);
            return (
              <div className="award" key={a.title}>
                <p className="award-title">{a.title}</p>
                <p className="award-name">{p?.name}</p>
                <p className="award-detail">{a.detail}</p>
              </div>
            );
          })}
        </section>
      )}

      {isHost ? (
        <button id="btn-again" className="btn primary wide" onClick={() => act({ action: 'again' })}>
          Play again with the same room
        </button>
      ) : (
        <p className="hint center">Waiting for {nameOf(s, s.hostId)} to start another game.</p>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- Rules */

export function Rules({ onClose }: { onClose: () => void }) {
  return (
    <div className="backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-label="How to play" onClick={(e) => e.stopPropagation()}>
        <h2>How to play</h2>
        <ol className="rules">
          <li>
            <b>Join.</b> One person hosts a room and shares the 4-letter code. Everyone else types it in on their own
            phone or laptop. No accounts.
          </li>
          <li>
            <b>Write.</b> A real fact appears with a blank. Type a fake answer that could pass for real. You can't submit
            the actual answer, and you can't change your mind once you lock in.
          </li>
          <li>
            <b>Vote.</b> Every answer is shuffled together with a couple of fakes from the house. Pick the one you think is
            true. You can't pick your own.
          </li>
          <li>
            <b>Score.</b> Finding the truth earns 1,000. Each player who picks your lie earns you 500. If two people wrote
            the same lie they split into one option and both get paid.
          </li>
          <li>
            <b>Three rounds, three prompts each.</b> Round 1 is worth x1, round 2 is x2, round 3 is x3 and has less room to
            hide. Most points after nine prompts wins.
          </li>
        </ol>
        <p className="hint">The host can skip a timer at any time. If the host disappears, the game keeps moving by itself.</p>
        <button className="btn primary wide" onClick={onClose}>
          Got it
        </button>
      </div>
    </div>
  );
}
