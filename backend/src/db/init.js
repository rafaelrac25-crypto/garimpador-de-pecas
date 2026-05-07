/* Roda as migrations iniciais do schema. Idempotente — pode rodar várias vezes. */

const fs = require('fs');
const path = require('path');
const db = require('./index');

async function init() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
  /* Remove comentários (linhas começando com --) ANTES de splitar por ';'.
     Bug anterior: stmt que começava com cabeçalho '-- Garimpador...' era inteiro
     descartado pelo filter, derrubando o CREATE TABLE colado depois. */
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
