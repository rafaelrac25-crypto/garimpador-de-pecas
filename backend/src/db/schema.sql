-- Garimpador de Peças — schema inicial
-- Tabelas mínimas pro MVP. Mais tabelas entram nas fases:
-- Fase 6: favorites, searches (histórico)
-- Fase 7: alerts (queda de preço)

CREATE TABLE IF NOT EXISTS searches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  q TEXT NOT NULL,
  modelo TEXT,
  filtros TEXT,           -- JSON
  results_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS favorites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,           -- 'mercadolivre' | 'olx' | 'webmotors'
  external_id TEXT NOT NULL,      -- id na fonte original
  title TEXT NOT NULL,
  price REAL,
  url TEXT NOT NULL,
  thumb_url TEXT,
  metadata TEXT,                  -- JSON
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (source, external_id)
);

CREATE TABLE IF NOT EXISTS alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  favorite_id INTEGER NOT NULL REFERENCES favorites(id) ON DELETE CASCADE,
  last_price REAL,
  threshold_pct INTEGER DEFAULT 10,    -- alerta quando cair >= X%
  last_checked_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_searches_created ON searches(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_favorites_source ON favorites(source, external_id);
