// POST /api/palettes  { hex } -> { id, url }
// The same hex always gets the same short id.

import { normalizeHex } from '../../public/color.js';

const ID_ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789'; // no look-alikes: l, o, 0, 1
const ID_LENGTH = 6;
const MAX_ATTEMPTS = 5;

function randomId() {
  const bytes = crypto.getRandomValues(new Uint8Array(ID_LENGTH));
  return [...bytes].map((b) => ID_ALPHABET[b % ID_ALPHABET.length]).join('');
}

const json = (body, status = 200) => Response.json(body, { status });

export async function onRequestPost({ request, env }) {
  let hex;
  try {
    hex = normalizeHex((await request.json()).hex);
  } catch {
    return json({ error: 'Невалідний hex' }, 400);
  }

  const origin = new URL(request.url).origin;
  const result = (id) => json({ id, url: `${origin}/p/${id}` });

  const existing = await env.DB.prepare('SELECT id FROM palettes WHERE hex = ?').bind(hex).first();
  if (existing) return result(existing.id);

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const id = randomId();
    try {
      await env.DB.prepare('INSERT INTO palettes (id, hex) VALUES (?, ?)').bind(id, hex).run();
      return result(id);
    } catch (error) {
      if (!String(error).includes('UNIQUE')) throw error;
      // Either the id is taken (try another) or the same hex was saved meanwhile.
      const saved = await env.DB.prepare('SELECT id FROM palettes WHERE hex = ?').bind(hex).first();
      if (saved) return result(saved.id);
    }
  }
  return json({ error: 'Не вдалося створити посилання' }, 500);
}
