import { useEffect, useRef, useState } from 'react';
import type { DeckCategory, GameMode, GameModifiers, MatchLength, PublicPlayer, Reaction, TopLieRecord } from '../lib/types';
import { sound, speech } from './audio';

export const COLORS = ['#e4472b', '#f4b836', '#1d7a6b', '#4a63d8', '#9a55ad', '#7fae3d', '#ef82ab', '#ea8a2d'];

export const PARTY_AVATARS = ['🎩', '👑', '🕶️', '🤠', '🍕', '🦊', '⭐', '🎲', '💎', '🚀'];

export const RANDOM_PARTY_NAMES = [
  'Captain Bluff',
  'Lady Deception',
  'Sherlock Bones',
  'Sneaky Fox',
  'Baron Fibber',
  'Mastermind',
  'Bamboozler',
  'Agent 007',
  'The Illusionist',
  'Smooth Operator',
  'Duchess Sly',
  'Professor Fake',
  'Lucky Strike',
  'Clever Coyote',
  'Mystery Maven',
  'Grand Trickster',
];

export function randomPartyName(): string {
  return RANDOM_PARTY_NAMES[Math.floor(Math.random() * RANDOM_PARTY_NAMES.length)];
}

export const VIP_TRAITS: Record<string, string> = {
  'Uncle Leo': '🎩 The High Roller',
  'Grandma Ethel': '🧶 Crafty Storyteller',
  'Detective Knox': '🕵️ Truth Hunter',
  'Chef Marco': '🍕 Theatrical Liar',
  'Captain Jack': '⚓ Swashbuckler',
  'Chloe': '💅 Poker Face',
  'DJ Blaze': '🎧 Chaotic Decoy',
  'Baron Von Bluff': '🧐 Aristocrat',
  'Professor Plum': '📚 Trivia Scholar',
  'Auntie Bea': '🥧 Sweet Deceiver',
};

export function getVipTrait(name: string): string {
  for (const [key, trait] of Object.entries(VIP_TRAITS)) {
    if (name.includes(key)) return trait;
  }
  return 'VIP House Guest';
}

export function EmblemPicker({
  selected,
  onSelect,
}: {
  selected?: string;
  onSelect: (avatar: string) => void;
}) {
  return (
    <div className="emblem-picker" role="radiogroup" aria-label="Select Party Emblem">
      <div className="emblem-picker-header">
        <span className="emblem-picker-label">Choose your party hat:</span>
        <span className="emblem-picker-hint">Tap any emblem to equip</span>
      </div>
      <div className="emblem-grid">
        {PARTY_AVATARS.map((av) => (
          <button
            key={av}
            type="button"
            role="radio"
            aria-checked={selected === av}
            className={`emblem-choice${selected === av ? ' active' : ''}`}
            onClick={() => {
              sound.pop();
              onSelect(av);
            }}
            title={`Select ${av}`}
          >
            {av}
          </button>
        ))}
      </div>
    </div>
  );
}

export function BluffSparksRow({
  onPickSpark,
  onAutoDraft,
}: {
  onPickSpark: (text: string) => void;
  onAutoDraft: () => void;
}) {
  const sparks = [
    { label: '🍕 Everyday Object', hint: 'a wooden spoon' },
    { label: '🐾 Odd Animal', hint: 'a pygmy possum' },
    { label: '🎩 Retro Legend', hint: "the King's pocket watch" },
  ];
  return (
    <div className="sparks-row">
      <span className="sparks-label">💡 Inspiration Sparks:</span>
      <div className="sparks-btns">
        {sparks.map((s) => (
          <button
            key={s.label}
            type="button"
            className="spark-chip"
            onClick={() => {
              sound.pop();
              onPickSpark(s.hint);
            }}
          >
            {s.label}
          </button>
        ))}
        <button
          type="button"
          className="spark-chip spark-draft"
          onClick={() => {
            sound.sparkle();
            onAutoDraft();
          }}
        >
          ✨ Spark Draft
        </button>
      </div>
    </div>
  );
}

export function OlympicPodium({ players }: { players: PublicPlayer[] }) {
  if (players.length === 0) return null;
  const top1 = players[0];
  const top2 = players[1];
  const top3 = players[2];

  return (
    <div className="olympic-podium" aria-label="Winner Podium">
      {top2 && (
        <div className="podium-col silver">
          <div className="podium-player">
            <span className="podium-medal">🥈</span>
            <Chip p={top2} size="md" />
            <span className="podium-name">{top2.name}</span>
            <span className="podium-score">{money(top2.score)} pts</span>
          </div>
          <div className="podium-step step-2">
            <span className="step-num">2</span>
          </div>
        </div>
      )}

      {top1 && (
        <div className="podium-col gold">
          <div className="podium-player">
            <span className="podium-crown">👑</span>
            <Chip p={top1} size="lg" />
            <span className="podium-name">{top1.name}</span>
            <span className="podium-score">{money(top1.score)} pts</span>
          </div>
          <div className="podium-step step-1">
            <span className="step-num">1</span>
          </div>
        </div>
      )}

      {top3 && (
        <div className="podium-col bronze">
          <div className="podium-player">
            <span className="podium-medal">🥉</span>
            <Chip p={top3} size="md" />
            <span className="podium-name">{top3.name}</span>
            <span className="podium-score">{money(top3.score)} pts</span>
          </div>
          <div className="podium-step step-3">
            <span className="step-num">3</span>
          </div>
        </div>
      )}
    </div>
  );
}

export function Chip({
  p,
  size = 'md',
  muted = false,
  onClick,
}: {
  p: Pick<PublicPlayer, 'name' | 'color'> & { isBot?: boolean; avatar?: string };
  size?: 'sm' | 'md' | 'lg';
  muted?: boolean;
  onClick?: () => void;
}) {
  const icon = p.avatar || (p.isBot ? '🎩' : p.name.trim().charAt(0).toUpperCase());
  return (
    <span
      className={`chip chip-${size}${muted ? ' chip-muted' : ''}${p.isBot ? ' chip-guest' : ''}${onClick ? ' chip-clickable' : ''}`}
      style={{ background: COLORS[p.color % COLORS.length] }}
      title={onClick ? 'Click to change party emblem!' : p.isBot ? `${p.name} (VIP Guest)` : p.name}
      aria-label={p.name}
      onClick={onClick}
    >
      {icon}
    </span>
  );
}

export function PromptText({ text, fill }: { text: string; fill?: string }) {
  const [before, after = ''] = text.split('______');
  return (
    <>
      {before}
      <span className={`blank${fill ? ' filled' : ''}`}>{fill ?? '\u00a0'}</span>
      {after}
    </>
  );
}

export function TimerBar({ secs, total }: { secs: number; total: number }) {
  const pct = total > 0 ? Math.max(0, Math.min(100, (secs / total) * 100)) : 0;
  const urgent = secs <= 10;
  return (
    <div className={`timer${urgent ? ' urgent' : ''}`} role="timer" aria-label={`${Math.ceil(secs)} seconds left`}>
      <div className="timer-track">
        <div className="timer-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="timer-num">{Math.ceil(Math.max(0, secs))}</span>
    </div>
  );
}

export const money = (n: number) => n.toLocaleString('en-US');

export function StreakBadge({ streak }: { streak?: number }) {
  if (!streak || streak < 2) return null;
  return (
    <span className="streak-badge" title={`${streak} correct truths in a row!`}>
      🔥 {streak} Streak
    </span>
  );
}

export function HeartMeter({ lives = 3 }: { lives?: number }) {
  return (
    <div className="heart-meter" title={`${lives} hearts remaining`}>
      {[1, 2, 3].map((h) => (
        <span key={h} className={`heart-icon${h <= lives ? ' alive' : ' lost'}`}>
          {h <= lives ? '❤️' : '🖤'}
        </span>
      ))}
      <span className="heart-count">{lives} Lives</span>
    </div>
  );
}

export function GameModeSelector({
  currentMode = 'classic',
  isHost,
  onSelectMode,
}: {
  currentMode?: GameMode;
  isHost: boolean;
  onSelectMode: (mode: GameMode) => void;
}) {
  const modes: { id: GameMode; icon: string; title: string; desc: string; badge: string }[] = [
    {
      id: 'classic',
      icon: '🏆',
      title: 'Classic Barefaced',
      desc: '3 standard rounds • 9 prompts • escalating stakes (x1, x2, x3)',
      badge: 'Original Party',
    },
    {
      id: 'blitz',
      icon: '⚡',
      title: 'Turbo Blitz',
      desc: '4 fast prompts • 15s speed timers • instant 2x stakes on all answers',
      badge: 'Fast Sprint',
    },
    {
      id: 'infinity',
      icon: '♾️',
      title: 'Infinity Survival',
      desc: 'Endless gauntlet • 3 Hearts ❤️❤️❤️ • Survive as many rounds as possible!',
      badge: 'Endless Gauntlet',
    },
  ];

  return (
    <div className="game-mode-panel" aria-label="Game Modes">
      <div className="panel-header">
        <span className="panel-title">🎮 Game Mode</span>
        {!isHost && <span className="panel-host-note">Chosen by Host</span>}
      </div>
      <div className="mode-cards-grid">
        {modes.map((m) => (
          <button
            key={m.id}
            type="button"
            disabled={!isHost}
            className={`mode-card${currentMode === m.id ? ' active' : ''}`}
            onClick={() => {
              sound.pop();
              onSelectMode(m.id);
            }}
          >
            <div className="mode-card-top">
              <span className="mode-icon">{m.icon}</span>
              <span className="mode-badge">{m.badge}</span>
            </div>
            <strong className="mode-title">{m.title}</strong>
            <p className="mode-desc">{m.desc}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

export function PartyModifiersPanel({
  modifiers = {},
  isHost,
  onToggleModifier,
}: {
  modifiers?: GameModifiers;
  isHost: boolean;
  onToggleModifier: (key: keyof GameModifiers, val: boolean) => void;
}) {
  const items: { key: keyof GameModifiers; icon: string; label: string; hint: string }[] = [
    { key: 'chaos', icon: '🔥', label: 'Chaos Stakes', hint: '2x all round multipliers' },
    { key: 'speedDemon', icon: '⏱️', label: 'Speed Demon', hint: 'Halves writing & voting timers' },
    { key: 'doubleDecoy', icon: '🎯', label: 'Extra Decoys', hint: '3 trick house decoys per prompt' },
    { key: 'anonymity', icon: '🕵️', label: 'Anonymous Liars', hint: 'Authors hidden until podium' },
  ];

  return (
    <div className="modifiers-panel" aria-label="Party House Modifiers">
      <div className="panel-header">
        <span className="panel-title">⚡ Party Modifiers (Optional)</span>
        {!isHost && <span className="panel-host-note">Toggled by Host</span>}
      </div>
      <div className="modifiers-grid">
        {items.map((it) => {
          const active = Boolean(modifiers[it.key]);
          return (
            <button
              key={it.key}
              type="button"
              disabled={!isHost}
              className={`modifier-chip${active ? ' active' : ''}`}
              onClick={() => {
                sound.click();
                onToggleModifier(it.key, !active);
              }}
            >
              <span className="mod-icon">{it.icon}</span>
              <div className="mod-info">
                <b>{it.label}</b>
                <small>{it.hint}</small>
              </div>
              <span className="mod-toggle">{active ? 'ON' : 'OFF'}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const IDEA_HINTS = [
  'Think of a mundane Victorian household gadget',
  'Try an unlikely animal food pairing',
  'Something oddly specific from the 1800s',
  'An innocent schoolyard childhood pastime',
  'A very peculiar British or French tradition',
  'Something made out of wood or tin',
  'A bizarre medical belief from centuries ago',
  'A delightfully absurd everyday mistake',
];

export function IdeaSparkButton({
  onIdea,
  onAutoDraft,
}: {
  onIdea?: (idea: string) => void;
  onAutoDraft?: () => void;
}) {
  const [hint, setHint] = useState<string | null>(null);

  const roll = () => {
    sound.click();
    const pick = IDEA_HINTS[Math.floor(Math.random() * IDEA_HINTS.length)];
    setHint(pick);
    if (onIdea) onIdea(pick);
  };

  return (
    <div className="idea-box">
      <div className="idea-buttons">
        <button type="button" className="btn small idea-btn" onClick={roll}>
          💡 Need a spark?
        </button>
        {onAutoDraft && (
          <button
            type="button"
            className="btn small ai-draft-btn"
            title="Generate a clever bluff suggestion"
            onClick={() => {
              sound.pop();
              onAutoDraft();
            }}
          >
            🎲 Bluff Inspirometer
          </button>
        )}
      </div>
      {hint && <p className="idea-text">Tip: {hint}</p>}
    </div>
  );
}

export function DoubleDownToggle({
  active,
  onToggle,
  disabled,
}: {
  active: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={`double-down-btn${active ? ' active' : ''}`}
      disabled={disabled}
      onClick={() => {
        if (!disabled) {
          sound.wager();
          onToggle();
        }
      }}
    >
      <span className="dd-icon">{active ? '🔥' : '⚡'}</span>
      <span className="dd-text">
        <b>{active ? 'DOUBLE DOWN ACTIVE (x2)' : 'DOUBLE DOWN'}</b>
        <small>{active ? '2x points on truth / 2x to liar if wrong!' : 'High-roller wager (+100% win / risk)'}</small>
      </span>
    </button>
  );
}

const EMOJI_CATEGORIES: { name: string; icon: string; items: string[] }[] = [
  { name: 'Trending', icon: '🔥', items: ['🔥', '😂', '🤯', '💀', '🤥', '🎯', '👏', '🏆'] },
  { name: 'Savage', icon: '🤣', items: ['🤣', '🤡', '💩', '👀', '🍿', '🧂', '🤐', '💅'] },
  { name: 'Party', icon: '🎉', items: ['🎉', '🥳', '🍾', '💃', '✨', '⚡', '💣', '👑'] },
  { name: 'Hype', icon: '❤️', items: ['❤️', '💯', '🙌', '🚀', '🧠', '🤩', '😎', '💃'] },
];

export function ReactionToolbar({ onReact }: { onReact: (emoji: string) => void }) {
  const [activeTab, setActiveTab] = useState(0);
  const [combo, setCombo] = useState({ count: 0, emoji: '' });
  const comboTimer = useRef<number | undefined>(undefined);

  const handleEmojiClick = (e: string) => {
    sound.pop();
    onReact(e);

    setCombo((prev) => {
      const nextCount = prev.emoji === e ? prev.count + 1 : 1;
      if (nextCount > 1) sound.combo(nextCount);
      return { count: nextCount, emoji: e };
    });

    window.clearTimeout(comboTimer.current);
    comboTimer.current = window.setTimeout(() => setCombo({ count: 0, emoji: '' }), 1500);
  };

  return (
    <div className="reaction-container" aria-label="Quick reactions">
      <div className="reaction-tabs">
        {EMOJI_CATEGORIES.map((cat, idx) => (
          <button
            key={cat.name}
            type="button"
            className={`reaction-tab${activeTab === idx ? ' active' : ''}`}
            onClick={() => setActiveTab(idx)}
          >
            <span>{cat.icon}</span> {cat.name}
          </button>
        ))}
        {combo.count >= 2 && (
          <span className="combo-counter">
            {combo.emoji} x{combo.count} COMBO!
          </span>
        )}
      </div>

      <div className="reaction-bar">
        <div className="reaction-btns">
          {EMOJI_CATEGORIES[activeTab].items.map((e) => (
            <button
              key={e}
              type="button"
              className="react-btn"
              title={`React with ${e}`}
              onClick={() => handleEmojiClick(e)}
            >
              {e}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ReactionsOverlay({ reactions }: { reactions?: Reaction[] }) {
  const [active, setActive] = useState<{ id: string; emoji: string; name: string; x: number }[]>([]);
  const seen = useRef(new Set<string>());

  useEffect(() => {
    if (!reactions) return;
    const fresh = reactions.filter((r) => !seen.current.has(r.id));
    if (fresh.length === 0) return;

    fresh.forEach((r) => seen.current.add(r.id));
    const newItems = fresh.map((r) => ({
      id: r.id,
      emoji: r.emoji,
      name: r.playerName,
      x: 12 + Math.random() * 76,
    }));

    setActive((prev) => [...prev.slice(-12), ...newItems]);

    const timer = setTimeout(() => {
      setActive((prev) => prev.filter((item) => !newItems.some((n) => n.id === item.id)));
    }, 2800);

    return () => clearTimeout(timer);
  }, [reactions]);

  if (active.length === 0) return null;

  return (
    <div className="reactions-overlay" aria-hidden="true">
      {active.map((item) => (
        <div key={item.id} className="floating-react" style={{ left: `${item.x}%` }}>
          <span className="floating-emoji">{item.emoji}</span>
          <span className="floating-name">{item.name}</span>
        </div>
      ))}
    </div>
  );
}

export function ConfettiCanvas({ active }: { active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ['#e4472b', '#f4b836', '#1d7a6b', '#4a63d8', '#ff70a6'];
    const particles = Array.from({ length: 70 }, () => ({
      x: Math.random() * canvas.width,
      y: -20 - Math.random() * 80,
      size: 6 + Math.random() * 8,
      color: colors[Math.floor(Math.random() * colors.length)],
      vx: (Math.random() - 0.5) * 3,
      vy: 2.5 + Math.random() * 4,
      rot: Math.random() * 360,
      vrot: (Math.random() - 0.5) * 12,
    }));

    let animId: number;
    let frames = 0;

    const loop = () => {
      frames++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vrot;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rot * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
      });

      if (frames < 180) {
        animId = requestAnimationFrame(loop);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [active]);

  if (!active) return null;
  return <canvas ref={canvasRef} className="confetti-canvas" aria-hidden="true" />;
}

/* ---------------------------------------------------------------- Hostess AI: Roxy */

const HOSTESS_QUIPS: Record<string, string[]> = {
  LOBBY: [
    "Welcome darling! I'm Roxy, your studio hostess tonight! 🎙️✨ Invite your crew or play with our VIP guests!",
    "Need to warm up your bluffing muscle? Click '+ Invite VIP Guest' and we can start whenever you say the word!",
    "Remember: The best lie is something boring enough that nobody questions it! 💅",
  ],
  WRITE: [
    "Round in session! Fill in that blank with a lie so juicy they can't help but vote for it! ✍️",
    "Feeling stuck? Click 'Spark Lie Draft' and let me cook up something deceptive for you! 🧠✨",
    "Pro-tip from Roxy: Don't sound too smart—ordinary everyday things make the deadliest lies!",
  ],
  VOTE: [
    "Look at these options! One of them is 100% authentic real truth. Spot it and cash in! 🕵️‍♀️",
    "Feeling lucky? Hit that DOUBLE DOWN button for 2x points—unless a rival tricks you! 🔥",
    "Trust your gut... or is that just your rival smirking on the other side of the screen? 👀",
  ],
  REVEAL: [
    "The masks are off! Look at who fell for the bluff! Make sure you hit '👍 Like' on the funniest ones! 🎭",
    "Oh the drama! Someone cashed in big while someone else got totally bamboozled! 😂",
    "Check out those score deltas! The leaderboard is heating up!",
  ],
  FINAL: [
    "AND WE HAVE A CHAMPION! 🏆 Confetti time! Give it up for our master deceiver!",
    "Don't forget to hit '📋 Copy Recap' to show off your glorious victory in the group chat! 🎉",
  ],
};

export function PromptAudioButton({ text }: { text: string }) {
  const [speaking, setSpeaking] = useState(false);

  const handleSpeak = () => {
    sound.click();
    setSpeaking(true);
    speech.speak(text, true);
    setTimeout(() => setSpeaking(false), 3500);
  };

  return (
    <button
      type="button"
      className={`btn-narrate${speaking ? ' speaking' : ''}`}
      title="Listen to Studio Hostess read this question aloud"
      onClick={handleSpeak}
    >
      <span className="narrate-icon">{speaking ? '🔊' : '🗣️'}</span>
      <span className="narrate-label">{speaking ? 'Reading...' : 'Read Aloud'}</span>
    </button>
  );
}

export function LieRadarLifeline({
  used,
  onActivate,
}: {
  used?: boolean;
  onActivate: () => void;
}) {
  return (
    <button
      type="button"
      className={`radar-btn${used ? ' used' : ''}`}
      disabled={used}
      title={used ? '50/50 Lie Radar already used this game' : 'Eliminate 1 fake decoy choice!'}
      onClick={() => {
        sound.radar();
        onActivate();
      }}
    >
      <span className="radar-icon">🎯</span>
      <span className="radar-text">
        <b>50/50 Lie Radar</b>
        <small>{used ? 'Used This Match' : 'Eliminate 1 Fake Decoy'}</small>
      </span>
      {!used && <span className="radar-badge">1 LEFT</span>}
    </button>
  );
}

export function TruthShieldButton({
  active,
  used,
  onActivate,
}: {
  active?: boolean;
  used?: boolean;
  onActivate: () => void;
}) {
  return (
    <button
      type="button"
      className={`shield-btn${active ? ' active' : ''}${used && !active ? ' used' : ''}`}
      disabled={used || active}
      title={used ? 'Truth Shield already used this game' : 'Protect yourself against false votes!'}
      onClick={() => {
        sound.shield();
        onActivate();
      }}
    >
      <span className="shield-icon">🛡️</span>
      <span className="shield-text">
        <b>{active ? 'SHIELD ARMORED' : 'Truth Shield'}</b>
        <small>{active ? 'Immune to penalty' : used ? 'Used This Match' : 'Zero penalty on wrong vote'}</small>
      </span>
      {!used && !active && <span className="shield-badge">1 LEFT</span>}
    </button>
  );
}

export function BluffTrapToggle({
  active,
  used,
  onToggle,
}: {
  active?: boolean;
  used?: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className={`trap-btn${active ? ' active' : ''}${used && !active ? ' used' : ''}`}
      disabled={used && !active}
      title={used ? 'Bluff Trap already planted' : 'Plant a trap on your bluff to steal +500 bonus points!'}
      onClick={() => {
        sound.trap();
        onToggle();
      }}
    >
      <span className="trap-icon">💣</span>
      <span className="trap-text">
        <b>{active ? 'TRAP PLANTED' : 'Bluff Trap'}</b>
        <small>{active ? '+500 bonus per victim' : used ? 'Used This Match' : 'Bonus bounty on victims'}</small>
      </span>
    </button>
  );
}

export function DeckCategorySelector({
  category = 'all',
  isHost,
  onSelectCategory,
}: {
  category?: DeckCategory;
  isHost: boolean;
  onSelectCategory: (category: DeckCategory) => void;
}) {
  const categories: { id: DeckCategory; label: string; icon: string; desc: string }[] = [
    { id: 'all', label: 'All Mix', icon: '🌐', desc: 'Full variety blend' },
    { id: 'history', label: 'Epic History', icon: '📜', desc: 'Ancient lore & odd wars' },
    { id: 'pop', label: 'Pop & Food', icon: '🍿', desc: 'Inventions, brands & food' },
    { id: 'nature', label: 'Wild Nature', icon: '🦁', desc: 'Bizarre beasts & biology' },
    { id: 'science', label: 'Science & Space', icon: '🔬', desc: 'Cosmic & physics facts' },
  ];

  return (
    <div className="card deck-category-panel">
      <div className="card-head">
        <h3>Trivia Deck Category</h3>
        <span className="count">{isHost ? 'Host Selectable' : 'Selected by Host'}</span>
      </div>
      <div className="deck-category-grid" role="radiogroup" aria-label="Deck Category">
        {categories.map((c) => {
          const selected = category === c.id;
          return (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={!isHost}
              className={`deck-cat-btn${selected ? ' active' : ''}${!isHost ? ' readonly' : ''}`}
              onClick={() => {
                sound.pop();
                onSelectCategory(c.id);
              }}
            >
              <span className="deck-cat-icon">{c.icon}</span>
              <div className="deck-cat-info">
                <b>{c.label}</b>
                <small>{c.desc}</small>
              </div>
              {selected && <span className="cat-check">✓</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function HallOfDeception({ topLies }: { topLies?: TopLieRecord[] }) {
  if (!topLies || topLies.length === 0) return null;
  const bestLies = topLies.slice(0, 3);
  const medals = ['🥇 Deception Master', '🥈 Silver Bamboozle', '🥉 Crafty Illusion'];

  return (
    <section className="card hall-of-deception" aria-label="Hall of Deception">
      <div className="card-head">
        <h3>🏛️ Hall of Deception</h3>
        <span className="count">Match's Most Convincing Bluffs</span>
      </div>
      <div className="top-lies-list">
        {bestLies.map((item, idx) => (
          <div key={idx} className={`top-lie-card rank-${idx + 1}`}>
            <div className="top-lie-header">
              <span className="top-lie-medal">{medals[idx] || '🎖️ Great Bluff'}</span>
              <span className="top-lie-votes">
                🔥 Fooled <b>{item.votesCount}</b> {item.votesCount === 1 ? 'player' : 'players'}
              </span>
            </div>
            <p className="top-lie-quote">“{item.lieText}”</p>
            <p className="top-lie-prompt">for: <em>{item.promptText}</em></p>
            <div className="top-lie-author">
              <span className="author-tag">Liar: <b>{item.authorName}</b></span>
              <span className="bounty-tag">+{item.votesCount * 500} pts stolen</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}


export function EqualizerBars({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <span className="equalizer-bars" title="Roxy is speaking">
      <i />
      <i />
      <i />
      <i />
    </span>
  );
}

export function HostessBanner({
  phase,
  onOpenChat,
}: {
  phase: string;
  onOpenChat: () => void;
}) {
  const [quip, setQuip] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(speech.isSpeaking);

  useEffect(() => {
    return speech.subscribe(setIsSpeaking);
  }, []);

  useEffect(() => {
    const list = HOSTESS_QUIPS[phase] || HOSTESS_QUIPS.LOBBY;
    const chosen = list[Math.floor(Math.random() * list.length)];
    setQuip(chosen);
    sound.hostessVoice();
    speech.speak(chosen);
  }, [phase]);

  return (
    <div className="hostess-banner" role="region" aria-label="Hostess Commentary">
      <div
        className={`hostess-avatar${isSpeaking ? ' speaking-halo' : ''}`}
        onClick={onOpenChat}
        title="Click to chat with Roxy!"
      >
        <span className="hostess-emoji">💁‍♀️</span>
        <span className="mic-badge">🎙️</span>
      </div>
      <div className="hostess-content">
        <div className="hostess-meta">
          <div className="hostess-meta-left">
            <span className="hostess-name">Roxy • Studio Hostess</span>
            <EqualizerBars active={isSpeaking} />
            <span className="on-air-pill">🔴 ON AIR</span>
          </div>
          <div className="hostess-meta-right">
            <button type="button" className="hostess-chat-trigger" onClick={onOpenChat}>
              💬 Ask Roxy
            </button>
          </div>
        </div>
        <p className="hostess-quip">
          {quip}
        </p>
      </div>
    </div>
  );
}

export function HostessChatDrawer({
  isOpen,
  onClose,
  phase,
  onAutoDraft,
}: {
  isOpen: boolean;
  onClose: () => void;
  phase: string;
  onAutoDraft?: () => void;
}) {
  const [messages, setMessages] = useState<
    { sender: 'roxy' | 'user'; text: string; time: string }[]
  >([
    {
      sender: 'roxy',
      text: "Welcome backstage, darling! 🎙️ Need a winning bluff idea, advice on Double Down, or want me to roast the table? Fire away!",
      time: 'Just now',
    },
  ]);
  const [input, setInput] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(speech.isSpeaking);

  useEffect(() => {
    return speech.subscribe(setIsSpeaking);
  }, []);

  const sendQuery = (q: string) => {
    sound.click();
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setMessages((prev) => [...prev, { sender: 'user', text: q, time }]);

    setTimeout(() => {
      sound.hostessVoice();
      let reply = "You're playing like a seasoned pro! Keep your answers simple and believable!";
      const lower = q.toLowerCase();

      if (lower.includes('sweet') || lower.includes('nice') || lower.includes('compliment')) {
        reply = "You've got such a sharp mind and amazing style! I just know you're going to tell the most convincing lies and steal the show! Go get 'em, superstar! ✨💖";
      } else if (lower.includes('bluff') || lower.includes('lie') || lower.includes('idea')) {
        reply = "Here's my golden rule: pick a totally ordinary object like 'a wooden spoon' or 'mustard jar'. People always fall for mundane answers!";
        if (onAutoDraft) onAutoDraft();
      } else if (lower.includes('double') || lower.includes('wager')) {
        reply = "Double Down gives you double points if you spot the genuine truth, but if you pick a rival's bluff, you pay THEM double! Only use it when you're 90% sure!";
      } else if (lower.includes('roast')) {
        reply = "Whoever fell for the decoy earlier is probably checking their pockets wondering where their dignity went! 😂🔥";
      } else if (lower.includes('win') || lower.includes('tip')) {
        reply = "Watch the decoys! The house writes absurd options, but player lies often sound just plausible enough to steal all the votes!";
      }

      speech.speak(reply, true);
      setMessages((prev) => [
        ...prev,
        { sender: 'roxy', text: reply, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
      ]);
    }, 450);
  };

  if (!isOpen) return null;

  return (
    <div className="hostess-drawer-backdrop" onClick={onClose}>
      <div className="hostess-drawer" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Roxy Studio Hostess">
        <div className="hostess-drawer-head">
          <div className="hostess-drawer-title">
            <span className={`hostess-avatar-large${isSpeaking ? ' speaking-halo' : ''}`}>💁‍♀️🎙️</span>
            <div>
              <div className="drawer-title-row">
                <h3>Roxy</h3>
                <EqualizerBars active={isSpeaking} />
              </div>
              <span className="live-status">● Live Studio Hostess • {phase} Round</span>
            </div>
          </div>
          <div className="drawer-head-actions">
            <button type="button" className="btn small close-drawer-btn" onClick={onClose}>
              ✕
            </button>
          </div>
        </div>

        <div className="hostess-messages">
          {messages.map((m, i) => (
            <div key={i} className={`msg-bubble ${m.sender}`}>
              <span className="sender-tag">{m.sender === 'roxy' ? 'Roxy 🎙️' : 'You'}</span>
              <p>{m.text}</p>
              {m.sender === 'roxy' && (
                <button
                  type="button"
                  className="read-msg-btn"
                  title="Listen"
                  onClick={() => speech.speak(m.text, true)}
                >
                  🔊 Listen
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="quick-prompts">
          <button type="button" className="quick-p-btn" onClick={() => sendQuery("Give me a backstage secret!")}>
            🎭 Backstage secret
          </button>
          <button type="button" className="quick-p-btn" onClick={() => sendQuery("Give me a lie idea!")}>
            💡 Lie inspiration
          </button>
          <button type="button" className="quick-p-btn" onClick={() => sendQuery("Should I Double Down?")}>
            🔥 Double Down advice
          </button>
          <button type="button" className="quick-p-btn" onClick={() => sendQuery("Roast the scoreboard!")}>
            😂 Roast the room
          </button>
          <button type="button" className="quick-p-btn" onClick={() => sendQuery("Give me tips to win")}>
            🎯 How to win?
          </button>
        </div>

        <form
          className="hostess-input-row"
          onSubmit={(e) => {
            e.preventDefault();
            if (!input.trim()) return;
            sendQuery(input);
            setInput('');
          }}
        >
          <input
            className="input"
            value={input}
            placeholder="Ask Roxy for game tips..."
            onChange={(e) => setInput(e.target.value)}
          />
          <button type="submit" className="btn primary small">
            Send
          </button>
        </form>
      </div>
    </div>
  );
}

export function PlayerTitleBadge({ title }: { title?: string }) {
  if (!title) return null;
  return <span className="player-title-badge" title={title}>{title}</span>;
}

const MATCH_LENGTH_PRESETS: { id: MatchLength; name: string; rounds: number; desc: string; icon: string; badge: string }[] = [
  { id: 'quick', name: 'Quick Sprint', rounds: 1, desc: '1 Round • 3 Prompts • Perfect for a fast ~4 min party burst!', icon: '⚡', badge: 'Fast Party' },
  { id: 'standard', name: 'Standard Show', rounds: 3, desc: '3 Rounds • 9 Prompts • Full TV studio experience with escalating stakes!', icon: '🎯', badge: 'Classic' },
  { id: 'marathon', name: 'Marathon', rounds: 5, desc: '5 Rounds • 15 Prompts • Extended deception championship for trivia masters!', icon: '🏆', badge: 'Deep Game' },
];

export function MatchLengthSelector({
  length,
  isHost,
  onSelectLength,
}: {
  length?: MatchLength;
  isHost: boolean;
  onSelectLength: (l: MatchLength) => void;
}) {
  const current = length || 'standard';
  return (
    <section className="card match-length-panel">
      <div className="card-head">
        <div>
          <h3>Match Length</h3>
          <p className="hint">Set how many rounds you want to play before crowning the champion</p>
        </div>
        <span className="mode-badge">
          {MATCH_LENGTH_PRESETS.find((m) => m.id === current)?.icon}{' '}
          {MATCH_LENGTH_PRESETS.find((m) => m.id === current)?.name}
        </span>
      </div>
      <div className="match-length-grid">
        {MATCH_LENGTH_PRESETS.map((m) => {
          const active = m.id === current;
          return (
            <button
              key={m.id}
              type="button"
              className={`match-len-btn${active ? ' active' : ''}`}
              disabled={!isHost}
              onClick={() => {
                sound.click();
                onSelectLength(m.id);
              }}
            >
              <div className="match-len-top">
                <span className="match-len-icon">{m.icon}</span>
                <span className="match-len-title">{m.name}</span>
                <span className="match-len-badge">{m.badge}</span>
              </div>
              <p className="match-len-desc">{m.desc}</p>
            </button>
          );
        })}
      </div>
      {!isHost && <p className="hint center">Only the studio host can adjust the match length.</p>}
    </section>
  );
}

export function StudioSoundboardModal({
  isOpen,
  onClose,
  bgmOn,
  soundOn,
  voiceOn,
  onToggleBgm,
  onToggleSound,
  onToggleVoice,
}: {
  isOpen: boolean;
  onClose: () => void;
  bgmOn: boolean;
  soundOn: boolean;
  voiceOn: boolean;
  onToggleBgm: () => void;
  onToggleSound: () => void;
  onToggleVoice: () => void;
}) {
  if (!isOpen) return null;

  const triggerSfx = (fn: () => void) => {
    fn();
  };

  return (
    <div className="soundboard-modal-backdrop" onClick={onClose}>
      <div
        className="soundboard-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Studio Soundboard & Audio Console"
      >
        <div className="soundboard-head">
          <div className="soundboard-head-left">
            <span className="soundboard-icon">📻</span>
            <div>
              <h3>Studio Soundboard & Broadcast Audio</h3>
              <p className="soundboard-subtitle">Live sound effects console and master audio channels</p>
            </div>
          </div>
          <button type="button" className="btn small close-soundboard-btn" onClick={onClose} title="Close Soundboard">
            ✕
          </button>
        </div>

        <div className="soundboard-section">
          <h4>Master Broadcast Channels</h4>
          <div className="audio-channels-grid">
            <button
              type="button"
              className={`channel-card${bgmOn ? ' active' : ''}`}
              onClick={() => {
                sound.click();
                onToggleBgm();
              }}
            >
              <span className="channel-icon">🎵</span>
              <div className="channel-info">
                <span className="channel-name">Studio Lounge BGM</span>
                <span className="channel-status">{bgmOn ? '🟢 On Air' : '⚪ Muted'}</span>
              </div>
            </button>

            <button
              type="button"
              className={`channel-card${soundOn ? ' active' : ''}`}
              onClick={() => {
                sound.click();
                onToggleSound();
              }}
            >
              <span className="channel-icon">🔔</span>
              <div className="channel-info">
                <span className="channel-name">Game SFX</span>
                <span className="channel-status">{soundOn ? '🟢 On Air' : '⚪ Muted'}</span>
              </div>
            </button>

            <button
              type="button"
              className={`channel-card${voiceOn ? ' active' : ''}`}
              onClick={() => {
                sound.click();
                onToggleVoice();
              }}
            >
              <span className="channel-icon">🎙️</span>
              <div className="channel-info">
                <span className="channel-name">Roxy Hostess Voice</span>
                <span className="channel-status">{voiceOn ? '🟢 On Air' : '⚪ Muted'}</span>
              </div>
            </button>
          </div>
        </div>

        <div className="soundboard-section">
          <h4>Instant Soundboard FX Pads</h4>
          <p className="hint">Tap any button to trigger live studio reaction effects during the party!</p>
          <div className="sfx-buttons-grid">
            <button
              type="button"
              className="sfx-pad-btn sfx-airhorn"
              onClick={() => triggerSfx(() => sound.airhorn())}
            >
              <span className="pad-icon">🎺</span>
              <span className="pad-name">Airhorn</span>
              <span className="pad-tag">Hype</span>
            </button>

            <button
              type="button"
              className="sfx-pad-btn sfx-rimshot"
              onClick={() => triggerSfx(() => sound.rimshot())}
            >
              <span className="pad-icon">🥁</span>
              <span className="pad-name">Rimshot</span>
              <span className="pad-tag">Comedy</span>
            </button>

            <button
              type="button"
              className="sfx-pad-btn sfx-applause"
              onClick={() => triggerSfx(() => sound.applause())}
            >
              <span className="pad-icon">👏</span>
              <span className="pad-name">Applause</span>
              <span className="pad-tag">Crowd</span>
            </button>

            <button
              type="button"
              className="sfx-pad-btn sfx-cash"
              onClick={() => triggerSfx(() => sound.cashRegister())}
            >
              <span className="pad-icon">💰</span>
              <span className="pad-name">Ka-Ching</span>
              <span className="pad-tag">Jackpot</span>
            </button>

            <button
              type="button"
              className="sfx-pad-btn sfx-crickets"
              onClick={() => triggerSfx(() => sound.crickets())}
            >
              <span className="pad-icon">🦗</span>
              <span className="pad-name">Crickets</span>
              <span className="pad-tag">Awkward</span>
            </button>

            <button
              type="button"
              className="sfx-pad-btn sfx-drama"
              onClick={() => triggerSfx(() => sound.dramaSting())}
            >
              <span className="pad-icon">😱</span>
              <span className="pad-name">Drama Sting</span>
              <span className="pad-tag">Suspense</span>
            </button>

            <button
              type="button"
              className="sfx-pad-btn sfx-drumroll"
              onClick={() => triggerSfx(() => sound.drumroll())}
            >
              <span className="pad-icon">🥁</span>
              <span className="pad-name">Drumroll</span>
              <span className="pad-tag">Anticipation</span>
            </button>

            <button
              type="button"
              className="sfx-pad-btn sfx-cheer"
              onClick={() => triggerSfx(() => sound.cheer())}
            >
              <span className="pad-icon">🎉</span>
              <span className="pad-name">Cheer</span>
              <span className="pad-tag">Celebration</span>
            </button>

            <button
              type="button"
              className="sfx-pad-btn sfx-fanfare"
              onClick={() => triggerSfx(() => sound.fanfare())}
            >
              <span className="pad-icon">🏆</span>
              <span className="pad-name">Fanfare</span>
              <span className="pad-tag">Victory</span>
            </button>

            <button
              type="button"
              className="sfx-pad-btn sfx-sparkle"
              onClick={() => triggerSfx(() => sound.sparkle())}
            >
              <span className="pad-icon">✨</span>
              <span className="pad-name">Sparkle</span>
              <span className="pad-tag">Magic</span>
            </button>

            <button
              type="button"
              className="sfx-pad-btn sfx-points"
              onClick={() => triggerSfx(() => sound.pointShower())}
            >
              <span className="pad-icon">💎</span>
              <span className="pad-name">Point Shower</span>
              <span className="pad-tag">Bonus</span>
            </button>

            <button
              type="button"
              className="sfx-pad-btn sfx-roxy"
              onClick={() => {
                sound.sparkle();
                speech.speak("That bluff was so brilliant, even the studio judges were fooled!", true);
              }}
            >
              <span className="pad-icon">🎙️</span>
              <span className="pad-name">Roxy Praise</span>
              <span className="pad-tag">Voice</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

