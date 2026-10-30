import { useState, useEffect, type FormEvent } from 'react';
import type { ApiResult, ClientState, Payload, PublicOption, PublicPlayer } from '../lib/types';
import {
  BluffSparksRow,
  BluffTrapToggle,
  Chip,
  ConfettiCanvas,
  DeckCategorySelector,
  DoubleDownToggle,
  EmblemPicker,
  GameModeSelector,
  getVipTrait,
  HallOfDeception,
  HeartMeter,
  IdeaSparkButton,
  LieRadarLifeline,
  MatchLengthSelector,
  OlympicPodium,
  PARTY_AVATARS,
  PartyModifiersPanel,
  PlayerTitleBadge,
  PromptAudioButton,
  PromptText,
  randomPartyName,
  ReactionToolbar,
  StreakBadge,
  TimerBar,
  TruthShieldButton,
  money,
} from './ui';
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

const ROUND_FLAVORS: Record<number, { title: string; desc: string }> = {
  1: { title: '🌱 The Warm-Up', desc: 'Standard stakes • 1,000 truth / 500 lie' },
  2: { title: '⚡ Double Trouble', desc: 'Double stakes (x2) • 2,000 truth / 1,000 lie • Double Down available!' },
  3: { title: '🔥 Barefaced Finale', desc: 'Triple stakes (x3) • Only 1 house decoy • Ultimate Showdown!' },
};

/* ---------------------------------------------------------------- Home */

const QUICK_NAMES = ['Captain Bluff', 'Sneaky Fox', 'Lucky Strike', 'Detective Knox', 'Pizza Boss'];

export function Home(props: {
  invite: string;
  busy: boolean;
  initialName: string;
  onCreate: (name: string) => void;
  onSolo?: (name: string) => void;
  onJoin: (name: string, code: string) => void;
  onRules: () => void;
}) {
  const [name, setName] = useState(props.initialName || '');
  const [code, setCode] = useState(props.invite || '');
  const [avatar, setAvatar] = useState(PARTY_AVATARS[0]);
  const [activeTab, setActiveTab] = useState<'solo' | 'host' | 'join'>(props.invite ? 'join' : 'solo');

  const handleNameChange = (val: string) => {
    setName(val);
    try {
      localStorage.setItem('barefaced.name', val);
    } catch {
      // ignore
    }
  };

  const rollName = () => {
    sound.pop();
    const next = randomPartyName();
    handleNameChange(next);
  };

  const cycleAvatar = () => {
    sound.pop();
    const idx = PARTY_AVATARS.indexOf(avatar);
    setAvatar(PARTY_AVATARS[(idx + 1) % PARTY_AVATARS.length]);
  };

  const handleJoin = (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (code.length < 4) return;
    props.onJoin(name.trim() || 'Player 1', code);
  };

  const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (activeTab === 'join') {
        if (code.length === 4) handleJoin();
        else {
          document.getElementById('code')?.focus();
        }
      } else if (activeTab === 'solo' && props.onSolo) {
        props.onSolo(name.trim() || 'Player 1');
      } else if (activeTab === 'host') {
        props.onCreate(name.trim() || 'Player 1');
      }
    }
  };

  return (
    <div className="home">
      <section className="hero">
        <p className="eyebrow">The World-Class Party Game of Believable Lies</p>
        <h1>
          Lie well.
          <br />
          <span className="underline">Be believed.</span>
        </h1>
        <p className="lede">
          Every prompt is a real fact with the answer missing. Invent a fake answer that sounds true, then try to spot the
          real one among everyone else's. The better your lie, the more it pays!
        </p>
        <div className="features-pill">
          <span>🔥 Double Down Wagers</span>
          <span>🎩 VIP House Guests & Drafts</span>
          <span>👍 Clever Lie Kudos</span>
          <span>⚡ Live Reactions</span>
          <span>🎭 Suspense Reveal</span>
        </div>
        <ol className="steps">
          <li>
            <b>Write</b> a believable fake answer or spark an idea.
          </li>
          <li>
            <b>Vote & Double Down</b> when you feel 100% confident!
          </li>
          <li>
            <b>Score & Laugh</b> at the hilarious reveals and awards.
          </li>
        </ol>
        <button className="linkbtn" onClick={props.onRules}>
          Read the full rules
        </button>
      </section>

      <section className="card entry" aria-label="Player Sign-in">
        {/* Dedicated Player Identity section */}
        <div className="player-identity-card">
          <div className="identity-header">
            <button
              type="button"
              className="identity-avatar-btn"
              onClick={cycleAvatar}
              title="Click to change your party hat"
            >
              <span className="identity-avatar-icon">{avatar}</span>
              <span className="avatar-cycle-hint">Tap to swap</span>
            </button>
            <div className="identity-title-col">
              <span className="identity-pill">PLAYER PROFILE</span>
              <h2 className="identity-title">Your Name</h2>
            </div>
            <span className="identity-char-count">{name.length}/18</span>
          </div>

          <div className="name-input-group">
            <div className="name-input-box">
              <input
                id="name"
                className="input name-input-field"
                value={name}
                maxLength={18}
                autoComplete="nickname"
                placeholder="What should we call you?"
                autoFocus
                onChange={(e) => handleNameChange(e.target.value)}
                onKeyDown={handleNameKeyDown}
              />
              {name.length > 0 && (
                <button
                  type="button"
                  className="name-clear-btn"
                  onClick={() => handleNameChange('')}
                  title="Clear name"
                >
                  ✕
                </button>
              )}
            </div>
            <button
              type="button"
              className="btn small random-name-btn"
              onClick={rollName}
              title="Roll random fun party alias"
            >
              🎲 Roll
            </button>
          </div>

          <div className="quick-picks-bar">
            <span className="quick-picks-label">⚡ Quick Picks:</span>
            <div className="quick-picks-list">
              {QUICK_NAMES.map((q) => (
                <button
                  key={q}
                  type="button"
                  className={`quick-pick-chip${name === q ? ' active' : ''}`}
                  onClick={() => {
                    sound.pop();
                    handleNameChange(q);
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Tab Selection for Play Options */}
        <div className="home-tabs" role="tablist" aria-label="Game Start Options">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'solo'}
            className={`home-tab${activeTab === 'solo' ? ' active' : ''}`}
            onClick={() => {
              sound.pop();
              setActiveTab('solo');
            }}
          >
            🎮 Quick Solo
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'host'}
            className={`home-tab${activeTab === 'host' ? ' active' : ''}`}
            onClick={() => {
              sound.pop();
              setActiveTab('host');
            }}
          >
            👑 Host Party
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'join'}
            className={`home-tab${activeTab === 'join' ? ' active' : ''}`}
            onClick={() => {
              sound.pop();
              setActiveTab('join');
            }}
          >
            🔑 Join Room
          </button>
        </div>

        {/* Pane 1: Quick Solo vs VIPs */}
        {activeTab === 'solo' && props.onSolo && (
          <div className="tab-pane">
            <p className="tab-pane-desc">
              Play immediately with VIP House Guests (Uncle Leo, Grandma Ethel & Chef Marco). Perfect for testing your lies and solo practice!
            </p>
            <button
              id="btn-solo"
              type="button"
              className="btn primary wide btn-action"
              disabled={props.busy}
              onClick={() => props.onSolo?.(name.trim() || 'Player 1')}
            >
              🚀 Launch Game vs VIP Guests
            </button>
            <div className="vip-preview-bar">
              <span className="vip-preview-label">VIP Guests ready to play:</span>
              <span className="vip-preview-chips">
                <span>🎩 Uncle Leo</span>
                <span>🧶 Grandma Ethel</span>
                <span>🍕 Chef Marco</span>
                <span>💅 Chloe</span>
              </span>
            </div>
          </div>
        )}

        {/* Pane 2: Host Room */}
        {activeTab === 'host' && (
          <div className="tab-pane">
            <p className="tab-pane-desc">
              Create a new room for you and up to 7 friends. You'll get a unique 4-letter room code with full party controls.
            </p>
            <button
              id="btn-create"
              type="button"
              className="btn primary wide btn-action"
              disabled={props.busy}
              onClick={() => props.onCreate(name.trim() || 'Player 1')}
            >
              👑 Create Party Room
            </button>
          </div>
        )}

        {/* Pane 3: Join Room */}
        {activeTab === 'join' && (
          <form className="tab-pane" onSubmit={handleJoin}>
            <p className="tab-pane-desc">
              Got a 4-letter code from a friend's screen? Type it below to join their party!
            </p>
            {props.invite && <p className="invite">Invited to room {props.invite}.</p>}

            <label className="label" htmlFor="code">
              Room Code
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

            <button
              id="btn-join"
              className="btn primary wide btn-action"
              type="submit"
              disabled={props.busy || code.length < 4}
            >
              Join Room Now
            </button>
          </form>
        )}
      </section>
    </div>
  );
}

/* --------------------------------------------------------------- Lobby */

export function Lobby({ s, me, isHost, act }: Ctx) {
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}${window.location.pathname}?room=${s.code}`;
  const enough = s.players.length >= 2;
  const botCount = s.players.filter((p) => p.isBot).length;

  const cycleAvatar = () => {
    sound.click();
    const currentIdx = me.avatar ? PARTY_AVATARS.indexOf(me.avatar) : -1;
    const next = PARTY_AVATARS[(currentIdx + 1) % PARTY_AVATARS.length];
    act({ action: 'avatar', avatar: next });
  };

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

  const shareRoom = async () => {
    sound.click();
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share({
          title: 'Barefaced Party Game',
          text: `Join my Barefaced game room (${s.code})! Spot the authentic truth among clever lies:`,
          url: link,
        });
        return;
      } catch {
        // Fall back to copy
      }
    }
    copy();
  };

  return (
    <div className="lobby">
      <section className="ticket" aria-label="Room code">
        <p className="ticket-label">Room code</p>
        <p className="ticket-code" id="room-code">
          {s.code}
        </p>
        <p className="ticket-hint">Friends open this site and type it in, or use the link.</p>
        <div className="ticket-actions">
          <button id="btn-copy" className="btn small" onClick={copy}>
            {copied ? '✅ Link copied' : '📋 Copy link'}
          </button>
          <button type="button" className="btn small share-btn" onClick={shareRoom} title="Share room invite">
            📲 Share invite
          </button>
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Studio Players</h2>
          <span className="count">
            {s.players.length} of 8 {botCount > 0 && `(${botCount} Guests)`}
          </span>
        </div>

        <EmblemPicker selected={me.avatar} onSelect={(av) => act({ action: 'avatar', avatar: av })} />

        <ul className="roster">
          {s.players.map((p) => (
            <li key={p.id}>
              <Chip p={p} onClick={p.id === me.id ? cycleAvatar : undefined} />
              <span className="roster-name">
                {p.name}
                {p.id === me.id && <em> (you)</em>}
              </span>
              <PlayerTitleBadge title={p.title} />
              <StreakBadge streak={p.streak} />
              {p.isHost && <span className="tag">Host</span>}
              {p.isBot && <span className="tag tag-guest">{getVipTrait(p.name)}</span>}
            </li>
          ))}
        </ul>

        <p className="hint center" style={{ marginTop: '0.75rem' }}>
          🎩 Tap your emblem above to equip your favorite party hat!
        </p>

        {isHost && (
          <div className="bot-controls">
            <button
              type="button"
              className="btn small"
              disabled={s.players.length >= 8}
              onClick={() => {
                sound.click();
                act({ action: 'addBot' });
              }}
            >
              + Invite VIP Guest
            </button>
            {botCount > 0 && (
              <button
                type="button"
                className="btn small"
                onClick={() => {
                  sound.click();
                  act({ action: 'removeBot' });
                }}
              >
                - Dismiss Guest
              </button>
            )}
          </div>
        )}

        {isHost ? (
          <>
            <button id="btn-start" className="btn primary wide" disabled={!enough} onClick={() => act({ action: 'start' })}>
              Start the game
            </button>
            {!enough && (
              <p className="hint">
                Need at least 2 players. Click <b>"+ Invite VIP Guest"</b> above to play right now, or invite a friend!
              </p>
            )}
          </>
        ) : (
          <p className="hint center">Waiting for {nameOf(s, s.hostId)} to start.</p>
        )}
      </section>

      <MatchLengthSelector
        length={s.matchLength}
        isHost={isHost}
        onSelectLength={(len) => act({ action: 'setMatchLength', matchLength: len })}
      />

      <GameModeSelector
        currentMode={s.gameMode ?? 'classic'}
        isHost={isHost}
        onSelectMode={(mode) => act({ action: 'setGameMode', gameMode: mode })}
      />

      <DeckCategorySelector
        category={s.deckCategory}
        isHost={isHost}
        onSelectCategory={(cat) => act({ action: 'setCategory', deckCategory: cat })}
      />

      <PartyModifiersPanel
        modifiers={s.modifiers}
        isHost={isHost}
        onToggleModifier={(key, val) => act({ action: 'setModifier', modifierKey: key, modifierVal: val })}
      />
    </div>
  );
}

/* --------------------------------------------------------------- Write */

function RoundStrip({ s }: { s: ClientState }) {
  const flavor =
    s.gameMode === 'blitz'
      ? { title: '⚡ Turbo Blitz Sprint', desc: 'Fast timers • Instant 2x' }
      : s.gameMode === 'infinity'
        ? { title: `♾️ Level ${s.infinityLevel || 1} Endurance`, desc: 'Survive the gauntlet' }
        : ROUND_FLAVORS[s.round] || { title: `Round ${s.round}`, desc: '' };

  return (
    <div className="strip-wrap">
      <div className="strip">
        <span className="round-title">{flavor.title}</span>
        <span className="dot" />
        <span>
          {s.gameMode === 'infinity' ? `Prompt ${s.infinityLevel}` : `Prompt ${s.promptNumber} of ${s.promptsPerRound}`}
        </span>
        {s.gameMode === 'infinity' && <HeartMeter lives={s.myLives} />}
        <StreakBadge streak={s.streak} />
        <span className={`mult m${s.multiplier}`}>x{s.multiplier} Points</span>
      </div>
    </div>
  );
}

function Waiting({ s, done, label }: { s: ClientState; done: (p: PublicPlayer) => boolean; label: string }) {
  const left = s.players.filter((p) => !done(p)).length;
  return (
    <div className="waiting">
      <p>{left === 0 ? 'Everyone is ready!' : `${label} ${left} more ${left === 1 ? 'player' : 'players'}...`}</p>
      <ul className="statuses">
        {s.players.map((p) => (
          <li key={p.id} className={done(p) ? 'done' : ''}>
            <Chip p={p} size="sm" muted={!done(p)} />
            <span>{p.name}</span>
            {p.doubleDown && <span className="dd-pill">🔥 x2</span>}
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
  const [plantTrap, setPlantTrap] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    setErr('');
    const r = await act({ action: 'lie', text, plantTrap }, true);
    setSending(false);
    if (!r.ok) setErr(r.error || 'That did not work.');
    else sound.lock();
  };

  const autoDraft = async () => {
    setSending(true);
    const r = await act({ action: 'suggestLie' });
    setSending(false);
    if (r.ok && r.suggestedLie) {
      setText(r.suggestedLie);
      setErr('');
    }
  };

  return (
    <div className="play">
      <RoundStrip s={s} />
      <TimerBar secs={secs} total={s.phaseTotal} />
      <div className="prompt-header-row">
        <h2 className="prompt">
          <PromptText text={s.prompt ?? ''} />
        </h2>
        <PromptAudioButton text={s.prompt ?? ''} />
      </div>

      {s.myLie === null || s.myLie === undefined ? (
        <form className="card write" onSubmit={submit}>
          <label className="label" htmlFor="lie">
            Your fake answer
          </label>
          <div className="input-with-counter">
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
            <span className={`char-counter${text.length >= 35 ? ' warn' : ''}`}>
              {text.length}/40
            </span>
          </div>
          {err && (
            <p className="error" role="alert">
              {err}
            </p>
          )}

          <BluffSparksRow onPickSpark={(hint) => setText(hint)} onAutoDraft={autoDraft} />

          <div className="tactical-options-row">
            <BluffTrapToggle active={plantTrap} used={s.myTrapUsed} onToggle={() => setPlantTrap(!plantTrap)} />
          </div>

          {text.trim().length > 0 && (
            <div className="bluff-preview-card" aria-label="Answer Board Preview">
              <div className="preview-card-header">
                <span className="preview-tag">👁️ Live Board Preview</span>
                <span className="preview-tip">
                  {text.trim().split(/\s+/).length} {text.trim().split(/\s+/).length === 1 ? 'word' : 'words'} • Looking believable!
                </span>
              </div>
              <div className="preview-card-body">
                <span className="preview-letter">?</span>
                <span className="preview-text">{text}</span>
                {plantTrap && <span className="preview-trap-tag">💣 Trapped</span>}
              </div>
            </div>
          )}

          <button id="btn-lie" className="btn primary wide" disabled={!text.trim() || sending}>
            {plantTrap ? '💣 Lock in Trapped Lie' : 'Lock it in'}
          </button>
          <p className="hint">
            Each person who picks it earns you {money(500 * s.multiplier)} points. Copying the real answer will not work, the
            game checks!
          </p>
        </form>
      ) : (
        <div className="card locked">
          <div className="locked-badge">
            <span>🔒 LOCKED IN FOR SHOWDOWN</span>
          </div>
          <p className="locked-text">{s.myLie}</p>
          <p className="locked-subtext">✨ Your bluff is in the mix! Stand by for voting.</p>
          <Waiting s={s} done={(p) => p.submitted} label="Waiting for" />
        </div>
      )}

      <ReactionToolbar onReact={(emoji) => act({ action: 'react', emoji }, true)} />

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
  const [doubleDown, setDoubleDown] = useState(s.myDoubleDown || false);
  const [radarUsed, setRadarUsed] = useState(s.myRadarUsed || false);
  const [useShield, setUseShield] = useState(s.myShieldActive || false);
  const [eliminatedId, setEliminatedId] = useState<string | null>(null);
  const chosen = s.myVote ?? pending;

  const pick = async (o: PublicOption) => {
    if (chosen || o.mine || o.id === eliminatedId) return;
    setPending(o.id);
    sound.vote();
    const r = await act({ action: 'vote', optionId: o.id, doubleDown, useShield });
    if (!r.ok) setPending(null);
  };

  const activateRadar = async () => {
    if (radarUsed || !s.options) return;
    setRadarUsed(true);
    act({ action: 'useRadar' }, true);
    // Find a false decoy to eliminate
    const decoys = s.options.filter((o) => !o.mine);
    if (decoys.length > 1) {
      const pickDecoy = decoys[Math.floor(Math.random() * decoys.length)];
      setEliminatedId(pickDecoy.id);
    }
  };

  const activateShield = async () => {
    if (s.myShieldUsed || useShield) return;
    setUseShield(true);
    act({ action: 'useShield' }, true);
  };

  return (
    <div className="play">
      <RoundStrip s={s} />
      <TimerBar secs={secs} total={s.phaseTotal} />
      <div className="prompt-header-row">
        <h2 className="prompt">
          <PromptText text={s.prompt ?? ''} />
        </h2>
        <PromptAudioButton text={s.prompt ?? ''} />
      </div>
      <p className="subprompt">One of these is authentic fact. Spot the truth!</p>

      {/* Lifeline Row: Double Down Wager, 50/50 Lie Radar & Truth Shield */}
      <div className="lifeline-row">
        <DoubleDownToggle
          active={s.myDoubleDown || doubleDown}
          onToggle={() => setDoubleDown(!doubleDown)}
          disabled={!!chosen}
        />
        <LieRadarLifeline used={radarUsed} onActivate={activateRadar} />
        <TruthShieldButton active={useShield} used={s.myShieldUsed} onActivate={activateShield} />
      </div>

      {doubleDown && (
        <div className="dd-fire-banner">
          🔥 DOUBLE DOWN WAGER ACTIVE: 2,000 PTS AT STAKE (Spot truth for 2x, but picking a bluff pays rival 2x)!
        </div>
      )}

      <ul className="options">
        {s.options?.map((o, i) => {
          const isEliminated = o.id === eliminatedId;
          return (
            <li key={o.id}>
              <button
                id={`opt-${i}`}
                className={`option${chosen === o.id ? ' chosen' : ''}${o.mine ? ' mine' : ''}${isEliminated ? ' eliminated' : ''}`}
                disabled={!!chosen || o.mine || isEliminated}
                onClick={() => pick(o)}
              >
                <span className="letter">{LETTERS[i]}</span>
                <span className={`option-text${isEliminated ? ' struck' : ''}`}>{o.text}</span>
                {o.mine && <span className="tag">Yours</span>}
                {isEliminated && <span className="tag tag-eliminated">❌ Radar Decoy</span>}
                {chosen === o.id && (
                  <span className={`tag ink${doubleDown ? ' dd-tag' : ''}`}>
                    {doubleDown ? '🔥 Double Down Vote' : '🔒 Locked In'}
                  </span>
                )}
                {useShield && chosen === o.id && (
                  <span className="tag tag-shielded">🛡️ Shield Active</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {chosen && <Waiting s={s} done={(p) => p.voted} label="Waiting for" />}

      <ReactionToolbar onReact={(emoji) => act({ action: 'react', emoji }, true)} />

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

  // Suspense reveal steps: 0 = Fakes unmasked, 1 = Real truth revealed, 2 = Leaderboard & Points
  const [stage, setStage] = useState<0 | 1 | 2>(0);
  const [instant, setInstant] = useState(false);

  useEffect(() => {
    if (stage === 1) {
      sound.chime();
      sound.applause();
    } else if (stage === 0) {
      sound.buzzer();
    } else if (stage === 2) {
      if (mine.gain > 0) {
        sound.cashRegister();
        sound.win();
        sound.pointShower();
      } else {
        if (s.gameMode === 'infinity' && (s.myLives ?? 3) < 3) {
          sound.heartCrack();
        }
        sound.lose();
      }
    }
  }, [stage, mine.gain, s.gameMode, s.myLives]);

  const advanceStage = () => {
    sound.whoosh();
    setStage((prev) => (prev < 2 ? ((prev + 1) as 0 | 1 | 2) : 2));
  };

  const showTruth = instant || stage >= 1;
  const showScores = instant || stage >= 2;

  const likeOption = (optId: string) => {
    sound.like();
    act({ action: 'like', optionId: optId });
  };

  return (
    <div className="play reveal">
      <RoundStrip s={s} />

      <div className="reveal-stage-header">
        <span className="stage-step-tag">
          {instant
            ? 'All Results'
            : stage === 0
              ? 'Stage 1 of 3: Unmasking the Lies'
              : stage === 1
                ? 'Stage 2 of 3: The Authentic Truth'
                : 'Stage 3 of 3: Standings & Awards'}
        </span>
        <button
          type="button"
          className="linkbtn instant-toggle"
          onClick={() => {
            sound.click();
            setInstant(!instant);
          }}
        >
          {instant ? '🎬 Suspense Mode' : '⚡ Instant View'}
        </button>
      </div>

      <h2 className="prompt">
        <PromptText text={s.prompt ?? ''} fill={showTruth ? s.truth : undefined} />
      </h2>

      <ul className="options">
        {s.options?.map((o, i) => {
          const truth = o.kind === 'truth';
          // In stage 0, hide whether it's truth unless instant or stage >= 1
          const revealedTruth = truth && showTruth;
          const isHouse = o.kind === 'house';
          const authorNames = (o.authors ?? []).map((a) => nameOf(s, a)).join(' and ');
          const likesCount = o.likes?.length || 0;

          return (
            <li key={o.id} className="rise" style={{ ['--i' as string]: i }}>
              <div
                className={`option shown${revealedTruth ? ' truth' : ''}${o.mine ? ' mine' : ''}${
                  !truth ? ' fake-unmasked' : ''
                }`}
              >
                <span className="letter">{LETTERS[i]}</span>
                <div className="option-body">
                  <div className="option-title-row">
                    <span className="option-text">{o.text}</span>
                    {revealedTruth && <span className="stamp-badge stamp-truth">✓ THE TRUTH</span>}
                    {!truth && showTruth && <span className="stamp-badge stamp-bluff">BLUFF</span>}
                    {o.trapped && showTruth && (o.voters?.length || 0) > 0 && (
                      <span className="stamp-badge stamp-trap-sprung">💥 TRAP SPRUNG (+{money(o.voters!.length * 500 * s.multiplier)})</span>
                    )}
                    {o.trapped && showTruth && (!o.voters || o.voters.length === 0) && (
                      <span className="stamp-badge stamp-trap">💣 TRAPPED BLUFF</span>
                    )}
                    {!truth && showTruth && (o.voters?.length || 0) > 0 && (
                      <span className="stamp-badge stamp-bamboozle">
                        🔥 Fooled {o.voters!.length} {o.voters!.length === 1 ? 'victim' : 'victims'} (+{money(o.voters!.length * 500 * s.multiplier)})
                      </span>
                    )}
                    {o.mine && !truth && showTruth && (o.voters?.length || 0) > 0 && (
                      <span className="stamp-badge stamp-my-bluff">⭐ Your Bluff Scored!</span>
                    )}
                  </div>
                  <span className="byline">
                    {revealedTruth
                      ? '⭐ The Real Truth!'
                      : !showTruth && truth
                        ? 'Answer choice'
                        : isHouse
                          ? '🎭 Made up by the House'
                          : `🎭 Written by ${authorNames}`}
                  </span>
                </div>

                {!truth && (
                  <button
                    type="button"
                    className={`like-btn${o.likedByMe ? ' liked' : ''}`}
                    title="Vote this lie as funny/clever!"
                    onClick={() => likeOption(o.id)}
                  >
                    👍 {likesCount > 0 ? likesCount : ''}
                  </button>
                )}

                <div className="voters">
                  {(o.voters ?? []).map((v) => {
                    const p = s.players.find((x) => x.id === v);
                    return p ? (
                      <span key={v} className="voter-badge">
                        <Chip p={p} size="sm" />
                        {p.doubleDown && <span className="dd-fire-tag" title="Doubled down!">🔥</span>}
                      </span>
                    ) : null;
                  })}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {showTruth && <p className="note">{s.note}</p>}

      {!instant && stage < 2 && (
        <button type="button" className="btn primary wide next-stage-btn" onClick={advanceStage}>
          {stage === 0 ? 'Reveal the Truth ⭐' : 'See Standings 🏆'}
        </button>
      )}

      {showScores && (
        <>
          <div className={`card yours ${mine.gain > 0 ? 'won' : ''}`}>
            <p className="label">You scored</p>
            <p className="big-gain">+{money(mine.gain)}</p>
            {s.gameMode === 'infinity' && (
              <div className="reveal-lives-row">
                <HeartMeter lives={s.myLives} />
              </div>
            )}
            {mine.doubleDown && <p className="dd-announcement">🔥 DOUBLE DOWN WAGER WAS ACTIVE!</p>}
            {mine.gainTruth > 0 && <p className="why">+{money(mine.gainTruth)} for spotting the truth</p>}
            {mine.gainFooled > 0 && <p className="why">+{money(mine.gainFooled)} for fooling other players</p>}
            {mine.gain === 0 && <p className="why">No points this time!</p>}
          </div>

          <section className="card">
            <h3>Standings</h3>
            <ol className="board">
              {ranked.map((p, i) => (
                <li key={p.id} className={p.id === me.id ? 'me' : ''}>
                  <span className="rank">{i + 1}</span>
                  <Chip p={p} size="sm" />
                  <span className="board-name">
                    {p.name} {p.isBot && ' 🎩'}
                    <PlayerTitleBadge title={p.title} />
                  </span>
                  <StreakBadge streak={p.streak} />
                  {p.gain > 0 && <span className="delta">+{money(p.gain)}</span>}
                  <span className="board-score">{money(p.score)}</span>
                </li>
              ))}
            </ol>
          </section>
        </>
      )}

      <ReactionToolbar onReact={(emoji) => act({ action: 'react', emoji }, true)} />

      {isHost ? (
        <button id="btn-next" className="btn primary wide" onClick={() => act({ action: 'next' })}>
          {last ? 'See the final result 🏆' : 'Next prompt ➡️'}
        </button>
      ) : (
        <p className="hint center">Waiting for {nameOf(s, s.hostId)}. It moves on by itself in {Math.ceil(secs)}s.</p>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- Final */

export function Final({ s, me, isHost, act }: Ctx) {
  const [copied, setCopied] = useState(false);
  const ranked = byScore(s.players);
  const top = ranked[0];
  const tie = ranked.length > 1 && ranked[1].score === top.score;

  const copyRecap = async () => {
    sound.click();
    const recap = [
      `🎮 Barefaced Game Recap! (Room ${s.code})`,
      `🏆 Winner: ${top.name} with ${money(top.score)} points!`,
      `📊 Final Standings:`,
      ...ranked.map((p, i) => `  ${i + 1}. ${p.name}: ${money(p.score)} pts`),
      ...(s.awards && s.awards.length > 0
        ? [`🎖️ Awards:`, ...s.awards.map((a) => `  • ${a.title}: ${nameOf(s, a.playerId)} (${a.detail})`)]
        : []),
    ].join('\n');

    try {
      await navigator.clipboard.writeText(recap);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt('Copy game recap', recap);
    }
  };

  return (
    <div className="final">
      <ConfettiCanvas active={true} />
      <section className="winner">
        <p className="eyebrow">{tie ? 'Dead heat!' : top.id === me.id ? '🎉 You Win!' : '🏆 Grand Champion'}</p>
        <div className="stamp">
          <Chip p={top} size="lg" />
          <h2>{tie ? ranked.filter((p) => p.score === top.score).map((p) => p.name).join(' & ') : top.name}</h2>
          {top.title && <div style={{ margin: '0.4rem 0' }}><PlayerTitleBadge title={top.title} /></div>}
          <p className="winner-score">{money(top.score)} points</p>
        </div>
      </section>

      {/* Olympic 3D Top-3 Podium */}
      <OlympicPodium players={ranked} />

      {/* Lie of the Night spotlight card */}
      <div className="highlight-card">
        <p className="highlight-title">🌟 Lie of the Night Award</p>
        <p className="highlight-body">
          {s.awards && s.awards.length > 0
            ? `${nameOf(s, s.awards[0].playerId)}: "${s.awards[0].detail}"`
            : `Master Deceiver: ${top.name} with ${money(top.score)} pts!`}
        </p>
      </div>

      {/* Hall of Deception: Top 3 Most Deceptive Player Bluffs */}
      <HallOfDeception topLies={s.topLies} />

      <section className="card">
        <div className="card-head">
          <h3>Final Standings</h3>
          <button type="button" className="btn small recap-btn" onClick={copyRecap}>
            {copied ? '✅ Recap Copied!' : '📋 Copy Recap'}
          </button>
        </div>
        <ol className="board">
          {ranked.map((p, i) => (
            <li key={p.id} className={p.id === me.id ? 'me' : ''}>
              <span className="rank">
                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`}
              </span>
              <Chip p={p} size="sm" />
              <span className="board-name">
                {p.name} {p.isBot && ' 🎩'}
                <PlayerTitleBadge title={p.title} />
              </span>
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
                <p className="award-name">
                  {p?.name} {p?.isBot && ' 🎩'}
                </p>
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
            <b>Join or Play Solo.</b> One person hosts and shares the 4-letter code, or plays solo against VIP House
            Guests. No accounts or downloads needed.
          </li>
          <li>
            <b>Write or Idea Spark.</b> A real fact appears with a blank. Type a fake answer that could pass for real, or
            use Idea Spark if stuck. You can't submit the actual answer!
          </li>
          <li>
            <b>Vote & Double Down.</b> Every answer is shuffled together with fakes from the house. If you are confident,
            activate <b>Double Down</b> for 2x points (or 2x payout to the liar)!
          </li>
          <li>
            <b>Score & Give Kudos.</b> Finding the truth earns 1,000 points. Each player who picks your lie earns you 500.
            Give a thumbs up to the funniest lies!
          </li>
          <li>
            <b>Three rounds, three prompts each.</b> Round 1 is x1, Round 2 is x2, Round 3 is x3 and only has 1 house decoy!
            Most points after nine prompts wins.
          </li>
        </ol>
        <p className="hint">The host can skip a timer at any time. If the host disappears, the game keeps moving by itself.</p>
        <button className="btn primary wide" onClick={onClose}>
          Got it!
        </button>
      </div>
    </div>
  );
}
