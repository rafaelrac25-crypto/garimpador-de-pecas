-- Schema Postgres (Neon) — espelho de schema.sql adaptado.
-- Diferenças vs SQLite:
--   AUTOINCREMENT     -> SERIAL
--   TIMESTAMPTZ       (em vez de TEXT DEFAULT CURRENT_TIMESTAMP)
--   ON CONFLICT       (em vez de INSERT OR IGNORE)

CREATE TABLE IF NOT EXISTS searches (
  id SERIAL PRIMARY KEY,
  q TEXT NOT NULL,
  modelo TEXT,
  filtros TEXT,
  results_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS favorites (
  id SERIAL PRIMARY KEY,
  source TEXT NOT NULL,
  external_id TEXT NOT NULL,
  title TEXT NOT NULL,
  price REAL,
  url TEXT NOT NULL,
  thumb_url TEXT,
  metadata TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (source, external_id)
);

CREATE TABLE IF NOT EXISTS alerts (
  id SERIAL PRIMARY KEY,
  favorite_id INTEGER NOT NULL REFERENCES favorites(id) ON DELETE CASCADE,
  last_price REAL,
  threshold_pct INTEGER DEFAULT 10,
  last_checked_at TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_searches_created ON searches(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_favorites_source ON favorites(source, external_id);

CREATE TABLE IF NOT EXISTS price_alerts (
  id SERIAL PRIMARY KEY,
  q TEXT NOT NULL,
  modelo TEXT,
  filtros TEXT,
  threshold_price REAL NOT NULL,
  baseline_price REAL,
  baseline_sample INTEGER,
  email_to TEXT,
  whatsapp_to TEXT,
  active INTEGER DEFAULT 1,
  last_checked_at TEXT,
  last_match_price REAL,
  last_match_at TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  link TEXT,
  metadata TEXT,
  read_at TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_price_alerts_active ON price_alerts(active, last_checked_at);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(read_at, created_at DESC);

CREATE TABLE IF NOT EXISTS error_logs (
  id SERIAL PRIMARY KEY,
  source TEXT NOT NULL,
  action TEXT,
  code TEXT,
  message TEXT NOT NULL,
  context TEXT,
  resolved_at TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_error_logs_recent ON error_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_open ON error_logs(resolved_at, created_at DESC);

CREATE TABLE IF NOT EXISTS vehicle (
  id INTEGER PRIMARY KEY,
  apelido TEXT,
  modelo TEXT,
  ano INTEGER,
  placa TEXT,
  chassi TEXT,
  motor TEXT,
  cor TEXT,
  combustivel TEXT,
  km_atual INTEGER,
  km_atual_at TEXT,
  foto_url TEXT,
  pressao_pneu_dianteiro REAL,
  pressao_pneu_traseiro REAL,
  vencimento_ipva TEXT,
  vencimento_seguro TEXT,
  observacoes TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS maintenance_logs (
  id SERIAL PRIMARY KEY,
  kind TEXT NOT NULL,
  peca TEXT NOT NULL,
  marca TEXT,
  km INTEGER,
  data TEXT NOT NULL,
  durabilidade_km INTEGER,
  durabilidade_meses INTEGER,
  valor REAL,
  fornecedor TEXT,
  notas TEXT,
  foto_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_maintenance_kind_date ON maintenance_logs(kind, data DESC);

CREATE TABLE IF NOT EXISTS ml_tokens (
  id INTEGER PRIMARY KEY,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TEXT NOT NULL,
  user_id TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE ml_tokens ALTER COLUMN refresh_token DROP NOT NULL;

INSERT INTO vehicle (id, apelido, modelo, ano, combustivel)
VALUES (1, 'C14 do Costa', 'Chevrolet C14', 1964, 'gasolina')
ON CONFLICT (id) DO NOTHING;

-- Cache de ofertas Mercado Livre. Populado por scraper Playwright em
-- GitHub Actions (cron 2h + manual dispatch). Frontend lê daqui em vez
-- de fazer scraping live (ML bloqueia datacenter Vercel).
CREATE TABLE IF NOT EXISTS ml_offers_cache (
  id SERIAL PRIMARY KEY,
  external_id TEXT NOT NULL UNIQUE,
  termo TEXT NOT NULL,
  modelo TEXT,
  title TEXT NOT NULL,
  price REAL,
  url TEXT NOT NULL,
  thumb_url TEXT,
  free_shipping INTEGER DEFAULT 0,
  scraped_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ml_cache_termo ON ml_offers_cache(termo, scraped_at DESC);
CREATE INDEX IF NOT EXISTS idx_ml_cache_recent ON ml_offers_cache(scraped_at DESC);

-- Status do scraper (single-row, id=1)
CREATE TABLE IF NOT EXISTS ml_scrape_status (
  id INTEGER PRIMARY KEY,
  last_run_at TIMESTAMPTZ,
  last_run_count INTEGER DEFAULT 0,
  last_run_status TEXT,
  last_run_termos INTEGER DEFAULT 0,
  last_error TEXT
);

INSERT INTO ml_scrape_status (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Termos aprendidos do uso real. Cada busca do usuário que dá miss no
-- ML registra aqui. Cron rotativo do scraper mescla esses com os fixos.
CREATE TABLE IF NOT EXISTS ml_terms_learned (
  id SERIAL PRIMARY KEY,
  q TEXT NOT NULL UNIQUE,
  modelo TEXT,
  hits INTEGER DEFAULT 1,
  active INTEGER DEFAULT 1,
  last_hit_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ml_terms_active ON ml_terms_learned(active, hits DESC);

-- Sessão Playwright autenticada no ML. Single-row id=1.
-- Scraper carrega no início, refaz login se inválida, salva ao fim.
CREATE TABLE IF NOT EXISTS ml_session (
  id INTEGER PRIMARY KEY,
  storage_state TEXT,
  saved_at TIMESTAMPTZ
);

INSERT INTO ml_session (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
