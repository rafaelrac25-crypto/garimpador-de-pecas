/* Auto-detecta ambiente: SQLite local em dev, Postgres Neon em prod.
   API mínima compatível com o uso do projeto: query(sql, params). */

const isProduction = !!process.env.DATABASE_URL;

let dbImpl;
if (isProduction) {
  const { neon } = require('@neondatabase/serverless');
  const sql = neon(process.env.DATABASE_URL);
  dbImpl = {
    async query(text, params = []) {
      /* neon() retorna função chamada com tagged template OU com (text, params) */
      const rows = await sql(text, params);
      return { rows };
    },
  };
  console.log('[db] usando Postgres Neon (prod)');
} else {
  /* Node 22+ tem `node:sqlite` built-in (experimental mas estável o bastante).
     Eliminamos dependência nativa (better-sqlite3 exige Python+VS Build Tools
     no Windows). API quase idêntica. */
  const { DatabaseSync } = require('node:sqlite');
  const path = require('path');
  const fs = require('fs');
  const dataDir = path.join(__dirname, '..', '..', 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  const sqliteDb = new DatabaseSync(path.join(dataDir, 'garimpador.db'));
  /* Detecta DDL (CREATE/DROP/ALTER) — `exec()` aceita múltiplos statements
     e não tem placeholders. SELECT usa prepare().all(); INSERT/UPDATE/DELETE
     usa prepare().run(). */
  function isDDL(sql) { return /^\s*(CREATE|DROP|ALTER|BEGIN|COMMIT)\b/i.test(sql); }
  function isSelect(sql) { return /^\s*SELECT\b/i.test(sql); }
  dbImpl = {
    async query(text, params = []) {
      try {
        if (isDDL(text) && (!params || params.length === 0)) {
          sqliteDb.exec(text);
          return { rows: [] };
        }
        const stmt = sqliteDb.prepare(text);
        if (isSelect(text)) {
          const rows = stmt.all(...params);
          return { rows };
        }
        const info = stmt.run(...params);
        return { rows: [], rowCount: info.changes, lastInsertRowid: info.lastInsertRowid };
      } catch (err) {
        throw err;
      }
    },
    raw: sqliteDb,
  };
  console.log('[db] usando SQLite (node:sqlite built-in) em modo dev');
}

module.exports = dbImpl;
