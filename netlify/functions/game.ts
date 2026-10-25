import { handleAction } from '../../lib/engine';
import type { Payload } from '../../lib/types';

// Standard Netlify Function, reachable at /.netlify/functions/game (no redirects, no config.path).

const HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
};

export default async (req: Request): Promise<Response> => {
  let payload: Payload;
  try {
    if (req.method === 'POST') {
      payload = (await req.json()) as Payload;
    } else {
      const q = new URL(req.url).searchParams;
      payload = {
        action: q.get('action') || 'state',
        code: q.get('code') || undefined,
        playerId: q.get('playerId') || undefined,
      };
    }
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'Bad request.' }), { status: 400, headers: HEADERS });
  }

  const { status, body } = await handleAction(payload);
  return new Response(JSON.stringify(body), { status, headers: HEADERS });
};
