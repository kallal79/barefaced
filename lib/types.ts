export type Phase = 'LOBBY' | 'WRITE' | 'VOTE' | 'REVEAL' | 'FINAL';

export type GameMode = 'classic' | 'blitz' | 'infinity';

export type MatchLength = 'quick' | 'standard' | 'marathon';

export type DeckCategory = 'all' | 'history' | 'pop' | 'nature' | 'science';

export interface TopLieRecord {
  promptText: string;
  lieText: string;
  authorId: string;
  authorName: string;
  votesCount: number;
}

export interface GameModifiers {
  chaos?: boolean;
  speedDemon?: boolean;
  doubleDecoy?: boolean;
  anonymity?: boolean;
}

export interface Prompt {
  round: number;
  /** Contains a ______ blank that players fill in. */
  text: string;
  truth: string;
  /** Other spellings of the truth that must not be accepted as a "lie". */
  accept?: string[];
  /** Fake answers the house can mix in. */
  decoys: string[];
  /** Short explanation shown after the reveal. */
  note: string;
  category?: DeckCategory;
}

export interface Player {
  id: string;
  name: string;
  color: number;
  score: number;
  lie: string | null;
  vote: string | null;
  // lifetime stats for this game (used for the end-of-game awards)
  truthsFound: number;
  fooled: number;
  houseVotes: number;
  // points earned on the prompt that was just revealed
  gain: number;
  gainTruth: number;
  gainFooled: number;
  isBot?: boolean;
  doubleDown?: boolean;
  streak: number;
  likesReceived: number;
  doubleDownHits: number;
  radarUsed?: boolean;
  avatar?: string;
  lives?: number;
  shieldUsed?: boolean;
  shieldActive?: boolean;
  trapUsed?: boolean;
  trapActive?: boolean;
  title?: string;
}

export interface Option {
  id: string;
  text: string;
  kind: 'truth' | 'lie' | 'house';
  authors: string[];
  voters: string[];
  likes?: string[];
  trapped?: boolean;
}

export interface Reaction {
  id: string;
  playerId: string;
  playerName: string;
  emoji: string;
  createdAt: number;
}

export interface Room {
  code: string;
  hostId: string;
  phase: Phase;
  promptIndex: number;
  prompts: Prompt[];
  players: Record<string, Player>;
  order: string[];
  options: Option[];
  reactions?: Reaction[];
  deadline: number;
  version: number;
  createdAt: number;
  updatedAt: number;
  gameMode?: GameMode;
  matchLength?: MatchLength;
  modifiers?: GameModifiers;
  deckCategory?: DeckCategory;
  topLies?: TopLieRecord[];
}

/* ---------- what the browser is allowed to see ---------- */

export interface PublicPlayer {
  id: string;
  name: string;
  color: number;
  score: number;
  isHost: boolean;
  isBot?: boolean;
  submitted: boolean;
  voted: boolean;
  gain: number;
  gainTruth: number;
  gainFooled: number;
  doubleDown?: boolean;
  streak?: number;
  likesReceived?: number;
  radarUsed?: boolean;
  avatar?: string;
  lives?: number;
  shieldUsed?: boolean;
  trapUsed?: boolean;
  title?: string;
}

export interface PublicOption {
  id: string;
  text: string;
  /** true when this option is (or includes) the viewing player's own lie */
  mine: boolean;
  // only filled in once the answer is revealed
  kind?: 'truth' | 'lie' | 'house';
  authors?: string[];
  voters?: string[];
  likes?: string[];
  likedByMe?: boolean;
  trapped?: boolean;
}

export interface Award {
  title: string;
  playerId: string;
  detail: string;
}

export interface ClientState {
  code: string;
  phase: Phase;
  hostId: string;
  version: number;
  serverTime: number;
  deadline: number;
  /** length of the current phase in seconds (0 when there is no timer) */
  phaseTotal: number;
  round: number;
  rounds: number;
  promptNumber: number;
  promptsPerRound: number;
  multiplier: number;
  players: PublicPlayer[];
  prompt?: string;
  options?: PublicOption[];
  reactions?: Reaction[];
  myLie?: string | null;
  myVote?: string | null;
  myDoubleDown?: boolean;
  myRadarUsed?: boolean;
  myLives?: number;
  myShieldUsed?: boolean;
  myShieldActive?: boolean;
  myTrapUsed?: boolean;
  myTrapActive?: boolean;
  streak?: number;
  truth?: string;
  note?: string;
  awards?: Award[];
  gameMode?: GameMode;
  matchLength?: MatchLength;
  modifiers?: GameModifiers;
  deckCategory?: DeckCategory;
  topLies?: TopLieRecord[];
  infinityLevel?: number;
}

export interface Payload {
  action: string;
  code?: string;
  playerId?: string;
  name?: string;
  text?: string;
  optionId?: string;
  emoji?: string;
  doubleDown?: boolean;
  likeOptionId?: string;
  useRadar?: boolean;
  avatar?: string;
  gameMode?: GameMode;
  matchLength?: MatchLength;
  deckCategory?: DeckCategory;
  modifierKey?: keyof GameModifiers;
  modifierVal?: boolean;
  useShield?: boolean;
  plantTrap?: boolean;
}

export interface ApiResult {
  ok: boolean;
  error?: string;
  playerId?: string;
  state?: ClientState;
  suggestedLie?: string;
}
