/**
 * Dados da C14 do Costa + histórico de manutenção.
 *
 * GET   /api/vehicle             → dados (sempre row id=1)
 * PATCH /api/vehicle             → atualiza campos
 *
 * GET   /api/vehicle/maintenance              → lista trocas
 * POST  /api/vehicle/maintenance              → adiciona troca
 * PATCH /api/vehicle/maintenance/:id
 * DELETE /api/vehicle/maintenance/:id
 *
 * GET   /api/vehicle/maintenance/upcoming     → calcula próximas trocas baseado em durabilidade
 */

const express = require('express');
const router = express.Router();
const db = require('../db');

const VEHICLE_FIELDS = [
  'apelido','modelo','ano','placa','chassi','motor','cor','combustivel',
  'km_atual','km_atual_at','foto_url',
  'pressao_pneu_dianteiro','pressao_pneu_traseiro',
  'vencimento_ipva','vencimento_seguro','observacoes',
];
const MAINT_FIELDS = ['kind','peca','marca','km','data','durabilidade_km','durabilidade_meses','valor','fornecedor','notas','foto_url'];

router.get('/', async (req, res) => {
  try {
    const r = await db.query('SELECT * FROM vehicle WHERE id = 1');
    return res.json({ vehicle: r.rows[0] || null });
  } catch (e) { return res.status(500).json({ error: e.message }); }
});

router.patch('/', async (req, res) => {
  const fields = []; const params = [];
  for (const k of VEHICLE_FIELDS) {
    if (req.body[k] !== undefined) { fields.push(`${k} = ?`); params.push(req.body[k]); }
  }
  if (fields.length === 0) return res.status(400).json({ error: 'nenhum campo' });
  fields.push('updated_at = ?'); params.push(new Date().toISOString());
  try {
    await db.query(`UPDATE vehicle SET ${fields.join(', ')} WHERE id = 1`, params);
    const r = await db.query('SELECT * FROM vehicle WHERE id = 1');
    return res.json({ vehicle: r.rows[0] });
  } catch (e) { return res.status(500).json({ error: e.message }); }
});

router.get('/maintenance', async (req, res) => {
  try {
    const r = await db.query('SELECT * FROM maintenance_logs ORDER BY data DESC, id DESC LIMIT 200');
    return res.json({ logs: r.rows });
  } catch (e) { return res.status(500).json({ error: e.message }); }
});

router.post('/maintenance', async (req, res) => {
  const b = req.body || {};
  if (!b.kind || !b.peca || !b.data) {
    return res.status(400).json({ error: 'kind, peca e data obrigatórios' });
  }
  try {
    const r = await db.query(
      `INSERT INTO maintenance_logs (kind, peca, marca, km, data, durabilidade_km, durabilidade_meses, valor, fornecedor, notas, foto_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      MAINT_FIELDS.map(f => b[f] ?? null)
    );
    return res.status(201).json({ ok: true, id: r.lastInsertRowid });
  } catch (e) { return res.status(500).json({ error: e.message }); }
});

router.patch('/maintenance/:id', async (req, res) => {
  const fields = []; const params = [];
  for (const k of MAINT_FIELDS) {
    if (req.body[k] !== undefined) { fields.push(`${k} = ?`); params.push(req.body[k]); }
  }
  if (fields.length === 0) return res.status(400).json({ error: 'nenhum campo' });
  params.push(req.params.id);
  try {
    await db.query(`UPDATE maintenance_logs SET ${fields.join(', ')} WHERE id = ?`, params);
    return res.json({ ok: true });
  } catch (e) { return res.status(500).json({ error: e.message }); }
});

router.delete('/maintenance/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM maintenance_logs WHERE id = ?', [req.params.id]);
    return res.json({ ok: true });
  } catch (e) { return res.status(500).json({ error: e.message }); }
});

/* Calcula próximas trocas baseadas em durabilidade da última troca por kind */
router.get('/maintenance/upcoming', async (req, res) => {
  try {
    const veh = await db.query('SELECT km_atual FROM vehicle WHERE id = 1');
    const kmAtual = veh.rows[0]?.km_atual || null;
    /* Pega a última troca de cada kind */
    const r = await db.query(`
      SELECT m.* FROM maintenance_logs m
      INNER JOIN (SELECT kind, MAX(id) AS max_id FROM maintenance_logs GROUP BY kind) x
        ON x.max_id = m.id
      ORDER BY m.data DESC
    `);
    const today = new Date();
    const upcoming = r.rows.map(log => {
      const status = computeStatus(log, kmAtual, today);
      return { ...log, ...status };
    });
    return res.json({ upcoming, km_atual: kmAtual });
  } catch (e) { return res.status(500).json({ error: e.message }); }
});

function computeStatus(log, kmAtual, today) {
  const out = { precisa_trocar: false, motivo: null };
  /* Por km */
  if (log.durabilidade_km && kmAtual && log.km) {
    const rodados = kmAtual - log.km;
    if (rodados >= log.durabilidade_km) {
      out.precisa_trocar = true;
      out.motivo = `${rodados} km rodados desde a última troca (limite ${log.durabilidade_km})`;
    }
  }
  /* Por meses */
  if (!out.precisa_trocar && log.durabilidade_meses && log.data) {
    const trocaDate = new Date(log.data + 'T00:00:00');
    const diffMonths = (today - trocaDate) / (1000 * 60 * 60 * 24 * 30.44);
    if (diffMonths >= log.durabilidade_meses) {
      out.precisa_trocar = true;
      out.motivo = `${Math.round(diffMonths)} meses desde a última troca (limite ${log.durabilidade_meses})`;
    }
  }
  return out;
}

module.exports = router;
