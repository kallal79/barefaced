import { PROMPT_POOL } from './prompts';
import { createRoom, readRoom, updateRoom, GameError } from './store';
import type { ApiResult, Award, ClientState, Option, Payload, Player, PublicOption, Room } from './types';

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
  maxNameLength: 14,
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
  };
}

function pickPrompts() {
  const chosen = [];
  for (let r = 1; r <= RULES.rounds; r++) {
    chosen.push(...shuffle(PROMPT_POOL.filter((p) => p.round === r)).slice(0, RULES.perRound));
  }
  return chosen;
}

/* --------------------------- state machine ------------------------- */

const everyone = (room: Room) => room.order.map((id) => room.players[id]);

function beginPrompt(room: Room, now: number) {
  for (const p of everyone(room)) {
    p.lie = null;
    p.vote = null;
    p.gain = p.gainTruth = p.gainFooled = 0;
  }
  room.options = [];
  room.phase = 'WRITE';
  const round = room.prompts[room.promptIndex].round;
  room.deadline = now + RULES.writeSecs[round] * 1000;
}

function beginVote(room: Room, now: number) {
  const prompt = room.prompts[room.promptIndex];
  const byKey = new Map<string, Option>();
  const options: Option[] = [];
  const add = (text: string, kind: Option['kind'], author?: string) => {
    const key = norm(text);
    const existing = byKey.get(key);
    if (existing) {
      // two people wrote the same lie: it is one option and both get paid
      if (author && existing.kind === 'lie' && !existing.authors.includes(author)) existing.authors.push(author);
      return;
    }
    const opt: Option = { id: '', text, kind, authors: author ? [author] : [], voters: [] };
    byKey.set(key, opt);
    options.push(opt);
  };

  add(prompt.truth, 'truth');
  for (const p of everyone(room)) if (p.lie) add(p.lie, 'lie', p.id);
  const decoys = prompt.round === 3 ? 1 : 2; // fewer places to hide in the last round
  for (const d of prompt.decoys.slice(0, decoys)) add(d, 'house');

  room.options = shuffle(options).map((o, i) => ({ ...o, id: 'o' + i }));
  room.phase = 'VOTE';
  room.deadline = now + RULES.voteSecs * 1000;
}

function beginReveal(room: Room, now: number) {
  const mult = RULES.multiplier[room.prompts[room.promptIndex].round];
  for (const voter of everyone(room)) {
    const opt = room.options.find((o) => o.id === voter.vote);
    if (!opt) continue;
    opt.voters.push(voter.id);
    if (opt.kind === 'truth') {
      voter.gainTruth = RULES.truthPoints * mult;
      voter.truthsFound += 1;
    } else if (opt.kind === 'lie') {
      for (const a of opt.authors) {
        const author = room.players[a];
        if (!author) continue;
        author.gainFooled += RULES.foolPoints * mult;
        author.fooled += 1;
      }
    } else {
      voter.houseVotes += 1;
    }
  }
  for (const p of everyone(room)) {
    p.gain = p.gainTruth + p.gainFooled;
    p.score += p.gain;
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
    rounds: RULES.rounds,
    promptNumber: prompt ? (room.promptIndex % RULES.perRound) + 1 : 1,
    promptsPerRound: RULES.perRound,
    multiplier: prompt ? RULES.multiplier[prompt.round] : 1,
    players: everyone(room).map((p) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      score: p.score,
      isHost: p.id === room.hostId,
      submitted: p.lie !== null,
      voted: p.vote !== null,
      gain: p.gain,
      gainTruth: p.gainTruth,
      gainFooled: p.gainFooled,
    })),
  };

  if (room.phase === 'WRITE' || room.phase === 'VOTE' || room.phase === 'REVEAL') {
    state.prompt = prompt.text;
    state.myLie = me?.lie ?? null;
    state.myVote = me?.vote ?? null;
  }

  if (room.phase === 'VOTE' || room.phase === 'REVEAL') {
    state.options = room.options.map<PublicOption>((o) => {
      const base: PublicOption = { id: o.id, text: o.text, mine: o.authors.includes(playerId) };
      // the answer key only leaves the server once voting is over
      if (revealed) {
        base.kind = o.kind;
        base.authors = o.authors;
        base.voters = o.voters;
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

  const { room } = await updateRoom(code, (room) => {
    const me = requirePlayer(room, pid);
    let changed = advance(room, now); // always catch up on timers first

    switch (action) {
      case 'state':
        return { result: null, write: changed };

      case 'start': {
        requireHost(room, pid);
        if (room.phase !== 'LOBBY') throw new GameError('The game has already started.');
        if (room.order.length < RULES.minPlayers) throw new GameError(`You need at least ${RULES.minPlayers} players.`);
        room.prompts = pickPrompts();
        room.promptIndex = 0;
        for (const p of everyone(room)) {
          p.score = 0;
          p.truthsFound = p.fooled = p.houseVotes = 0;
        }
        beginPrompt(room, now);
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
        advance(room, now);
        return { result: null, write: true };
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

      default:
        throw new GameError(`Unknown action "${action}".`);
    }
  });

  if (action === 'leave') return { ok: true };
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
