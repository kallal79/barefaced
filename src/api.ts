import { handleAction } from '../lib/engine';
import type { ApiResult, Payload } from '../lib/types';

const ENDPOINT = '/.netlify/functions/game';

export interface Reply extends ApiResult {
  status: number;
}

async function parse(res: Response): Promise<Reply> {
  try {
    const body = (await res.json()) as ApiResult;
    return { ...body, status: res.status };
  } catch {
    return { ok: false, error: 'The server sent something unexpected.', status: res.status };
  }
}

export async function send(payload: Payload): Promise<Reply> {
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.status === 404) {
      const local = await handleAction(payload);
      return { ...local.body, status: local.status };
    }
    return await parse(res);
  } catch {
    try {
      const local = await handleAction(payload);
      return { ...local.body, status: local.status };
    } catch {
      return { ok: false, error: 'Cannot reach the game server. Check your connection.', status: 0 };
    }
  }
}

export async function poll(code: string, playerId: string): Promise<Reply> {
  try {
    const q = new URLSearchParams({ action: 'state', code, playerId });
    const res = await fetch(`${ENDPOINT}?${q}`, { cache: 'no-store' });
    if (res.status === 404) {
      const local = await handleAction({ action: 'state', code, playerId });
      return { ...local.body, status: local.status };
    }
    return await parse(res);
  } catch {
    try {
      const local = await handleAction({ action: 'state', code, playerId });
      return { ...local.body, status: local.status };
    } catch {
      return { ok: false, error: 'offline', status: 0 };
    }
  }
}

/* A seat in a room belongs to one browser tab, so two tabs on one laptop are two players. */
const KEY = 'barefaced.seat';
export interface Seat {
  code: string;
  playerId: string;
}

export const loadSeat = (): Seat | null => {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) || 'null');
  } catch {
    return null;
  }
};
export const saveSeat = (seat: Seat | null) => {
  if (seat) sessionStorage.setItem(KEY, JSON.stringify(seat));
  else sessionStorage.removeItem(KEY);
};
