const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function initDB() {
  try {
    const sql = fs.readFileSync(path.join(__dirname, 'database.sql'), 'utf8');
    await pool.query(sql);
    console.log('Banco de dados inicializado com sucesso.');

    // Cria admin padrão se não existir
    const bcrypt = require('bcryptjs');
    const email = process.env.ADMIN_EMAIL || 'admin@helpdesk.com';
    const password = process.env.ADMIN_PASSWORD || 'admin123';
    const existing = await pool.query('SELECT id FROM agents WHERE email = $1', [email]);
    if (existing.rows.length === 0) {
      const hash = await bcrypt.hash(password, 10);
      await pool.query(
        'INSERT INTO agents (name, email, password_hash, role) VALUES ($1, $2, $3, $4)',
        ['Administrador', email, hash, 'admin']
      );
      console.log(`Admin criado: ${email}`);
    }
  } catch (err) {
    console.error('Erro ao inicializar banco:', err.message);
  }
}

module.exports = { pool, initDB };
