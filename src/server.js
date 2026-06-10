require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDB, pool } = require('./db');
const { apiKeyAuth } = require('./auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Rotas da API
app.use('/auth', require('./routes.auth'));
app.use('/api/v1/tickets', require('./routes.tickets'));

// Agentes
app.get('/api/v1/agents', apiKeyAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, email, role, active, created_at FROM agents WHERE active = true ORDER BY name');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Categorias
app.get('/api/v1/categories', apiKeyAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM categories WHERE active = true ORDER BY name');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/v1/categories', apiKeyAuth, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Nome obrigatório.' });
    const result = await pool.query('INSERT INTO categories (name) VALUES ($1) ON CONFLICT (name) DO NOTHING RETURNING *', [name]);
    res.status(201).json(result.rows[0] || { message: 'Categoria já existe.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Notificações
app.get('/api/v1/notifications', apiKeyAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM notifications ORDER BY created_at DESC LIMIT 50');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.patch('/api/v1/notifications/:id/read', apiKeyAuth, async (req, res) => {
  try {
    await pool.query('UPDATE notifications SET read = true WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.patch('/api/v1/notifications/read-all', apiKeyAuth, async (req, res) => {
  try {
    await pool.query('UPDATE notifications SET read = true');
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Health check (Railway usa isso para verificar se o app está vivo)
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// SPA fallback — serve o index.html para qualquer rota não reconhecida
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Inicializa banco e sobe servidor
initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`HelpDesk Pro rodando na porta ${PORT}`);
    console.log(`Ambiente: ${process.env.NODE_ENV || 'development'}`);
  });
});
