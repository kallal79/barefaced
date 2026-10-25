import { getStore } from '@netlify/blobs';
import type { Room } from './types';

/**
 * Room storage.
 *
 * On Netlify every room is one blob read with strong consistency and written with
 * a conditional write (onlyIfMatch / onlyIfNew). Two players hitting the function
 * at the same moment can therefore never overwrite each other: the loser re-reads
 * and re-applies its change.
 *
 * Outside Netlify (local dev, tests) there is no Blobs environment, so rooms live
 * in memory with the same etag semantics.
 */

export class GameError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

interface Loaded {
  room: Room;
  etag: string;
}

const memory = new Map<string, { json: string; etag: number }>();

function blobs() {
  try {
    return getStore({ name: 'barefaced-rooms', consistency: 'strong' });
  } catch {
    // MissingBlobsEnvironmentError: not running on Netlify
    return null;
  }
}

const clean = (code: string) => code.toUpperCase().replace(/[^A-Z0-9]/g, '');

async function load(code: string): Promise<Loaded | null> {
  const store = blobs();
  if (store) {
    const hit = await store.getWithMetadata(code, { type: 'json' });
    if (!hit) return null;
    return { room: hit.data as Room, etag: hit.etag as string };
  }
  const m = memory.get(code);
  return m ? { room: JSON.parse(m.json), etag: String(m.etag) } : null;
}

async function write(room: Room, etag: string | null): Promise<boolean> {
  const store = blobs();
  if (store) {
    const res = await store.setJSON(room.code, room, etag ? { onlyIfMatch: etag } : { onlyIfNew: true });
    return res.modified;
  }
  const m = memory.get(room.code);
  if (etag === null ? !!m : !m || String(m.etag) !== etag) return false;
  memory.set(room.code, { json: JSON.stringify(room), etag: (m?.etag ?? 0) + 1 });
  return true;
}

export async function readRoom(rawCode: string): Promise<Room | null> {
  const loaded = await load(clean(rawCode));
  return loaded ? loaded.room : null;
}

/** Returns false if the code is already taken. */
export async function createRoom(room: Room): Promise<boolean> {
  return write(room, null);
}

/**
 * Apply `fn` to the latest copy of the room and save it. `fn` mutates the room it is
 * given and says whether anything changed. Retries when someone else wrote first.
 */
export async function updateRoom<T>(
  rawCode: string,
  fn: (room: Room) => { result: T; write: boolean }
): Promise<{ room: Room; result: T }> {
  const code = clean(rawCode);
  for (let attempt = 0; attempt < 12; attempt++) {
    const loaded = await load(code);
    if (!loaded) throw new GameError(`No room with code ${code}. Check the letters and try again.`, 404);

    const { room, etag } = loaded;
    const out = fn(room);
    if (!out.write) return { room, result: out.result };

    room.version += 1;
    room.updatedAt = Date.now();
    if (await write(room, etag)) return { room, result: out.result };

    await new Promise((r) => setTimeout(r, 15 + Math.random() * 45 * (attempt + 1)));
  }
  throw new GameError('The room is very busy right now. Please try again.', 503);
}
