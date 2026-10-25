export type Phase = 'LOBBY' | 'WRITE' | 'VOTE' | 'REVEAL' | 'FINAL';

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
}

export interface Option {
  id: string;
  text: string;
  kind: 'truth' | 'lie' | 'house';
  authors: string[];
  voters: string[];
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
  deadline: number;
  version: number;
  createdAt: number;
  updatedAt: number;
}

/* ---------- what the browser is allowed to see ---------- */

export interface PublicPlayer {
  id: string;
  name: string;
  color: number;
  score: number;
  isHost: boolean;
  submitted: boolean;
  voted: boolean;
  gain: number;
  gainTruth: number;
  gainFooled: number;
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
  myLie?: string | null;
  myVote?: string | null;
  truth?: string;
  note?: string;
  awards?: Award[];
}

export interface Payload {
  action: string;
  code?: string;
  playerId?: string;
  name?: string;
  text?: string;
  optionId?: string;
}

export interface ApiResult {
  ok: boolean;
  error?: string;
  playerId?: string;
  state?: ClientState;
}
