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

-- Alertas por busca (estilo Zoom): cadastra termo+filtros+threshold,
-- sistema monitora e notifica quando aparece peça abaixo do preço
CREATE TABLE IF NOT EXISTS price_alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  q TEXT NOT NULL,
  modelo TEXT,
  filtros TEXT,                  -- JSON
  threshold_price REAL NOT NULL, -- alerta quando aparecer item ≤ este valor
  baseline_price REAL,           -- preço de referência calculado (mediana das fontes)
  baseline_sample INTEGER,       -- quantidade de amostras usada no baseline
  email_to TEXT,                 -- opcional — envia email quando dispara
  whatsapp_to TEXT,              -- opcional — envia WhatsApp via CallMeBot
  active INTEGER DEFAULT 1,
  last_checked_at TEXT,
  last_match_price REAL,         -- último preço que disparou (pra evitar repetir notif)
  last_match_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Notificações in-app (sino do header). Cresce com os disparos.
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,            -- 'price_alert' | 'system' | 'info'
  title TEXT NOT NULL,
  message TEXT,
  link TEXT,                     -- URL pra abrir (anúncio externo)
  metadata TEXT,                 -- JSON (alert_id, etc)
  read_at TEXT,                  -- NULL = não lida
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_price_alerts_active ON price_alerts(active, last_checked_at);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(read_at, created_at DESC);

-- Log de erros do sistema (aba Diagnósticos do sino)
CREATE TABLE IF NOT EXISTS error_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,          -- ex 'mercadoLivre', 'olx', 'partRecognition', 'cron'
  action TEXT,                   -- ex 'search', 'fetchAndResize', 'verifyMatch'
  code TEXT,                     -- HTTP status ou código próprio do erro
  message TEXT NOT NULL,         -- mensagem do erro (sanitizada — sem secrets)
  context TEXT,                  -- JSON: query/url/parâmetros relevantes (sanitizados)
  resolved_at TEXT,              -- NULL = aberto
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_error_logs_recent ON error_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_open ON error_logs(resolved_at, created_at DESC);
