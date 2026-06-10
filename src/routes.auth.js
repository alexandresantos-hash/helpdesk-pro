const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('./db');
const router = express.Router();

// POST /auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'E-mail e senha obrigatórios.' });

    const result = await pool.query('SELECT * FROM agents WHERE email = $1 AND active = true', [email]);
    if (result.rows.length === 0) return res.status(401).json({ error: 'Credenciais inválidas.' });

    const agent = result.rows[0];
    const valid = await bcrypt.compare(password, agent.password_hash);
    if (!valid) return res.status(401).json({ error: 'Credenciais inválidas.' });

    const token = jwt.sign(
      { id: agent.id, email: agent.email, name: agent.name, role: agent.role },
      process.env.JWT_SECRET || 'secret_dev',
      { expiresIn: '12h' }
    );

    res.json({ token, agent: { id: agent.id, name: agent.name, email: agent.email, role: agent.role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
