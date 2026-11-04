// GET /api/palettes/:id -> { id, hex, createdAt } or 404

const ID_PATTERN = /^[a-z0-9]{6}$/;

export async function onRequestGet({ params, env }) {
  const id = String(params.id);
  if (!ID_PATTERN.test(id)) return Response.json({ error: 'Палітру не знайдено' }, { status: 404 });

  const row = await env.DB.prepare('SELECT id, hex, created_at FROM palettes WHERE id = ?').bind(id).first();
  if (!row) return Response.json({ error: 'Палітру не знайдено' }, { status: 404 });

  return Response.json({ id: row.id, hex: row.hex, createdAt: row.created_at });
}
