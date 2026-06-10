const jwt = require('jsonwebtoken');

// Autenticação via API Key (para Power BI e integrações)
function apiKeyAuth(req, res, next) {
  const key = req.headers['x-api-key'] || req.query.api_key;
  if (key && key === process.env.API_KEY) return next();

  // Tenta JWT se não tiver API Key
  return jwtAuth(req, res, next);
}

// Autenticação via JWT (para o app web)
function jwtAuth(req, res, next) {
  const auth = req.headers['authorization'];
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Não autorizado. Forneça API Key ou token JWT.' });
  }
  try {
    const token = auth.split(' ')[1];
    req.user = jwt.verify(token, process.env.JWT_SECRET || 'secret_dev');
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido ou expirado.' });
  }
}

module.exports = { apiKeyAuth, jwtAuth };
