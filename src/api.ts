import { handleAction } from '../lib/engine';
import type { ApiResult, Payload } from '../lib/types';

function getEndpoint(): string {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host.includes('github.io') || host.includes('glitch.me')) {
      return 'https://barefaced-kallal.netlify.app/.netlify/functions/game';
    }
  }
  return '/.netlify/functions/game';
}

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
  const endpoint = getEndpoint();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json();
      return { ...data, status: res.status };
    }
    if (res.status === 404 || res.status === 405 || res.status >= 500) {
      const local = await handleAction(payload);
      return { ...local.body, status: local.status };
    }
    return await parse(res);
  } catch {
    try {
      const local = await handleAction(payload);
      return { ...local.body, status: local.status };
    } catch (e: any) {
      return { ok: false, error: e?.message || 'Cannot process action.', status: 0 };
    }
  }
}

export async function poll(code: string, playerId: string): Promise<Reply> {
  const endpoint = getEndpoint();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    const q = new URLSearchParams({ action: 'state', code, playerId });
    const res = await fetch(`${endpoint}?${q}`, {
      cache: 'no-store',
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json();
      return { ...data, status: res.status };
    }
    if (res.status === 404 || res.status === 405 || res.status >= 500) {
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
