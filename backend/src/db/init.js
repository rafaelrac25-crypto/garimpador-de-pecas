/* Roda as migrations iniciais do schema. Idempotente — pode rodar várias vezes. */

const fs = require('fs');
const path = require('path');
const db = require('./index');

async function init() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
  /* Quebra em statements (SQLite não aceita múltiplos no mesmo prepare) */
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s && !s.startsWith('--'));
  for (const stmt of statements) {
    try {
      await db.query(stmt);
    } catch (e) {
      console.warn('[db:init] statement falhou (continuando):', e.message.slice(0, 100));
    }
  }
  console.log('[db:init] schema aplicado');
}

if (require.main === module) {
  init().then(() => process.exit(0)).catch(err => {
    console.error('[db:init] erro fatal:', err);
    process.exit(1);
  });
}

module.exports = init;
