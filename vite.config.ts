import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { handleAction } from './lib/engine';
import type { Payload } from './lib/types';

// Mirrors /.netlify/functions/game while developing, so the front end code is identical in both places.
function devFunction(): Plugin {
  return {
    name: 'dev-game-function',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || '';
        if (!url.startsWith('/.netlify/functions/game')) return next();

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-store');
        try {
          let payload: Payload;
          if (req.method === 'POST') {
            const raw = await new Promise<string>((resolve, reject) => {
              let data = '';
              req.on('data', (c) => (data += c));
              req.on('end', () => resolve(data));
              req.on('error', reject);
            });
            payload = raw ? JSON.parse(raw) : ({} as Payload);
          } else {
            const q = new URL(url, 'http://localhost').searchParams;
            payload = {
              action: q.get('action') || 'state',
              code: q.get('code') || undefined,
              playerId: q.get('playerId') || undefined,
            };
          }
          const { status, body } = await handleAction(payload);
          res.statusCode = status;
          res.end(JSON.stringify(body));
        } catch {
          res.statusCode = 400;
          res.end(JSON.stringify({ ok: false, error: 'Bad request.' }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), devFunction()],
  server: { port: 5173, host: true },
});
