const express = require('express');
const { pool } = require('./db');
const { apiKeyAuth } = require('./auth');
const router = express.Router();

const SLA_HOURS = { Baixa: { first: 8, resolve: 72 }, Média: { first: 4, resolve: 48 }, Alta: { first: 2, resolve: 24 }, Crítica: { first: 0.5, resolve: 4 } };

function calcSLA(ticket) {
  if (ticket.status === 'Resolvido' || ticket.status === 'Fechado') return { label: 'Cumprido', pct: 100 };
  const rules = SLA_HOURS[ticket.priority] || SLA_HOURS['Média'];
  const elapsed = (Date.now() - new Date(ticket.created_at)) / 3600000;
  const pct = Math.min(100, Math.round(elapsed / rules.resolve * 100));
  const remaining = rules.resolve - elapsed;
  if (pct >= 100) return { label: 'Violado', pct: 100, remaining_hours: Math.round(remaining * 10) / 10 };
  if (pct >= 80) return { label: 'Em risco', pct, remaining_hours: Math.round(remaining * 10) / 10 };
  return { label: 'No prazo', pct, remaining_hours: Math.round(remaining * 10) / 10 };
}

// GET /api/v1/tickets
router.get('/', apiKeyAuth, async (req, res) => {
  try {
    const { status, priority, agent_id, category_id, page = 1, limit = 100 } = req.query;
    let where = [];
    let params = [];
    let i = 1;
    if (status) { where.push(`t.status = $${i++}`); params.push(status); }
    if (priority) { where.push(`t.priority = $${i++}`); params.push(priority); }
    if (agent_id) { where.push(`t.agent_id = $${i++}`); params.push(agent_id); }
    if (category_id) { where.push(`t.category_id = $${i++}`); params.push(category_id); }
    const whereStr = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const offset = (page - 1) * limit;

    const result = await pool.query(`
      SELECT t.*, a.name as agent_name, a.email as agent_email, c.name as category_name
      FROM tickets t
      LEFT JOIN agents a ON t.agent_id = a.id
      LEFT JOIN categories c ON t.category_id = c.id
      ${whereStr}
      ORDER BY t.created_at DESC
      LIMIT $${i++} OFFSET $${i++}
    `, [...params, limit, offset]);

    const tickets = result.rows.map(t => ({ ...t, sla: calcSLA(t) }));
    const countResult = await pool.query(`SELECT COUNT(*) FROM tickets t ${whereStr}`, params);

    res.json({ tickets, total: parseInt(countResult.rows[0].count), page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/tickets/metrics
router.get('/metrics', apiKeyAuth, async (req, res) => {
  try {
    const [byStatus, byPriority, byCat, byAgent, total] = await Promise.all([
      pool.query("SELECT status, COUNT(*) as count FROM tickets GROUP BY status"),
      pool.query("SELECT priority, COUNT(*) as count FROM tickets GROUP BY priority"),
      pool.query("SELECT c.name as category, COUNT(*) as count FROM tickets t LEFT JOIN categories c ON t.category_id = c.id GROUP BY c.name"),
      pool.query("SELECT a.name as agent, COUNT(*) as count FROM tickets t LEFT JOIN agents a ON t.agent_id = a.id WHERE t.status IN ('Aberto','Pendente') GROUP BY a.name"),
      pool.query("SELECT COUNT(*) as total FROM tickets"),
    ]);

    // SLA
    const all = await pool.query("SELECT priority, status, created_at FROM tickets");
    const slaStats = { ok: 0, at_risk: 0, breached: 0, fulfilled: 0 };
    all.rows.forEach(t => {
      const s = calcSLA(t).label;
      if (s === 'Cumprido') slaStats.fulfilled++;
      else if (s === 'Violado') slaStats.breached++;
      else if (s === 'Em risco') slaStats.at_risk++;
      else slaStats.ok++;
    });

    res.json({
      total: parseInt(total.rows[0].total),
      by_status: byStatus.rows,
      by_priority: byPriority.rows,
      by_category: byCat.rows,
      by_agent: byAgent.rows,
      sla: slaStats,
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/tickets/export
router.get('/export', apiKeyAuth, async (req, res) => {
  try {
    const { format = 'json' } = req.query;
    const result = await pool.query(`
      SELECT t.id, t.subject, t.requester_name, t.requester_email, t.priority, t.status,
             c.name as category, a.name as agent, t.created_at, t.resolved_at, t.updated_at
      FROM tickets t
      LEFT JOIN agents a ON t.agent_id = a.id
      LEFT JOIN categories c ON t.category_id = c.id
      ORDER BY t.created_at DESC
    `);
    const tickets = result.rows.map(t => ({ ...t, sla_status: calcSLA(t).label }));

    if (format === 'csv') {
      const headers = ['ID','Assunto','Solicitante','E-mail','Prioridade','Status','Categoria','Agente','SLA','Criado em','Resolvido em'];
      const rows = tickets.map(t => [
        t.id, `"${(t.subject||'').replace(/"/g,'""')}"`, `"${t.requester_name||''}"`,
        t.requester_email||'', t.priority, t.status, t.category||'', t.agent||'',
        t.sla_status, t.created_at ? new Date(t.created_at).toLocaleString('pt-BR') : '',
        t.resolved_at ? new Date(t.resolved_at).toLocaleString('pt-BR') : ''
      ]);
      const csv = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="helpdesk_chamados.csv"');
      return res.send(csv);
    }

    res.json({ tickets, exported_at: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/tickets/:id
router.get('/:id', apiKeyAuth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT t.*, a.name as agent_name, c.name as category_name
      FROM tickets t
      LEFT JOIN agents a ON t.agent_id = a.id
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.id = $1
    `, [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Chamado não encontrado.' });

    const history = await pool.query('SELECT * FROM ticket_history WHERE ticket_id = $1 ORDER BY created_at ASC', [req.params.id]);
    const ticket = { ...result.rows[0], history: history.rows, sla: calcSLA(result.rows[0]) };
    res.json(ticket);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/tickets
router.post('/', apiKeyAuth, async (req, res) => {
  try {
    const { subject, description, requester_name, requester_email, priority = 'Média', category_id, agent_id } = req.body;
    if (!subject || !requester_name) return res.status(400).json({ error: 'Assunto e solicitante são obrigatórios.' });

    const rules = SLA_HOURS[priority] || SLA_HOURS['Média'];
    const now = new Date();
    const sla_first = new Date(now.getTime() + rules.first * 3600000);
    const sla_resolve = new Date(now.getTime() + rules.resolve * 3600000);

    const result = await pool.query(`
      INSERT INTO tickets (subject, description, requester_name, requester_email, priority, category_id, agent_id, sla_first_response, sla_resolve_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *
    `, [subject, description, requester_name, requester_email, priority, category_id || null, agent_id || null, sla_first, sla_resolve]);

    const ticket = result.rows[0];
    await pool.query(`INSERT INTO ticket_history (ticket_id, agent_name, action, comment) VALUES ($1,$2,$3,$4)`,
      [ticket.id, 'Sistema', 'created', 'Chamado criado.']);
    await pool.query(`INSERT INTO notifications (type, message, ticket_id) VALUES ($1,$2,$3)`,
      ['new_ticket', `Novo chamado criado: #${ticket.id} ${subject}`, ticket.id]);

    res.status(201).json({ ...ticket, sla: calcSLA(ticket) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/v1/tickets/:id
router.patch('/:id', apiKeyAuth, async (req, res) => {
  try {
    const { subject, description, priority, status, category_id, agent_id, comment } = req.body;
    const existing = await pool.query('SELECT * FROM tickets WHERE id = $1', [req.params.id]);
    if (!existing.rows.length) return res.status(404).json({ error: 'Chamado não encontrado.' });

    const t = existing.rows[0];
    const updates = [];
    const params = [];
    let i = 1;

    if (subject) { updates.push(`subject=$${i++}`); params.push(subject); }
    if (description !== undefined) { updates.push(`description=$${i++}`); params.push(description); }
    if (priority) { updates.push(`priority=$${i++}`); params.push(priority); }
    if (status) {
      updates.push(`status=$${i++}`); params.push(status);
      if ((status === 'Resolvido' || status === 'Fechado') && t.status !== status) {
        updates.push(`resolved_at=$${i++}`); params.push(new Date());
      }
      await pool.query(`INSERT INTO ticket_history (ticket_id, agent_name, action, old_value, new_value) VALUES ($1,$2,$3,$4,$5)`,
        [t.id, req.user?.name || 'Sistema', 'status_changed', t.status, status]);
    }
    if (category_id !== undefined) { updates.push(`category_id=$${i++}`); params.push(category_id); }
    if (agent_id !== undefined) { updates.push(`agent_id=$${i++}`); params.push(agent_id); }
    updates.push(`updated_at=$${i++}`); params.push(new Date());

    if (updates.length) {
      params.push(req.params.id);
      await pool.query(`UPDATE tickets SET ${updates.join(',')} WHERE id=$${i}`, params);
    }
    if (comment) {
      await pool.query(`INSERT INTO ticket_history (ticket_id, agent_name, action, comment) VALUES ($1,$2,$3,$4)`,
        [t.id, req.user?.name || 'Sistema', 'commented', comment]);
    }

    const updated = await pool.query('SELECT * FROM tickets WHERE id = $1', [req.params.id]);
    res.json({ ...updated.rows[0], sla: calcSLA(updated.rows[0]) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/tickets/:id/history
router.get('/:id/history', apiKeyAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM ticket_history WHERE ticket_id = $1 ORDER BY created_at ASC', [req.params.id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
