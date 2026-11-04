-- Saved palettes for short links /p/:id. The whole palette is derived from the hex.
CREATE TABLE IF NOT EXISTS palettes (
  id TEXT PRIMARY KEY,
  hex TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
