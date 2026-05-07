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
  const Database = require('better-sqlite3');
  const path = require('path');
  const fs = require('fs');
  const dataDir = path.join(__dirname, '..', '..', 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  const sqliteDb = new Database(path.join(dataDir, 'garimpador.db'));
  dbImpl = {
    async query(text, params = []) {
      /* better-sqlite3 é síncrono — embrulha em Promise pra manter contrato */
      const isSelect = /^\s*SELECT/i.test(text);
      try {
        const stmt = sqliteDb.prepare(text);
        if (isSelect) {
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
  console.log('[db] usando SQLite local (dev)');
}

module.exports = dbImpl;
