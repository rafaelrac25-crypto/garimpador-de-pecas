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

-- C14 do Costa — dados da caminhonete (single-row, id=1)
CREATE TABLE IF NOT EXISTS vehicle (
  id INTEGER PRIMARY KEY,
  apelido TEXT,                  -- ex: "C14 do Costa"
  modelo TEXT,                   -- ex: "Chevrolet C14"
  ano INTEGER,                   -- ex: 1964
  placa TEXT,
  chassi TEXT,
  motor TEXT,                    -- ex: "6cc 4.1"
  cor TEXT,
  combustivel TEXT,              -- gasolina|etanol|alcool|flex
  km_atual INTEGER,
  km_atual_at TEXT,              -- ISO date — quando o km foi registrado
  foto_url TEXT,
  pressao_pneu_dianteiro REAL,
  pressao_pneu_traseiro REAL,
  vencimento_ipva TEXT,
  vencimento_seguro TEXT,
  observacoes TEXT,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Log de manutenção/troca de peça
CREATE TABLE IF NOT EXISTS maintenance_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,            -- 'oleo_motor'|'filtro_combustivel'|'agua_radiador'|'carburador'|'pneu'|'bateria'|'embreagem'|'pastilha'|'outro'
  peca TEXT NOT NULL,            -- nome da peça/serviço
  marca TEXT,
  km INTEGER,                    -- km do carro na hora da troca
  data TEXT NOT NULL,            -- ISO date (YYYY-MM-DD)
  durabilidade_km INTEGER,       -- ex: 5000 (alerta quando passar disso)
  durabilidade_meses INTEGER,    -- ex: 12
  valor REAL,
  fornecedor TEXT,
  notas TEXT,
  foto_url TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_maintenance_kind_date ON maintenance_logs(kind, data DESC);

-- OAuth Mercado Livre — token único (single-row, id=1).
-- Rafa autoriza 1 vez via /api/ml/start, callback salva tokens.
-- Refresh token rota a cada uso (ML rotation policy).
CREATE TABLE IF NOT EXISTS ml_tokens (
  id INTEGER PRIMARY KEY,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TEXT NOT NULL,      -- ISO datetime
  user_id TEXT,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Pré-popula vehicle row 1 com defaults C14 do Costa
INSERT OR IGNORE INTO vehicle (id, apelido, modelo, ano, combustivel)
VALUES (1, 'C14 do Costa', 'Chevrolet C14', 1964, 'gasolina');
