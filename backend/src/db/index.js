/* Auto-detecta ambiente:
   - DATABASE_URL setada → Postgres Neon (prod recomendado)
   - Vercel/serverless sem DATABASE_URL → in-memory stub (dados efêmeros,
     resetam a cada cold start — OK pro MVP enquanto não cria Neon)
   - Local com node:sqlite → SQLite em arquivo (dev)
   API mínima: query(sql, params). */

const hasNeon = !!process.env.DATABASE_URL;
const isVercel = !!process.env.VERCEL;

let dbImpl;
if (hasNeon) {
  const { neon } = require('@neondatabase/serverless');
  const sql = neon(process.env.DATABASE_URL);
  dbImpl = {
    async query(text, params = []) {
      const rows = await sql(text, params);
      return { rows };
    },
  };
  console.log('[db] usando Postgres Neon (prod)');
} else if (isVercel) {
  /* Vercel sem DATABASE_URL → fallback in-memory.
     Implementação minimal: aceita CREATEs (no-op), guarda inserts/selects em Map.
     Pra MVP: histórico de busca, favoritos, vehicle, alerts funcionam por
     instância. Dados se perdem em cold start.
     Quando Rafa criar Neon, basta setar DATABASE_URL e a instância acima toma. */
  const tables = new Map();
  function getTable(name) {
    if (!tables.has(name)) tables.set(name, { rows: [], autoId: 1 });
    return tables.get(name);
  }
  function parseTableName(sql, prefix) {
    const m = sql.match(new RegExp(prefix + '\\s+(?:OR\\s+IGNORE\\s+|OR\\s+REPLACE\\s+)?(?:INTO\\s+)?(\\w+)', 'i'));
    return m ? m[1] : null;
  }
  /* Pré-popula vehicle row 1 (mesmo seed do schema.sql) */
  getTable('vehicle').rows.push({ id: 1, apelido: 'C14 do Costa', modelo: 'Chevrolet C14', ano: 1964, combustivel: 'gasolina' });

  dbImpl = {
    async query(text, params = []) {
      const sql = String(text).trim();
      if (/^\s*CREATE/i.test(sql) || /^\s*INSERT\s+OR\s+IGNORE.*vehicle/i.test(sql)) return { rows: [] };
      if (/^\s*SELECT/i.test(sql)) {
        const tname = (sql.match(/FROM\s+(\w+)/i) || [])[1];
        if (!tname) return { rows: [] };
        const t = getTable(tname);
        /* Suporta SELECT COUNT(*) AS c */
        if (/COUNT\(\*\)/i.test(sql)) {
          let rows = t.rows;
          if (/WHERE\s+read_at\s+IS\s+NULL/i.test(sql)) rows = rows.filter(r => !r.read_at);
          if (/WHERE\s+resolved_at\s+IS\s+NULL/i.test(sql)) rows = rows.filter(r => !r.resolved_at);
          return { rows: [{ c: rows.length }] };
        }
        let rows = [...t.rows];
        /* WHERE id = ? */
        const whereId = sql.match(/WHERE\s+id\s*=\s*\?/i);
        if (whereId) rows = rows.filter(r => String(r.id) === String(params[0]));
        /* ORDER BY created_at|data DESC */
        if (/ORDER BY (created_at|data)/i.test(sql)) rows.sort((a, b) => String(b.created_at || b.data || '').localeCompare(String(a.created_at || a.data || '')));
        /* LIMIT */
        const lm = sql.match(/LIMIT\s+(\d+|\?)/i);
        if (lm) {
          const n = lm[1] === '?' ? Number(params[params.length - 1]) : Number(lm[1]);
          if (Number.isFinite(n)) rows = rows.slice(0, n);
        }
        return { rows };
      }
      if (/^\s*INSERT/i.test(sql)) {
        const tname = parseTableName(sql, 'INSERT');
        if (!tname) return { rows: [] };
        const t = getTable(tname);
        const cols = (sql.match(/\(([^)]+)\)\s*VALUES/i) || [, ''])[1].split(',').map(s => s.trim());
        const obj = { id: t.autoId++ };
        cols.forEach((c, i) => { obj[c] = params[i]; });
        if (!obj.created_at) obj.created_at = new Date().toISOString();
        t.rows.push(obj);
        return { rows: [], rowCount: 1, lastInsertRowid: obj.id };
      }
      if (/^\s*UPDATE/i.test(sql)) {
        const tname = parseTableName(sql, 'UPDATE');
        if (!tname) return { rows: [] };
        return { rows: [], rowCount: 0 };
      }
      if (/^\s*DELETE/i.test(sql)) {
        const tname = parseTableName(sql, 'DELETE\\s+FROM');
        if (!tname) return { rows: [] };
        const t = getTable(tname);
        const whereId = sql.match(/WHERE\s+id\s*=\s*\?/i);
        if (whereId) {
          const before = t.rows.length;
          t.rows = t.rows.filter(r => String(r.id) !== String(params[0]));
          return { rows: [], rowCount: before - t.rows.length };
        }
        return { rows: [] };
      }
      return { rows: [] };
    },
  };
  console.warn('[db] sem DATABASE_URL em prod — usando stub in-memory (dados efêmeros). Configure DATABASE_URL pra persistência.');
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
