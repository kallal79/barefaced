import { PROMPT_POOL } from './prompts';
import { createRoom, readRoom, updateRoom, GameError } from './store';
import type { ApiResult, Award, ClientState, DeckCategory, GameMode, GameModifiers, MatchLength, Option, Payload, Player, Prompt, PublicOption, Room } from './types';

/* ------------------------------------------------------------------ *
 *  Rules (kept in one place so the UI, the tests and the README agree)
 * ------------------------------------------------------------------ */
export const RULES = {
  rounds: 3,
  perRound: 3,
  minPlayers: 2,
  maxPlayers: 8,
  writeSecs: { 1: 50, 2: 45, 3: 40 } as Record<number, number>,
  voteSecs: 25,
  revealSecs: 60,
  multiplier: { 1: 1, 2: 2, 3: 3 } as Record<number, number>,
  truthPoints: 1000,
  foolPoints: 500,
  maxLieLength: 40,
  maxNameLength: 18,
};

/* ------------------------------ helpers ---------------------------- */

const ARTICLES = new Set(['a', 'an', 'the']);

/** Normal form used to compare answers: ignores case, punctuation, articles and plurals. */
export function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['\u2019]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !ARTICLES.has(w))
    .map((w) => (w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w))
    .join(' ');
}

function distance(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let last = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, last + (a[i - 1] === b[j - 1] ? 0 : 1));
      last = tmp;
    }
  }
  return prev[b.length];
}

/** True when a player's lie is basically the real answer. */
export function tooCloseToTruth(lie: string, truth: string, accept: string[] = []): boolean {
  const k = norm(lie);
  return [truth, ...accept].some((t) => {
    const tk = norm(t);
    if (k === tk) return true;
    return k.length >= 5 && tk.length >= 5 && distance(k, tk) <= 1;
  });
}

function shuffle<T>(list: T[]): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const cleanText = (s: unknown, max: number) =>
  String(s ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);

const CODE_LETTERS = 'BCDFGHJKLMNPQRSTVWXZ'; // no vowels, so codes never spell anything rude
function makeCode(): string {
  let c = '';
  for (let i = 0; i < 4; i++) c += CODE_LETTERS[Math.floor(Math.random() * CODE_LETTERS.length)];
  return c;
}

const makeId = () => 'p' + Math.random().toString(36).slice(2, 10);

function newPlayer(name: string, takenColors: number[]): Player {
  let color = 0;
  while (takenColors.includes(color)) color++;
  return {
    id: makeId(),
    name,
    color,
    score: 0,
    lie: null,
    vote: null,
    truthsFound: 0,
    fooled: 0,
    houseVotes: 0,
    gain: 0,
    gainTruth: 0,
    gainFooled: 0,
    doubleDown: false,
    streak: 0,
    likesReceived: 0,
    doubleDownHits: 0,
    radarUsed: false,
  };
}

const BOT_FALLBACK_LIES = [
  'rubber duck', 'tin foil', 'potato clock', 'bamboo spoon', 'disco ball',
  'hamster wheel', 'yo-yo', 'banana peel', 'feather duster', 'plastic kazoo',
  'cuckoo clock', 'trampoline', 'paper airplane', 'cheese grater', 'bubble blower',
  'wooden peg', 'brass trumpet', 'pancake mix', 'traffic cone', 'snow globe'
];

function makeBotLie(prompt: Prompt, existingLies: string[]): string {
  const normExisting = new Set(existingLies.map((s) => norm(s)));
  if (prompt.decoys && prompt.decoys.length > 2) {
    for (const d of prompt.decoys.slice(2)) {
      if (!normExisting.has(norm(d)) && !tooCloseToTruth(d, prompt.truth, prompt.accept)) {
        return d;
      }
    }
  }
  const shuffled = shuffle(BOT_FALLBACK_LIES);
  for (const f of shuffled) {
    if (!normExisting.has(norm(f)) && !tooCloseToTruth(f, prompt.truth, prompt.accept)) {
      return f;
    }
  }
  return 'mystery gadget';
}

export function inferPromptCategory(p: Prompt): DeckCategory {
  if (p.category) return p.category;
  const t = (p.text + ' ' + p.truth + ' ' + p.note).toLowerCase();
  if (/animal|bird|cat|dog|tortoise|emu|flamingo|fish|shark|octopus|creature|species|insect|bee|bear|whale|spider/.test(t)) {
    return 'nature';
  }
  if (/nasa|space|planet|star|atom|element|science|chemist|physics|biology|doctor|brain|blood|cell|dna|laser|radar/.test(t)) {
    return 'science';
  }
  if (/ancient|century|king|queen|emperor|war|army|soldier|19\d\d|18\d\d|17\d\d|aztec|roman|history|oxford|president/.test(t)) {
    return 'history';
  }
  return 'pop';
}

export function computePlayerTitle(p: Player, totalPrompts: number): string {
  if (p.isBot) return '';
  if (p.fooled >= 4) return '🎭 Master Bamboozler';
  if (p.truthsFound >= 4) return '🔍 Eagle-Eye Detective';
  if ((p.doubleDownHits || 0) >= 2) return '🔥 High Roller';
  if ((p.streak || 0) >= 3) return '⚡ On Fire';
  if (p.fooled >= 2) return '🎩 Crafty Fibber';
  if (p.truthsFound >= 2) return '🕵️ Truth Seeker';
  if (p.houseVotes >= 2) return '🎣 Decoy Magnet';
  return '⭐ Studio Contestant';
}

function pickPrompts(gameMode?: GameMode, deckCategory?: DeckCategory, matchLength: MatchLength = 'standard') {
  let pool = PROMPT_POOL;
  if (deckCategory && deckCategory !== 'all') {
    const filtered = PROMPT_POOL.filter((p) => inferPromptCategory(p) === deckCategory);
    if (filtered.length >= 4) {
      pool = filtered;
    }
  }

  if (gameMode === 'blitz') {
    return shuffle(pool).slice(0, 4);
  }
  if (gameMode === 'infinity') {
    return shuffle(pool).slice(0, 24);
  }
  const rounds = matchLength === 'quick' ? 1 : matchLength === 'marathon' ? 5 : RULES.rounds;
  const chosen = [];
  for (let r = 1; r <= rounds; r++) {
    const roundIdx = ((r - 1) % RULES.rounds) + 1;
    const roundPool = pool.filter((p) => p.round === roundIdx);
    const available = roundPool.length >= RULES.perRound ? roundPool : pool;
    chosen.push(...shuffle(available).slice(0, RULES.perRound));
  }
  return chosen;
}

/* --------------------------- state machine ------------------------- */

const everyone = (room: Room) => room.order.map((id) => room.players[id]);

function beginPrompt(room: Room, now: number) {
  for (const p of everyone(room)) {
    p.lie = null;
    p.vote = null;
    p.doubleDown = false;
    p.shieldActive = false;
    p.gain = p.gainTruth = p.gainFooled = 0;
  }
  room.options = [];
  room.phase = 'WRITE';
  const round = room.prompts[room.promptIndex].round || 1;
  const isFast = Boolean(room.modifiers?.speedDemon || room.gameMode === 'blitz');
  const writeSecs = isFast ? Math.floor(RULES.writeSecs[round] * 0.6) : RULES.writeSecs[round];
  room.deadline = now + writeSecs * 1000;

  const prompt = room.prompts[room.promptIndex];
  for (const p of everyone(room)) {
    if (p.isBot) {
      p.lie = makeBotLie(prompt, everyone(room).map((x) => x.lie).filter(Boolean) as string[]);
    }
  }
}

function beginVote(room: Room, now: number) {
  const prompt = room.prompts[room.promptIndex];
  const byKey = new Map<string, Option>();
  const options: Option[] = [];
  const add = (text: string, kind: Option['kind'], author?: string, trapped?: boolean) => {
    const key = norm(text);
    const existing = byKey.get(key);
    if (existing) {
      // two people wrote the same lie: it is one option and both get paid
      if (author && existing.kind === 'lie' && !existing.authors.includes(author)) existing.authors.push(author);
      if (trapped) existing.trapped = true;
      return;
    }
    const opt: Option = { id: '', text, kind, authors: author ? [author] : [], voters: [], likes: [], trapped };
    byKey.set(key, opt);
    options.push(opt);
  };

  add(prompt.truth, 'truth');
  for (const p of everyone(room)) {
    if (p.lie) add(p.lie, 'lie', p.id, p.trapActive);
  }
  const decoys = room.modifiers?.doubleDecoy ? 3 : prompt.round === 3 ? 1 : 2;
  for (const d of prompt.decoys.slice(0, decoys)) add(d, 'house');

  room.options = shuffle(options).map((o, i) => ({ ...o, id: 'o' + i }));
  room.phase = 'VOTE';
  const isFast = Boolean(room.modifiers?.speedDemon || room.gameMode === 'blitz');
  const voteSecs = isFast ? Math.floor(RULES.voteSecs * 0.6) : RULES.voteSecs;
  room.deadline = now + voteSecs * 1000;

  // Make bots vote with autonomous personalities
  for (const p of everyone(room)) {
    if (p.isBot) {
      const candidates = room.options.filter((o) => !o.authors.includes(p.id));
      if (candidates.length > 0) {
        const humanLies = candidates.filter((o) => o.kind === 'lie' && o.authors.some((a) => !room.players[a]?.isBot));
        const truthOpt = candidates.find((o) => o.kind === 'truth');
        const roll = Math.random();
        if (roll < 0.45 && humanLies.length > 0) {
          p.vote = humanLies[Math.floor(Math.random() * humanLies.length)].id;
        } else if (roll < 0.75 && truthOpt) {
          p.vote = truthOpt.id;
        } else {
          p.vote = candidates[Math.floor(Math.random() * candidates.length)].id;
        }
        // High-stakes bluffing: bots double down occasionally in rounds 2 and 3
        if (prompt.round >= 2 && Math.random() < 0.3) {
          p.doubleDown = true;
        }
      }
    }
  }
}

function beginReveal(room: Room, now: number) {
  const prompt = room.prompts[room.promptIndex];
  const mult = room.modifiers?.chaos
    ? (RULES.multiplier[prompt.round] || 1) * 2
    : (RULES.multiplier[prompt.round] || 1);

  for (const voter of everyone(room)) {
    const opt = room.options.find((o) => o.id === voter.vote);
    if (!opt) continue;
    opt.voters.push(voter.id);
    const wager = voter.doubleDown ? 2 : 1;

    if (opt.kind === 'truth') {
      voter.gainTruth = RULES.truthPoints * mult * wager;
      voter.truthsFound += 1;
      voter.streak = (voter.streak || 0) + 1;
      if (voter.doubleDown) voter.doubleDownHits = (voter.doubleDownHits || 0) + 1;
    } else {
      if (!voter.shieldActive) {
        voter.streak = 0;
      }
      if (room.gameMode === 'infinity' && !voter.shieldActive) {
        voter.lives = Math.max(0, (voter.lives ?? 3) - 1);
      }
      if (opt.kind === 'lie') {
        for (const a of opt.authors) {
          const author = room.players[a];
          if (!author) continue;
          author.gainFooled += RULES.foolPoints * mult * wager;
          if (opt.trapped || author.trapActive) {
            author.gainFooled += 500 * mult; // Bonus trap reward!
          }
          author.fooled += 1;
        }
      } else {
        voter.houseVotes += 1;
      }
    }
  }

  for (const p of everyone(room)) {
    p.gain = p.gainTruth + p.gainFooled;
    p.score += p.gain;
  }

  // Record deceptive bluffs for Hall of Deception
  if (!room.topLies) room.topLies = [];
  for (const opt of room.options) {
    if (opt.kind === 'lie' && opt.voters.length > 0) {
      for (const a of opt.authors) {
        const author = room.players[a];
        if (author) {
          room.topLies.push({
            promptText: prompt.text,
            lieText: opt.text,
            authorId: author.id,
            authorName: author.name,
            votesCount: opt.voters.length,
          });
        }
      }
    }
  }
  room.topLies.sort((a, b) => b.votesCount - a.votesCount);
  if (room.topLies.length > 10) room.topLies = room.topLies.slice(0, 10);

  // Autonomous bot emoji reactions on reveal outcome
  for (const p of everyone(room)) {
    if (p.isBot) {
      if (p.gainFooled > 0) {
        if (!room.reactions) room.reactions = [];
        room.reactions.push({
          id: makeId(),
          playerId: p.id,
          playerName: p.name,
          emoji: '😂',
          createdAt: now,
        });
      } else if (p.gainTruth === 0 && p.vote && p.vote !== 'truth' && Math.random() < 0.5) {
        if (!room.reactions) room.reactions = [];
        room.reactions.push({
          id: makeId(),
          playerId: p.id,
          playerName: p.name,
          emoji: '🤯',
          createdAt: now,
        });
      }
    }
  }

  room.phase = 'REVEAL';
  room.deadline = now + RULES.revealSecs * 1000;
}

function nextPrompt(room: Room, now: number) {
  room.promptIndex += 1;
  if (room.promptIndex >= room.prompts.length) {
    room.phase = 'FINAL';
    room.deadline = 0;
    return;
  }
  beginPrompt(room, now);
}

/** Move the room forward if a timer ran out or everybody has acted. Returns true if it changed. */
export function advance(room: Room, now: number): boolean {
  const players = everyone(room);
  switch (room.phase) {
    case 'WRITE':
      if (now >= room.deadline || players.every((p) => p.lie !== null)) {
        beginVote(room, now);
        return true;
      }
      return false;
    case 'VOTE':
      if (now >= room.deadline || players.every((p) => p.vote !== null)) {
        beginReveal(room, now);
        return true;
      }
      return false;
    case 'REVEAL':
      if (now >= room.deadline) {
        nextPrompt(room, now);
        return true;
      }
      return false;
    default:
      return false;
  }
}

/* ------------------------------- views ----------------------------- */

function awardsFor(room: Room): Award[] {
  const list = everyone(room);
  const best = (pick: (p: Player) => number) =>
    list.reduce<Player | null>((top, p) => (pick(p) > (top ? pick(top) : 0) ? p : top), null);

  const awards: Award[] = [];
  const liar = best((p) => p.fooled);
  if (liar) awards.push({ title: 'Best liar', playerId: liar.id, detail: `${liar.fooled} people fell for their lies` });
  const hunter = best((p) => p.truthsFound);
  if (hunter)
    awards.push({
      title: 'Lie detector',
      playerId: hunter.id,
      detail: `Found the truth ${hunter.truthsFound} of ${room.prompts.length} times`,
    });
  const mark = best((p) => p.houseVotes);
  if (mark)
    awards.push({ title: 'Easiest mark', playerId: mark.id, detail: `Fell for the house's fakes ${mark.houseVotes} times` });
  const pleaser = best((p) => p.likesReceived || 0);
  if (pleaser && pleaser.likesReceived > 0)
    awards.push({ title: 'Crowd pleaser', playerId: pleaser.id, detail: `${pleaser.likesReceived} players voted their lies the funniest` });
  const roller = best((p) => p.doubleDownHits || 0);
  if (roller && roller.doubleDownHits > 0)
    awards.push({ title: 'High roller', playerId: roller.id, detail: `Won ${roller.doubleDownHits} high-stakes Double Down bets` });
  return awards;
}

export function view(room: Room, playerId: string, now: number): ClientState {
  const prompt = room.prompts[room.promptIndex];
  const revealed = room.phase === 'REVEAL' || room.phase === 'FINAL';
  const me = room.players[playerId];

  const state: ClientState = {
    code: room.code,
    phase: room.phase,
    hostId: room.hostId,
    version: room.version,
    serverTime: now,
    deadline: room.deadline,
    phaseTotal:
      room.phase === 'WRITE' && prompt
        ? RULES.writeSecs[prompt.round]
        : room.phase === 'VOTE'
          ? RULES.voteSecs
          : room.phase === 'REVEAL'
            ? RULES.revealSecs
            : 0,
    round: prompt ? prompt.round : 1,
    rounds: room.matchLength === 'quick' ? 1 : room.matchLength === 'marathon' ? 5 : RULES.rounds,
    promptNumber: prompt ? (room.promptIndex % RULES.perRound) + 1 : 1,
    promptsPerRound: RULES.perRound,
    multiplier: prompt
      ? (room.modifiers?.chaos ? (RULES.multiplier[prompt.round] || 1) * 2 : RULES.multiplier[prompt.round] || 1)
      : 1,
    players: everyone(room).map((p) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      score: p.score,
      isHost: p.id === room.hostId,
      isBot: p.isBot,
      submitted: p.lie !== null,
      voted: p.vote !== null,
      gain: p.gain,
      gainTruth: p.gainTruth,
      gainFooled: p.gainFooled,
      doubleDown: p.doubleDown,
      streak: p.streak,
      likesReceived: p.likesReceived,
      radarUsed: p.radarUsed,
      avatar: p.avatar,
      lives: p.lives ?? 3,
      shieldUsed: p.shieldUsed,
      trapUsed: p.trapUsed,
      title: computePlayerTitle(p, room.prompts.length),
    })),
    reactions: (room.reactions ?? []).filter((r) => now - r.createdAt < 12000),
    gameMode: room.gameMode || 'classic',
    matchLength: room.matchLength || 'standard',
    modifiers: room.modifiers || {},
    deckCategory: room.deckCategory || 'all',
    topLies: room.topLies || [],
    myLives: me?.lives ?? 3,
    myShieldUsed: me?.shieldUsed,
    myShieldActive: me?.shieldActive,
    myTrapUsed: me?.trapUsed,
    myTrapActive: me?.trapActive,
    infinityLevel: room.promptIndex + 1,
  };

  if (room.phase === 'WRITE' || room.phase === 'VOTE' || room.phase === 'REVEAL') {
    state.prompt = prompt.text;
    state.myLie = me?.lie ?? null;
    state.myVote = me?.vote ?? null;
    state.myDoubleDown = me?.doubleDown;
    state.myRadarUsed = me?.radarUsed;
    state.streak = me?.streak;
  }

  if (room.phase === 'VOTE' || room.phase === 'REVEAL') {
    state.options = room.options.map<PublicOption>((o) => {
      const base: PublicOption = {
        id: o.id,
        text: o.text,
        mine: o.authors.includes(playerId),
        likes: o.likes ?? [],
        likedByMe: (o.likes ?? []).includes(playerId),
      };
      // the answer key only leaves the server once voting is over
      if (revealed) {
        base.kind = o.kind;
        base.authors = room.modifiers?.anonymity ? ['🎭 Anonymous Liar'] : o.authors;
        base.voters = o.voters;
        base.trapped = o.trapped;
      }
      return base;
    });
  }

  if (room.phase === 'REVEAL') {
    state.truth = prompt.truth;
    state.note = prompt.note;
  }
  if (room.phase === 'FINAL') state.awards = awardsFor(room);

  return state;
}

/* ------------------------------ actions ---------------------------- */

const need = <T>(v: T | undefined | null, msg: string): T => {
  if (v === undefined || v === null || v === ('' as unknown)) throw new GameError(msg);
  return v;
};

function requireHost(room: Room, playerId: string) {
  if (playerId !== room.hostId) throw new GameError('Only the host can do that.', 403);
}

function requirePlayer(room: Room, playerId: string | undefined): Player {
  const p = playerId ? room.players[playerId] : undefined;
  if (!p) throw new GameError('You are not part of this room.', 403);
  return p;
}

function validName(raw: unknown): string {
  const name = cleanText(raw, RULES.maxNameLength);
  if (!name) throw new GameError('Pick a name first.');
  return name;
}

async function run(payload: Payload): Promise<ApiResult> {
  const now = Date.now();
  const { action } = payload;

  if (action === 'create') {
    const name = validName(payload.name);
    const host = newPlayer(name, []);
    for (let i = 0; i < 20; i++) {
      const room: Room = {
        code: makeCode(),
        hostId: host.id,
        phase: 'LOBBY',
        promptIndex: 0,
        prompts: [],
        players: { [host.id]: host },
        order: [host.id],
        options: [],
        deadline: 0,
        version: 1,
        createdAt: now,
        updatedAt: now,
      };
      if (await createRoom(room)) return { ok: true, playerId: host.id, state: view(room, host.id, now) };
    }
    throw new GameError('Could not make a room. Try again.', 503);
  }

  const code = need(payload.code, 'Enter the 4-letter room code.');
  const pid = payload.playerId ?? '';

  if (action === 'join') {
    const name = validName(payload.name);
    if (!(await readRoom(code))) throw new GameError(`No room with code ${String(code).toUpperCase()}. Check the letters and try again.`, 404);
    const { room, result } = await updateRoom(code, (room) => {
      if (pid && room.players[pid]) return { result: pid, write: false }; // rejoining
      if (room.phase !== 'LOBBY') throw new GameError('That game has already started. Wait for the next one.');
      if (room.order.length >= RULES.maxPlayers) throw new GameError(`This room is full (${RULES.maxPlayers} players).`);
      if (everyone(room).some((p) => p.name.toLowerCase() === name.toLowerCase()))
        throw new GameError('Someone in this room already has that name. Pick another.');
      const p = newPlayer(name, everyone(room).map((x) => x.color));
      room.players[p.id] = p;
      room.order.push(p.id);
      return { result: p.id, write: true };
    });
    return { ok: true, playerId: result, state: view(room, result, now) };
  }

  const { room, result } = await updateRoom(code, (room) => {
    const me = requirePlayer(room, pid);
    let changed = advance(room, now); // always catch up on timers first

    switch (action) {
      case 'state':
        return { result: null, write: changed };

      case 'start': {
        requireHost(room, pid);
        if (room.phase !== 'LOBBY') throw new GameError('The game has already started.');
        if (room.order.length < RULES.minPlayers) throw new GameError(`You need at least ${RULES.minPlayers} players.`);
        room.prompts = pickPrompts(room.gameMode, room.deckCategory, room.matchLength);
        room.promptIndex = 0;
        room.topLies = [];
        for (const p of everyone(room)) {
          p.score = 0;
          p.truthsFound = p.fooled = p.houseVotes = 0;
          p.lives = 3;
          p.shieldUsed = false;
          p.shieldActive = false;
          p.trapUsed = false;
          p.trapActive = false;
        }
        beginPrompt(room, now);
        return { result: null, write: true };
      }

      case 'setGameMode': {
        requireHost(room, pid);
        if (room.phase !== 'LOBBY') throw new GameError('Game mode can only be changed in the lobby.');
        const mode = payload.gameMode;
        if (mode === 'classic' || mode === 'blitz' || mode === 'infinity') {
          room.gameMode = mode;
        }
        return { result: null, write: true };
      }

      case 'setMatchLength': {
        requireHost(room, pid);
        if (room.phase !== 'LOBBY') throw new GameError('Match length can only be changed in the lobby.');
        const ml = payload.matchLength;
        if (ml === 'quick' || ml === 'standard' || ml === 'marathon') {
          room.matchLength = ml;
        }
        return { result: null, write: true };
      }

      case 'setCategory': {
        requireHost(room, pid);
        if (room.phase !== 'LOBBY') throw new GameError('Deck category can only be changed in the lobby.');
        const cat = payload.deckCategory;
        if (cat === 'all' || cat === 'history' || cat === 'pop' || cat === 'nature' || cat === 'science') {
          room.deckCategory = cat;
        }
        return { result: null, write: true };
      }

      case 'setModifier': {
        requireHost(room, pid);
        if (room.phase !== 'LOBBY') throw new GameError('Modifiers can only be changed in the lobby.');
        if (!room.modifiers) room.modifiers = {};
        if (payload.modifierKey) {
          room.modifiers[payload.modifierKey] = Boolean(payload.modifierVal);
        }
        return { result: null, write: true };
      }

      case 'lie': {
        if (room.phase !== 'WRITE') throw new GameError('Time is up for this one.');
        if (me.lie !== null) throw new GameError('Your lie is already locked in.');
        const text = cleanText(payload.text, RULES.maxLieLength);
        if (!norm(text)) throw new GameError('Write an actual answer.');
        const prompt = room.prompts[room.promptIndex];
        if (tooCloseToTruth(text, prompt.truth, prompt.accept))
          throw new GameError('Too close to the real answer. Write something false.');
        me.lie = text;
        if (payload.plantTrap && !me.trapUsed) {
          me.trapActive = true;
          me.trapUsed = true;
        }
        advance(room, now);
        return { result: null, write: true };
      }

      case 'vote': {
        if (room.phase !== 'VOTE') throw new GameError('Voting is closed.');
        if (me.vote !== null) throw new GameError('You already voted.');
        const opt = room.options.find((o) => o.id === payload.optionId);
        if (!opt) throw new GameError('That option does not exist.');
        if (opt.authors.includes(me.id)) throw new GameError("You can't vote for your own lie.");
        me.vote = opt.id;
        me.doubleDown = Boolean(payload.doubleDown);
        if (payload.useShield && !me.shieldUsed) {
          me.shieldActive = true;
          me.shieldUsed = true;
        }
        advance(room, now);
        return { result: null, write: true };
      }

      case 'useShield': {
        if (room.phase !== 'VOTE') throw new GameError('Truth Shield can only be used during voting.');
        if (me.shieldUsed) throw new GameError('You have already used your Truth Shield this game.');
        me.shieldActive = true;
        me.shieldUsed = true;
        return { result: null, write: true };
      }

      case 'plantTrap': {
        if (room.phase !== 'WRITE') throw new GameError('Bluff Trap can only be planted during writing.');
        if (me.trapUsed) throw new GameError('You have already planted your Bluff Trap this game.');
        me.trapActive = true;
        me.trapUsed = true;
        return { result: null, write: true };
      }

      case 'like': {
        const targetId = payload.optionId || payload.likeOptionId;
        const opt = room.options.find((o) => o.id === targetId);
        if (!opt) throw new GameError('That option does not exist.');
        if (!opt.likes) opt.likes = [];
        if (!opt.likes.includes(me.id)) {
          opt.likes.push(me.id);
          for (const a of opt.authors) {
            if (room.players[a]) room.players[a].likesReceived = (room.players[a].likesReceived || 0) + 1;
          }
        }
        return { result: null, write: true };
      }

      case 'suggestLie': {
        if (room.phase !== 'WRITE') throw new GameError('Writing phase is not active.');
        const prompt = room.prompts[room.promptIndex];
        const existing = everyone(room).map((p) => p.lie).filter(Boolean) as string[];
        const suggestion = makeBotLie(prompt, existing);
        return { result: suggestion, write: false };
      }

      case 'next': {
        requireHost(room, pid);
        if (room.phase !== 'WRITE' && room.phase !== 'VOTE' && room.phase !== 'REVEAL')
          throw new GameError('Nothing to skip right now.');
        room.deadline = now; // let the normal rules do the transition
        advance(room, now);
        return { result: null, write: true };
      }

      case 'again': {
        requireHost(room, pid);
        if (room.phase !== 'FINAL') throw new GameError('The game is not over yet.');
        room.phase = 'LOBBY';
        room.prompts = [];
        room.promptIndex = 0;
        room.options = [];
        room.topLies = [];
        room.deadline = 0;
        for (const p of everyone(room)) {
          p.score = 0;
          p.lie = p.vote = null;
          p.gain = p.gainTruth = p.gainFooled = 0;
          p.truthsFound = p.fooled = p.houseVotes = 0;
        }
        return { result: null, write: true };
      }

      case 'leave': {
        if (room.phase !== 'LOBBY') return { result: null, write: changed };
        delete room.players[pid];
        room.order = room.order.filter((id) => id !== pid);
        if (room.hostId === pid && room.order.length) room.hostId = room.order[0];
        return { result: null, write: true };
      }

      case 'addBot': {
        requireHost(room, pid);
        if (room.phase !== 'LOBBY') throw new GameError('Can only add bots in the lobby.');
        if (room.order.length >= RULES.maxPlayers) throw new GameError(`Room is full (${RULES.maxPlayers} players max).`);
        const botConfigs = [
          { name: 'Uncle Leo 🎩', avatar: '🎩' },
          { name: 'Grandma Ethel 🧶', avatar: '👑' },
          { name: 'Detective Knox 🕵️', avatar: '🕶️' },
          { name: 'Chef Marco 🍕', avatar: '🍕' },
          { name: 'Captain Jack ⚓', avatar: '🤠' },
          { name: 'Chloe 💅', avatar: '💎' },
          { name: 'DJ Blaze 🎧', avatar: '🚀' },
          { name: 'Baron Von Bluff 🧐', avatar: '⭐' },
          { name: 'Professor Plum 📚', avatar: '🦊' },
          { name: 'Auntie Bea 🥧', avatar: '🎲' },
        ];
        const existing = new Set(everyone(room).map((p) => p.name.toLowerCase()));
        let chosen = botConfigs.find((b) => !existing.has(b.name.toLowerCase()));
        const botName = chosen ? chosen.name : `Guest ${room.order.length + 1}`;
        const bot = newPlayer(botName, everyone(room).map((x) => x.color));
        bot.isBot = true;
        if (chosen) bot.avatar = chosen.avatar;
        room.players[bot.id] = bot;
        room.order.push(bot.id);
        return { result: null, write: true };
      }

      case 'removeBot': {
        requireHost(room, pid);
        if (room.phase !== 'LOBBY') throw new GameError('Can only remove bots in the lobby.');
        const botId = [...room.order].reverse().find((id) => room.players[id]?.isBot);
        if (!botId) throw new GameError('No bots to remove.');
        delete room.players[botId];
        room.order = room.order.filter((id) => id !== botId);
        return { result: null, write: true };
      }

      case 'useRadar': {
        if (room.phase !== 'VOTE') throw new GameError('Lie Radar can only be used during voting.');
        if (me.radarUsed) throw new GameError('You have already used your 50/50 Lie Radar this game.');
        me.radarUsed = true;
        return { result: null, write: true };
      }

      case 'avatar': {
        const icon = cleanText(payload.avatar || '', 8);
        if (icon) me.avatar = icon;
        return { result: null, write: true };
      }

      case 'react': {
        const emoji = cleanText(payload.emoji || payload.text, 8);
        if (!emoji) return { result: null, write: false };
        if (!room.reactions) room.reactions = [];
        room.reactions.push({
          id: makeId(),
          playerId: me.id,
          playerName: me.name,
          emoji,
          createdAt: now,
        });
        room.reactions = room.reactions.filter((r) => now - r.createdAt < 15000).slice(-15);
        return { result: null, write: true };
      }

      default:
        throw new GameError(`Unknown action "${action}".`);
    }
  });

  if (action === 'leave') return { ok: true };
  if (action === 'suggestLie') return { ok: true, playerId: pid, suggestedLie: result as string, state: view(room, pid, now) };
  return { ok: true, playerId: pid, state: view(room, pid, now) };
}

/** Entry point shared by the Netlify function, the dev server and the tests. */
export async function handleAction(payload: Payload): Promise<{ status: number; body: ApiResult }> {
  try {
    return { status: 200, body: await run(payload) };
  } catch (err) {
    if (err instanceof GameError) return { status: err.status, body: { ok: false, error: err.message } };
    console.error(err);
    return { status: 500, body: { ok: false, error: 'Something broke on our side. Try again in a moment.' } };
  }
}
