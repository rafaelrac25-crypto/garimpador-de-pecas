/* Roda as migrations iniciais do schema. Idempotente.
   Retorna { ok, applied, failed } pra diagnóstico. */

const fs = require('fs');
const path = require('path');
const db = require('./index');

async function init() {
  /* Postgres (Neon) usa schema-postgres.sql; SQLite/stub usa schema.sql */
  const isPostgres = !!process.env.DATABASE_URL;
  const file = isPostgres ? 'schema-postgres.sql' : 'schema.sql';
  const sqlPath = path.join(__dirname, file);
  if (!fs.existsSync(sqlPath)) {
    return { ok: false, error: `schema file not found: ${sqlPath}`, dialect: isPostgres ? 'postgres' : 'sqlite' };
  }
  const sql = fs.readFileSync(sqlPath, 'utf-8');
  /* Remove comentários por linha antes de splitar por ';' */
  const cleaned = sql
    .split('\n')
    .map(line => {
      const idx = line.indexOf('--');
      return idx >= 0 ? line.slice(0, idx) : line;
    })
    .join('\n');
  const statements = cleaned
    .split(';')
    .map(s => s.trim())
    .filter(Boolean);

  const applied = [];
  const failed = [];
  for (const stmt of statements) {
    try {
      await db.query(stmt);
      applied.push(stmt.slice(0, 60).replace(/\s+/g, ' '));
    } catch (e) {
      failed.push({
        stmt: stmt.slice(0, 100).replace(/\s+/g, ' '),
        error: e.message.slice(0, 200),
      });
      console.warn('[db:init] statement falhou:', e.message.slice(0, 150));
    }
  }
  console.log(`[db:init] ${applied.length} ok, ${failed.length} falharam`);
  return { ok: failed.length === 0, applied: applied.length, failed, dialect: isPostgres ? 'postgres' : 'sqlite' };
}

if (require.main === module) {
  init().then((r) => { console.log(r); process.exit(r.ok ? 0 : 1); }).catch(err => {
    console.error('[db:init] erro fatal:', err);
    process.exit(1);
  });
}

module.exports = init;
